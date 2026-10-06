// The bucketed score explainer: reasons derive from the report's own fields,
// buckets/labels/actions pass through from the pack-owned required_work, and
// nothing is invented. Every rule here is one a later edit could silently
// break — especially "the explainer never names a bucket the report didn't".
import test from "node:test";
import assert from "node:assert/strict";
import {
  explainLowScore,
  facetScoreReasons,
} from "../scripts/lib/jev-explain.mjs";
import {
  printExplanation,
  renderExplanationMarkdown,
} from "../scripts/lib/jev-report-print.mjs";

function makeReport() {
  return {
    score: 87.71,
    min_score: 99,
    pass: false,
    blocking_facets: ["privacy"],
    facets: {
      privacy: {
        bucket: "privacy_gap",
        authority: "jev",
        level: "failing — evidence contradicts quality",
        index: 0,
        ordinal: 0,
        source: "live",
        confidence: 0.9,
      },
      comparison: {
        bucket: "comparison_gap",
        authority: "jev",
        level: "mixed — partial or unverified evidence",
        index: 2,
        ordinal: 60,
        source: "live",
        confidence: 0.3,
      },
      docs: {
        bucket: "docs_gap",
        authority: "jev",
        level: "mixed — partial or unverified evidence",
        index: 2,
        ordinal: 60,
        source: "heuristic",
        confidence: null,
      },
    },
    required_work: [
      {
        bucket: "privacy_gap",
        label: "Privacy gap",
        path_id: "P1",
        work_type: "adversarial-fix",
        suggested_next_action: "Audit data egress.",
        axis: "privacy",
        level: "failing — evidence contradicts quality",
        ordinal: 0,
        source: "live",
        primary: true,
      },
      {
        bucket: "tests_gap",
        label: "Tests gap",
        path_id: "P0",
        work_type: "contract-tests",
        suggested_next_action: "Make the suite green.",
        axis: null,
        level: null,
        ordinal: -1,
        source: "hard_gate",
        primary: false,
      },
    ],
    scoped: {
      scope: "P0.4",
      facets: ["quality"],
      score: 94.75,
      min_score: 99,
      facets_short_of_proven: ["quality"],
      ratchet: { status: "met" },
      pass: false,
    },
  };
}

function makeEvidence() {
  return {
    facet_evidence: {
      privacy: "Coordinates are NOT rounded: raw lat/lon leaves the device.",
      comparison: "2 of the 4 purchase paths exist.",
      // docs deliberately absent: the explainer must say so, not invent one.
    },
  };
}

test("buckets pass through pack-owned fields; facets carry reasons + proof", () => {
  const expl = explainLowScore(makeReport(), makeEvidence());
  assert.equal(expl.score, 87.71);
  assert.equal(expl.target, 99);
  assert.equal(expl.pass, false);
  assert.equal(expl.buckets.length, 2);

  const [privacy, tests] = expl.buckets;
  assert.equal(privacy.bucket, "privacy_gap");
  assert.equal(privacy.label, "Privacy gap");
  assert.equal(privacy.work_type, "adversarial-fix");
  assert.equal(privacy.primary, true);
  assert.equal(privacy.focus, "Audit data egress.");
  assert.equal(privacy.facets.length, 1);
  const pf = privacy.facets[0];
  assert.equal(pf.axis, "privacy");
  assert.equal(pf.ordinal, 0);
  assert.equal(pf.source, "live");
  assert.ok(
    pf.proof.includes("Coordinates are NOT rounded"),
    "quotes the proof line the judge saw",
  );
  assert.ok(
    pf.reasons.some((r) => r.includes("blocking facet")),
    "names the blocking bar",
  );
  assert.ok(
    pf.reasons.some((r) => r.includes("rated this facet failing")),
    "says the live judge rated it failing",
  );

  // Hard-gate bucket: no facet invented, fail-closed reason stated.
  assert.equal(tests.facets.length, 1);
  assert.equal(tests.facets[0].axis, null);
  assert.equal(tests.facets[0].source, "hard_gate");
  assert.ok(
    tests.facets[0].reasons.some((r) => r.includes("fail-closed")),
    "hard-gate failure states the cap rule",
  );
});

test("heuristic, low-confidence, and missing-proof reasons", () => {
  const expl = explainLowScore(makeReport(), makeEvidence());
  const byAxis = Object.fromEntries(
    expl.buckets.flatMap((b) => b.facets.map((f) => [f.axis, f])),
  );
  // docs has no required_work entry here; exercise facetScoreReasons directly.
  const docsReasons = facetScoreReasons(
    "docs",
    makeReport().facets.docs,
    undefined,
    [],
  );
  assert.ok(
    docsReasons.some((r) => r.includes("neutral heuristic")),
    "heuristic source is named",
  );
  assert.ok(
    docsReasons.some((r) => r.includes("no proof line")),
    "missing proof line is stated, not papered over",
  );
  const compReasons = facetScoreReasons(
    "comparison",
    makeReport().facets.comparison,
    "2 of the 4 purchase paths exist.",
    [],
  );
  assert.ok(
    compReasons.some((r) => r.includes("low (0.3)")),
    "low judge confidence is surfaced",
  );
  assert.ok(byAxis.privacy, "privacy facet present");
});

test("scoped shortfall names the facets and the gap", () => {
  const expl = explainLowScore(makeReport(), makeEvidence());
  assert.ok(expl.scoped);
  assert.equal(expl.scoped.scope, "P0.4");
  assert.equal(expl.scoped.gap, 4.25);
  assert.equal(expl.scoped.ratchet, "met");
  assert.equal(expl.scoped.short_of_proven.length, 1);
  assert.equal(expl.scoped.short_of_proven[0].axis, "quality");
});

test("markdown rendering carries buckets, reasons, and focus", () => {
  const md = renderExplanationMarkdown(
    explainLowScore(makeReport(), makeEvidence()),
  );
  assert.ok(md.includes("## Why the score is 87.71 (target 99)"));
  assert.ok(md.includes("`privacy_gap`"));
  assert.ok(md.includes("Audit data egress."));
  assert.ok(md.includes("Coordinates are NOT rounded"));
  assert.ok(md.includes("P0.4"));
});

test("console rendering writes the same substance", () => {
  let out = "";
  printExplanation(explainLowScore(makeReport(), makeEvidence()), {
    write: (s) => {
      out += s;
    },
  });
  assert.ok(out.includes("why the score is 87.71"));
  assert.ok(out.includes("[privacy_gap]"));
  assert.ok(out.includes("focus: Audit data egress."));
});

test("a passing report explains nothing", () => {
  const report = makeReport();
  report.pass = true;
  report.required_work = [];
  report.scoped = null;
  const expl = explainLowScore(report, makeEvidence());
  assert.equal(expl.buckets.length, 0);
  assert.equal(expl.scoped, null);
});
