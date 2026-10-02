// A cross-process lock for tests that briefly mutate the working tree.
//
// Why this exists: `tests/deploy-manifest.test.mjs` proves "a deleted-but-
// tracked file fails loudly, not silently" by really deleting `robots.txt`
// from the repo root. `tests/ci-resilience.test.mjs` spawns
// `scripts/verify-staging.mjs`, which reads every allowlisted file — including
// `robots.txt`. node --test runs test FILES in parallel, so on some runs the
// verifier observed the tooth's deletion and reported
// `parity robots.txt — unreadable: local read failed: ENOENT`, failing a test
// about budget verdicts for a reason that had nothing to do with budgets.
// Verified by measurement, not assumed: with robots.txt deleted, the verifier
// really does report it unreadable.
//
// The lock is a FILE in the OS temp directory, deliberately outside the repo:
// this suite reads `git ls-files` and scans the working tree for stray files,
// so a lock file inside the checkout would show up in those gates. The name is
// derived from the repo path so two checkouts cannot block each other.
import { createHash } from "node:crypto";
import { existsSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/** Stable per-checkout lock path. */
export function mutationLockPath(root = process.cwd()) {
  const h = createHash("sha256").update(resolve(root)).digest("hex");
  return join(tmpdir(), `beco-mutation-lock-${h.slice(0, 16)}.lock`);
}

/**
 * Hold the lock for the duration of `fn`, waiting first if another holder
 * exists.
 *
 * BOTH sides must use this. Waiting only on the reader side is not enough: the
 * writer can take the lock the instant the reader stops waiting and still
 * mutate the tree mid-read. That was the first version's bug — it still raced
 * in 1 run in 4, because the verifier was still reading robots.txt while the
 * tooth deleted it. Mutual exclusion needs both directions.
 *
 * The file holds the owning pid so a crash mid-tooth is diagnosable rather than
 * leaving a mystery block. `waitForMutationLockFree` is bounded on both ends,
 * so a crashed holder delays a test rather than wedging the suite.
 */
export async function withMutationLock(fn, root = process.cwd()) {
  const path = mutationLockPath(root);
  await waitForMutationLockFree({ root });
  writeFileSync(path, String(process.pid), "utf8");
  try {
    return await fn();
  } finally {
    rmSync(path, { force: true });
  }
}

/**
 * Wait until no test holds the lock, or give up and proceed anyway.
 *
 * Deliberately bounded: a crashed holder must not wedge the suite forever. On
 * timeout the caller proceeds — a stale lock then costs a flake, which is
 * strictly better than a suite that hangs.
 */
export async function waitForMutationLockFree({
  timeoutMs = 30000,
  stepMs = 100,
  root = process.cwd(),
} = {}) {
  const path = mutationLockPath(root);
  const start = Date.now();
  while (existsSync(path)) {
    if (Date.now() - start > timeoutMs) return false;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return true;
}
