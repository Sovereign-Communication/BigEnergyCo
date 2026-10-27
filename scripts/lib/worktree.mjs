// Worktree plumbing for the rollback path — `promote.mjs --to <sha>` rebuilds a
// recorded commit inside a detached worktree so the old artifact can be gated
// and deployed without touching the checkout.
//
// `git worktree add` refuses a path that is still REGISTERED, and a previous run
// whose directory was deleted (an interrupted rollback, or our own rmSync before
// rebuilding) leaves exactly such a registration behind:
//
//   fatal: '<dir>' is a missing but already registered worktree
//
// So rolling back twice used to fail — on the one command that must work when
// production is already broken. Detaching first makes the second attempt behave
// like the first.
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

const git = (args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

/**
 * Attach a detached worktree of `sha` at `dir`, replacing any earlier one.
 * @param {string} dir worktree path (discarded and rebuilt)
 * @param {string} sha commit to check out
 * @returns {string} the worktree path
 */
export function attachWorktree(dir, sha) {
  rmSync(dir, { recursive: true, force: true });
  try {
    git(["worktree", "remove", "--force", dir]);
  } catch {
    /* not registered — the usual case */
  }
  git(["worktree", "prune"]);
  git(["worktree", "add", "--detach", dir, sha]);
  return dir;
}

/** Drop a worktree and its registration, ignoring a worktree that is already gone. */
export function detachWorktree(dir) {
  rmSync(dir, { recursive: true, force: true });
  try {
    git(["worktree", "remove", "--force", dir]);
  } catch {
    /* already gone */
  }
  git(["worktree", "prune"]);
}
