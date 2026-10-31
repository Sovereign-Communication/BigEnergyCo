// Server-side counterpart to the pre-push hook.
//
// Usage:
//   node scripts/direct-push-audit.mjs --before <sha> --after <sha>
//   node scripts/direct-push-audit.mjs            # audit the tip commit
//
// Exits non-zero when a commit that is not a PR merge/squash touched files
// outside the documentation set — the one flavor of direct push to main the
// project forbids. Every commit in the pushed range is inspected, because a
// force-push or a multi-commit push could otherwise hide one.
import { commitMessage, directPushVerdict } from "./lib/release.mjs";
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
  try {
    return execFileSync("git", args, {
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

let before = idx("--before");
const after = idx("--after") || "HEAD";
if (before === ZERO) before = null;

const range = before ? `${before}..${after}` : null;
const commits = commitsIn(range);

if (!commits.length) {
  console.log("MAIN AUDIT: no commits to inspect");
  process.exit(0);
}

const violations = [];
let docsOnly = 0;
let fromPr = 0;

for (const sha of commits) {
  const message = commitMessage(sha);
  const single = `${sha}^..${sha}`;
  let verdict;
  try {
    verdict = directPushVerdict({ range: single, message });
  } catch {
    continue;
  }
  if (verdict.ok) {
    if (/PR merge commit/.test(verdict.reason)) fromPr++;
    else docsOnly++;
    continue;
  }
  violations.push({
    sha: sha.slice(0, 8),
    subject: message.split("\n")[0],
    files: verdict.files,
  });
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

if (violations.length) {
  console.error(
    "\nMain is staging: it publishes the staging mirror and is the revision the\n" +
      "brand-domain promote is verified against. Revert the direct commit and\n" +
      "land the change through a PR with green checks.",
  );
  process.exit(1);
}
process.exit(0);
