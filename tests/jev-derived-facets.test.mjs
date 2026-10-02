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
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COMPLETE_FACET_CLIP } from "../scripts/lib/jev-complete.mjs";
import {
  BYTE_BUDGET_FACET_AXES,
  BYTE_BUDGET_LIMITS,
  composeQualityFacetLine,
} from "../scripts/lib/byte-budgets.mjs";
import {
  composeQualityContractClause,
  QUALITY_CONTRACT_AXIS,
  QUALITY_CONTRACT_FIELDS,
  RECORD_SOURCES,
} from "../scripts/lib/jev-evidence.mjs";
import { A11Y_CONTROLS_CLAUSE_MAX } from "../scripts/lib/a11y-controls.mjs";

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
  // The accessibility axis is derived the same way and for the same reason: the
  // smoke suite measures the calculator's own controls (keyboard reach, control
  // names, WCAG AA contrast, reduced motion) in a real browser on every run, and
  // the hand-typed sentence that used to stand here was the only source for all
  // four numbers. Composed at the measurement means a run that stops measuring
  // the controls says so, instead of leaving the claim standing.
  assert.equal(
    Object.hasOwn(PROSE.facet_evidence || {}, "accessibility"),
    false,
    "evidence/advisor-and-release.json must not carry a hand-typed " +
      "`accessibility` line either. The smoke run composes it from the run that " +
      "measured the controls, so a typed line here is a second, unverifiable " +
      "source for the same facet.",
  );
  // The quality axis is the third derived one, and the reason is the same: the
  // sentence that stood here ("prettier clean repo-wide; the two duplications the
  // design audit found are gone") named a past audit and a formatter, so a run
  // that measured nothing looked exactly like a run that measured green. It is
  // now composed from the two instruments that DO measure the axis — the plan
  // §3.1 reading of the shipped payload (the gate that took it composes that
  // clause) and the required test job's own clarity readings (the builder
  // appends that clause from the run records).
  assert.equal(
    Object.hasOwn(PROSE.facet_evidence || {}, "quality"),
    false,
    "evidence/advisor-and-release.json must not carry a hand-typed `quality` " +
      "line: the byte-budget gate composes it from the run that measured the " +
      "shipped bytes, so a typed line here is a second, unverifiable source for " +
      "the same facet",
  );
  // …and the other axes stay typed, because nothing measures them yet. This is
  // the scope boundary: the measured facets are derived, not everything.
  assert.ok(
    Object.keys(PROSE.facet_evidence || {}).length > 10,
    "the remaining axes keep their prose lines; only the measured ones are derived",
  );
});

test("EVIDENCE: the byte-budget gate declares the axis it is the evidence for", () => {
  // Same defect as the Lighthouse report's missing `facet_axes`: without the
  // declaration the builder has to keep a list of gate names beside it, which is
  // the list-beside-the-code shape #161 removed from ci_green.
  const src = readFileSync("scripts/check-byte-budgets.mjs", "utf8");
  assert.match(
    src,
    /facet_axes\s*:/,
    "the byte-budgets report must declare facet_axes",
  );
  assert.match(
    src,
    /facet_line = composeQualityFacetLine\(report\)/,
    "…and compose the line from the report it just built, not from a typed copy",
  );
  assert.match(
    src,
    /QUALITY_SIZE_CLAUSE_MAX/,
    "…holding it against the budget for its half, so the joined line still fits the clip",
  );
});

test("EVIDENCE: one axis, two instruments — and the two agree on which axis", () => {
  // The size clause and the contract clause each declare the axis they belong to,
  // once per instrument. A disagreement would produce two axes or none, so it
  // fails here rather than in the judge's record.
  assert.ok(
    BYTE_BUDGET_FACET_AXES.includes(QUALITY_CONTRACT_AXIS),
    `the byte-budget gate declares ${JSON.stringify(BYTE_BUDGET_FACET_AXES)} and the ` +
      `contract clause speaks for "${QUALITY_CONTRACT_AXIS}"`,
  );
  // The clarity half is worded from the job/step map, not from a second list: a
  // reading the required job records but this clause has no phrase for would be
  // silently left off the line.
  for (const field of QUALITY_CONTRACT_FIELDS) {
    const clause = composeQualityContractClause({ [field]: true });
    assert.ok(
      typeof clause === "string" && clause.length > 20,
      `${field} passes in the record but composes no clause`,
    );
    assert.doesNotMatch(
      clause,
      new RegExp(field),
      `${field} has no phrase of its own, so the clause would print the raw field name`,
    );
  }
});

