// The `performance` axis's speed clause, and why it exists as a second half.
//
// WHY THIS TEST EXISTS: at P0.4 the gate measured CLS fall from 0.114 to 0.000
// and FCP and LCP roughly halve, on the same runner, with the same gate, and
// the `performance` ordinal did not move by a single point. The cause was not
// that the measurement was weak. It was that the composed facet line carried
// none of it — `composeFacetLine` spends all 280 characters on the warm
// reading, the target count, the three deterministic categories and the
// variance envelope, and has never put FCP, LCP or CLS in front of the judge
// even though the gate measures all three on every run. A measurement nobody
// reads cannot move anything.
//
// So the axis became TWO clauses, joined under the per-axis clip the same way
// `quality` and `accessibility` already are. These tests pin the discipline
// that makes the split honest rather than convenient:
//
//   · the numbers are DERIVED from `report.measured`, never typed;
//   · they are the WORST across every measured target, and the clause says so,
//     because a bare "FCP 2.1s" reads as a page's first paint or a median when
//     it is the slowest template in the run;
//   · FCP/LCP are stored in SECONDS and must not go through the millisecond
//     formatter the warm clause uses (that mistake renders 2.08s as "2ms");
//   · each half is bounded by its OWN declared maximum, so an over-budget half
//     is NAMED rather than trimmed, and the joint total is checked too;
//   · and the bound arithmetic is recorded, including the fact that the real
//     14-target line currently exceeds the transport clip. That is a decision
//     for the owner, not something to quietly trim a word away to make green.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  PERF_RATCHET_CLAUSE_MAX,
  PERF_SPEED_CLAUSE_MAX,
  composeFacetLine,
  composePerfClauses,
  composeSpeedClause,
  LIGHTHOUSE_FACET_AXES,
  LIGHTHOUSE_SPEED_CEILINGS,
} from "../scripts/lib/lighthouse-budgets.mjs";
import { COMPLETE_FACET_CLIP } from "../scripts/lib/jev-complete.mjs";

/** A report shaped like the gate's, with the speed readings the gate records. */
const reportWith = (measured) => ({
  measured,
  warm_interaction: {
    ok: true,
    cold_run: { ms: 5400 },
    warm_rerun: { ms: 51 },
    warm_adjustments: { preview_median_ms: 11, confirm_median_ms: 0 },
    warm_network_requests: 0,
  },
});

const target = (id, speed, perf = 90) => ({
  id,
  scores: {
    performance: perf,
    accessibility: 100,
    "best-practices": 100,
    seo: 100,
  },
  speed,
});

test("the speed clause reports the WORST target, and says so on the line", () => {
  const clause = composeSpeedClause(
    reportWith([
      target("home/mobile", { fcp_s: 1.99, lcp_s: 2.37, tbt_ms: 88, cls: 0.0 }),
      target("home/desktop", {
        fcp_s: 2.08,
        lcp_s: 2.7,
        tbt_ms: 89,
        cls: 0.005,
      }),
      target("city/mobile", { fcp_s: 0.64, lcp_s: 0.9, tbt_ms: 45, cls: 0.0 }),
    ]),
  );
  assert.equal(clause, "worst FCP 2.1s, LCP 2.7s, TBT 89/100ms, CLS 0.005");
  // The word is load-bearing, not decoration. The ratchet half says "median of
  // 3" about RUNS; without "worst" here the two halves would be describing
  // different statistics in the same words and neither would say which.
  assert.match(
    clause,
    /^worst /,
    "the clause must name that these are the worst measured, not a median or a " +
      "single page's reading",
  );
  // And it must be the max, not the first, the min, or an average.
  assert.ok(
    clause.includes("2.1s"),
    "FCP must be home/desktop's 2.08s, not the min",
  );
  assert.ok(clause.includes("2.7s"), "LCP must be home/desktop's 2.7s");
  assert.ok(clause.includes("0.005"), "CLS must be the worst 0.005, not 0");
});

