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
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  DOC_PATTERNS,
  blockMessage,
  directPushVerdict,
  changedFilesStrict,
  hasMergedPullRequest,
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

test("GATE: strict changed-file inspection throws on an invalid Git range", (t) => {
  const { dir } = scratchRepo(t);
  assert.throws(() => changedFilesStrict("missing^..missing", dir));
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
function audit(dir, before, after, env = {}, preload = null, flags = []) {
  return spawnSync(
    process.execPath,
    [
      ...(preload ? ["--import", pathToFileURL(preload).href] : []),
      AUDIT,
      "--before",
      before,
      "--after",
      after,
      ...flags,
    ],
    {
      cwd: dir,
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_TOKEN: "",
        GITHUB_REPOSITORY: "",
        ...env,
      },
    },
  );
}

test("GATE: audit trusts only merged-PR metadata and still catches direct commits", (t) => {
  const mergedRepo = scratchRepo(t);
  const merged = mergedRepo.commit(
    "assets/app.js",
    "export const app = true;\\n",
    "perf: heatmap redesign without PR number",
  );
  const mock = join(mergedRepo.dir, "mock-github.mjs");
  writeFileSync(
    mock,
    `globalThis.fetch = async (url) => {
      const sha = url.match(/\\/commits\\/([a-f0-9]+)\\/pulls$/)?.[1];
      const pulls = sha === process.env.GITHUB_MERGED_SHA
        ? [{
            merged_at: "2026-10-17T01:12:41Z",
            base: { ref: process.env.GITHUB_PR_BASE || "main" },
          }]
        : [];
      return {
        ok: process.env.GITHUB_API_STATUS !== "403",
        status: Number(process.env.GITHUB_API_STATUS || 200),
        json: async () => pulls,
      };
    };\n`,
  );
  const env = {
    GITHUB_TOKEN: "test-token",
    GITHUB_REPOSITORY: "owner/repo",
    GITHUB_API_URL: "https://github.test/api/v3",
    GITHUB_MERGED_SHA: merged,
  };
  const mergedResult = audit(
    mergedRepo.dir,
    mergedRepo.base,
    merged,
    env,
    mock,
  );
  assert.equal(
    mergedResult.status,
    0,
    mergedResult.stdout + mergedResult.stderr,
  );
  assert.match(mergedResult.stdout, /1 via PR, 0 docs-only, 0 violation/);

  const directRepo = scratchRepo(t);
  const direct = directRepo.commit(
    "assets/app.js",
    "export const app = true;\\n",
    "perf: direct code change without PR metadata",
  );
  const directResult = audit(
    directRepo.dir,
    directRepo.base,
    direct,
    { ...env, GITHUB_MERGED_SHA: "" },
    mock,
  );
  assert.equal(
    directResult.status,
    1,
    directResult.stdout + directResult.stderr,
  );
  assert.match(directResult.stderr, /assets\/app\.js/);
  assert.match(directResult.stdout, /0 via PR, 0 docs-only, 1 violation/);
});

test("GATE: GitHub metadata lookup requires a merged PR targeting main", async () => {
  const response = (base, mergedAt = "2026-10-17T01:12:41Z") => ({
    ok: true,
    json: async () => [{ merged_at: mergedAt, base: { ref: base } }],
  });
  const options = {
    repository: "owner/repo",
    token: "test-token",
    fetchImpl: async () => response("develop"),
  };
  assert.equal(await hasMergedPullRequest("sha", options), false);
  assert.equal(
    await hasMergedPullRequest("sha", {
      ...options,
      fetchImpl: async () => response("main"),
    }),
    true,
  );
  assert.equal(
    await hasMergedPullRequest("sha", {
      ...options,
      fetchImpl: async () => response("main", null),
    }),
    false,
  );
  await assert.rejects(
    hasMergedPullRequest("sha", {
      ...options,
      fetchImpl: async () => ({ ok: true, json: async () => ({}) }),
    }),
    /invalid response/,
  );
});

test("GATE: PR-looking subjects cannot bypass server-side association checks", (t) => {
  const { dir, commit, base } = scratchRepo(t);
  const tip = commit(
    "assets/app.js",
    "export const forged = true;\\n",
    "feat: forged title (#219)",
  );
  const mock = join(dir, "mock-github.mjs");
  writeFileSync(
    mock,
    `globalThis.fetch = async () => ({
      ok: true, status: 200, json: async () => [],
    });\n`,
  );
  const r = audit(
    dir,
    base,
    tip,
    {
      GITHUB_TOKEN: "test-token",
      GITHUB_REPOSITORY: "owner/repo",
      GITHUB_API_URL: "https://github.test/api/v3",
    },
    mock,
  );
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.ok(r.stderr.includes("assets/app.js"), r.stdout + r.stderr);
  assert.match(r.stdout, /0 via PR, 0 docs-only, 1 violation/);
});

test("GATE: merged PRs targeting another branch do not authorize main", (t) => {
  const { dir, commit, base } = scratchRepo(t);
  const tip = commit(
    "assets/app.js",
    "export const app = true;\\n",
    "perf: squash subject without PR number",
  );
  const mock = join(dir, "mock-github.mjs");
  writeFileSync(
    mock,
    `globalThis.fetch = async () => ({
      ok: true, status: 200,
      json: async () => [{ merged_at: "2026-10-17T01:12:41Z", base: { ref: "develop" } }],
    });\n`,
  );
  const r = audit(
    dir,
    base,
    tip,
    {
      GITHUB_TOKEN: "test-token",
      GITHUB_REPOSITORY: "owner/repo",
      GITHUB_API_URL: "https://github.test/api/v3",
      GITHUB_MERGED_SHA: tip,
      GITHUB_PR_BASE: "develop",
    },
    mock,
  );
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.ok(r.stderr.includes("assets/app.js"), r.stdout + r.stderr);
  assert.match(r.stdout, /0 via PR, 0 docs-only, 1 violation/);
});

test("GATE: API errors fail the real audit closed", (t) => {
  const { dir, commit, base } = scratchRepo(t);
  const tip = commit(
    "assets/app.js",
    "export const app = true;\\n",
    "feat: app",
  );
  const mock = join(dir, "mock-github.mjs");
  writeFileSync(
    mock,
    `globalThis.fetch = async () => ({ ok: false, status: 403 });\n`,
  );
  const r = audit(
    dir,
    base,
    tip,
    {
      GITHUB_TOKEN: "test-token",
      GITHUB_REPOSITORY: "owner/repo",
      GITHUB_API_URL: "https://github.test/api/v3",
    },
    mock,
  );
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /HTTP 403/);
});

