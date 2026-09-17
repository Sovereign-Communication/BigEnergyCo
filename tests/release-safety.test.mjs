// Regression gates for the release-safety rules.
//
// Two independent guards share this logic (the local pre-push hook and the
// server-side Main audit workflow), so the definitions of "docs-only" and "came
// from a PR" are tested directly — if either drifts, one guard would start
// allowing what the other blocks.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DOC_PATTERNS,
  blockMessage,
  directPushVerdict,
  hasPrReference,
  isDocsOnly,
} from "../scripts/lib/release.mjs";

test("GATE: documentation paths may skip the PR", () => {
  assert.equal(isDocsOnly(["README.md"]), true);
  assert.equal(isDocsOnly(["docs/DEPLOY_RUNBOOK.md", "docs/INDEX.md"]), true);
  assert.equal(isDocsOnly(["drafts/01_ACTION_PLAN.md"]), true);
  assert.equal(isDocsOnly(["blog-drafts/thing.md"]), true);
  assert.equal(isDocsOnly(["LICENSE"]), true);
});

test("GATE: anything a user can load is NOT documentation", () => {
  for (const path of [
    ".gitignore",
    "package.json",
    "index.html",
    "sw.js",
    "_headers",
    "assets/site.css",
    "assets/js/sizing/ui.js",
    "tests/engine.test.mjs",
    ".github/workflows/test.yml",
    "scripts/check-seo.mjs",
    "sitemap.xml",
  ]) {
    assert.equal(
      isDocsOnly([path]),
      false,
      `${path} must require a PR: it changes what ships or how it is built`,
    );
  }
});

test("GATE: mixed pushes are not docs-only", () => {
  assert.equal(isDocsOnly(["README.md", "assets/js/sizing/ui.js"]), false);
  assert.equal(isDocsOnly(["docs/a.md", "package.json"]), false);
});

test("GATE: an empty change set is never treated as docs", () => {
  // A force-push or a bad range must fail closed, not sail through.
  assert.equal(isDocsOnly([]), false);
});

test("GATE: PR references are recognized in merge and squash subjects", () => {
  assert.equal(hasPrReference("Merge pull request #55 from x/y"), true);
  assert.equal(
    hasPrReference("polish: google-quality passes 1 + 2 — gates (#55)"),
    true,
  );
  assert.equal(hasPrReference("fix: something ( #7 )"), true);
  assert.equal(
    hasPrReference("fix: plain commit\n\nRefs: landed in (#55) after review"),
    false,
    "a PR number in the body is not proof the commit came from a PR",
  );
  assert.equal(hasPrReference("chore: bump tokens"), false);
  assert.equal(hasPrReference(""), false);
});

test("GATE: docs patterns do not accidentally cover code directories", () => {
  const codePaths = [
    "scripts/lib/gates.mjs",
    "assets/js/chat.js",
    "index.html",
  ];
  for (const p of codePaths)
    assert.equal(
      DOC_PATTERNS.some((rx) => rx.test(p)),
      false,
      `${p} matched a docs pattern`,
    );
});

test("GATE: the block message names the files and the way forward", () => {
  const msg = blockMessage("main", ["assets/js/sizing/ui.js", "package.json"]);
  assert.match(msg, /refusing a direct push to main/);
  assert.match(msg, /assets\/js\/sizing\/ui\.js/);
  assert.match(msg, /gh pr create --base main/);
  assert.match(msg, /Documentation-only changes/);
});

test("GATE: a docs-only range itself is judged without git", () => {
  // Only the classifier is exercised here; the git-backed path is covered by
  // the pre-push hook running for real on the next commit.
  assert.equal(isDocsOnly(["docs/QUALITY_GATES.md"]), true);
  assert.equal(directPushVerdict({ range: "", message: "" }).ok, true);
});