test("FCP and LCP are seconds and must not read as milliseconds", () => {
  // The unit bug this pins: the warm clause's formatter takes MILLISECONDS, and
  // routing `fcp_s` through it renders 2.08 seconds as "2ms" — wrong by three
  // orders of magnitude and reading as an instant first paint.
  const clause = composeSpeedClause(
    reportWith([
      target("home/desktop", { fcp_s: 2.08, lcp_s: 2.7, tbt_ms: 89, cls: 0.0 }),
    ]),
  );
  assert.ok(!/\b2ms\b/.test(clause), `2.08s must not render as 2ms: ${clause}`);
  assert.match(clause, /FCP 2\.1s/);
  // Sub-second readings are the same trap from the other side: 0.9s is 900ms.
  const sub = composeSpeedClause(
    reportWith([
      target("city/mobile", { fcp_s: 0.64, lcp_s: 0.9, tbt_ms: 45, cls: 0 }),
    ]),
  );
  assert.match(sub, /FCP 0\.6s|FCP 640ms/);
  assert.ok(!/FCP 0\.6ms/.test(sub), `0.64s must not render as 0.6ms: ${sub}`);
});

test("a missing metric yields no clause at all, not a partial one", () => {
  // Three metrics and two is a claim about a different measurement.
  assert.equal(
    composeSpeedClause(
      reportWith([
        target("home/mobile", { fcp_s: 1.99, lcp_s: 2.37, tbt_ms: 90 }),
      ]),
    ),
    null,
    "a missing cls must suppress the whole clause, not emit FCP and LCP alone",
  );
  assert.equal(composeSpeedClause(reportWith([])), null);
  assert.equal(composeSpeedClause({}), null);
  assert.equal(composeSpeedClause(null), null);
  // A non-finite reading is a HOLE in that target, not a zero and not a
  // reason to suppress the clause: the worst of the targets that DID measure is
  // still the worst measured. What must never happen is a hole reading as 0,
  // which would report an instant first paint.
  assert.equal(
    composeSpeedClause(
      reportWith([
        target("holed", { fcp_s: Number.NaN, lcp_s: 2, tbt_ms: 80, cls: 0 }),
        target("ok", { fcp_s: 1, lcp_s: 2, tbt_ms: 80, cls: 0 }),
      ]),
    ),
    "worst FCP 1.0s, LCP 2.0s, TBT 80/100ms, CLS 0.000",
  );
  // But when NOTHING measured, that is a hole, not a zero.
  assert.equal(
    composeSpeedClause(
      reportWith([
        target("holed", { fcp_s: Number.NaN, lcp_s: 2, tbt_ms: 80, cls: 0 }),
      ]),
    ),
    null,
  );
});

test("both halves are declared, ordered, and each carries its own bound", () => {
  const report = reportWith([
    target("home/mobile", { fcp_s: 1.99, lcp_s: 2.37, tbt_ms: 88, cls: 0.0 }),
    target("home/desktop", { fcp_s: 2.08, lcp_s: 2.7, tbt_ms: 89, cls: 0.005 }),
  ]);
  const clauses = composePerfClauses(report);
  assert.equal(clauses.length, 2);
  assert.deepEqual(
    clauses.map((c) => c.half),
    ["ratchet", "speed"],
    "the ratchet half is first: it is the sentence that says how to read the run",
  );
  assert.deepEqual(
    clauses.map((c) => c.metric),
    ["perf_ratchet", "perf_speed"],
    "the join matches on metric, so both must be distinct and stable",
  );
  for (const c of clauses)
    assert.equal(
      c.max,
      c.half === "speed" ? PERF_SPEED_CLAUSE_MAX : PERF_RATCHET_CLAUSE_MAX,
      `${c.half} must be checked against its OWN bound: a half that outgrows ` +
        "its budget pushes the other half out of room",
    );
  // The ratchet half must be exactly what the gate has always published, or
  // this change is not additive.
  assert.equal(clauses[0].text, composeFacetLine(report));
});

