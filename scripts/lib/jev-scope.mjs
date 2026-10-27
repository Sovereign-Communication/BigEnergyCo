// Which plan item is this PR about? — flexible edition.
//
// The gate infers scope semantically, not syntactically. Wording variations
// in the title ("blog post" vs "(P9.7)" vs "P9.7 content") must not trip it up.
// The resolver tries, in order:
//   1. Explicit P-item ID in the title (tolerant: "P9.7", "(P9.7)", "p9.7" all work)
//   2. File-path inference (blog/** → P9.7, locales → P9.1, etc.). A ledger
//      row is progress evidence; it does not override the named plan item.
//   3. Title keyword inference ("blog", "locale", "i18n", etc.)
// Only when all three fail does it return null — and even then, the caller
// decides whether that's fatal, not this module.
import { SCOPE_FACETS } from "./jev-complete.mjs";

// Plan item ids, tolerant: P9.7, (P9.7), p9.7, P9.7a all normalise.
const PLAN_ITEM = /\bP(\d+)(?:\.(\d+))?([a-z])?\b/gi;
function normalisePlanId(raw) {
  const match = /^P(\d+)(?:\.(\d+))?([a-z])?$/i.exec(String(raw || ""));
  if (!match) return null;
  const [, major, minor] = match;
  return minor === undefined ? `P${major}` : `P${major}.${minor}`;
}
function normalisePlanItem(match) {
  return normalisePlanId(match && match[0]);
}

// File-path → scope inference. Order matters: more specific first.
// Note: the three canonical plan files are handled by governance precedence
// in resolveCiScope, not here. A proposal document resolves from the plan
// item its filename names (see PROPOSAL_DOC below).
const PATH_SCOPE_RULES = [
  { pattern: /^blog\//, scope: "P9.7", reason: "touches blog/" },
  { pattern: /locales?\.js$/, scope: "P9.1", reason: "touches locale files" },
  { pattern: /^assets\/js\/i18n/, scope: "P9.1", reason: "touches i18n files" },
];

// Title keyword → scope inference (case-insensitive).
// Note: "plan" is deliberately NOT a keyword — "mentions the plan itself"
// is too vague to infer P0.1. Use docs/plan/ path inference instead.
const TITLE_KEYWORD_RULES = [
  { pattern: /\bblog\b/i, scope: "P9.7", reason: 'title mentions "blog"' },
  {
    pattern: /\b(content|article|post)\b/i,
    scope: "P9.7",
    reason: "title mentions content",
  },
  {
    pattern: /\b(locale|i18n|dutch|translation)\b/i,
    scope: "P9.1",
    reason: "title mentions locale",
  },
];

// Dependency / CI maintenance. A dependabot or release-chore PR carries no plan
// item — package manifests, lockfiles and workflow files are the whole of its
// surface — so a scoped judgment has nothing to scope TO. Before this route
// existed those PRs died at the scope step and held the required `jev-complete`
// check red forever (the npm-group PR #314 was the first casualty). The route
// resolves with NO scope and no error; the caller decides what that means. The
// workflow runs the full advisory report instead of a scoped one, and the
// post-merge full run on main stays the gate (D-03: each PR report is attached
// but advisory because its merge SHA is not the final staging commit).
const MAINTENANCE_FILES = [
  /^package\.json$/,
  /^package-lock\.json$/,
  /^npm-shrinkwrap\.json$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)bun\.lockb?$/,
  /^\.github\//,
];
function isMaintenanceFile(file) {
  return MAINTENANCE_FILES.some((pattern) => pattern.test(file));
}

// Only canonical plan documents use governance precedence. LEDGER.jsonl is a
// progress record required by §9, so its path must not hide the phase being
// proved by the same PR.
const GOVERNANCE_PLAN_FILES = new Set([
  "docs/plan/MASTER_PLAN.md",
  "docs/plan/AMENDMENTS.md",
  "docs/plan/PLAN.lock.json",
]);

