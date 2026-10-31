// Bucketed "why is the score low" explainer for the Jev complete gate.
//
// OWNERSHIP. This module invents nothing:
//   - buckets, labels, work types and suggested actions come from the report,
//     which took them from the pack (the pack owns every bucket);
//   - facet levels, ordinals, sources and confidences come from the report;
//   - proof lines come from the evidence file — the exact text the judge saw.
// The only thing this module adds is STRUCTURE: grouping the failing facets
// under their buckets, deriving a plain-language reason per facet from the
// report's own fields, and naming the scoped shortfall when the run was
// scoped. A low score with no bucketed reasons is a verdict nobody can act
// on; this is the part that turns "87.71" into "fix these three things".
//
// Pure: no network, no filesystem, no pack import. It reads a scored report
// the way scripts/lib/jev-verdict.mjs does — the caller supplies everything.
function asRecord(value) {
  return typeof value === "object" && value !== null ? value : {};
}

/**
 * Derive the plain-language reasons a facet scored the way it did, from the
 * report's own fields only. Never guesses at model internals: every reason
 * names the field it came from.
 */
export function facetScoreReasons(axis, facet, proofLine, blockingFacets) {
  const f = asRecord(facet);
  const reasons = [];
  const blocking = Array.isArray(blockingFacets)
    ? blockingFacets.includes(axis)
    : false;
  if (blocking) {
    reasons.push(
      "a blocking facet — at or below the blocking bar, so it alone can hold the gate red",
    );
  }
  if (f.source === "live" && f.ordinal === 0) {
    reasons.push(
      "the live judge rated this facet failing — the recorded proof describes an open gap, not a passing state",
    );
  } else if (f.source === "live" && typeof f.ordinal === "number") {
    reasons.push(
      `the live judge rated this "${f.level}" (ordinal ${f.ordinal}) — short of proven`,
    );
  }
  if (f.source === "heuristic") {
    reasons.push(
      "no live judgment reached this facet — the neutral heuristic stood in; only recorded, measured proof can move it",
    );
  }
  if (f.source === "code") {
    reasons.push(
      "a code-authority fact (Jev may lower a code fact, never raise it)",
    );
  }
  if (
    typeof f.confidence === "number" &&
    !Number.isNaN(f.confidence) &&
    f.confidence < 0.5
  ) {
    reasons.push(
      `judge confidence was low (${f.confidence}) — the evidence was thin or ambiguous`,
    );
  }
  if (typeof proofLine !== "string" || !proofLine.trim()) {
    reasons.push("no proof line was recorded for this axis in the evidence");
  }
  return reasons;
}

/**
 * Explain a failing (or failed-scoped) complete-gate report as buckets of
 * focus areas, each carrying the reasons its facets scored low.
 *
 * Shape:
 *   { score, target, pass, buckets: [{
 *       bucket, label, work_type, primary, focus,
 *       facets: [{ axis, level, ordinal, source, confidence,
 *                  proof, reasons[] }]
 *     }],
 *     scoped: null | { scope, score, target, gap, ratchet,
 *                       short_of_proven: [{ axis, level, ordinal, source,
 *                                           proof, reasons[] }] } }
 */
export function explainLowScore(report, evidence = {}) {
  const rep = asRecord(report);
  const facetEvidence = asRecord(asRecord(evidence).facet_evidence);
  const facets = asRecord(rep.facets);
  const blockingFacets = Array.isArray(rep.blocking_facets)
    ? rep.blocking_facets
    : [];

  const buckets = [];
  for (const item of Array.isArray(rep.required_work)
    ? rep.required_work
    : []) {
    const entry = asRecord(item);
    const facetEntries = [];
    if (entry.axis && facets[entry.axis]) {
      const f = facets[entry.axis];
      const proof = facetEvidence[entry.axis];
      facetEntries.push({
        axis: entry.axis,
        level: f.level ?? null,
        ordinal: f.ordinal ?? null,
        source: f.source ?? null,
        confidence: f.confidence ?? null,
        proof:
          typeof proof === "string" && proof.trim()
            ? proof.slice(0, 280).trim()
            : null,
        reasons: facetScoreReasons(entry.axis, f, proof, blockingFacets),
      });
    } else if (entry.source === "hard_gate") {
      // A code-certain hard-gate failure outranks any semantic flag on the
      // same bucket — it caps the score below target no matter what the
      // semantic side says (fail-closed).
      facetEntries.push({
        axis: null,
        level: "hard gate red",
        ordinal: -1,
        source: "hard_gate",
        confidence: null,
        proof: null,
        reasons: [
          "a hard gate failed — this caps the score below target regardless of the semantic side (fail-closed)",
        ],
      });
    }
    buckets.push({
      bucket: entry.bucket ?? null,
      label: entry.label ?? null,
      work_type: entry.work_type ?? null,
      primary: entry.primary === true,
      focus: entry.suggested_next_action ?? null,
      facets: facetEntries,
    });
  }

  let scoped = null;
  const sc = asRecord(rep.scoped);
  if (sc && typeof sc.scope === "string") {
    const short = Array.isArray(sc.facets_short_of_proven)
      ? sc.facets_short_of_proven
      : [];
    scoped = {
      scope: sc.scope,
      score: sc.score ?? null,
      target: sc.min_score ?? null,
      gap:
        typeof sc.score === "number" && typeof sc.min_score === "number"
          ? Math.round((sc.min_score - sc.score) * 100) / 100
          : null,
      ratchet: asRecord(sc.ratchet).status ?? "unknown",
      short_of_proven: short.map((axis) => {
        const f = asRecord(facets[axis]);
        const proof = facetEvidence[axis];
        return {
          axis,
          level: f.level ?? null,
          ordinal: f.ordinal ?? null,
          source: f.source ?? null,
          proof:
            typeof proof === "string" && proof.trim()
              ? proof.slice(0, 280).trim()
              : null,
          reasons: facetScoreReasons(axis, f, proof, blockingFacets),
        };
      }),
    };
  }

  return {
    score: rep.score ?? null,
    target: rep.min_score ?? null,
    pass: rep.pass === true,
    buckets,
    scoped,
  };
}
