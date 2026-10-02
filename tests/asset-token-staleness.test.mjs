// The asset-stamp staleness gate in scripts/bump-asset-tokens.mjs.
//
// Why it exists. `/assets/*` is served `Cache-Control: immutable 1yr`, so an
// asset whose bytes changed under an unchanged `?v=` token is not delivered to
// any visitor who already has it cached. The checks that were already there
// proved the token was PRESENT and CONSISTENT; none asked whether it was still
// TRUE. A release could therefore merge, pass every gate, and reach first-time
// visitors only.
//
// The subtle part, and the reason these tests exist at all, is WHICH commit the
// check anchors on. `git log -S` matches a commit whenever that string's
// occurrence count changes — and a release that adds a new reference under an
// existing stamp does exactly that. Anchoring on the newest match points the
// check at the very release it is meant to catch, which then compares that
// release against itself and reports green. That was built and caught during
// implementation; the test below pins it so it cannot come back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  findStaleAssets,
  gitBlob,
  stampCommit,
} from "../scripts/lib/asset-tokens.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ── anchoring ────────────────────────────────────────────────────────────

test("stampCommit anchors on the OLDEST commit that introduced the stamp", () => {
  // Read the file rather than `git grep`: `?` is a regex quantifier, so an
  // unescaped `?v=` pattern matches nothing and yields an empty token.
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const toks = [
    ...new Set([...html.matchAll(/\?v=([0-9A-Za-z]+)/g)].map((m) => m[1])),
  ];
  assert.ok(toks.length >= 1, "index.html carries no ?v= token to test with");

  for (const t of toks) {
    const { sha, error } = stampCommit(ROOT, t);
    assert.equal(error, undefined, `stampCommit(${t}) errored: ${error}`);

    // Every commit whose occurrence count of the string changed.
    const touching = execFileSync(
      "git",
      [
        "log",
        `-S?v=${t}`,
        "--format=%H",
        "--",
        "index.html",
        "solar-heatmap",
        "about",
        "blog",
        "solar-calculator",
        "assets/js",
      ],
      { cwd: ROOT, encoding: "utf8" },
    )
      .trim()
      .split("\n");

    assert.equal(
      sha,
      touching[touching.length - 1],
      `stampCommit(${t}) returned ${sha}, expected the oldest of ${touching.join(",")}`,
    );
  }
});

test("a stamp that no commit ever introduced reports an error, not a pass", () => {
  const { sha, error } = stampCommit(ROOT, "19990101z");
  assert.equal(sha, undefined);
  assert.match(error, /no commit in history ever introduced/);
});

// ── classification ───────────────────────────────────────────────────────
// Pure: getBlob is injected, so these assert the RULE, not git.

const blobs = (table) => (rev, p) => table[rev]?.[p] ?? null;
const b = (s) => Buffer.from(s);

test("an asset that changed since the setter is reported stale", () => {
  const getBlob = blobs({
    setter: { "a.js": b("v1"), "b.js": b("same") },
    HEAD: { "a.js": b("v2"), "b.js": b("same") },
  });
  assert.deepEqual(findStaleAssets(["a.js", "b.js"], "setter", getBlob), [
    "a.js",
  ]);
});

test("an asset that did not change is not reported", () => {
  const getBlob = blobs({
    setter: { "a.js": b("v1") },
    HEAD: { "a.js": b("v1") },
  });
  assert.deepEqual(findStaleAssets(["a.js"], "setter", getBlob), []);
});

test("an asset NEW since the setter is exempt — its URL cannot be cached", () => {
  // This is the case that shipped: #173 added turnstile-client.js referenced
  // under the pre-existing 20260929a. Nothing could have been holding that URL.
  const getBlob = blobs({ setter: {}, HEAD: { "new.js": b("v1") } });
  assert.deepEqual(findStaleAssets(["new.js"], "setter", getBlob), []);
});

test("an asset deleted since the setter is exempt — nothing references it", () => {
  const getBlob = blobs({ setter: { "gone.js": b("v1") }, HEAD: {} });
  assert.deepEqual(findStaleAssets(["gone.js"], "setter", getBlob), []);
});

test("results are sorted, so the message is stable run to run", () => {
  const getBlob = blobs({
    setter: { "z.js": b("v1"), "a.js": b("v1"), "m.js": b("v1") },
    HEAD: { "z.js": b("v2"), "a.js": b("v2"), "m.js": b("v2") },
  });
  assert.deepEqual(
    findStaleAssets(["z.js", "m.js", "a.js"], "setter", getBlob),
    ["a.js", "m.js", "z.js"],
  );
});

// ── against the real repository ──────────────────────────────────────────

test("the gate detects the four stale assets this change was written for", () => {
  // Anchored on the stamp that was live when the staleness was found.
  const setter = "64a6d664e13ca727e2f872590aa413fad2ec49eb";
  const stale = findStaleAssets(
    [
      "assets/js/chat.js",
      "assets/js/shared/i18n.js",
      "assets/js/shared/locales.js",
      "assets/js/sizing/ui.js",
      "assets/js/sizing/validate.js",
      "assets/js/turnstile-client.js",
    ],
    setter,
    (rev, p) => gitBlob(ROOT, rev, p),
  );
  // chat/i18n/locales/ui changed under an unchanged stamp. validate.js did not,
  // and turnstile-client.js is new since the setter, so both are exempt.
  assert.deepEqual(stale, [
    "assets/js/chat.js",
    "assets/js/shared/i18n.js",
    "assets/js/shared/locales.js",
    "assets/js/sizing/ui.js",
  ]);
});
