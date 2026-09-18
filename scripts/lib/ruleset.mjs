// The desired `main` ruleset, as data — no side effects, so tests can assert
// exactly what the protected path is supposed to enforce without talking to
// GitHub. `scripts/apply-branch-protection.mjs` is the only thing that applies
// it (`npm run protect`), and `npm run protect:check` compares it to the live
// ruleset and exits 1 on drift.
//
// Required check contexts are the CHECK-RUN names, which for GitHub Actions are
// the bare job names — the "Tests / web-smoke" form is UI grouping, not the
// context, and requiring it would leave a PR waiting forever on a status that
// can never be reported. Verified against
// `GET /repos/{owner}/{repo}/commits/{sha}/check-runs` on an open PR.
export const RULESET_NAME = "main-protection";

export const REQUIRED_CHECKS = ["test", "web-smoke", "coverage", "analyze"];

// Analyzer gate on FINDINGS, not just on the run.
//
// `analyze` (the CodeQL workflow's job) is a required status check, so a CodeQL
// run that ERRORS blocks a merge already. But a successful analysis that reports
// alerts still passes its check run — the findings land in the Security tab and
// nothing stops them reaching main. Blocking on them needs this rule, which is
// the only rule type that reads code-scanning alerts at all.
export const CODE_SCANNING_TOOLS = [
  {
    tool: "CodeQL",
    alerts_threshold: "errors",
    security_alerts_threshold: "high_or_higher",
  },
];

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
    {
      type: "code_scanning",
      parameters: { code_scanning_tools: CODE_SCANNING_TOOLS },
    },
    { type: "non_fast_forward" }, // no force pushes
    { type: "deletion" }, // never delete main
  ],
});

// "tool/threshold/security-threshold" — a comparable identity for a live rule.
export const analyzerIdentity = (t) =>
  [t.tool, t.alerts_threshold, t.security_alerts_threshold].join("/");
