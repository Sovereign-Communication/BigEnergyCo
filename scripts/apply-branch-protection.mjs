// Apply (or inspect) the `main` branch ruleset.
//
// Usage:
//   node scripts/apply-branch-protection.mjs --check   # report only, exit 1 on drift
//   node scripts/apply-branch-protection.mjs           # create or update
//
// Why a ruleset rather than classic branch protection: rulesets are readable
// and revertible as JSON, and their bypass is an explicit, auditable list.
//
// The bypass is `OrganizationAdmin`, which is the deliberate docs-only escape
// hatch — GitHub cannot express "docs-only" as a bypass *condition*, so the
// condition lives in .githooks/pre-push (blocks the push on the machine) and
// .github/workflows/main-audit.yml (fails loudly if one lands anyway). Anything
// that is not documentation must reach main through a PR.
//
// Required check contexts are the CHECK-RUN names, which for GitHub Actions are
// the bare job names — the "Tests / web-smoke" form is UI grouping, not the
// context, and requiring it would leave a PR waiting forever on a status that
// can never be reported. Verified against
// `GET /repos/{owner}/{repo}/commits/{sha}/check-runs` on an open PR.
// Do not enable this until those checks have reported at least once on a real
// PR, or every PR waits forever on a status that will never arrive.
import { execFileSync } from "node:child_process";

const RULESET_NAME = "main-protection";
const CHECK = process.argv.includes("--check");

export const REQUIRED_CHECKS = ["test", "web-smoke", "coverage", "analyze"];

export const desiredRuleset = () => ({
  name: RULESET_NAME,
  target: "branch",
  enforcement: "active",
  conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
  // OrganizationAdmin needs no actor_id and covers the maintainer.
  bypass_actors: [{ actor_type: "OrganizationAdmin", bypass_mode: "always" }],
  rules: [
    {
      type: "pull_request",
      parameters: {
        required_approving_review_count: 0, // self-merge stays allowed
        dismiss_stale_reviews_on_push: true,
        require_code_owner_review: false,
        require_last_push_approval: false,
        required_review_thread_resolution: false,
        // GitHub defaults this to true; left implicit it demands an extra
        // approval for commits it cannot attribute to an account, which a
        // single-maintainer repo can never satisfy. The gate here is CI, not a
        // second human, so state it explicitly.
        require_extra_approval_for_unattributed_changes: false,
      },
    },
    {
      type: "required_status_checks",
      parameters: {
        // Not "strict": this repo merges frequently and rebasing every PR on a
        // moving main would cost more than it catches. The staging verification
        // job is what proves the merged revision before promotion.
        strict_required_status_checks_policy: false,
        required_status_checks: REQUIRED_CHECKS.map((context) => ({ context })),
      },
    },
    { type: "non_fast_forward" }, // no force pushes
    { type: "deletion" }, // never delete main
  ],
});

function gh(args, { input } = {}) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    stdio: [input ? "pipe" : "inherit", "pipe", "pipe"],
    input,
  });
}

function slug() {
  return gh([
    "repo",
    "view",
    "--json",
    "nameWithOwner",
    "--jq",
    ".nameWithOwner",
  ]).trim();
}

function listRulesets(repo) {
  try {
    return JSON.parse(
      gh([
        "api",
        `repos/${repo}/rulesets`,
        "--jq",
        "[.[] | {id, name, enforcement}]",
      ]),
    );
  } catch (e) {
    console.error(`could not list rulesets: ${e.stderr || e.message}`);
    process.exit(1);
  }
}

const repo = slug();
const existing = listRulesets(repo).find((r) => r.name === RULESET_NAME);

if (CHECK) {
  if (!existing) {
    console.error(
      `FAIL ${RULESET_NAME} ruleset is not configured on ${repo} — main is unprotected`,
    );
    process.exit(1);
  }
  const detail = JSON.parse(
    gh(["api", `repos/${repo}/rulesets/${existing.id}`]),
  );
  const actual = new Set(
    (
      detail.rules?.find((r) => r.type === "required_status_checks")?.parameters
        ?.required_status_checks || []
    ).map((c) => c.context),
  );
  const missing = REQUIRED_CHECKS.filter((c) => !actual.has(c));
  const hasPrRule = (detail.rules || []).some((r) => r.type === "pull_request");
  const hasNoForce = (detail.rules || []).some(
    (r) => r.type === "non_fast_forward",
  );
  if (missing.length || !hasPrRule || !hasNoForce) {
    console.error(
      `FAIL ${RULESET_NAME} drift — missing checks: ${missing.join(", ") || "none"}; pull_request rule: ${hasPrRule}; non_fast_forward: ${hasNoForce}`,
    );
    process.exit(1);
  }
  console.log(
    `OK   ${RULESET_NAME} active on ${repo} (${detail.enforcement}), requiring ${REQUIRED_CHECKS.join(", ")}`,
  );
  process.exit(0);
}

const body = JSON.stringify(desiredRuleset());
if (existing) {
  gh(
    [
      "api",
      "-X",
      "PUT",
      `repos/${repo}/rulesets/${existing.id}`,
      "--input",
      "-",
    ],
    {
      input: body,
    },
  );
  console.log(`updated ruleset ${RULESET_NAME} (id ${existing.id}) on ${repo}`);
} else {
  const created = gh(
    ["api", "-X", "POST", `repos/${repo}/rulesets`, "--input", "-"],
    {
      input: body,
    },
  );
  console.log(
    `created ruleset ${RULESET_NAME} on ${repo}: ${created.trim().slice(0, 120)}`,
  );
}

console.log(
  `\nmain now requires a PR with these checks: ${REQUIRED_CHECKS.join(", ")}`,
);
console.log(
  "Bypass: organization admins only. Docs-only direct pushes are checked by\n" +
    ".githooks/pre-push locally and .github/workflows/main-audit.yml server-side.",
);
