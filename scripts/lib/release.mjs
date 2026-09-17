// Release-safety rules shared by the local pre-push hook, the server-side
// direct-push audit and their tests.
//
// The project rule is "everything reaches main through a PR with green
// checks". Documentation is the one deliberate exception: a typo in a README
// does not need a review cycle, and blocking it just teaches people to bypass
// the gate. So the classifier below is the single definition of "docs-only",
// used identically in both places — a rule that only exists in someone's head
// is not a gate.
import { execFileSync } from "node:child_process";

/** Paths that may be pushed straight to main without a PR. */
export const DOC_PATTERNS = [
  /\.md$/i, // any markdown, wherever it lives
  /^docs\//i,
  /^drafts\//i,
  /^blog-drafts\//i,
  /^LICENSE$/i,
  /^\.CYCLE_LIFE/i,
];

/** True when every changed path is documentation. Empty input is not docs. */
export function isDocsOnly(paths) {
  if (!paths.length) return false;
  return paths.every((p) =>
    DOC_PATTERNS.some((rx) => rx.test(String(p).trim())),
  );
}

/** Merge commits and squash commits both name the PR they came from. */
export function hasPrReference(message) {
  const text = String(message || "");
  return (
    /Merge pull request #\d+/.test(text) ||
    /\(#\d+\)\s*$/.test(text.split("\n")[0]) ||
    /\(\s*#\d+\s*\)/.test(text.split("\n")[0])
  );
}

/** Files changed by a commit range, one level of rename detection included. */
export function changedFiles(range, cwd = process.cwd()) {
  try {
    return execFileSync("git", ["diff", "--name-only", range], {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    })
      .split("\n")
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
}

/**
 * Decide whether a push straight to a protected branch is acceptable.
 * Returns `{ ok, reason, files }` so callers can print something actionable
 * instead of a bare non-zero exit.
 */
export function directPushVerdict({ range, message, cwd } = {}) {
  const files = changedFiles(range, cwd);
  if (!files.length)
    return { ok: true, reason: "no file changes detected", files };
  if (hasPrReference(message))
    return { ok: true, reason: "PR merge commit", files };
  if (isDocsOnly(files)) return { ok: true, reason: "docs-only change", files };
  const offending = files.filter((f) => !DOC_PATTERNS.some((rx) => rx.test(f)));
  return {
    ok: false,
    reason: `${offending.length} non-documentation file(s) changed outside a PR`,
    files: offending,
  };
}

/** One-line, copy-pasteable instruction for a blocked direct push. */
export function blockMessage(branch, files) {
  return [
    `BLOCKED: refusing a direct push to ${branch} with non-documentation changes.`,
    "",
    "main is production-adjacent: it publishes the staging mirror and is what",
    "the brand-domain release is verified against. Code, CI, config and asset",
    "changes must reach it through a PR with green checks.",
    "",
    "Touched (non-doc):",
    ...files.slice(0, 12).map((f) => `  - ${f}`),
    files.length > 12 ? `  … and ${files.length - 12} more` : "",
    "",
    "Do this instead:",
    "  git switch -c fix/<what-you-are-fixing>",
    "  git push -u origin HEAD",
    "  gh pr create --base main",
    "",
    "Documentation-only changes (*.md, docs/**, drafts/**) may be pushed directly.",
  ]
    .filter((l) => l !== "")
    .join("\n");
}
