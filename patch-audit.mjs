// Applies the main-audit delivery-rule fix in the fix-main-audit worktree.
// Line endings are preserved: the checkout is CRLF, the repo stores LF.
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = "C:/tmp/fix-main-audit";
const CRLF = /\r\n/g;

function patch(file, edits) {
  const path = `${ROOT}/${file}`;
  const raw = readFileSync(path, "utf8");
  const hadCrlf = raw.includes("\r\n");
  let text = raw.replace(CRLF, "\n");
  for (const [oldText, newText] of edits) {
    const hits = text.split(oldText).length - 1;
    if (hits !== 1)
      throw new Error(
        `${file}: anchor matched ${hits} times, expected exactly 1:\n${oldText.slice(0, 120)}`,
      );
    text = text.replace(oldText, newText);
  }
  writeFileSync(path, hadCrlf ? text.replace(/\n/g, "\r\n") : text, "utf8");
  console.log(`patched ${file} (${edits.length} edit(s), ${hadCrlf ? "CRLF" : "LF"} kept)`);
}

// ── scripts/lib/release.mjs ─────────────────────────────────────────────────
patch("scripts/lib/release.mjs", [
  [
    `/** Files changed by a commit range, one level of rename detection included. */
export function changedFiles(range, cwd = process.cwd()) {
  try {
    return execFileSync("git", ["diff", "--name-only", range], {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    })
      .split("\\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Commit subject+body for a single revision. */
export function commitMessage(rev, cwd = process.cwd()) {
  try {
    return execFileSync("git", ["log", "-1", "--format=%B", rev], {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    return "";
  }
}`,
    `/** One way to shell out to git: exact arguments, empty output on any failure. */
function git(args, cwd) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    return "";
  }
}

/** Files changed by a commit range, one level of rename detection included. */
export function changedFiles(range, cwd = process.cwd()) {
  return git(["diff", "--name-only", range], cwd)
    .split("\\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Commit subject+body for a single revision. */
export function commitMessage(rev, cwd = process.cwd()) {
  return git(["log", "-1", "--format=%B", rev], cwd);
}

/** Parent shas of one revision, first parent first. Empty when it cannot be read. */
export function commitParents(rev, cwd = process.cwd()) {
  const line = git(["rev-list", "--parents", "-n", "1", rev], cwd).trim();
  if (!line) return [];
  const [, ...parents] = line.split(/\\s+/);
  return parents;
}

/**
 * Commits that arrived WITH a PR merge, rather than being pushed straight to
 * the branch.
 *
 * A merge commit names the PR it landed (\`Merge pull request #N from ...\`), and
 * the commits it brought in are exactly those reachable from its non-first
 * parents but not from its first. The server-side audit needs that set because
 * it inspects every commit in the pushed range one at a time: without it a PR's
 * own branch commits are indistinguishable from commits typed straight onto
 * main, and every non-documentation pull request merged with a merge commit is
 * reported as a violation. Measured on this repository before the fix: 4 of the
 * 10 most recent Main audit runs read that way, including the range that landed
 * PR #220.
 *
 * LIMIT, stated rather than hidden: a merge commit created locally with a
 * fabricated \`Merge pull request #N\` subject is indistinguishable from a
 * GitHub merge here, because the object graph and the commit message are all
 * this function can see. That ambiguity is older than this function — the merge
 * commit itself has always been forgiven by \`hasPrReference\`. Telling the two
 * apart needs the API (\`/commits/{sha}/pulls\`), which would make the audit
 * depend on a network call and a token, so it is deliberately not done.
 */
export function prDeliveredShas(commits, { cwd = process.cwd() } = {}) {
  const delivered = new Set();
  for (const sha of commits) {
    const parents = commitParents(sha, cwd);
    if (parents.length < 2) continue;
    if (!hasPrReference(commitMessage(sha, cwd))) continue;
    const [first, ...side] = parents;
    for (const rev of git(["rev-list", ...side, "--not", first], cwd).split("\\n")) {
      const trimmed = rev.trim();
      if (trimmed) delivered.add(trimmed);
    }
  }
  return delivered;
}`,
  ],
]);

// ── scripts/direct-push-audit.mjs ───────────────────────────────────────────
patch("scripts/direct-push-audit.mjs", [
  [
    `// Exits non-zero when a commit that is not a PR merge/squash touched files
// outside the documentation set — the one flavor of direct push to main the
// project forbids. Every commit in the pushed range is inspected, because a
// force-push or a multi-commit push could otherwise hide one.
import { commitMessage, directPushVerdict } from "./lib/release.mjs";`,
    `// Exits non-zero when a commit reached main outside a PR and touched files
// outside the documentation set — the one flavor of direct push to main the
// project forbids. Every commit in the pushed range is inspected, because a
// force-push or a multi-commit push could otherwise hide one, and "outside a
// PR" is asked of each commit on its own evidence:
//
//   * a merge or squash commit names its PR in the subject, and
//   * a commit with no trailer of its own is judged by the merge that brought
//     it in. A PR merged with a merge commit puts its own branch commits in the
//     pushed range, and those commits are not direct pushes. A range that
//     contains a merge does NOT launder an unrelated commit pushed on top of
//     it: only the commits on the merge's own side of the graph are delivered.
//
// The limit of that evidence — a locally fabricated merge message — is written
// down in \`prDeliveredShas\`, where the decision is made.
import {
  commitMessage,
  directPushVerdict,
  prDeliveredShas,
} from "./lib/release.mjs";`,
  ],
  [
    `const violations = [];
let docsOnly = 0;
let fromPr = 0;

for (const sha of commits) {
  const message = commitMessage(sha);`,
    `const delivered = prDeliveredShas(commits);

const violations = [];
let docsOnly = 0;
let fromPr = 0;

for (const sha of commits) {
  // Brought in by a merge in this same range: the merge is the PR that landed
  // it, so this commit is not a direct push.
  if (delivered.has(sha)) {
    fromPr++;
    continue;
  }
  const message = commitMessage(sha);`,
  ],
]);

console.log("all patches applied");
