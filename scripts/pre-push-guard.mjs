// CLI used by .githooks/pre-push. Prints why a direct push is refused and
// exits non-zero so git aborts the push.
//
// Usage: node scripts/pre-push-guard.mjs <range|sha> <remote-ref>
import {
  blockMessage,
  commitMessage,
  directPushVerdict,
} from "./lib/release.mjs";

const [range, remoteRef = "refs/heads/main"] = process.argv.slice(2);
if (!range) {
  console.error("pre-push-guard: missing revision range");
  process.exit(1);
}

const branch = remoteRef.replace("refs/heads/", "");
const verdict = directPushVerdict({ range, message: commitMessage(range) });

if (verdict.ok) process.exit(0);

console.error(blockMessage(branch, verdict.files));
process.exit(1);
