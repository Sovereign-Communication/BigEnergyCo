// Stamp-staleness logic for scripts/bump-asset-tokens.mjs.
//
// Lives here rather than inline in the CLI so it can be tested without
// executing a script that rewrites the repository. Same reason as
// lib/api-target.mjs and lib/deploy-manifest.mjs.
//
// The question this module answers: does the `?v=` stamp still describe the
// bytes behind it? `/assets/*` is served `Cache-Control: immutable 1yr`, so an
// asset whose content changed under an unchanged stamp is not delivered to any
// visitor who already has it cached — while every other gate reports green.
import { execFileSync } from "node:child_process";

// Graph locations searched for the stamp's introduction. Kept coarse on
// purpose: passing every graph file as a pathspec would be a very long command
// line on Windows for no gain.
export const GRAPH_PATHSPEC = [
  "index.html",
  "solar-heatmap",
  "about",
  "blog",
  "solar-calculator",
  "assets/js",
];

/**
 * The commit that MINTED this stamp value: the OLDEST commit in which the
 * literal `?v=<stamp>` appears.
 *
 * Newest is wrong, and the distinction is load-bearing. `git log -S` matches a
 * commit whenever that string's OCCURRENCE COUNT changes — and a release that
 * adds a new reference under an existing stamp does exactly that. Anchoring on
 * the newest match points at the very release this check exists to catch, and
 * the check then compares the release against itself and passes.
 */
export function isShallow(root) {
  try {
    return (
      execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim() === "true"
    );
  } catch {
    return false;
  }
}

export function stampCommit(root, stamp, pathspec = GRAPH_PATHSPEC) {
  if (!stamp) return { error: "no stamp given" };
  // MUST be checked before `git log`, not by catching its failure.
  //
  // A shallow clone does not make `git log -S` throw. HEAD is a grafted root,
  // so the log diffs it against the empty tree, reports exactly one commit, and
  // `setter` becomes HEAD. `findStaleAssets` then compares HEAD against HEAD and
  // returns [] — a green "42 referenced assets verified" that verified nothing.
  // Measured on a `git clone --depth 1` of this repo before this guard existed.
  if (isShallow(root))
    return {
      error:
        "this checkout is shallow, so the commit that set the stamp is not " +
        "reachable and the staleness of the asset graph cannot be determined. " +
        "Run `git fetch --unshallow` and re-run. Refusing to report green.",
    };
  try {
    const out = execFileSync(
      "git",
      ["log", `-S?v=${stamp}`, "--format=%H", "--", ...pathspec],
      { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    ).trim();
    if (!out)
      return { error: `no commit in history ever introduced ?v=${stamp}` };
    const sha = out.split("\n").pop().trim();
    let short = "";
    try {
      short = execFileSync("git", ["rev-parse", "--short", sha], {
        cwd: root,
        encoding: "utf8",
      }).trim();
    } catch {
      /* cosmetic only */
    }
    return { sha, short };
  } catch (e) {
    // A shallow clone cannot answer this. Fail LOUDLY: a gate that could not
    // check must never report a clean result.
    return {
      error:
        "cannot locate the commit that set the stamp — this checkout looks " +
        "shallow (git log -S found nothing). Run `git fetch --unshallow` and " +
        `re-run. (${String(e.message).slice(0, 120)})`,
    };
  }
}

/**
 * A git blob at `rev:path`, or null when the path does not exist there.
 *
 * git prints "fatal: path ... does not exist" to stderr for every absent
 * path; that is an expected answer here, not an error to surface.
 */
export function gitBlob(root, rev, path) {
  try {
    return execFileSync("git", ["show", `${rev}:${path}`], {
      cwd: root,
      maxBuffer: 128 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return null;
  }
}

/**
 * Which referenced assets changed since the stamp was minted.
 *
 * `assets` is an iterable of repo-relative paths. `getBlob(rev, path)` returns
 * a Buffer or null. Pure: every git call is injected.
 *
 * Two kinds of asset are deliberately NOT counted as stale, and they must not be
 * conflated — the difference is a green light versus a hard failure:
 *
 *   - Absent at the setter commit, i.e. NEW. A URL that never existed cannot be
 *     in anyone's cache, so there is nothing to invalidate. This is the normal
 *     case when a release adds a script alongside an existing stamp.
 *   - Absent NOW. Every path here came from `referencedAssets()`, so by
 *     definition something references it; a missing blob means a broken
 *     reference, a path that escapes the repo, or an untracked new file — not a
 *     deletion. Silently skipping it would let a resolution bug report every
 *     asset as verified while checking none of them, so these are returned
 *     separately as `unresolvable` for the caller to fail on.
 */
export function findStaleAssets(assets, setter, getBlob) {
  const stale = [];
  const unresolvable = [];
  for (const asset of assets) {
    const then = getBlob(setter, asset);
    if (then === null || then === undefined) continue; // new since the setter
    const now = getBlob("HEAD", asset);
    if (now === null || now === undefined) {
      unresolvable.push(asset);
      continue;
    }
    if (!Buffer.from(then).equals(Buffer.from(now))) stale.push(asset);
  }
  return { stale: stale.sort(), unresolvable: unresolvable.sort() };
}
