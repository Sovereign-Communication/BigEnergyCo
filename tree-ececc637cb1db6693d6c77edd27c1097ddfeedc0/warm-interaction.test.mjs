// The `performance` facet has three claims and the Lighthouse gate only ever
// measured one of them. Its facet line used to end "not warm interactions or
// memoization", which is an honest reading of a first-paint-only instrument —
// and the judge read it as an unverified facet.
//
// These tests pin the other half: that the warm claims are now MEASURED, that
// what reaches the judge is the measurement rather than a better sentence, and
// that every way the measurement can be absent falls back to saying so. A green
// line that has quietly stopped claiming the warm half is the failure these
// exist to catch.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { composeFacetLine } from "../scripts/lib/lighthouse-budgets.mjs";
import { COMPLETE_FACET_CLIP } from "../scripts/lib/jev-complete.mjs";

const GATE = "scripts/check-lighthouse.mjs";
const RUNTIME = "scripts/smoke/runtime.mjs";
const WARM = "scripts/lib/warm-interaction.mjs";

/** A Lighthouse report shaped like the one the gate writes. */
const lighthouseReport = (extra = {}) => ({
  lighthouse_version: "13.5.0",
  measured: [
    {
      scores: {
        performance: 61,
        accessibility: 100,
        "best-practices": 96,
        seo: 63,
      },
    },
    {
      scores: {
        performance: 100,
        accessibility: 100,
        "best-practices": 100,
        seo: 100,
      },
    },
    {
      scores: {
        performance: 76,
        accessibility: 100,
        "best-practices": 98,
        seo: 70,
      },
    },
  ],
  regressions: [],
  holes: [],
  ratchet_categories: ["accessibility", "best-practices", "seo"],
  ...extra,
});

/** A warm measurement shaped like the one a real run produces. */
const warmReading = (extra = {}) => ({
  ok: true,
  cold_run: { ok: true, ms: 7886 },
  warm_rerun: { ms: 64, started: true, cardPresent: true },
  warm_adjustments: {
    preview_median_ms: 10,
    confirm_median_ms: 3034,
    all_previews_rendered: true,
    all_followed_through: true,
  },
  warm_network_requests: 4,
  warm_request_urls: Array.from({ length: 4 }, () => "https://host/api/health"),
  ...extra,
});

test("WARM: the measured warm numbers reach the judge's line", () => {
  const line = composeFacetLine(
    lighthouseReport({ warm_interaction: warmReading() }),
  );
  assert.match(line, /7\.9s/, `cold sizing run missing: ${line}`);
  assert.match(line, /64ms/, `warm re-run missing: ${line}`);
  assert.match(line, /drag 10ms/, `drag preview missing: ${line}`);
  assert.match(
    line,
    /confirm 3\.0s/,
    `the 3s confirm re-slice must not be dropped because the drag was fast: ${line}`,
  );
  assert.ok(
    line.length <= COMPLETE_FACET_CLIP,
    `the composed line is ${line.length} chars, over the ${COMPLETE_FACET_CLIP}-char ` +
      "clip: it would be cut in transit and the axis would arrive without its " +
      "warm numbers",
  );
});

test("WARM: a warm measurement does not launder the noisy first-paint score", () => {
  const line = composeFacetLine(
    lighthouseReport({ warm_interaction: warmReading() }),
  );
  // A real warm reading must not make the Lighthouse composite look like a fact.
  // That score is 40-76 wide across 21 calibration runs and is not ratcheted for
  // exactly that reason, and both halves of that have to survive onto the line.
  assert.match(line, /not ratcheted/i, line);
  assert.match(
    line,
    /\d+\s*[-–]\s*\d+/,
    `the run's own spread is gone: ${line}`,
  );
  assert.match(
    line,
    /over 21 runs/,
    `the calibration envelope is gone: ${line}`,
  );
  assert.match(line, /accessibility/, line);
});

