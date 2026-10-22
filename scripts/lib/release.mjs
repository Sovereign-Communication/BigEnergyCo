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

/**
 * Markdown that is NOT exempt: the hash-pinned master plan, its amendment
 * log and its ledger only change through a PR, where the plan-pin gate runs.
 */
export const PR_ONLY_PATTERNS = [/^docs\/plan\//i];

/** True when every changed path is documentation. Empty input is not docs. */
export function isDocsOnly(paths) {
  if (!paths.length) return false;
  return paths.every((p) => {
    const path = String(p).trim();
    if (PR_ONLY_PATTERNS.some((rx) => rx.test(path))) return false;
    return DOC_PATTERNS.some((rx) => rx.test(path));
  });
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

/** One way to shell out to git: exact arguments, empty output on any failure. */
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
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Strict server-audit variant: a failed git command is not an empty diff. */
export function changedFilesStrict(range, cwd = process.cwd()) {
  return execFileSync("git", ["diff", "--name-only", range], {
    cwd,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Commit subject+body for a single revision. */
export function commitMessage(rev, cwd = process.cwd()) {
  return git(["log", "-1", "--format=%B", rev], cwd);
}

/** Whether GitHub associates this commit with a merged pull request. */
export async function hasMergedPullRequest(
  sha,
  {
    repository,
    token,
    apiUrl = "https://api.github.com",
    targetBranch = "main",
    fetchImpl = fetch,
  } = {},
) {
  if (!repository || !token)
    throw new Error("GITHUB_REPOSITORY and GITHUB_TOKEN are required");
  if (
    repository.split("/").length !== 2 ||
    repository.split("/").some((part) => !part)
  )
    throw new Error("GITHUB_REPOSITORY must be owner/repository");
  const url = `${apiUrl.replace(/\/+$/, "")}/repos/${repository}/commits/${encodeURIComponent(sha)}/pulls`;
  const response = await fetchImpl(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok)
    throw new Error(
      `GitHub commit-to-PR lookup failed (HTTP ${response.status})`,
    );
  const pulls = await response.json();
  if (!Array.isArray(pulls))
    throw new Error("GitHub commit-to-PR lookup returned an invalid response");
  return pulls.some(
    (pull) =>
      typeof pull?.merged_at === "string" && pull.base?.ref === targetBranch,
  );
}

export function commitParents(rev, cwd = process.cwd()) {
  const line = git(["rev-list", "--parents", "-n", "1", rev], cwd).trim();
  if (!line) return [];
  const [, ...parents] = line.split(/\s+/);
  return parents;
}

/**
 * Commits that arrived WITH a PR merge, rather than being pushed straight to
 * the branch.
 *
 * A merge commit names the PR it landed (`Merge pull request #N from ...`), and
 * the commits it brought in are exactly those reachable from its non-first
 * parents but not from its first. The server-side audit needs that set because
 * it inspects every commit in the pushed range one at a time: without it a PR's
 * own branch commits are indistinguishable from commits typed straight onto
 * main, and every non-documentation pull request merged with a merge commit is
 * reported as a violation. Measured on this repository before the fix: 4 of the
 * 10 most recent Main audit runs read that way, including the range that landed
 * PR #220.
 *
 * A squash commit has no merge graph, so its delivery cannot be inferred here;
 * the server-side audit checks GitHub's commit-to-PR association for such a
 * commit, including its target branch. Local pre-push checks remain offline
 * and use the available git proof.
 */
export function prDeliveredShas(commits, { cwd = process.cwd() } = {}) {
  const delivered = new Set();
  for (const sha of commits) {
    const parents = commitParents(sha, cwd);
    if (parents.length < 2) continue;
    if (!hasPrReference(commitMessage(sha, cwd))) continue;
    const [first, ...others] = parents;
    const pulled = git(["rev-list", ...others, "--not", first], cwd);
    for (const rev of pulled.split("\n")) {
      const trimmed = rev.trim();
      if (trimmed) delivered.add(trimmed);
    }
  }
  return delivered;
}

/**
 * Decide whether a push straight to a protected branch is acceptable.
 * Returns `{ ok, reason, files }` so callers can print something actionable
 * instead of a bare non-zero exit.
 */
export function directPushVerdict({
  range,
  message,
  cwd,
  strict = false,
  trustPrReference = true,
} = {}) {
  const files = strict
    ? changedFilesStrict(range, cwd)
    : changedFiles(range, cwd);
  if (!files.length)
    return { ok: true, reason: "no file changes detected", files };
  if (trustPrReference && hasPrReference(message))
    return { ok: true, reason: "PR merge commit", files };
  if (isDocsOnly(files)) return { ok: true, reason: "docs-only change", files };
  const offending = files.filter((f) => !isDocsOnly([f]));
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