test("GATE: invalid Git ranges fail closed instead of becoming empty audits", (t) => {
  const { dir } = scratchRepo(t);
  const r = audit(dir, "not-a-commit", "also-not-a-commit");
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /could not inspect commit range/);
});

test("GATE: required API mode fails closed when credentials are missing", (t) => {
  const { dir, commit, base } = scratchRepo(t);
  const tip = commit("scripts/app.mjs", "export {};\\n", "feat: app");
  const missingToken = audit(
    dir,
    base,
    tip,
    { GITHUB_REPOSITORY: "owner/repo" },
    null,
    ["--require-api"],
  );
  assert.equal(
    missingToken.status,
    2,
    missingToken.stdout + missingToken.stderr,
  );
  assert.match(
    missingToken.stderr,
    /requires both GITHUB_TOKEN and GITHUB_REPOSITORY/,
  );

  const missingRepository = audit(
    dir,
    base,
    tip,
    { GITHUB_TOKEN: "test-token" },
    null,
    ["--require-api"],
  );
  assert.equal(
    missingRepository.status,
    2,
    missingRepository.stdout + missingRepository.stderr,
  );
  assert.match(
    missingRepository.stderr,
    /requires both GITHUB_TOKEN and GITHUB_REPOSITORY/,
  );
});

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

test("LIMIT: offline fallback cannot authenticate a fabricated PR merge", (t) => {
  // The server audit verifies each non-doc commit with GitHub metadata. The
  // local audit has no network credentials and can only infer delivery from
  // graph shape and commit text, so fabricated PR merge messages remain an
  // explicit limitation of offline use.
  const { dir, g, commit, mergeIntoMain, base } = scratchRepo(t);
  g("checkout", "-q", "-b", "pr");
  commit("scripts/thing.mjs", "export const x = 1;\n", "feat: a thing");
  g("checkout", "-q", "main");
  const tip = mergeIntoMain("pr", "Merge pull request #9 from o/pr");
  assert.equal(audit(dir, base, tip).status, 0);
});
