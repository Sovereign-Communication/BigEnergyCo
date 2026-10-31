// Regression gates for the release-safety rules.
//
// Two independent guards share this logic (the local pre-push hook and the
// server-side Main audit workflow), so the definitions of "docs-only" and "came
// from a PR" are tested directly — if either drifts, one guard would start
// allowing what the other blocks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DOC_PATTERNS,
  blockMessage,
  directPushVerdict,
  hasPrReference,
  isDocsOnly,
  prDeliveredShas,
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

test("GATE: the pinned master plan is markdown but never docs-only", () => {
  // docs/plan/** is hash-pinned; a direct push would skip the plan-pin gate
  // that only runs on PRs, so these paths always require a PR.
  for (const path of [
    "docs/plan/MASTER_PLAN.md",
    "docs/plan/AMENDMENTS.md",
    "docs/plan/LEDGER.jsonl",
    "docs/plan/PLAN.lock.json",
  ]) {
    assert.equal(isDocsOnly([path]), false, `${path} must require a PR`);
  }
  assert.equal(isDocsOnly(["README.md", "docs/plan/MASTER_PLAN.md"]), false);
  // Neighbouring docs keep the exemption.
  assert.equal(isDocsOnly(["docs/DEPLOY_RUNBOOK.md"]), true);
  assert.equal(isDocsOnly(["docs/planning-notes.md"]), true);
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

// ── the server-side audit's delivery rule ───────────────────────────────────
//
// scripts/direct-push-audit.mjs inspects EVERY commit in a pushed range, one
// commit at a time, so it has to separate two shapes that look identical that
// way: a PR's own branch commits, which arrive with the merge that lands them,
// and commits typed straight onto main. Both shapes are built for real here, in
// a throwaway repository, and the actual script is run over them.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AUDIT = join(ROOT, "scripts", "direct-push-audit.mjs");

/**
 * A throwaway repository, so no test ever writes this repository's refs.
 * `commit` writes a file and returns the new revision, and every git call runs
 * in that directory rather than the one the suite was started from.
 */
function scratchRepo(t) {
  const dir = mkdtempSync(join(tmpdir(), "beco-audit-"));
  const g = (...args) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  const commit = (file, body, message) => {
    mkdirSync(join(dir, dirname(file)), { recursive: true });
    writeFileSync(join(dir, file), body);
    g("-c", "user.name=t", "-c", "user.email=t@e", "add", "-A");
    g(
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@e",
      "commit",
      "-q",
      "-m",
      message,
    );
    return g("rev-parse", "HEAD");
  };
  // Committed as GitHub does it, so the fixture has the shape a real PR merge
  // has rather than the shape we wish it had.
  const mergeIntoMain = (branch, message) => {
    g(
      "-c",
      "user.name=GitHub",
      "-c",
      "user.email=noreply@github.com",
      "merge",
      "--no-ff",
      "-q",
      "-m",
      message,
      branch,
    );
    return g("rev-parse", "HEAD");
  };
  g("init", "-q", "-b", "main", ".");
  const base = commit("README.md", "base\n", "base");
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return { dir, g, commit, mergeIntoMain, base };
}

/** The real script, over a range, as .github/workflows/main-audit.yml runs it. */
function audit(dir, before, after) {
  return spawnSync(
    process.execPath,
    [AUDIT, "--before", before, "--after", after],
    { cwd: dir, encoding: "utf8" },
  );
}

test("GATE: a direct push of a non-documentation commit is still a violation", (t) => {
  const { dir, commit, base } = scratchRepo(t);
  const tip = commit(
    "scripts/thing.mjs",
    "export const x = 1;\n",
    "feat: a thing",
  );
  const r = audit(dir, base, tip);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /reached main without a PR and touched:/);
  assert.match(r.stderr, /scripts\/thing\.mjs/);
  assert.match(
    r.stdout,
    /MAIN AUDIT: 1 commit\(s\) — 0 via PR, 0 docs-only, 1 violation\(s\)/,
  );
});

test("GATE: commits a PR merge brought in are not direct pushes", (t) => {
  // The shape of PR #220: a branch commit with no trailer of its own, landed by
  // a merge commit that names the PR. Before the delivery rule, that branch
  // commit was reported as having reached main without a PR.
  const { dir, g, commit, mergeIntoMain, base } = scratchRepo(t);
  g("checkout", "-q", "-b", "pr");
  commit("scripts/thing.mjs", "export const x = 1;\n", "feat: a thing");
  g("checkout", "-q", "main");
  const tip = mergeIntoMain("pr", "Merge pull request #42 from o/pr");
  const r = audit(dir, base, tip);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(
    r.stdout,
    /MAIN AUDIT: 2 commit\(s\) — 2 via PR, 0 docs-only, 0 violation\(s\)/,
  );
});

test("GATE: a merge that names no PR launders nothing", (t) => {
  const { dir, g, commit, mergeIntoMain, base } = scratchRepo(t);
  g("checkout", "-q", "-b", "pr");
  commit("scripts/thing.mjs", "export const x = 1;\n", "feat: a thing");
  g("checkout", "-q", "main");
  const tip = mergeIntoMain("pr", "merge branch 'pr'");
  const r = audit(dir, base, tip);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /reached main without a PR and touched:/);
  assert.match(r.stderr, /scripts\/thing\.mjs/);
});

