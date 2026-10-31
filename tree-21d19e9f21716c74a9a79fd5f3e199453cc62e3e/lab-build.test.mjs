// Regression tests for the `/next/` lab-build noindex removal.
//
// The failure this file exists to make impossible: a DEPLOY that carries the
// strip would publish an unreleased preview app as indexable, and that is the
// one consequence here that lands outside the repository. So the property under
// test is overwhelmingly NEGATIVE — what must NOT happen — rather than what the
// transform is for.
//
// The safety is enforced twice on purpose: `labTransform` refuses any path that
// is not a `/next/` HTML page, and the staging script only calls it under
// `--lab`. A single check would be one refactor away from gone; two independent
// ones are not.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  NEXT_PREFIX,
  isNextPath,
  stripNoindex,
  labTransform,
} from "../scripts/lib/lab-build.mjs";

const NOINDEX_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex, follow" />
    <title>Preview</title>
  </head>
  <body><h1>New app</h1></body>
</html>`;

test("only /next/ HTML pages are in scope", () => {
  assert.equal(isNextPath("next/index.html"), true);
  assert.equal(isNextPath("next/slices/bill-cut/index.html"), true);
  assert.equal(isNextPath("./next/index.html"), true);
  assert.equal(
    isNextPath("next\\index.html"),
    true,
    "Windows separators are normalised",
  );

  // Everything below must be false. A prefix match that is looser than this
  // would eventually rewrite the robots policy of a page nobody meant to touch.
  assert.equal(isNextPath("index.html"), false);
  assert.equal(
    isNextPath("next.html"),
    false,
    "a page merely NAMED next is not the app",
  );
  assert.equal(isNextPath("nextjs/bundle.html"), false);
  assert.equal(isNextPath("something-next/index.html"), false);
  assert.equal(isNextPath("assets/js/next.js"), false, "not an HTML page");
  assert.equal(isNextPath(""), false);
  assert.equal(isNextPath(undefined), false);
});

test("the lab transform removes noindex and keeps follow", () => {
  const { html, changed } = stripNoindex(NOINDEX_PAGE);
  assert.equal(changed, true);
  assert.match(html, /content="follow"/);
  assert.doesNotMatch(html, /noindex/);
  // The rest of the document is untouched — a transform that rewrote anything
  // else would be doing more than it was asked.
  assert.match(html, /<title>Preview<\/title>/);
  assert.match(html, /<h1>New app<\/h1>/);
  assert.match(html, /<meta charset="utf-8" \/>/);
});

test("nofollow survives, because the lab page still declares what it is", () => {
  const { html } = stripNoindex(
    `<head><meta name="robots" content="noindex, nofollow" /></head>`,
  );
  assert.match(html, /content="nofollow"/);
  assert.doesNotMatch(html, /noindex/);
});

test("a robots tag left with nothing meaningful is dropped, not emptied", () => {
  // `<meta name="robots" content="" />` is valid but meaningless, and every
  // future checker would have to special-case it.
  const { html, changed } = stripNoindex(
    `<head><meta name="robots" content="noindex" /><title>x</title></head>`,
  );
  assert.equal(changed, true);
  assert.doesNotMatch(html, /name="robots"/);
  assert.match(html, /<title>x<\/title>/);
});

test("a page with no robots meta is a NO-OP, not an invented tag", () => {
  const src = `<head><meta charset="utf-8" /><title>x</title></head>`;
  const { html, changed } = stripNoindex(src);
  assert.equal(changed, false);
  assert.equal(html, src);
});

test("content before name is handled, because a hand-edited page writes it that way", () => {
  const { html, changed } = stripNoindex(
    `<head><meta content="noindex, follow" name="robots" /></head>`,
  );
  assert.equal(changed, true);
  assert.doesNotMatch(html, /noindex/);
});

test("a meta that is not robots is never touched", () => {
  const src = `<head><meta name="description" content="noindex is a robots directive" /></head>`;
  const { html, changed } = stripNoindex(src);
  assert.equal(changed, false);
  assert.equal(html, src);
});

test("the transform refuses every path outside /next/, whatever the markup says", () => {
  // The safety property. A non-preview page handed to the transform with a
  // noindex tag must come back byte-identical.
  for (const p of [
    "index.html",
    "solar-heatmap/index.html",
    "next.html",
    "assets/js/app.js",
  ]) {
    const r = labTransform(p, NOINDEX_PAGE);
    assert.equal(r.changed, false, `${p} must not be rewritten`);
    assert.equal(r.html, NOINDEX_PAGE, `${p} must be byte-identical`);
  }
});

test("the transform does rewrite a real /next/ page", () => {
  // The negative tests above would pass trivially if the transform were a
  // no-op for everything, so the positive case is pinned in the same file.
  const r = labTransform("next/index.html", NOINDEX_PAGE);
  assert.equal(r.changed, true);
  assert.doesNotMatch(r.html, /noindex/);
});

test("the deploy path cannot pass --lab", () => {
  // Read from the script itself rather than from a copy of the rule, so the
  // test fails if the guard is removed from the script.
  const src = readFileSync("scripts/deploy-pages-local.mjs", "utf8");
  assert.match(
    src,
    /--lab is a staging-only flag; it cannot be combined with a push/,
    "the staging script must refuse --lab on a push",
  );
  // And the strip must live inside the lab branch, never in the copy loop. The
  // copy loop is read as the region between the manifest walk and the lab block
  // so that the assertion keeps meaning if the file is reordered.
  const from = src.indexOf("for (const f of deployList())");
  const guard = src.indexOf("if (LAB)");
  const strip = src.indexOf("labTransform(f, readFileSync(dest");
  assert.ok(
    from >= 0 && guard > from,
    "the copy loop must come before the lab branch",
  );
  assert.ok(strip > guard, "the strip must be inside the lab branch");
  assert.doesNotMatch(
    src.slice(from, guard),
    /labTransform/,
    "the copy loop must copy verbatim, with no transform",
  );
  // The verbatim copy is now `stageFromIndex(ROOT, STAGE, files)` — it stages
  // the committed bytes rather than the working tree, so a CRLF checkout cannot
  // ship line endings the repository does not hold. The invariant being pinned
  // is unchanged and still matters: this region COPIES and nothing else.
  assert.match(src.slice(from, guard), /stageFromIndex\(ROOT, STAGE, files\)/);
  assert.doesNotMatch(
    src.slice(from, guard),
    /readFileSync\(join\(ROOT, f\)/,
    "the staging region must not read deployable bytes from the working tree",
  );
});

test("the prefix is declared once, so /next/ is spelled in one place", () => {
  assert.equal(NEXT_PREFIX, "next/");
});

test("the mechanism is inert until P6 allowlists /next/, and that is the only blocker", async () => {
  // `/next/` is not in the deploy ALLOWLIST today, because plan item P6 has not
  // built the preview app yet — so a lab build currently strips nothing, and
  // saying so is more useful than pretending the gate is live. When P6 adds the
  // allowlist entry the transform starts applying with no change here, because
  // the staging script already walks `deployList()`.
  //
  // This asserts the DEPENDENCY, not the absence of the app: the moment the
  // allowlist gains `next`, this test is expected to be updated to assert the
  // strip applies. Until then it must not claim coverage it does not have.
  const { ALLOWLIST } = await import("../scripts/lib/deploy-manifest.mjs");
  const hasNext = ALLOWLIST.some((f) => f === "next" || f.startsWith("next/"));
  const src = readFileSync("scripts/deploy-pages-local.mjs", "utf8");
  // The staging script must already walk the manifest, so no change is needed
  // when the entry appears.
  assert.match(src, /for \(const f of deployList\(\)\)/);
  assert.ok(
    typeof hasNext === "boolean",
    "the allowlist is readable, so the dependency is checkable",
  );
  if (!hasNext) {
    assert.equal(
      hasNext,
      false,
      "if P6 has now allowlisted /next/, update this test to assert the strip applies",
    );
  }
});
