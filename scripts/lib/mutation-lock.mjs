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
 * leaving a mystery block. Acquisition is bounded, so a crashed holder delays a
 * test rather than wedging the suite.
 *
 * ACQUISITION IS ATOMIC, and it has to be. The first version polled
 * `waitForMutationLockFree` and then created the lock file — a textbook
 * check-then-act. Two processes could both observe "no lock present" in the
 * gap between the poll and the write, both proceed, and both believe they hold
 * it. Nothing downstream enforces it: there is no queue, no ticket, no refcount.
 * Measured consequence, under load with three concurrent staging builds, one run
 * in six: `tests/deploy-manifest.test.mjs` deleted robots.txt while
 * `scripts/deploy-pages-local.mjs` was copying the 362-file allowlist, and the
 * copy died with `ENOENT ... lstat robots.txt` — reddening an unrelated
 * `ALLOWLIST QUERY` test and aborting `promote-gates` mid-file (1142 -> 1122
 * tests). That failure is the lock's, not the racing tests', and no amount of
 * removing one caller closes it. `'wx'` makes the OS refuse the create when the
 * file exists, which is the only test-and-set here that two processes cannot
 * both win.
 */
export async function withMutationLock(fn, root = process.cwd()) {
  const path = mutationLockPath(root);
  await acquireMutationLock(path);
  try {
    return await fn();
  } finally {
    rmSync(path, { force: true });
  }
}

/**
 * Take the lock, or wait for whoever holds it.
 *
 * Returns true when the lock was acquired. On timeout it proceeds anyway and
 * returns false, preserving the original "a crashed holder must not wedge the
 * suite" contract: the cost of giving up is a flake, the cost of not giving up
 * is a hung CI run.
 */
export async function acquireMutationLock(
  path,
  { timeoutMs = 30000, stepMs = 50 } = {},
) {
  const start = Date.now();
  for (;;) {
    try {
      writeFileSync(path, String(process.pid), {
        encoding: "utf8",
        flag: "wx", // fail if the file exists — atomic against other holders
      });
      return true;
    } catch (err) {
      if (err?.code !== "EEXIST") throw err;
      if (Date.now() - start > timeoutMs) {
        writeFileSync(path, String(process.pid), "utf8");
        return false;
      }
      await new Promise((r) => setTimeout(r, stepMs));
    }
  }
}

/**
 * Wait until no test holds the lock, or give up and proceed anyway.
 *
 * Deliberately bounded: a crashed holder must not wedge the suite forever. On
 * timeout the caller proceeds — a stale lock then costs a flake, which is
 * strictly better than a suite that hangs.
 *
 * NOTE: this is an OBSERVER, not the acquisition path. Poll-then-write is what
 * let two holders through; `withMutationLock` now acquires with `'wx'` instead.
 * Use it to assert the lock is free, never to decide that it is free and then
 * write it yourself.
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
