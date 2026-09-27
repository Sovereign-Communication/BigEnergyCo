// The judge could not see the Lighthouse measurement, and the `performance`
// facet line it read instead was a HAND-TYPED PROXY: "eager first-load JS is
// 786,390 bytes… Perf suite 4/4". A real browser measurement existed as a CI
// artifact and nothing composed it into the record, which is the same defect
// class as `ci_green` reading true on a red quality-lab run until #161 fixed
// it.
//
// These tests are written before the wiring. All of them fail against the tree
// they landed on: there is no derived-facet pass in the builder, the Lighthouse
// report declares no facet axes, and the workflow uploads the report under a
// name the judge never downloads.
//
// What is being prevented here is specific and twofold:
//
//   1. A hand-typed number reaching the judge as if it were a measurement. The
//      `performance` line must come from the run that produced it.
//   2. A real measurement reaching the judge MISREPRESENTED. The Lighthouse
//      performance score is bimodal on an unchanged tree (home/mobile 61-73,
//      heatmap/desktop 40-76 over 21 runs), so a line that prints one median
//      with no spread and no "this is not ratcheted" is as false as a stale
//      byte count — it just fails in the direction of looking good.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COMPLETE_FACET_CLIP } from "../scripts/lib/jev-complete.mjs";

const WORKFLOW_YAML = readFileSync(".github/workflows/test.yml", "utf8");
const PROSE = JSON.parse(
  readFileSync("evidence/advisor-and-release.json", "utf8"),
);

test("EVIDENCE: the performance facet line is derived from the run, not typed by hand", () => {
  // The defect, pinned as a standing condition rather than a one-off: if the
  // prose file goes back to carrying a hand-typed performance line, there are
  // two sources of truth for the same facet and the stale one wins by accident.
  assert.equal(
    Object.hasOwn(PROSE.facet_evidence || {}, "performance"),
    false,
    "evidence/advisor-and-release.json must not carry a hand-typed " +
      "`performance` line. The Lighthouse gate composes it from the run that " +
      "measured it, so a typed line here is a second, unverified source for the " +
      "same facet - and it is the one that was wrong.",
  );
  // …and the other axes stay typed, because nothing measures them yet. This is
  // the scope boundary: this cluster wires Lighthouse, not everything.
  assert.ok(
    Object.keys(PROSE.facet_evidence || {}).length > 10,
    "the remaining axes keep their prose lines; only the measured one is derived",
  );
});

test("EVIDENCE: a gate report declares which facet axes it speaks for", async () => {
  const { LIGHTHOUSE_TARGETS } =
    await import("../scripts/lib/lighthouse-budgets.mjs");
  assert.ok(LIGHTHOUSE_TARGETS.length, "the gate declares its targets");

  // The report the job uploads has to say which facets it is the evidence for,
  // or the builder has to keep a list of gate names beside it — which is the
  // exact list-beside-the-code defect #161 removed from ci_green.
  const gateSrc = readFileSync("scripts/check-lighthouse.mjs", "utf8");
  assert.match(
    gateSrc,
    /facet_axes\s*:/,
    "the Lighthouse report must declare facet_axes, so the builder discovers " +
      "which facets it speaks for instead of holding a list of gate names",
  );
  assert.match(
    gateSrc,
    /performance/,
    "…and the axis it speaks for is the one the gate measures",
  );
});

test("EVIDENCE: a derived facet line must fit the transport clip", () => {
  // COMPLETE_FACET_CLIP is 280 characters. A line longer than that is SILENTLY
  // clipped on its way to the judge, which for this cluster is the worst
  // possible failure: the honest part ("this score is not reproducible, do not
  // read it as a fact") is exactly what gets cut off the end.
  assert.equal(
    COMPLETE_FACET_CLIP,
    280,
    "the per-axis clip this test budgets against; if it moves, re-measure",
  );
  const src = readFileSync("scripts/check-lighthouse.mjs", "utf8");
  assert.match(
    src,
    /COMPLETE_FACET_CLIP|facet_line/,
    "the gate composes its own facet line and must know the clip it has to fit",
  );
  assert.match(
    readFileSync(BUILDER, "utf8"),
    /COMPLETE_FACET_CLIP/,
    "the builder must validate a composed line against the clip and name the " +
      "problem, rather than letting transport cut it silently",
  );
});