// Proposal documents. A proposal amends exactly one plan item and changes no
// plan text, so the item it would amend is part of its name:
//
//   docs/plan/PROPOSED-AMENDMENT-<plan item>-<slug>.md
//
// The resolver stays pure (title + changed paths) and never reads prose to
// guess a scope. A proposal resolves only when the PR carries nothing outside
// docs/plan/, so a document can never widen a code change's scope.
const PROPOSAL_DOC =
  /^docs\/plan\/PROPOSED-AMENDMENT-(P\d+(?:\.\d+)?[a-z]?)-[^/]+\.md$/i;
const PLAN_DIR = /^docs\/plan\//;

/**
 * Resolve the CI scope for a PR, tolerantly.
 *
 * Precedence (owner, 2026-10-18): canonical plan documents beat the title.
 * A PR that modifies MASTER_PLAN.md, AMENDMENTS.md, or PLAN.lock.json is doing
 * governance work, even if its title names the item it creates. Judging a
 * plan-amendment PR against the new item's own facets is circular. LEDGER.jsonl
 * is the append-only progress record required by §9, not a plan amendment, so
 * it follows the title's phase scope.
 *
 * @param {object} input - { title: string, files?: string[] }
 * @returns {{ scope: string|null, how: string, considered: string[], error: string|null, coverageNote?: string, maintenance?: boolean }}
 *   how: "governance" | "proposal" | "explicit" | "path-inferred" | "keyword-inferred" | "maintenance" | null
 *   coverageNote: when scope was inferred (not explicit), notes that the plan
 *     may not fully encompass the PR's requirements — a finding for the
 *     judgment to consider, not a hard failure.
 *   maintenance: true for dependency/CI release chores — scope null, error
 *     null. The caller decides the non-fatal path; see MAINTENANCE_FILES.
 */