test("the two declared bounds and the transport clip are accounted for", () => {
  // The arithmetic, stated so a change to any of the three numbers has to be a
  // deliberate edit here rather than an accident. The pair's worst case must
  // fit the transport clip, or the axis is a guaranteed build failure.
  assert.ok(
    PERF_RATCHET_CLAUSE_MAX + 1 + PERF_SPEED_CLAUSE_MAX <= COMPLETE_FACET_CLIP,
    `the two declared worst cases join to ` +
      `${PERF_RATCHET_CLAUSE_MAX + 1 + PERF_SPEED_CLAUSE_MAX}, over the ` +
      `${COMPLETE_FACET_CLIP}-char clip; the axis could not survive a run whose ` +
      "readings are wide enough to hit both declared maxima",
  );
  assert.ok(
    PERF_RATCHET_CLAUSE_MAX < COMPLETE_FACET_CLIP,
    "the ratchet half alone must fit the clip, or the axis is already broken",
  );
  assert.ok(
    PERF_SPEED_CLAUSE_MAX < COMPLETE_FACET_CLIP,
    "the speed half alone must fit the clip",
  );
});

test("MEASURED: the real 14-target line reaches the judge whole", () => {
  // The WORST case, verbatim from run 36940063636 at 10f9710: the first run
  // whose worst blocking time went OVER the Q-03 ceiling. Pinned as a
  // measurement rather than a comment, because the number that decides whether
  // the speed half reaches the judge is the one most likely to drift — the
  // ratchet half's length moves with the data (target count, the ratcheted
  // categories' spread, the perf range) — and a line that quietly outgrows the
  // clip is cut SILENTLY in transit.
  //
  // This is the case that broke, and the failure mode was backwards: the worse
  // the run, the more the number is worth showing, and a bound sized for a
  // TWO-digit TBT deleted the axis rather than reporting `TBT 104/100ms`. The
  // speed cap and COMPLETE_FACET_CLIP moved for it, and the join now sits
  // exactly on the clip — which is the point of the invariant asserted below.
  const ratchet =
    "WARM, 1 unthrottled Chrome: cold 4.3s, repeat 51ms, drag 7ms, confirm 0ms, 0 warm requests. Lighthouse, 14 targets, median of 3. ratcheted accessibility 100, best-practices 96-100, seo 63-100. perf NOT ratcheted, 72-100 this run, 40-76 over 21 runs.";
  const speed = "worst FCP 2.2s, LCP 2.9s, TBT 104/100ms, CLS 0.005";
  const joined = `${ratchet} ${speed}`;

  // Each half is inside its own bound — the split itself is sound.
  assert.ok(
    ratchet.length <= PERF_RATCHET_CLAUSE_MAX,
    `ratchet half is ${ratchet.length}, over its ${PERF_RATCHET_CLAUSE_MAX}`,
  );
  assert.ok(
    speed.length <= PERF_SPEED_CLAUSE_MAX,
    `speed half is ${speed.length}, over its ${PERF_SPEED_CLAUSE_MAX}`,
  );
  // And the join still fits, whole, with the qualifier intact.
  assert.ok(
    joined.length <= COMPLETE_FACET_CLIP,
    `the joined 14-target line is ${joined.length} chars against the ` +
      `${COMPLETE_FACET_CLIP}-char clip; it would be cut in transit and the ` +
      "speed half is exactly what a cut drops",
  );
  // The two budgets still cannot jointly overrun: the speed cap is exactly the
  // room the clip leaves once the ratchet half has its own. Without this the
  // halves can each pass their own bound and still be refused at the join.
  assert.equal(
    PERF_RATCHET_CLAUSE_MAX + 1 + PERF_SPEED_CLAUSE_MAX,
    COMPLETE_FACET_CLIP,
    "the halves' worst case must still sum to the clip",
  );
  // The word that made this cost 6 characters, asserted so a future edit
  // cannot drop it silently and leave a number that reads like a median.
  assert.ok(
    speed.startsWith("worst "),
    "the 'worst' qualifier is not optional",
  );
  // TBT is on the line as a measurement against its ceiling, not as a bare
  // number: this is the reading that closed the heatmap's Q-03 breach, and a
  // bare "TBT 89ms" would leave the reader guessing what it is measured
  // against.
  assert.match(speed, /TBT \d+\/100ms/, "TBT must carry the ceiling it met");
});