test("EVIDENCE: the clarity clause names contracts the suite actually asserts", () => {
  // The clause claims the `test` job carries the one-owner and no-second-copy
  // contracts. That is a fact about this repository, so it is checked here: if
  // those contracts are ever deleted, the clause's claim fails a test rather
  // than shipping as a sentence with nothing behind it.
  const clause = composeQualityContractClause({
    tests_green: true,
    prettier_clean: true,
    seo_green: true,
  });
  assert.match(clause, /one-owner\/no-second-copy/);
  const suite = readdirSync("tests")
    .filter((f) => f.endsWith(".test.mjs"))
    .map((f) => readFileSync(join("tests", f), "utf8"))
    .join("\n");
  for (const [contract, pattern] of [
    ["one owner", /one owner/i],
    ["no second copy", /second copy of the /],
  ]) {
    assert.match(
      suite,
      pattern,
      `the clause names the "${contract}" contract, so the suite must assert it`,
    );
  }
  // The other half of the clause's claim: "dead-code/duplication scan" names a
  // STEP of the required test job, so the workflow must declare that step, the
  // RECORD_SOURCES map must route it, and the suite must test the instrument —
  // a phrase with no step behind it would be the exact defect this clause exists
  // to avoid.
  assert.match(
    WORKFLOW_YAML,
    /id: hygiene\n\s+run: node scripts\/check-code-hygiene\.mjs/,
    "the workflow must declare the hygiene step the clause's phrase is worded from",
  );
  assert.equal(
    RECORD_SOURCES.hygiene_clean?.step,
    "hygiene",
    "the clause's phrase routes through RECORD_SOURCES like every other reading",
  );
  assert.match(
    suite,
    /analyzeHygiene|check-code-hygiene/,
    "the suite must exercise the instrument the clause claims ran",
  );
});

