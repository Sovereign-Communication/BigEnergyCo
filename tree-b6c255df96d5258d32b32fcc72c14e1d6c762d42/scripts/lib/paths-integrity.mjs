// The comparability audit for the four-path model, kept OUT of the shipped
// bundle on purpose (see the note at the foot of assets/js/sizing/paths.js).
//
// This is a BUILD assertion: scripts/check-comparison.mjs and
// tests/comparison.test.mjs run it. No visitor ever triggers it, so putting
// it in paths.js would put a self-check on the wire for nothing. The numbers
// it audits are all still exported from paths.js.
//
// The property being enforced is the one the comparison facet actually asks
// for: the four paths must be priced against ONE sized system under ONE set
// of definitions, so the gap between them is a real gap and not a difference
// in what each path counts.
import { HORIZON_YEARS, PATH_IDS } from "../../assets/js/sizing/paths.js";

/** Every way the four paths can fail to be comparable, as readable strings. */
export function comparisonIntegrity(result) {
  const problems = [];
  if (!result || !Array.isArray(result.paths)) return ["no pricing result"];
  if (result.paths.length !== PATH_IDS.length)
    problems.push(
      `expected ${PATH_IDS.length} paths, got ${result.paths.length}`,
    );
  const ids = result.paths.map((p) => p.id).join(",");
  if (ids !== PATH_IDS.join(",")) problems.push(`path order drifted: ${ids}`);
  for (const p of result.paths) {
    if (!p.available) continue;
    if (p.horizonYears !== HORIZON_YEARS)
      problems.push(`${p.id}: horizon ${p.horizonYears} != ${HORIZON_YEARS}`);
    // R-PATH-07: spend20 IS year0 - incentives + recurring. If a path reports
    // a number that is not its own definition, the card and the premium
    // computed from it are two different stories.
    const expect = p.year0 - p.incentives + p.recurringTotal;
    if (Math.round(expect) !== p.spend20)
      problems.push(
        `${p.id}: spend20 ${p.spend20} != year0 - incentives + recurring (${Math.round(expect)})`,
      );
    if (p.recurringTotal < 0)
      problems.push(`${p.id}: negative recurring total`);
    if (p.year0Low > p.year0 || p.year0 > p.year0High)
      problems.push(`${p.id}: year-0 range does not contain its own mid`);
    if (p.recurringByYear.length !== HORIZON_YEARS)
      problems.push(
        `${p.id}: recurring schedule is not ${HORIZON_YEARS} years`,
      );
  }
  // Residual bills, baseline bills and bill cut are PHYSICS. If two available
  // paths disagree on any of them, one was priced against a different system
  // — the exact defect this module exists to remove.
  for (const field of ["billCutPct", "residualBills20", "baselineBills20"]) {
    const seen = new Map();
    for (const p of result.paths) {
      if (!p.available || p[field] === null) continue;
      if (!seen.has(p[field])) seen.set(p[field], []);
      seen.get(p[field]).push(p.id);
    }
    if (seen.size > 1)
      problems.push(
        `paths disagree on ${field} (${[...seen.entries()]
          .map(([v, ids2]) => `${ids2.join("+")}=${v}`)
          .join(", ")}): they were not priced against one system`,
      );
  }
  // The ranking has to be ACCOUNTED FOR, not merely reported.
  for (const edge of result.rankingExplained || [])
    if (!edge.explained)
      problems.push(
        `ranking cannot be accounted for: ${edge.cheaper} vs ${edge.dearer} (gap ${edge.gap}, components sum to ${edge.gap - edge.residual})`,
      );
  // Four identical numbers are not a comparison either.
  const spends = result.paths.filter((p) => p.available).map((p) => p.spend20);
  if (spends.length > 1 && new Set(spends).size === 1)
    problems.push(
      "every available path prices identically: nothing was compared",
    );
  return problems;
}
