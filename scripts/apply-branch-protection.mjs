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
// The desired state itself lives in scripts/lib/ruleset.mjs so it can be
// asserted by tests without side effects or GitHub credentials. Do not enable
// this until the required checks have reported at least once on a real PR, or
// every PR waits forever on a status that will never arrive.
import { execFileSync } from "node:child_process";
import {
  CODE_SCANNING_TOOLS,
  REQUIRED_CHECKS,
  RULESET_NAME,
  desiredRuleset,
} from "./lib/ruleset.mjs";

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

function main() {
  const isCheck = process.argv.includes("--check");
  const repo = slug();
  const existing = listRulesets(repo).find((r) => r.name === RULESET_NAME);

  if (isCheck) {
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
        detail.rules?.find((r) => r.type === "required_status_checks")
          ?.parameters?.required_status_checks || []
      ).map((c) => c.context),
    );
    const missing = REQUIRED_CHECKS.filter((c) => !actual.has(c));
    const hasPrRule = (detail.rules || []).some(
      (r) => r.type === "pull_request",
    );
    const hasNoForce = (detail.rules || []).some(
      (r) => r.type === "non_fast_forward",
    );
    const liveTools = (
      detail.rules?.find((r) => r.type === "code_scanning")?.parameters
        ?.code_scanning_tools || []
    ).map((t) =>
      [t.tool, t.alerts_threshold, t.security_alerts_threshold].join("/"),
    );
    const wantedTools = CODE_SCANNING_TOOLS.map((t) =>
      [t.tool, t.alerts_threshold, t.security_alerts_threshold].join("/"),
    );
    const analyzersMissing = wantedTools.filter((t) => !liveTools.includes(t));
    if (
      missing.length ||
      !hasPrRule ||
      !hasNoForce ||
      analyzersMissing.length
    ) {
      console.error(
        `FAIL ${RULESET_NAME} drift — missing checks: ${missing.join(", ") || "none"}; pull_request rule: ${hasPrRule}; non_fast_forward: ${hasNoForce}; analyzer rule missing: ${analyzersMissing.join(", ") || "none"}`,
      );
      process.exit(1);
    }
    console.log(
      `OK   ${RULESET_NAME} active on ${repo} (${detail.enforcement}), requiring ${REQUIRED_CHECKS.join(", ")}`,
    );
    console.log(
      `OK   analyzer gate active — new alerts block a merge: ${liveTools.join(", ")}`,
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
      { input: body },
    );
    console.log(
      `updated ruleset ${RULESET_NAME} (id ${existing.id}) on ${repo}`,
    );
  } else {
    const created = gh(
      ["api", "-X", "POST", `repos/${repo}/rulesets`, "--input", "-"],
      { input: body },
    );
    console.log(
      `created ruleset ${RULESET_NAME} on ${repo}: ${created.trim().slice(0, 120)}`,
    );
  }

  console.log(
    `\nmain now requires a PR with these checks: ${REQUIRED_CHECKS.join(", ")}`,
  );
  console.log(
    `and blocks on new analyzer findings: ${CODE_SCANNING_TOOLS.map((t) => `${t.tool} (${t.alerts_threshold} alerts, security ${t.security_alerts_threshold})`).join(", ")}`,
  );
  console.log(
    "Bypass: organization admins only. Docs-only direct pushes are checked by\n" +
      ".githooks/pre-push locally and .github/workflows/main-audit.yml server-side.",
  );
}

const isDirect = (() => {
  try {
    const u = new URL(import.meta.url);
    const argvFile = process.argv[1];
    if (!argvFile) return false;
    const url = new URL(`file://${argvFile.replace(/\\/g, "/")}`);
    return (
      u.pathname.endsWith(url.pathname) || url.pathname.endsWith(u.pathname)
    );
  } catch {
    return false;
  }
})();

if (isDirect) main();
