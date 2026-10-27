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
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  findStaleAssets,
  gitBlob,
  isShallow,
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
  assert.deepEqual(findStaleAssets(["a.js", "b.js"], "setter", getBlob), {
    stale: ["a.js"],
    unresolvable: [],
  });
});

test("an asset that did not change is not reported", () => {
  const getBlob = blobs({
    setter: { "a.js": b("v1") },
    HEAD: { "a.js": b("v1") },
  });
  assert.deepEqual(findStaleAssets(["a.js"], "setter", getBlob), {
    stale: [],
    unresolvable: [],
  });
});

test("an asset NEW since the setter is exempt — its URL cannot be cached", () => {
  // This is the case that shipped: #173 added turnstile-client.js referenced
  // under the pre-existing 20260929a. Nothing could have been holding that URL.
  const getBlob = blobs({ setter: {}, HEAD: { "new.js": b("v1") } });
  assert.deepEqual(findStaleAssets(["new.js"], "setter", getBlob), {
    stale: [],
    unresolvable: [],
  });
});

test("an asset that exists NOW but not at the setter is NOT unresolvable", () => {
  // The converse trap. "Absent somewhere" is not one condition: absent at the
  // SETTER is a brand-new file (exempt), absent at HEAD is a reference that
  // resolves to nothing (a hard failure). Treating both as "skip" made a
  // resolution bug indistinguishable from a clean run.
  const getBlob = blobs({ setter: {}, HEAD: { "new.js": b("v1") } });
  assert.deepEqual(
    findStaleAssets(["new.js"], "setter", getBlob).unresolvable,
    [],
  );
});

test("an asset GONE from HEAD is unresolvable, not silently skipped", () => {
  // Every path handed to findStaleAssets came from referencedAssets(), i.e.
  // something in the graph points at it. A missing blob at HEAD is therefore a
  // broken reference, a path escaping the repo, or an untracked file — never a
  // benign deletion, which is what the previous version assumed.
  const getBlob = blobs({ setter: { "gone.js": b("v1") }, HEAD: {} });
  assert.deepEqual(findStaleAssets(["gone.js"], "setter", getBlob), {
    stale: [],
    unresolvable: ["gone.js"],
  });
});

test("stale and unresolvable are classified independently and both sorted", () => {
  const getBlob = blobs({
    setter: {
      "z.js": b("v1"),
      "m.js": b("v1"),
      "q.js": b("v1"),
      "a.js": b("v1"),
    },
    HEAD: { "z.js": b("v2"), "m.js": b("v2"), "a.js": b("v2") },
  });
  // q.js has no blob at HEAD; the rest changed.
  assert.deepEqual(
    findStaleAssets(["z.js", "m.js", "q.js", "a.js"], "setter", getBlob),
    { stale: ["a.js", "m.js", "z.js"], unresolvable: ["q.js"] },
  );
});

test("results are sorted, so the message is stable run to run", () => {
  const getBlob = blobs({
    setter: { "z.js": b("v1"), "a.js": b("v1"), "m.js": b("v1") },
    HEAD: { "z.js": b("v2"), "a.js": b("v2"), "m.js": b("v2") },
  });
  assert.deepEqual(
    findStaleAssets(["z.js", "m.js", "a.js"], "setter", getBlob).stale,
    ["a.js", "m.js", "z.js"],
  );
});

// ── against the real repository ──────────────────────────────────────────

test("the gate detects the four stale assets this change was written for", () => {
  // Anchored on the stamp that was live when the staleness was found.
  const setter = "64a6d664e13ca727e2f872590aa413fad2ec49eb";
  const { stale, unresolvable } = findStaleAssets(
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
  assert.deepEqual(
    unresolvable,
    [],
    "every referenced path resolved at HEAD — a non-empty list is a broken reference",
  );
});

// ── the shallow-clone hole ───────────────────────────────────────────────
//
// This is the finding that mattered most, because it turned a safety gate into
// decoration with no output change at all. In a shallow clone HEAD is a grafted
// root, so `git log -S<stamp>` diffs it against the empty tree, finds exactly
// one commit, and returns HEAD. `findStaleAssets` then compares HEAD to HEAD,
// gets no stale assets, and the gate prints its normal green line — "42
// referenced assets verified" — having verified nothing. It does not throw, so
// catching the failure was never an option; the condition has to be tested first.
//
// Measured on a real `git clone --depth 1` before this guard existed: exit 0.

const git = (cwd, ...args) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });

function makeOrigin() {
  const dir = mkdtempSync(join(tmpdir(), "bec-shallow-origin-"));
  git(dir, "init", "-q", ".");
  writeFileSync(
    join(dir, "index.html"),
    '<script src="a.js?v=20260101a"></script>',
  );
  writeFileSync(join(dir, "a.js"), "v1\n");
  git(dir, "add", "-A");
  git(
    dir,
    "-c",
    "user.name=t",
    "-c",
    "user.email=t@e",
    "commit",
    "-q",
    "-m",
    "one",
  );
  writeFileSync(join(dir, "a.js"), "v2\n");
  git(dir, "add", "-A");
  git(
    dir,
    "-c",
    "user.name=t",
    "-c",
    "user.email=t@e",
    "commit",
    "-q",
    "-m",
    "two",
  );
  return dir;
}

test("a shallow clone is detected, and a full clone is not misreported as one", () => {
  assert.equal(
    isShallow(ROOT),
    false,
    "the test suite is running against a shallow checkout; the guard would make every other test here vacuous",
  );

  const origin = makeOrigin();
  const shallow = join(tmpdir(), `bec-shallow-${process.pid}-${Date.now()}`);
  // `--depth` is ignored for a plain local path; file:// is what honours it.
  git(tmpdir(), "clone", "-q", "--depth", "1", `file://${origin}`, shallow);
  try {
    assert.equal(isShallow(shallow), true);

    const { sha, error } = stampCommit(shallow, "20260101a");
    assert.equal(
      sha,
      undefined,
      "a shallow clone must not yield a setter commit",
    );
    assert.match(error, /shallow/);
    assert.match(error, /unshallow/);
  } finally {
    rmSync(shallow, { recursive: true, force: true });
    rmSync(origin, { recursive: true, force: true });
  }
});

test("the same history cloned in full does resolve the setter commit", () => {
  const origin = makeOrigin();
  const full = join(tmpdir(), `bec-full-${process.pid}-${Date.now()}`);
  git(tmpdir(), "clone", "-q", `file://${origin}`, full);
  try {
    assert.equal(isShallow(full), false);
    const { sha, error } = stampCommit(full, "20260101a", ["index.html"]);
    assert.equal(error, undefined, `full clone errored: ${error}`);
    assert.ok(sha, "a full clone must resolve the stamp's setter commit");
    // Two commits touched index.html, so the setter is the OLDER one.
    assert.equal(sha, git(full, "rev-list", "--max-parents=0", "HEAD").trim());
  } finally {
    rmSync(full, { recursive: true, force: true });
    rmSync(origin, { recursive: true, force: true });
  }
});

test("isShallow reports false rather than throwing outside a repository", () => {
  const dir = mkdtempSync(join(tmpdir(), "bec-not-a-repo-"));
  try {
    assert.equal(isShallow(dir), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