test("TBT over its ceiling is printed over, never rounded down or dropped", () => {
  // The breach is the point of the metric. A clause that quietly reported the
  // better of two numbers, or omitted TBT on the runs where it is over, would
  // make the facet line a record of the runs that went well.
  const over = composeSpeedClause(
    reportWith([
      target("heatmap/desktop", {
        fcp_s: 2.1,
        lcp_s: 4.1,
        tbt_ms: 124.4,
        cls: 0.005,
      }),
    ]),
  );
  assert.equal(over, "worst FCP 2.1s, LCP 4.1s, TBT 124/100ms, CLS 0.005");
  // The ceiling in the text is the plan's, not this file's: it is read from the
  // same table check-lighthouse reads when it raises `speed_over`.
  assert.ok(
    over.includes(`/${LIGHTHOUSE_SPEED_CEILINGS.tbt_ms}ms`),
    "the clause and the gate must quote the same ceiling",
  );
  // And the metric is still derived, not hand-typed: a second, worse target
  // raises the number.
  const worse = composeSpeedClause(
    reportWith([
      target("heatmap/desktop", {
        fcp_s: 2.1,
        lcp_s: 4.1,
        tbt_ms: 124.4,
        cls: 0,
      }),
      target("home/mobile", { fcp_s: 1, lcp_s: 2, tbt_ms: 310, cls: 0 }),
    ]),
  );
  assert.match(
    worse,
    /TBT 310\/100ms/,
    "the WORST target's reading is the one",
  );
});

test("a missing TBT suppresses the whole clause, not just that field", () => {
  // Four metrics and three is a claim about a different measurement: a clause
  // that omitted TBT would read as though the run had nothing to say about
  // blocking time.
  assert.equal(
    composeSpeedClause(
      reportWith([target("home/mobile", { fcp_s: 1.99, lcp_s: 2.37, cls: 0 })]),
    ),
    null,
    "a missing tbt_ms must suppress the whole clause",
  );
});

test("the gate emits both clauses and never lets a half be trimmed", () => {
  const gate = readFileSync("scripts/check-lighthouse.mjs", "utf8");
  // Both halves travel, each with its metric, so the builder can join them.
  assert.match(gate, /facet_clauses/, "the report must carry facet_clauses");
  // The single-clause form is kept for the case where the speed half cannot be
  // derived, so a partial measurement still reaches the judge.
  // Whitespace-tolerant: the formatter reflows ternaries, and a source
  // assertion that breaks when Prettier reformats a line is testing the
  // formatter, not the contract.
  assert.match(
    gate,
    /facet_line\s*=\s*perfClauses\s*\?\s*perfClauses\[0\]\.text\s*:\s*composeFacetLine/s,
    "facet_line must remain the ratchet half so a report with no speed " +
      "readings still carries the axis",
  );
  // Over-budget is a named failure with a non-zero exit, per half AND for the
  // join — never a slice.
  assert.ok(
    !/\.slice\(0,\s*COMPLETE_FACET_CLIP/.test(gate),
    "the gate must never trim its own line; an over-long line is a named failure",
  );
  assert.match(gate, /process\.exitCode = 1/);
});

test("the builder joins the two halves on metric, like the other two axes", () => {
  const builder = readFileSync("scripts/build-jev-evidence.mjs", "utf8");
  assert.match(
    builder,
    /d\.metric === "perf_ratchet"/,
    "the join must match on metric, the same way the a11y halves do",
  );
  assert.match(builder, /d\.metric === "perf_speed"/);
  // It reuses the one code path that already bounds a joined axis, rather than
  // growing a second join with its own idea of the rules.
  assert.match(builder, /joinAxisClauses\(evidence, problems, perfAxis/);
  // The plural clause form is additive: the single-clause path still works for
  // every other gate.
  assert.match(builder, /Array\.isArray\(parsed\.facet_clauses\)/);
  assert.match(
    builder,
    /if \(parsed\.facet_line\.length > COMPLETE_FACET_CLIP\)/,
    "the single-clause clip check must survive for the other gates",
  );
});

test("performance is declared as exactly one axis, as before", () => {
  assert.deepEqual(
    LIGHTHOUSE_FACET_AXES,
    ["performance"],
    "the split adds a second CLAUSE to the performance axis, never a second axis",
  );
});
