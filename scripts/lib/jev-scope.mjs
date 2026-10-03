// Which plan item is this PR about?
//
// One concern: a PR's title, read as a scope. It is here rather than beside
// the evidence rules because it has nothing to do with them — the jev-complete
// CI job reads this module directly to decide which facets to judge, and the
// evidence builder never touches it.
import { NAMED_SCOPE_FACETS, SCOPE_FACETS } from "./jev-complete.mjs";

// This exact standalone label evaluates only the public Cloudflare contest
// surface. It is not a master-plan item and has a separate facet registry.
const NAMED_SCOPE = /(?<![A-Z0-9])CF-SHOWCASE(?![A-Z0-9])/gi;

// Plan item ids, with an optional sub-letter the plan does not actually use:
// P0.3d normalises to P0.3 rather than inventing an id the plan never lists.
const PLAN_ITEM = /\bP(\d+)(?:\.(\d+))?([a-z])?\b/g;
function normalisePlanItem(match) {
  const [, major, minor] = match;
  return minor === undefined ? `P${major}` : `P${major}.${minor}`;
}

/**
 * Which plan item is this PR about? §9 rule 1 requires a PR to name its plan
 * items, and that name is the only thing that tells the gate which facets to
 * judge. A title that names none does not fall back to the whole program — that
 * would silently judge the P10 exit bar on every PR.
 */
export function resolveCiScope(title) {
  const text = typeof title === "string" ? title : "";
  const considered = [];
  const resolved = new Map();
  for (const match of text.matchAll(PLAN_ITEM)) {
    const id = normalisePlanItem(match);
    if (considered.includes(id)) continue;
    considered.push(id);
    if (Object.prototype.hasOwnProperty.call(SCOPE_FACETS, id)) {
      resolved.set(id, match[0]);
    }
  }
  for (const match of text.matchAll(NAMED_SCOPE)) {
    const id = match[0].toUpperCase();
    if (considered.includes(id)) continue;
    considered.push(id);
    if (Object.prototype.hasOwnProperty.call(NAMED_SCOPE_FACETS, id)) {
      resolved.set(id, match[0]);
    }
  }
  if (resolved.size === 0) {
    return {
      scope: null,
      considered,
      error:
        `no recognized scope id in the title (looked for ${considered.join(", ") || "none"}). ` +
        'Name the item this PR delivers, e.g. "(P1.3)", or the named ' +
        'contest scope "CF-SHOWCASE" — §9 rule 1, and the ' +
        "gate cannot choose which facets to judge without it.",
    };
  }
  if (resolved.size > 1) {
    return {
      scope: null,
      considered: [...resolved.keys()],
      error:
        `the title names more than one plan item (${[...resolved.keys()].join(", ")}). ` +
        "A scoped run judges one item's facets; split the PR, or set the scope " +
        "explicitly.",
    };
  }
  // `[...resolved]` would destructure the Map into [key, value] entries; the
  // scope is the single key, and a test pins that it is the id and not a pair.
  const [scope] = [...resolved.keys()];
  return { scope, considered, error: null };
}