test("EVIDENCE: a red clarity reading is named, never softened", () => {
  const green = composeQualityContractClause({
    tests_green: true,
    prettier_clean: true,
    seo_green: true,
  });
  assert.match(green, /^Test job green/);
  // A missing record contributes nothing rather than a claim: the builder then
  // carries the size clause alone.
  assert.equal(composeQualityContractClause({}), null);
  assert.equal(composeQualityContractClause(null), null);
  const red = composeQualityContractClause({
    tests_green: false,
    prettier_clean: true,
    seo_green: true,
  });
  assert.match(red, /^Test job RED \(unit tests\)/);
  assert.doesNotMatch(
    red,
    /green/,
    "a red reading must not ride under a green sentence",
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
  // COMPLETE_FACET_CLIP is 301 characters (280 at P0.4, then 300, then 301).
  // The last one character bought a run's worth of evidence: the performance
  // speed clause renders the worst TBT as `NNN/100ms`, so a three-digit worst
  // TBT overflowed a 300 clip and the axis was dropped instead of shown. A line
  // longer than the clip is SILENTLY clipped on its way to the judge, which for
  // this cluster is the worst possible failure: the honest part ("this score is
  // not reproducible, do not read it as a fact") is exactly what gets cut off
  // the end.
  assert.equal(
    COMPLETE_FACET_CLIP,
    301,
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
    steps: {
      unit_tests: "success",
      prettier: "success",
      seo: "success",
      hygiene: "success",
    },
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
  // Required for the same reason as `quality-lab` and `lighthouse` above: the
  // workflow declares it and the required set is derived from the workflow, so
  // a new gate is required without a code edit and every green-run fixture has
  // to carry it.
  "quality-evidence": {
    job: "quality-evidence",
    conclusion: "success",
    steps: { "quality-evidence": "success" },
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

test("EVIDENCE: the byte-budget run's line reaches the judge's quality axis", () => {
  // The key IS the file name `artifactsWith` writes, which is the name the
  // web-smoke job uploads and the builder discovers.
  const sizeClause = composeQualityFacetLine({
    metrics: Object.fromEntries(
      Object.keys(BYTE_BUDGET_LIMITS).map((n) => [
        n,
        { value: 1, limit: 1024, unit: "bytes" },
      ]),
    ),
    regressions: [],
    improvements: [{ metric: "css_total" }],
    unmeasured: [],
    breaches: [{ metric: "js_before_interactive" }],
  });
  const dir = artifactsWith({
    "byte-budgets-report.json": {
      metric: "byte_budgets",
      facet_axes: ["quality"],
      facet_line: sizeClause,
      metrics: {},
    },
  });
  const { status, stderr, out } = buildWith(dir, PROSE_MIN);
  assert.equal(status, 0, stderr);
  // BOTH halves reach the judge, joined: the size clause the gate composed, and
  // the clarity clause composed from the required test job's own records. The
  // size half alone is the defect this fixes — it disclaimed the rest of the
  // axis, and the judge read that partial measurement as unproven.
  assert.ok(
    out.facet_evidence.quality.startsWith(sizeClause),
    `the judge's quality line must carry the clause this run's report composed: ${out.facet_evidence.quality}`,
  );
  assert.match(
    out.facet_evidence.quality,
    /Test job green: .*dead-code\/duplication scan.*Unmeasured: branches\/abstractions/,
    `…joined to the clarity clause the run records support: ${out.facet_evidence.quality}`,
  );
  assert.match(
    out.facet_evidence.quality,
    /prettier/,
    "…and that clause names the formatter reading the test job records",
  );
  assert.ok(
    out.facet_evidence.quality.length <= COMPLETE_FACET_CLIP,
    `the joined line is ${out.facet_evidence.quality.length} chars, over the clip`,
  );
  const entry = out.derived_facet_lines?.find((d) => d.axis === "quality");
  assert.equal(
    entry?.source,
    "byte-budgets-report.json",
    `the record must say which report the line came from: ${JSON.stringify(
      out.derived_facet_lines,
    )}`,
  );
  assert.equal(
    entry?.joined_chars,
    out.facet_evidence.quality.length,
    "the record must record the length that actually reached the judge",
  );
});

test("EVIDENCE: a red test job withdraws the clarity half of the quality axis", () => {
  // The half that is NOT the byte gate's to see. A run whose suite or formatter
  // is red must reach the judge with that red on the line, not as a clause the
  // byte gate could not have known about.
  const dir = artifactsWith({
    "byte-budgets-report.json": {
      metric: "byte_budgets",
      facet_axes: ["quality"],
      facet_line: composeQualityFacetLine({ metrics: {}, regressions: [] }),
      metrics: {},
    },
    "test.json": {
      job: "test",
      conclusion: "success",
      steps: {
        unit_tests: "failure",
        prettier: "success",
        seo: "success",
        hygiene: "success",
      },
    },
  });
  const { status } = buildWith(dir, PROSE_MIN);
  // A red required step is a problem, so the builder exits non-zero — but it
  // still WRITES the record, red field and all, which is what the judge reads on
  // a run that cannot be trusted. That is the file this test reads.
  assert.equal(status, 1, "a red required step must stop the run");
  const evidence = JSON.parse(readFileSync(join(dir, "evidence.json"), "utf8"));
  assert.equal(evidence.tests_green, false);
  assert.match(
    evidence.facet_evidence.quality,
    /Test job RED \(unit tests\)/,
    `the red clarity reading must be on the judge's line: ${evidence.facet_evidence.quality}`,
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
    new RegExp(
      `facet_line is \\d+ chars, over the ${COMPLETE_FACET_CLIP}-char per-axis clip`,
    ),
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
  // The byte-budget report rides the same wire, and its upload has to survive a
  // red gate: `check-byte-budgets` exits 1 on a regression, and a REGRESSED
  // payload must reach the judge as a regression rather than as an absent axis.
  assert.match(
    WORKFLOW_YAML,
    /name:\s*jev-results-byte-budgets/,
    "the byte-budgets report must be uploaded under a name the judge's download picks up",
  );
  assert.match(
    WORKFLOW_YAML,
    /path:\s*byte-budgets-report\.json/,
    "…and the path must be the file the gate writes with --out",
  );
  assert.match(
    WORKFLOW_YAML,
    /check-byte-budgets\.mjs --stage _pages_budget --out byte-budgets-report\.json/,
    "…which means the step itself has to ask for it",
  );
  // The axe matrix is the second instrument of the `accessibility` facet, so
  // its report rides the same wire: a clause the builder never downloads is a
  // half of the line the judge never reads.
  assert.match(
    WORKFLOW_YAML,
    /name:\s*jev-results-a11y-matrix/,
    "the matrix report must be uploaded under the name the judge's download picks up",
  );
  assert.match(
    WORKFLOW_YAML,
    /path:\s*a11y-report\.json/,
    "…and the path must be the file the gate writes with --out",
  );
  assert.match(
    WORKFLOW_YAML,
    /check-a11y-matrix\.mjs --stage _pages_a11y --out a11y-report\.json/,
    "…which means the step itself has to ask for it",
  );
});

test("EVIDENCE: the accessibility axis joins the two instruments measured", () => {
  // The controls walk ends on its own limit — "no theme/RTL matrix" — and the
  // axe matrix is the run that measured exactly that matrix. Neither half may
  // claim the axis alone: the controls walk never loaded the matrix, and the
  // matrix never touched a keyboard.
  const controlsLine =
    "real Chrome, calculator controls: keyboard reaches sliders/quick/manual/kWh, wrapping with no trap (64/64/81/48 stops); every visible control named; WCAG AA contrast; reduced motion honored. 1 Chrome, no screen reader, no theme/RTL matrix.";
  const matrixLine = "axe matrix: 11/11 cells, 0 violations";
  const dir = artifactsWith({
    "a11y-controls-report.json": {
      metric: "a11y_controls",
      facet_axes: ["accessibility"],
      facet_line: controlsLine,
    },
    "a11y-report.json": {
      metric: "a11y_matrix",
      facet_axes: ["accessibility"],
      facet_line: matrixLine,
    },
  });
  const { status, stderr, out } = buildWith(dir, PROSE_MIN);
  assert.equal(status, 0, stderr);
  assert.equal(
    out.facet_evidence.accessibility,
    `${controlsLine} ${matrixLine}`,
    `both clauses must reach the judge, controls first, joined whole: ${out.facet_evidence.accessibility}`,
  );
  assert.ok(
    out.facet_evidence.accessibility.length <= COMPLETE_FACET_CLIP,
    `the joined line is ${out.facet_evidence.accessibility.length} chars, over the clip`,
  );
  const entries = (out.derived_facet_lines || []).filter(
    (d) => d.axis === "accessibility",
  );
  assert.deepEqual(
    entries.map((d) => d.metric).sort(),
    ["a11y_controls", "a11y_matrix"],
    `the record must say both instruments measured this axis: ${JSON.stringify(entries)}`,
  );
  for (const entry of entries) {
    assert.equal(
      entry.joined_chars,
      out.facet_evidence.accessibility.length,
      "every entry of a joined axis records the length that actually reached the judge",
    );
  }
});

test("EVIDENCE: an over-budget half of the accessibility line is named", () => {
  // Bounded from both ends: a controls clause past its declared half of the
  // clip cannot be trimmed — the part a trim would eat is the limit sentence
  // that keeps the claims honest — so the builder names the half that grew
  // and refuses the run instead of joining.
  const dir = artifactsWith({
    "a11y-controls-report.json": {
      metric: "a11y_controls",
      facet_axes: ["accessibility"],
      facet_line: `real Chrome, calculator controls: ${"c".repeat(A11Y_CONTROLS_CLAUSE_MAX + 1 - 34)}`,
    },
    "a11y-report.json": {
      metric: "a11y_matrix",
      facet_axes: ["accessibility"],
      facet_line: "axe matrix: 11/11 cells, 0 violations",
    },
  });
  const { status, stderr } = buildWith(dir, PROSE_MIN);
  assert.equal(status, 1, "an over-budget half must stop the run");
  assert.match(
    stderr,
    /the accessibility facet line is over budget \(controls \d+>240\)/,
    `the half that grew must be named: ${stderr}`,
  );
  // The record is still written — red problem and all — so read it as the
  // judge would and assert the over-budget clause is not half-joined into it.
  const evidence = JSON.parse(readFileSync(join(dir, "evidence.json"), "utf8"));
  // Neither half may reach the record on its own. The half that DID fit must
  // not stand in for the axis: run 36932232421 is the measurement — the
  // performance halves were 250 and 51 against a 300 clip, the join was
  // refused, and the axis reached the judge as a bare speed line, which reads
  // as the whole claim and is not one. The axis must be a HOLE.
  assert.equal(
    Object.hasOwn(evidence.facet_evidence, "accessibility"),
    false,
    "a refused join must leave no half-line behind as if it were the axis",
  );
  assert.equal(
    String(evidence.facet_evidence.accessibility).includes("c".repeat(100)),
    false,
    "…and the over-budget clause must not be half-joined into the record",
  );
  assert.match(
    stderr,
    /REMOVED rather than trimmed/,
    `the failure must say the axis was removed, not shortened: ${stderr}`,
  );
});