test("GATE: a direct commit pushed alongside a PR merge is still caught", (t) => {
  // The range contains a merge AND a commit typed on top of it. Only the
  // merge's own side of the graph is delivered, so this must fail, and must
  // blame the direct commit alone.
  const { dir, g, commit, mergeIntoMain, base } = scratchRepo(t);
  g("checkout", "-q", "-b", "pr");
  commit("scripts/thing.mjs", "export const x = 1;\n", "feat: a thing");
  g("checkout", "-q", "main");
  mergeIntoMain("pr", "Merge pull request #42 from o/pr");
  const tip = commit(
    "scripts/other.mjs",
    "export const y = 2;\n",
    "chore: direct",
  );
  const r = audit(dir, base, tip);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /scripts\/other\.mjs/);
  assert.doesNotMatch(
    r.stderr,
    /thing\.mjs/,
    "the PR's own commit is not blamed",
  );
  assert.match(
    r.stdout,
    /MAIN AUDIT: 3 commit\(s\) — 2 via PR, 0 docs-only, 1 violation\(s\)/,
  );
});

test("GATE: documentation still needs no PR", (t) => {
  const { dir, commit, base } = scratchRepo(t);
  const tip = commit("docs/notes.md", "note\n", "docs: a note");
  const r = audit(dir, base, tip);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(
    r.stdout,
    /MAIN AUDIT: 1 commit\(s\) — 0 via PR, 1 docs-only, 0 violation\(s\)/,
  );
});

test("GATE: prDeliveredShas names the merge's side, and only that side", (t) => {
  const { dir, g, commit, mergeIntoMain, base } = scratchRepo(t);
  g("checkout", "-q", "-b", "pr");
  const branch = commit(
    "scripts/thing.mjs",
    "export const x = 1;\n",
    "feat: a thing",
  );
  g("checkout", "-q", "main");
  const merge = mergeIntoMain("pr", "Merge pull request #42 from o/pr");
  const tip = commit(
    "scripts/other.mjs",
    "export const y = 2;\n",
    "chore: after",
  );
  const commits = g("rev-list", "--reverse", `${base}..${tip}`)
    .split("\n")
    .filter(Boolean);
  const delivered = prDeliveredShas(commits, { cwd: dir });
  assert.equal(
    delivered.has(branch),
    true,
    "the branch commit arrived with the merge",
  );
  assert.equal(delivered.has(merge), false, "the merge names its own PR");
  assert.equal(
    delivered.has(tip),
    false,
    "a commit after the merge is not delivered by it",
  );
  assert.equal(delivered.has(base), false, "the base is outside the range");
});

test("LIMIT: a locally fabricated PR merge cannot be told from a real one", (t) => {
  // Recorded rather than hidden. The delivery rule reads the object graph and
  // the commit message, and a locally created merge whose subject claims a PR
  // is indistinguishable from a GitHub merge by those two things alone — the
  // same ambiguity that has always let such a merge commit itself through.
  // Settling it needs /commits/{sha}/pulls, i.e. a token and a network call
  // inside the audit; that trade was not taken. Bounded cost: commits under a
  // fabricated merge trailer pass, and nothing else changes.
  const { dir, g, commit, mergeIntoMain, base } = scratchRepo(t);
  g("checkout", "-q", "-b", "pr");
  commit("scripts/thing.mjs", "export const x = 1;\n", "feat: a thing");
  g("checkout", "-q", "main");
  const tip = mergeIntoMain("pr", "Merge pull request #9 from o/pr");
  assert.equal(audit(dir, base, tip).status, 0);
});
