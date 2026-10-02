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
export function stampCommit(root, stamp, pathspec = GRAPH_PATHSPEC) {
  if (!stamp) return { error: "no stamp given" };
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
 * Two kinds of asset are deliberately NOT reported:
 *
 *   - Absent at the setter commit, i.e. NEW. A URL that never existed cannot be
 *     in anyone's cache, so there is nothing to invalidate. This is the normal
 *     case when a release adds a script alongside an existing stamp.
 *   - Absent now, i.e. deleted. Nothing references it any more; a cached copy
 *     is unreachable by definition.
 */
export function findStaleAssets(assets, setter, getBlob) {
  const stale = [];
  for (const asset of assets) {
    const then = getBlob(setter, asset);
    if (then === null || then === undefined) continue;
    const now = getBlob("HEAD", asset);
    if (now === null || now === undefined) continue;
    if (!Buffer.from(then).equals(Buffer.from(now))) stale.push(asset);
  }
  return stale.sort();
}
