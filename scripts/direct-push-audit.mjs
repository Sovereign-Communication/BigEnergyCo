// Server-side counterpart to the pre-push hook.
//
// Usage:
//   node scripts/direct-push-audit.mjs --before <sha> --after <sha>
//   node scripts/direct-push-audit.mjs            # audit the tip commit
//
// Exits non-zero when a commit reached main outside a PR and touched files
// outside the documentation set — the one flavor of direct push to main the
// project forbids. Every commit in the pushed range is inspected, because a
// force-push or a multi-commit push could otherwise hide one, and "outside a
// PR" is asked of each commit on its own evidence:
//
//   * the server audit verifies each non-doc commit has a merged-PR association
//     targeting main; offline runs use merge graph and subject evidence, and
//   * a commit with no trailer of its own is judged by the merge that brought
//     it in. A PR merged with a merge commit puts its own branch commits in the
//     pushed range, and those commits are not direct pushes. A range that
//     contains a merge does NOT launder an unrelated commit pushed on top of
//     it: only the commits on the merge's own side of the graph are delivered.
//
// Offline evidence cannot distinguish a real PR merge from a fabricated
// message, so that limitation is confined to runs without API credentials.
import {
  commitMessage,
  directPushVerdict,
  hasMergedPullRequest,
  prDeliveredShas,
} from "./lib/release.mjs";
import { execFileSync } from "node:child_process";

const ZERO = "0000000000000000000000000000000000000000";
const idx = (flag) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
};

function commitsIn(range) {
  const args = range
    ? ["rev-list", "--reverse", range]
    : ["rev-list", "--reverse", "-1", "HEAD"];
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  })
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

let before = idx("--before");
const after = idx("--after") || "HEAD";
if (before === ZERO) before = null;

const hasToken = Boolean(process.env.GITHUB_TOKEN);
const hasRepository = Boolean(process.env.GITHUB_REPOSITORY);
const requireApi = process.argv.includes("--require-api");
if (hasToken !== hasRepository || (requireApi && !hasToken)) {
  console.error(
    "ERROR: GitHub audit requires both GITHUB_TOKEN and GITHUB_REPOSITORY",
  );
  process.exit(2);
}
const hasApiCredentials = hasToken && hasRepository;

const range = before ? `${before}..${after}` : null;
let commits;
try {
  commits = commitsIn(range);
} catch (error) {
  console.error(`ERROR: could not inspect commit range: ${error.message}`);
  process.exit(2);
}

if (!commits.length) {
  console.log("MAIN AUDIT: no commits to inspect");
  process.exit(0);
}

const delivered = hasApiCredentials ? null : prDeliveredShas(commits);

const violations = [];
const lookupFailures = [];
const auditFailures = [];
let docsOnly = 0;
let fromPr = 0;

for (const sha of commits) {
  // Brought in by a merge in this same range: the merge is the PR that landed
  // it, so this commit is not a direct push.
  if (!hasApiCredentials && delivered.has(sha)) {
    fromPr++;
    continue;
  }
  const message = commitMessage(sha);
  const single = `${sha}^..${sha}`;
  let verdict;
  try {
    verdict = directPushVerdict({
      range: single,
      message,
      strict: true,
      trustPrReference: !hasApiCredentials,
    });
  } catch (error) {
    auditFailures.push({ sha: sha.slice(0, 8), message: error.message });
    continue;
  }
  if (verdict.reason === "no file changes detected") {
    docsOnly++;
    continue;
  }
  if (verdict.ok && verdict.reason === "docs-only change") {
    docsOnly++;
    continue;
  }
  if (!hasApiCredentials && verdict.reason === "PR merge commit") {
    fromPr++;
    continue;
  }
  if (hasApiCredentials) {
    try {
      if (
        await hasMergedPullRequest(sha, {
          repository: process.env.GITHUB_REPOSITORY,
          token: process.env.GITHUB_TOKEN,
          apiUrl: process.env.GITHUB_API_URL || "https://api.github.com",
          targetBranch: "main",
        })
      ) {
        fromPr++;
        continue;
      }
    } catch (error) {
      lookupFailures.push({ sha: sha.slice(0, 8), message: error.message });
      continue;
    }
  }
  violations.push({
    sha: sha.slice(0, 8),
    subject: message.split("\n")[0],
    files: verdict.files,
  });
}

for (const failure of auditFailures) {
  console.error(
    `ERROR ${failure.sha}: could not inspect commit changes: ${failure.message}`,
  );
}
for (const failure of lookupFailures) {
  console.error(
    `ERROR ${failure.sha}: could not verify merged-PR association: ${failure.message}`,
  );
}

for (const v of violations) {
  console.error(
    `FAIL ${v.sha} "${v.subject}" reached main without a PR and touched:\n` +
      v.files
        .slice(0, 12)
        .map((f) => `     - ${f}`)
        .join("\n"),
  );
}

console.log(
  `\nMAIN AUDIT: ${commits.length} commit(s) — ${fromPr} via PR, ${docsOnly} docs-only, ${violations.length} violation(s)`,
);

if (auditFailures.length || lookupFailures.length) {
  process.exitCode = 2;
} else if (violations.length) {
  console.error(
    "\nMain is staging: it publishes the staging mirror and is the revision the\n" +
      "brand-domain promote is verified against. Revert the direct commit and\n" +
      "land the change through a PR with green checks.",
  );
  process.exitCode = 1;
}