test("WARM: what the warm path put on the wire is named, not just counted", () => {
  // A bare "4 warm requests" reads as four redundant weather pulls. The line has
  // to say what they were, or the judge cannot tell a deliberate capability probe
  // from a cache that is not working.
  const named = composeFacetLine(
    lighthouseReport({ warm_interaction: warmReading() }),
  );
  assert.match(named, /4 warm requests \(all Jev \/api\/health\)/, named);

  // And the label is DERIVED from the measured URLs, so a warm path that starts
  // pulling something else cannot keep the Jev name.
  const other = composeFacetLine(
    lighthouseReport({
      warm_interaction: warmReading({
        warm_network_requests: 2,
        warm_request_urls: [
          "https://host/api/health",
          "https://host/assets/app.js",
        ],
      }),
    }),
  );
  assert.match(other, /2 warm requests(?! \(all Jev)/, other);

  // Zero is the claim the facet actually makes, so it gets said as zero.
  const zero = composeFacetLine(
    lighthouseReport({
      warm_interaction: warmReading({
        warm_network_requests: 0,
        warm_request_urls: [],
      }),
    }),
  );
  assert.match(zero, /0 warm requests/, zero);
});

test("WARM: the line's limit stays true once a warm number is on it", () => {
  const line = composeFacetLine(
    lighthouseReport({ warm_interaction: warmReading() }),
  );
  // "one unthrottled Chrome" is the remaining limit. Without it a reading from
  // one machine on a developer box reads as a population claim.
  assert.match(line, /1 unthrottled Chrome/i, line);
});

test("WARM: no measurement means the line still says the warm claims are unmeasured", () => {
  // The three ways it can be absent, all of which must fall back rather than
  // invent: never run, failed, and present-but-not-ok.
  for (const warm of [
    undefined,
    { ok: false, error: "no city suggestion for Honolulu" },
    { ok: false },
  ]) {
    const line = composeFacetLine(
      lighthouseReport(warm === undefined ? {} : { warm_interaction: warm }),
    );
    assert.match(
      line,
      /not warm interactions or memoization/,
      `a missing or failed warm measurement must leave the limit standing: ${line}`,
    );
    assert.doesNotMatch(
      line,
      /WARM,/,
      `no warm clause may be composed from a measurement that did not happen: ${line}`,
    );
  }
});

test("WARM: a partial warm reading cannot become a partial claim", () => {
  // Three of four numbers present. The line must fall back entirely rather than
  // print a warm clause with a hole in it.
  const line = composeFacetLine(
    lighthouseReport({
      warm_interaction: {
        ok: true,
        cold_run: { ok: true, ms: 7886 },
        warm_rerun: { ms: 64 },
        warm_adjustments: { preview_median_ms: 10 },
        warm_network_requests: 0,
        warm_request_urls: [],
      },
    }),
  );
  assert.doesNotMatch(line, /WARM,/, line);
  assert.match(line, /not warm interactions or memoization/, line);
});

test("WARM: the line survives the slowest plausible run", () => {
  // A cold CI runner is slower than this machine. If the numbers grow enough to
  // overflow the clip the axis is silently cut in transit, so the worst case is
  // asserted rather than discovered in a red build.
  const line = composeFacetLine(
    lighthouseReport({
      warm_interaction: warmReading({
        cold_run: { ok: true, ms: 24500 },
        warm_rerun: { ms: 1500 },
        warm_adjustments: { preview_median_ms: 120, confirm_median_ms: 12400 },
        warm_network_requests: 12,
        warm_request_urls: Array.from(
          { length: 12 },
          () => "https://host/api/health",
        ),
      }),
    }),
  );
  assert.ok(
    line.length <= COMPLETE_FACET_CLIP,
    `worst case composes to ${line.length} chars, over the ${COMPLETE_FACET_CLIP}-char ` +
      "clip: shorten the clause, do not raise the clip",
  );
});

test("WARM: the gate measures it on the real surface, not from a fixture", () => {
  const gate = readFileSync(GATE, "utf8");
  // The measurement runs inside the gate, against the same staged build the
  // Lighthouse run audited, in a real browser. A number typed into the evidence
  // file is the defect this whole path replaced.
  assert.match(
    gate,
    /measureWarmInteraction\(ctx, \{ url: srv\.url \}\)/,
    "the gate must drive the real page over the static server it already serves",
  );
  assert.match(
    gate,
    /warm_interaction: warmInteraction/,
    "the report must carry the measurement, or the line cannot be composed from it",
  );
  // A failed measurement is a hole, not a crash and not a silent pass.
  assert.match(
    gate,
    /warmInteraction = \{ ok: false, error:/,
    "a failed warm measurement must be recorded as a hole",
  );
  // Overflow fails the gate instead of letting the builder cut the line.
  assert.match(
    gate,
    /report\.facet_line\.length > COMPLETE_FACET_CLIP/,
    "an over-long facet line must fail the gate, not be cut in transit",
  );
});

test("WARM: the request count is read off the wire, not inferred", () => {
  const runtime = readFileSync(RUNTIME, "utf8");
  // If the count came from a static field the "zero redundant pulls" claim would
  // be a constant, and a constant cannot regress.
  assert.match(
    runtime,
    /Network\.requestWillBeSent/,
    "the CDP runtime must record requests so a window can be counted",
  );
  assert.match(
    runtime,
    /Network\.enable/,
    "the request log is only fed when the domain is enabled",
  );
  assert.match(
    runtime,
    /return \{ ws, send, evaluate, errors, requests, poll, close \}/,
    "the measurement reads the wire through the one existing CDP client",
  );

  const warm = readFileSync(WARM, "utf8");
  assert.match(
    warm,
    /requests\.slice\(requestsBefore\)/,
    "the warm window must be counted from the request log",
  );
  // Both ends of a slider move, because reporting one alone would either flatter
  // or libel the product.
  assert.match(warm, /preview_ms/, warm);
  assert.match(warm, /confirm_ms/, warm);
  assert.match(
    warm,
    /performance\.now\(\)/,
    "timings must come from the page clock, not the CDP round trip",
  );
});

test("WARM: the budget slider is timed on its own path, not read off the cut slider", () => {
  // The result stage carries a PAIR, and the cut slider's move is also the
  // budget thumb's observation point — so measuring only the cut slider left the
  // budget slider's own drag, label and commit assumed rather than measured.
  // Its paths are different (a cached curve walk, no worker round trip), so a
  // slow number here would be a real finding about the budget slider.
  const warm = readFileSync(WARM, "utf8");
  assert.match(warm, /WARM ADJUSTMENT: move the BUDGET slider itself/);
  assert.match(warm, /getElementById\("budgetSlider"\)/);
  assert.match(warm, /out\.budgetAdjusts\.push\(/);
  // Both ends of a budget move, for the same reason the cut slider reports both,
  // with the observables recorded separately from the timings so a zero that
  // measured nothing cannot read as a fast path.
  assert.match(warm, /preview_ms: budgetPreviewMs/);
  assert.match(warm, /relabelled,/);
  assert.match(warm, /preview_rendered: budgetPreviewed,/);
  assert.match(warm, /confirm_ms: Math\.round\(performance\.now\(\) - b1\)/);
  assert.match(warm, /committed,/);
  // Aggregated as medians plus all_* flags: one slow sample cannot hide behind
  // an average, and a sample that never committed is visible as such.
  assert.match(warm, /warm_budget_adjustments: \{/);
  assert.match(warm, /preview_median_ms: median\(budgetPreviewSamples\)/);
  assert.match(warm, /confirm_median_ms: median\(budgetConfirmSamples\)/);
  assert.match(warm, /all_committed: \(warm\.budgetAdjusts \|\| \[\]\)\.every/);
});

test("WARM: both sliders' numbers reach the report the builder reads", () => {
  const gate = readFileSync(GATE, "utf8");
  // The judge's facet line carries one slider's numbers (the 280-char clip has
  // 8 chars of headroom on the stress fixture, so a second slider's pair costs
  // more than it has — see composeFacetLine). The REPORT has no such limit, so
  // the pair's numbers belong there, side by side and named.
  assert.match(gate, /cut_preview_median_ms:/);
  assert.match(gate, /cut_confirm_median_ms:/);
  assert.match(gate, /budget_preview_median_ms:/);
  assert.match(gate, /budget_confirm_median_ms:/);
  assert.match(gate, /warm_budget_adjustments\?\.confirm_median_ms/);
  // Carried whole into the report, which is what the builder reads.
  assert.match(gate, /warm_interaction: warmInteraction/);
  // And the gate's own statement of what it measured names both sliders.
  assert.match(gate, /both result-stage sliders driven on their own paths/);
});