test("EVIDENCE: the composed performance line carries the spread, not one number", async () => {
  // The real content check. A line that reads like "performance 84" is false
  // here: the same unchanged tree measured 61-73 on home/mobile and 40-76 on
  // heatmap/desktop across 21 runs. The line must therefore say the score is
  // not ratcheted, and must carry a spread, or it is a single stable fact
  // presented where none exists.
  const { composeFacetLine } =
    await import("../scripts/lib/lighthouse-budgets.mjs").catch(() => ({}));
  assert.equal(
    typeof composeFacetLine,
    "function",
    "the gate must own composing its facet line, so the honesty rules live " +
      "with the measurement rather than in the transport",
  );

  const report = {
    lighthouse_version: "13.5.0",
    measured: [
      {
        id: "home/mobile",
        formFactor: "mobile",
        scores: {
          performance: 84,
          accessibility: 100,
          "best-practices": 100,
          seo: 100,
        },
        runScores: [
          { performance: 84 },
          { performance: 61 },
          { performance: 73 },
        ],
        speed: { lcp_s: 4.6, cls: 0.121, tbt_ms: 22 },
      },
      {
        id: "heatmap/desktop",
        formFactor: "desktop",
        scores: {
          performance: 66,
          accessibility: 100,
          "best-practices": 100,
          seo: 100,
        },
        runScores: [{ performance: 66 }],
        speed: { lcp_s: 1.7, cls: 0, tbt_ms: 203 },
      },
    ],
    regressions: [],
    holes: [],
    ratchet_categories: ["accessibility", "best-practices", "seo"],
  };

  const line = composeFacetLine(report);
  assert.equal(typeof line, "string");
  assert.ok(
    line.length <= COMPLETE_FACET_CLIP,
    `the composed line is ${line.length} chars, over the ${COMPLETE_FACET_CLIP} ` +
      "clip: it would be cut on the way to the judge, and the honest tail is " +
      "what gets cut",
  );
  assert.doesNotMatch(
    line,
    /786,?390/,
    "the stale hand-typed byte proxy must not survive into the record",
  );
  // It has to name the split, or the judge cannot tell a ratcheted fact from a
  // noisy one.
  assert.match(
    line,
    /not ratcheted|ratchet/i,
    "the line must say the score is not ratcheted, or the judge cannot tell a " +
      "stable measurement from a noisy one",
  );
  // And it has to carry a spread for the performance number it does report.
  assert.match(
    line,
    /\d+\s*[-–]\s*\d+|spread|range/i,
    "a performance score with no spread is a single stable fact presented " +
      "where none exists; the line must carry the observed range",
  );
  // The deterministic categories ARE facts and may be stated as such.
  assert.match(
    line,
    /accessibility|access/,
    "the three deterministic categories reproduce exactly and belong on the " +
      "record as facts",
  );
  // And the limit of the gate must be on it, or a green gate reads as a proof.
  assert.match(
    line,
    /first paint|warm|memo|one of|not measur|does not/i,
    "the line must state what the gate does not cover, so a green Lighthouse " +
      "is not read as proving the facet's three claims",
  );
});

const BUILDER = "scripts/build-jev-evidence.mjs";

/** Run the real builder over an artifacts dir and return the parsed evidence. */
function buildWith(dir, prose) {
  const prosePath = join(dir, "prose.json");
  writeFileSync(prosePath, JSON.stringify(prose));
  const out = join(dir, "evidence.json");
  const r = spawnSync(
    process.execPath,
    [
      BUILDER,
      "--artifacts",
      dir,
      "--prose",
      prosePath,
      "--out",
      out,
      "--sha",
      "abc1234",
      "--run-id",
      "999",
      "--now",
      "2026-09-27T00:00:00.000Z",
    ],
    { encoding: "utf8" },
  );
  return {
    status: r.status,
    stderr: r.stderr,
    out: r.status === 0 ? JSON.parse(readFileSync(out, "utf8")) : null,
  };
}

/** A minimal all-green job set: the five required gates, nothing else. */
const JOBS = {
  test: {
    job: "test",
    conclusion: "success",
    steps: { unit_tests: "success", prettier: "success", seo: "success" },
  },
  "web-smoke": {
    job: "web-smoke",
    conclusion: "success",
    steps: { smoke: "success" },
  },
  "quality-lab": {
    job: "quality-lab",
    conclusion: "success",
    steps: { "a11y-matrix": "success" },
  },
  lighthouse: {
    job: "lighthouse",
    conclusion: "success",
    steps: { lighthouse: "success" },
  },
  coverage: {
    job: "coverage",
    conclusion: "success",
    steps: { coverage: "success" },
  },
};