export function resolveCiScope(input) {
  const title = typeof input === "string" ? input : (input?.title ?? "");
  const files =
    typeof input === "object" && Array.isArray(input?.files) ? input.files : [];
  const considered = [];

  // 0. Governance precedence: a PR that modifies the plan itself is governance
  // work, regardless of what P-item its title names.
  const touchesPlan = files.some((f) => GOVERNANCE_PLAN_FILES.has(f));
  if (touchesPlan) {
    for (const match of title.matchAll(PLAN_ITEM)) {
      const id = normalisePlanItem(match);
      if (!considered.includes(id)) considered.push(id);
    }
    return {
      scope: "P0.1",
      how: "governance",
      considered,
      error: null,
      inferenceReason: "modifies docs/plan/ — governance work",
      coverageNote:
        "This PR modifies the plan itself. Judged as governance (P0.1 facets), " +
        "not against the plan item it creates. The new item's facets apply to " +
        "future PRs, not this one.",
    };
  }

  // 0b. Proposal documents: the amended item is in the filename, not inferred.
  const proposals = [];
  for (const file of files) {
    const match = PROPOSAL_DOC.exec(file);
    if (!match) continue;
    const id = normalisePlanId(match[1]);
    if (id && !proposals.includes(id)) proposals.push(id);
  }
  if (proposals.length > 0) {
    const outside = files.filter((f) => !PLAN_DIR.test(f));
    if (outside.length > 0) {
      return {
        scope: null,
        how: null,
        considered: proposals,
        error:
          "a proposal document amends a plan item and cannot be judged " +
          `alongside changes outside docs/plan/ (${outside.join(", ")}). ` +
          "Split the proposal from the change it would authorise.",
      };
    }
    const titledScopes = [];
    for (const match of title.matchAll(PLAN_ITEM)) {
      const id = normalisePlanItem(match);
      if (
        id &&
        Object.prototype.hasOwnProperty.call(SCOPE_FACETS, id) &&
        !titledScopes.includes(id)
      ) {
        titledScopes.push(id);
      }
    }
    const considered = [...new Set([...titledScopes, ...proposals])];
    if (proposals.length > 1) {
      return {
        scope: null,
        how: null,
        considered,
        error:
          `the proposal documents name more than one plan item (${proposals.join(", ")}). ` +
          "A scoped run judges one item's facets.",
      };
    }
    const [proposalScope] = proposals;
    if (!Object.prototype.hasOwnProperty.call(SCOPE_FACETS, proposalScope)) {
      return {
        scope: null,
        how: null,
        considered,
        error:
          `the proposal filename names "${proposalScope}", which is not a plan item the gate knows. ` +
          "Name the item it amends: docs/plan/PROPOSED-AMENDMENT-<item>-<slug>.md.",
      };
    }
    if (titledScopes.length > 0 && !titledScopes.includes(proposalScope)) {
      return {
        scope: null,
        how: null,
        considered,
        error:
          `the title names ${titledScopes.join(", ")} but the proposal amends ${proposalScope}. ` +
          "They must agree; a proposal PR judges the item it amends.",
      };
    }
    return {
      scope: proposalScope,
      how: "proposal",
      considered,
      error: null,
      inferenceReason: `proposal document amends ${proposalScope}`,
      coverageNote:
        "Scope comes from the plan item the proposal's filename names. The " +
        "proposal changes no plan text, so this judges the proposal, not the " +
        "policy it argues for.",
    };
  }

  // 1. Explicit P-item in title (tolerant matching).
  const resolved = new Map();
  for (const match of title.matchAll(PLAN_ITEM)) {
    const id = normalisePlanItem(match);
    if (considered.includes(id)) continue;
    considered.push(id);
    if (Object.prototype.hasOwnProperty.call(SCOPE_FACETS, id)) {
      resolved.set(id, match[0]);
    }
  }
  if (resolved.size === 1) {
    const [scope] = [...resolved.keys()];
    return { scope, how: "explicit", considered, error: null };
  }
  if (resolved.size > 1) {
    return {
      scope: null,
      how: null,
      considered: [...resolved.keys()],
      error:
        `the title names more than one plan item (${[...resolved.keys()].join(", ")}). ` +
        "A scoped run judges one item's facets; split the PR, or set the scope explicitly.",
    };
  }

  // 2. File-path inference.
  for (const { pattern, scope, reason } of PATH_SCOPE_RULES) {
    if (files.some((f) => pattern.test(f))) {
      if (Object.prototype.hasOwnProperty.call(SCOPE_FACETS, scope)) {
        return {
          scope,
          how: "path-inferred",
          considered,
          error: null,
          inferenceReason: reason,
          coverageNote:
            "Scope inferred from changed files, not explicit in title. " +
            "The plan may not fully encompass this PR's requirements — " +
            "treat as a finding, not a failure.",
        };
      }
    }
  }

  // 3. Title keyword inference.
  for (const { pattern, scope, reason } of TITLE_KEYWORD_RULES) {
    if (pattern.test(title)) {
      if (Object.prototype.hasOwnProperty.call(SCOPE_FACETS, scope)) {
        return {
          scope,
          how: "keyword-inferred",
          considered,
          error: null,
          inferenceReason: reason,
          coverageNote:
            "Scope inferred from title keywords, not an explicit plan item ID. " +
            "The plan may not fully encompass this PR's requirements — " +
            "treat as a finding, not a failure.",
        };
      }
    }
  }

  // 4. Dependency / CI maintenance: every changed file is a manifest, lockfile
  // or workflow file and no rule above claimed the PR. This is a release chore,
  // not a plan item — no scope is invented for it, and nothing is judged as if
  // it were. The caller chooses the non-fatal path.
  if (files.length > 0 && files.every(isMaintenanceFile)) {
    return {
      scope: null,
      how: "maintenance",
      maintenance: true,
      considered,
      error: null,
      coverageNote:
        "Dependency/CI maintenance only — manifests, lockfiles and workflow " +
        "files. No plan item owns this change, so no scoped judgment applies. " +
        "The full advisory report covers it, and the post-merge full run on " +
        "main is the gate.",
    };
  }

  // Truly cannot determine scope.
  return {
    scope: null,
    how: null,
    considered,
    error:
      "could not determine scope from title or changed files. " +
      'Add a plan item ID to the title (e.g. "(P9.7)"), or use a plan ' +
      "document route: a canonical plan file, or a proposal named " +
      "docs/plan/PROPOSED-AMENDMENT-<plan item>-<slug>.md.",
  };
}
