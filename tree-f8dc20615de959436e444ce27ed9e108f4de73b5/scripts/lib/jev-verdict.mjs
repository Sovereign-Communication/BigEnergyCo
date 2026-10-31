// The scoped verdict: which facets a named plan item is judged on, and what
// makes that judgment pass.
//
// One concern, and it is pure policy: it reads a report the whole-program pass
// already produced, the pack, and the ledger, and returns the scoped block. It
// reads no files and makes no request — the caller supplies the ledger text
// (scripts/validate-jev-complete.mjs reads it) — so the merge rule below can be
// read and argued about without knowing how anything is loaded.
import {
  checkRatchet,
  planItemAtLeast,
  readRatchetBaseline,
  resolveScopeFacets,
  COMPLETE_EXIT_RULE_FROM,
} from "./jev-complete.mjs";

/**
 * Judge a named plan item's facets (P0.3(c) / §13.3).
 *
 * The whole-program verdict above is the P10 bar and is expected to fail until
 * then. A scoped run judges only the facets the named item changes, against the
 * same target, AND fails on any facet that dropped below the ordinal the ledger
 * last recorded — in or out of scope.
 */
export function scopedVerdict({ report, scope, pack, ledgerText }) {
  const scopeFacets = resolveScopeFacets(scope, pack);
  const inScope = {};
  for (const axis of scopeFacets) inScope[axis] = report.facets[axis];
  const semantic =
    Object.values(inScope).reduce((s, f) => s + f.ordinal, 0) /
    Math.max(1, scopeFacets.length);
  const scopedCombined = report.hard_gates_passed
    ? Math.max(0, Math.min(100, 0.7 * report.mechanical_score + 0.3 * semantic))
    : 0;
  const ratchet = checkRatchet(
    report.facets,
    readRatchetBaseline(ledgerText, pack),
  );
  const short = scopeFacets.filter((a) => report.facets[a].index < 4);
  // The all-proven exit rule binds from COMPLETE_EXIT_RULE_FROM. P0.3(c)
  // defined the rule and is the one item it cannot judge (see the constant).
  const exitRuleBinds = planItemAtLeast(scope, COMPLETE_EXIT_RULE_FROM);
  // P0.3 bootstrap (plan §9 rule 6, owner ruling 2026-09-26): a P0.3
  // sub-PR builds the gate that judges it, so it merges on green CI plus an
  // attached scoped report with NO RATCHET REGRESSION, even below 99. The
  // ≥ 99 threshold and the all-proven rule bind from P0.4. The hard gates
  // and the ratchet bind throughout and are never relaxed.
  //
  // The ratchet test is `=== "met"`, not `!== "violation"`. An inactive
  // ratchet means nothing was checked, and "no regression" must mean
  // "checked and clean" — otherwise a run with no baseline at all would
  // sail through the very clause meant to catch a drop.
  const pass =
    report.hard_gates_passed &&
    ratchet.status === "met" &&
    (!exitRuleBinds ||
      (scopedCombined >= report.min_score && short.length === 0));
  return {
    pass,
    scoped: {
      scope,
      facets: scopeFacets,
      semantic_score: Math.round(semantic * 100) / 100,
      score: Math.round(scopedCombined * 100) / 100,
      min_score: report.min_score,
      bootstrap_applies: !exitRuleBinds,
      bootstrap_rule:
        "plan §9 rule 6: P0.3 sub-PRs merge on green CI plus no ratchet regression, even below 99",
      facets_short_of_proven: short,
      exit_rule_binds_from: COMPLETE_EXIT_RULE_FROM,
      exit_rule_binding: exitRuleBinds,
      // An inactive ratchet is stated, never implied. It is not a pass.
      ratchet:
        ratchet.status === "inactive_no_baseline"
          ? {
              status: ratchet.status,
              note:
                "no ledger row yet records per-facet ordinals, so there is no " +
                "previous level to hold; the ratchet did not run",
            }
          : ratchet,
      pass,
    },
  };
}