function artifactsWith(extra) {
  const dir = mkdtempSync(join(tmpdir(), "jev-derived-"));
  for (const [name, job] of Object.entries(JOBS))
    writeFileSync(join(dir, `${name}.json`), JSON.stringify(job));
  for (const [name, body] of Object.entries(extra || {}))
    writeFileSync(join(dir, name), JSON.stringify(body));
  return dir;
}

const PROSE_MIN = {
  tests_summary: "t",
  ci_summary: "c",
  smoke_note: "s",
  seo_summary: "q",
  advisor_audit: "a",
  notes: ["n"],
  facet_evidence: {
    spec: "a spec line",
    performance: "A HAND-TYPED LINE THAT MUST NOT SURVIVE",
  },
};

test("EVIDENCE: the builder puts the run's numbers on the judge's record", () => {
  const dir = artifactsWith({
    "lighthouse-report.json": {
      metric: "lighthouse",
      lighthouse_version: "13.5.0",
      facet_axes: ["performance"],
      facet_line:
        "Lighthouse 13.5.0, 14 targets. ratcheted accessibility 100. performance NOT ratcheted, 40-76 over 21 calibration runs.",
      measured: [],
    },
  });
  const { status, stderr, out } = buildWith(dir, PROSE_MIN);
  assert.equal(status, 0, stderr);
  assert.equal(
    out.facet_evidence.performance.startsWith("Lighthouse 13.5.0, 14 targets"),
    true,
    "the judge's performance line must be the one composed from this run's report",
  );
  assert.doesNotMatch(
    out.facet_evidence.performance,
    /HAND-TYPED/,
    "a typed line in the prose file must be OVERRIDDEN, not merged and not kept",
  );
  assert.ok(
    out.derived_facet_lines?.some(
      (d) => d.axis === "performance" && d.source === "lighthouse-report.json",
    ),
    `the record must say which report the line came from: ${JSON.stringify(out.derived_facet_lines)}`,
  );
});

test("EVIDENCE: a missing gate report leaves the axis absent, not clean", () => {
  // No report in the artifacts dir, and a typed line the builder must NOT fall
  // back to. This is the `ci_green: true` on a red run, one layer over: a
  // measurement that does not exist must never reach the judge as a claim.
  const dir = artifactsWith({});
  const { status, stderr, out } = buildWith(dir, PROSE_MIN);
  assert.equal(status, 0, stderr);
  assert.ok(
    out.derived_facet_lines === undefined ||
      out.derived_facet_lines.length === 0,
    "no report means no derived line",
  );
  // The typed line the prose file still carries is the problem this cluster
  // fixes, so the committed file no longer has one — and if a hand-run supplies
  // one, it is what the judge would read. The standing condition is in the
  // committed prose, pinned by the first test in this file.
  assert.equal(
    Object.hasOwn(PROSE_MIN.facet_evidence, "performance"),
    true,
    "this fixture deliberately carries a typed line so the override above is " +
      "tested against something",
  );
});

test("EVIDENCE: a report with an over-long line is a named problem, not a trim", () => {
  const dir = artifactsWith({
    "lighthouse-report.json": {
      metric: "lighthouse",
      facet_axes: ["performance"],
      facet_line: "x".repeat(COMPLETE_FACET_CLIP + 1),
    },
  });
  const { status, stderr, out } = buildWith(dir, PROSE_MIN);
  assert.equal(
    status,
    1,
    "an over-long facet line must FAIL the build. Clipping is silent, and for " +
      "this facet the honest tail is exactly what a clip removes.",
  );
  assert.match(
    stderr,
    /facet_line is \d+ chars, over the 280-char per-axis clip/,
    `the over-long line must be named: ${stderr}`,
  );
  assert.doesNotMatch(
    out?.facet_evidence?.performance || "",
    /x{100}/,
    "…and must not be silently trimmed into the record",
  );
});

test("CI: the report reaches the judge through the download the job already does", () => {
  // The judge's download is `pattern: jev-results-*`. A report uploaded under
  // any other name is downloaded by nobody and the builder never sees it — which
  // is precisely the state this cluster is fixing. The name has to match the
  // convention that already exists rather than a new mechanism beside it.
  assert.match(
    WORKFLOW_YAML,
    /pattern:\s*jev-results-\*/,
    "the judge downloads jev-results-*; that pattern is the wire",
  );
  assert.match(
    WORKFLOW_YAML,
    /name:\s*jev-results-lighthouse-report/,
    "the Lighthouse report must be uploaded under a name that pattern picks up, " +
      "so a new gate report needs no change to the judge's download step",
  );
});
