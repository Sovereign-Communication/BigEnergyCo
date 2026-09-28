// What the checkout in front of this process actually looks like.
//
// These are the CODE-OWNED facts (see CODE_OWNED_FIELDS in lib/jev-evidence.mjs):
// an evidence file can claim anything about a past CI run, but it cannot fake
// the working tree, the tracked secret shapes, or the test suite in front of it.
// This module owns that measurement, so the gate's hard gates read the tree
// rather than believing a file.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function git(args) {
  const r = spawnSync("git", args, { encoding: "utf8", timeout: 15000 });
  if (r.error) throw new Error(`git ${args[0]} failed: ${r.error.message}`);
  return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}

export function collectAutoFacts(repoRoot) {
  const status = git(["-C", repoRoot, "status", "--porcelain"]);
  if (status.status !== 0) {
    throw new Error(`git status failed: ${status.stderr.trim()}`);
  }
  const dirtyPaths = status.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.slice(3).replace(/^"|"$/g, ""));

  // Tracked-tree secret shapes: never print matches, only the count. The
  // patterns cover the provider key formats this repo actually uses.
  const scan = git([
    "-C",
    repoRoot,
    "grep",
    "-I",
    "-n",
    "-E",
    "(sk-or-v1-[0-9a-f]{20,}|apik[-_][0-9a-zA-Z]{16,}|AKIA[0-9A-Z]{16}|ghp_[0-9A-Za-z]{36})",
    "--",
    ".",
  ]);
  // git grep exit: 0 = match, 1 = clean, >1 = error (treat as NOT clean).
  const secretHits =
    scan.status === 0 ? scan.stdout.split("\n").filter(Boolean).length : 0;
  const secretsClean = scan.status <= 1 && secretHits === 0;

  const gitignorePath = join(repoRoot, ".gitignore");
  const gitignore = existsSync(gitignorePath)
    ? readFileSync(gitignorePath, "utf8")
    : "";
  const envIgnored = /^\.env[\s*]/m.test(gitignore);

  // A fresh repo has no HEAD yet — report it, never crash the gate on it.
  const shaRes = git(["-C", repoRoot, "rev-parse", "--short", "HEAD"]);
  const sha = shaRes.status === 0 ? shaRes.stdout.trim() : "unborn";
  const branchRes = git(["-C", repoRoot, "branch", "--show-current"]);
  const branch =
    branchRes.status === 0 && branchRes.stdout.trim()
      ? branchRes.stdout.trim()
      : "?";

  let testCount = 0;
  const testsDir = join(repoRoot, "tests");
  if (existsSync(testsDir)) {
    testCount = git(["-C", repoRoot, "ls-files", "tests"])
      .stdout.split("\n")
      .filter((f) => f.endsWith(".test.mjs")).length;
  }

  return {
    target: `${branch} @ ${sha}`,
    sha,
    branch,
    treeClean: dirtyPaths.length === 0,
    dirtyPaths,
    secretsClean,
    secretHitCount: secretHits,
    envIgnored,
    testCount,
  };
}
