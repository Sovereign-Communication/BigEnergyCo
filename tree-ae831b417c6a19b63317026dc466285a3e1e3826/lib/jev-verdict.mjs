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
<<<<<<< HEAD
  COMPLETE_FACET_MIN_ORDINAL,
  COMPLETE_MIN_CONFIDENCE,
=======
  ABSOLUTE_FACET_FROM,
  facetAbsoluteFrom,
>>>>>>> a6bfb8a1 (plan(A-002): the scoped exit composes with §3.2, and the showcase carve-out is recorded)
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
  // §3.2's Projection clause (A-002): a facet that projects a gate still in
  // regression-only mode is NOT required at `proven` — the ratchet holds it
  // instead — and the ≥ 99 threshold is computed over the facets whose gates are
  // absolute at this item's phase. `absoluteFacets` is that set. When it is
  // empty the absolute requirement is vacuous and the run exits on the ratchet,
  // which is exactly the position P0.3 is in.
  const absoluteFacets = scopeFacets.filter((a) =>
    planItemAtLeast(scope, facetAbsoluteFrom(a)),
  );
  const regressionOnlyFacets = scopeFacets.filter(
    (a) => !absoluteFacets.includes(a),
  );
  const judged = absoluteFacets.length ? absoluteFacets : scopeFacets;
  const inScope = {};
  for (const axis of judged) inScope[axis] = report.facets[axis];
  const semantic =
    Object.values(inScope).reduce((s, f) => s + f.ordinal, 0) /
    Math.max(1, judged.length);
  const scopedCombined = report.hard_gates_passed
    ? Math.max(0, Math.min(100, 0.7 * report.mechanical_score + 0.3 * semantic))
    : 0;
  const ratchet = checkRatchet(
    report.facets,
    readRatchetBaseline(ledgerText, pack),
  );
<<<<<<< HEAD
  const short = scopeFacets.filter(
    (a) => report.facets[a].ordinal < COMPLETE_FACET_MIN_ORDINAL,
  );
  // A-004 (owner ruling 2026-10-19): every in-scope facet must ALSO carry a
  // Jev confidence of at least COMPLETE_MIN_CONFIDENCE. A facet the judge
  // scored without confidence — or with none recorded — has not met the bar;
  // absence is not a pass.
  const lowConfidence = scopeFacets.filter((a) => {
    const c = report.facets[a].confidence;
    return !(typeof c === "number" && c >= COMPLETE_MIN_CONFIDENCE);
  });
  // The all-proven exit rule binds from COMPLETE_EXIT_RULE_FROM. P0.3(c)
  // defined the rule and is the one item it cannot judge (see the constant).
  // P0.6 is owner-ruled (§9 rule 6, 2026-10-06) into the same bootstrap: the
  // gate's confidence calibration cannot reach `proven` on audit evidence.
  const exitRuleBinds =
    planItemAtLeast(scope, COMPLETE_EXIT_RULE_FROM) && scope !== "P0.6";
=======
  const short = absoluteFacets.filter((a) => report.facets[a].index < 4);
  // The all-proven exit rule binds from COMPLETE_EXIT_RULE_FROM, PER FACET: a
  // facet that projects a gate §3.2 still holds regression-only is judged by the
  // ratchet instead. P0.3(c) defined the rule and is the one item it cannot
  // judge (see the constant); a scope whose facets are ALL still regression-only
  // exits the same way.
  const exitRuleBinds = absoluteFacets.length > 0;
>>>>>>> a6bfb8a1 (plan(A-002): the scoped exit composes with §3.2, and the showcase carve-out is recorded)
  // P0.3 bootstrap (plan §9 rule 6, owner ruling 2026-09-26): a P0.3
  // sub-PR builds the gate that judges it, so it merges on green CI plus an
  // attached scoped report with NO RATCHET REGRESSION, even below the bar.
  // The ≥ 95 threshold, the all-facets-at-95 rule and the ≥ 0.95 confidence
  // rule (A-004, owner ruling 2026-10-19) bind from P0.4. The hard gates
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
      (scopedCombined >= report.min_score &&
        short.length === 0 &&
        lowConfidence.length === 0));
  return {
    pass,
    scoped: {
      scope,
      facets: scopeFacets,
      absolute_facets: absoluteFacets,
      regression_only_facets: regressionOnlyFacets,
      absolute_facet_from: ABSOLUTE_FACET_FROM,
      semantic_score: Math.round(semantic * 100) / 100,
      score: Math.round(scopedCombined * 100) / 100,
      min_score: report.min_score,
      bootstrap_applies: !exitRuleBinds,
      bootstrap_rule:
<<<<<<< HEAD
        scope === "P0.6"
          ? "plan §9 rule 6: P0.6 evidence PRs merge on green CI plus no ratchet regression, even below 99 (owner ruling 2026-10-06)"
          : "plan §9 rule 6: P0.3 sub-PRs merge on green CI plus no ratchet regression, even below 99",
=======
        "plan §9 rule 6: no absolute threshold applies to an item whose gates, " +
        "or whose in-scope facets' projected gates, §3.2 still holds " +
        "regression-only (P0.3's bootstrap; §3.2 Projection from A-002) — the " +
        "run exits on the ratchet, which still binds every facet",
>>>>>>> a6bfb8a1 (plan(A-002): the scoped exit composes with §3.2, and the showcase carve-out is recorded)
      facets_short_of_proven: short,
      facets_below_confidence: lowConfidence,
      min_confidence: COMPLETE_MIN_CONFIDENCE,
      facet_min_ordinal: COMPLETE_FACET_MIN_ORDINAL,
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
