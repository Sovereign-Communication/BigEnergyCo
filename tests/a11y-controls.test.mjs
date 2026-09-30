// The `accessibility` facet used to rest on a hand-typed sentence. Every number
// in it was real — scripts/smoke/a11y.js measures exactly those four claims in a
// real browser — but a reader had to take it on trust, and a run that stopped
// measuring the controls could not be told apart from one that measured them
// green. The sentence was also the only place the number lived, so nothing could
// contradict it.
//
// These tests pin the replacement: the facet line is composed from the run that
// measured the calculator's controls, it names the surfaces a Tab actually
// reached (including the result stage's slider pair), it withdraws its claims
// when a gate fails, and it claims nothing at all when the flow did not run.
// The last test drives the REAL evidence builder, because the wiring — a report
// that declares `facet_axes` reaching the judge's per-axis line — is the whole
// point and a source pin alone would not prove it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  A11Y_FACET_AXES,
  composeA11yFacetLine,
} from "../scripts/lib/a11y-controls.mjs";
import { COMPLETE_FACET_CLIP } from "../scripts/lib/jev-complete.mjs";

const ROOT = ".";
const WORKFLOW = readFileSync(".github/workflows/test.yml", "utf8");
const SMOKE = readFileSync("scripts/browser-smoke.mjs", "utf8");
const FLOW = readFileSync("scripts/smoke/a11y.js", "utf8");
const PROSE = JSON.parse(
  readFileSync("evidence/advisor-and-release.json", "utf8"),
);

/** The four surfaces the flow walks, in walk order, as the flow names them. */
const WALKS = [
  {
    surface: "sliders",
    state: "result stage",
    stops: 64,
    wrapped: true,
    missing: [],
  },
  {
    surface: "quick",
    state: "quick mode",
    stops: 64,
    wrapped: true,
    missing: [],
  },
  {
    surface: "manual",
    state: "manual mode",
    stops: 81,
    wrapped: true,
    missing: [],
  },
  {
    surface: "kWh",
    state: "kWh load panel",
    stops: 47,
    wrapped: true,
    missing: [],
  },
];

const greenGates = (n = 16) =>
  Array.from({ length: n }, (_, i) => ({
    name: `keyboard surface ${i % 4}: reaches its controls`,
    ok: true,
    detail: "64 stops",
  }));

const greenSummary = (extra = {}) => ({
  ran: true,
  gates: greenGates(),
  walks: WALKS,
  names: { checked: 3, failures: 0 },
  contrast: { checked: true, failures: 0 },
  reduced_motion: { checked: true },
  ...extra,
});

test("A11Y: the composed line carries the four claims, and the surfaces by name", () => {
  const line = composeA11yFacetLine(greenSummary());
  // Each of the axis's four questions, tied to the reading that answered it.
  assert.match(line, /keyboard reaches sliders\/quick\/manual\/kWh/, line);
  assert.match(line, /wrapping with no trap/, line);
  assert.match(line, /64\/81\/47|64\/64\/81\/47/, line);
  assert.match(line, /every visible control named/, line);
  assert.match(line, /WCAG AA contrast/, line);
  assert.match(line, /reduced motion honored/, line);
  // And its own limit: one Chrome, no screen reader, not the theme/RTL matrix.
  // Without this a green line reads as proof of the facet.
  assert.match(line, /no screen reader/, line);
  assert.match(line, /theme\/RTL matrix/, line);
});

test("A11Y: the stop counts on the line are the ones the walks counted", () => {
  const line = composeA11yFacetLine(greenSummary());
  assert.match(line, /\(64\/64\/81\/47 stops\)/, line);
  // Derived, not typed: different counts produce a different line.
  const other = composeA11yFacetLine(
    greenSummary({
      walks: WALKS.map((w, i) => ({ ...w, stops: 10 + i })),
    }),
  );
  assert.match(other, /\(10\/11\/12\/13 stops\)/, other);
  // A walk that did not reach its controls is a named hole, not a zero.
  const partial = composeA11yFacetLine(
    greenSummary({
      walks: [WALKS[0], { ...WALKS[1], missing: ["citySearch"] }],
    }),
  );
  assert.match(partial, /missed controls on quick/, partial);
  assert.doesNotMatch(partial, /wrapping with no trap/, partial);
});

test("A11Y: a failed gate withdraws the claims it sits under", () => {
  const gates = greenGates().map((g, i) =>
    i < 2
      ? { ...g, ok: false, name: "keyboard quick mode: reaches its controls" }
      : g,
  );
  const line = composeA11yFacetLine(greenSummary({ gates }));
  assert.match(line, /2\/16 a11y gates FAILED/, line);
  assert.match(line, /keyboard quick mode: reaches its controls/, line);
  assert.match(line, /unproven where those gates sit/, line);
  // A red run must never arrive reading green: none of the green claims survive.
  assert.doesNotMatch(line, /every visible control named/, line);
  assert.doesNotMatch(line, /reduced motion honored/, line);
});

test("A11Y: no measurement means the line claims nothing", () => {
  for (const summary of [
    { ran: false, error: "no result card after the cold run" },
    {},
    undefined,
  ]) {
    const line = composeA11yFacetLine(summary);
    assert.match(line, /NOT measured in a browser this run/, line);
    assert.doesNotMatch(line, /every visible control named/, line);
    assert.doesNotMatch(line, /keyboard reaches/, line);
    assert.doesNotMatch(line, /WCAG AA contrast/, line);
  }
  // A long error may not push the line past the clip, and may not be cut
  // mid-word into a claim of its own.
  const long = composeA11yFacetLine({ ran: false, error: "x".repeat(400) });
  assert.ok(
    long.length <= COMPLETE_FACET_CLIP,
    `the unmeasured line is ${long.length} chars, over the ${COMPLETE_FACET_CLIP} clip`,
  );
});

test("A11Y: every shape fits the transport clip, with nothing trimmed", () => {
  // The bound is structural (bounded failure names, bounded surface names), so
  // this is the worst case rather than a sample: many long gates and long
  // surfaces still compose a line the judge receives whole.
  const longSurfaces = WALKS.map((w, i) => ({
    ...w,
    surface: `surface-${i}-`.padEnd(60, "z"),
  }));
  const longNames = Array.from({ length: 60 }, () => ({
    name: "keyboard some surface: tab order wraps (no trap) and reaches controls",
    ok: false,
  }));
  const shapes = {
    green: greenSummary(),
    "green-no-walks": greenSummary({ walks: [] }),
    "green-long-surfaces": greenSummary({ walks: longSurfaces }),
    "failed-many-gates": greenSummary({
      gates: longNames,
      walks: longSurfaces,
    }),
  };
  for (const [name, summary] of Object.entries(shapes)) {
    const line = composeA11yFacetLine(summary);
    assert.ok(
      line.length <= COMPLETE_FACET_CLIP,
      `${name} composes to ${line.length} chars, over the ${COMPLETE_FACET_CLIP} ` +
        "clip: an over-long line is refused by the builder, and a silent trim " +
        "would drop the limit sentence",
    );
  }
  // The limit sentence is the part a trim would eat, so it must survive the
  // worst GREEN case.
  assert.match(
    composeA11yFacetLine(shapes["green-long-surfaces"]),
    /no screen reader/,
  );
});

test("A11Y: the flow measures the result-stage slider PAIR, by name", () => {
  // The mission's subject is the slider pair, and this walk is the only
  // keyboard reachability measurement that names either of them.
  assert.match(
    FLOW,
    /const RESULTS = \["cutSlider", "budgetSlider"\]/,
    "the result-stage walk must expect the slider pair",
  );
  assert.match(
    FLOW,
    /tabWalk\(ctx, "result stage", RESULTS, "sliders"\)/,
    "and it must be recorded under the surface name the facet line prints",
  );
  // The structured half — walks, names, contrast, reduced motion — is what makes
  // the line composable from the run. Each field is produced by the flow.
  assert.match(
    FLOW,
    /walkRecord\(\{\s*surface,\s*state: label,\s*stops: seen\.size/,
  );
  assert.match(FLOW, /summary\.names = \{/);
  assert.match(FLOW, /checked: nameSets\.length > 0/);
  assert.match(FLOW, /summary\.contrast = \{/);
  assert.match(FLOW, /summary\.reduced_motion = \{ checked: true \}/);
  assert.match(
    FLOW,
    /return summary;/,
    "the flow must return what it measured",
  );
  // The gate names the run prints are unchanged: the wrapper is a recorder, not
  // a rewrite.
  assert.match(FLOW, /gate as smokeGate/);
  assert.match(FLOW, /return smokeGate\(name, ok, detail\);/);
});

test("A11Y: the report reaches the judge through the download it already does", () => {
  assert.match(
    SMOKE,
    /facet_axes: A11Y_FACET_AXES/,
    "the report must declare the axis it speaks for, or the builder discovers nothing",
  );
  assert.match(
    SMOKE,
    /facet_line: composeA11yFacetLine\(summary\)/,
    "the line must be composed from this run, not typed beside it",
  );
  assert.deepEqual(A11Y_FACET_AXES, ["accessibility"]);
  assert.match(
    WORKFLOW,
    /name: jev-results-a11y-controls/,
    "the judge downloads jev-results-*; any other name is read by nobody",
  );
  assert.match(
    WORKFLOW,
    /path: a11y-controls-report\.json/,
    "…and the artifact it downloads must be the file the smoke run wrote",
  );
  // The axe matrix is a different measurement and keeps its own name.
  assert.match(WORKFLOW, /name: a11y-matrix-report/);
});

test("A11Y: the typed line is gone, so there is one source for the facet", () => {
  assert.equal(
    Object.hasOwn(PROSE.facet_evidence || {}, "accessibility"),
    false,
    "evidence/advisor-and-release.json must not carry a hand-typed `accessibility` " +
      "line: the smoke run composes it from the run that measured the controls, " +
      "so a typed line here is a second, unverifiable source for the same facet",
  );
});

/** Run the real evidence builder over an artifacts dir and return its output. */
function buildWith(extraReports) {
  const dir = mkdtempSync(join(tmpdir(), "a11y-derive-"));
  for (const [name, body] of Object.entries({
    test: {
      job: "test",
      conclusion: "success",
      steps: {
        unit_tests: "success",
        prettier: "success",
        seo: "success",
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
    "quality-evidence": {
      job: "quality-evidence",
      conclusion: "success",
      steps: { "quality-evidence": "success" },
    },
    ...extraReports,
  })) {
    writeFileSync(join(dir, `${name}.json`), JSON.stringify(body));
  }
  const prosePath = join(dir, "prose.json");
  writeFileSync(
    prosePath,
    JSON.stringify({
      tests_summary: "t",
      ci_summary: "c",
      smoke_note: "s",
      seo_summary: "q",
      advisor_audit: "a",
      notes: ["n"],
      facet_evidence: { spec: "a spec line" },
    }),
  );
  const out = join(dir, "evidence.json");
  const run = spawnSync(
    process.execPath,
    [
      join(ROOT, "scripts/build-jev-evidence.mjs"),
      "--artifacts",
      dir,
      "--prose",
      prosePath,
      "--out",
      out,
      "--sha",
      "abc1234",
      "--run-id",
      "1",
      "--now",
      "2026-09-30T00:00:00.000Z",
    ],
    { encoding: "utf8" },
  );
  return {
    status: run.status,
    stderr: run.stderr,
    out: run.status === 0 ? JSON.parse(readFileSync(out, "utf8")) : null,
  };
}

test("A11Y: the builder puts the run's control-level line on the judge's record", () => {
  const line = composeA11yFacetLine(greenSummary());
  // The key carries no extension: buildWith writes `${key}.json`, which is the
  // name the web-smoke job uploads and the builder discovers.
  const { status, stderr, out } = buildWith({
    "a11y-controls-report": {
      metric: "a11y_controls",
      facet_axes: ["accessibility"],
      facet_line: line,
    },
  });
  assert.equal(status, 0, stderr);
  assert.equal(
    out.facet_evidence.accessibility,
    line,
    "the judge's accessibility line must be the one this run measured",
  );
  assert.ok(
    out.derived_facet_lines?.some(
      (d) =>
        d.axis === "accessibility" && d.source === "a11y-controls-report.json",
    ),
    `the record must say which report the line came from: ${JSON.stringify(
      out.derived_facet_lines,
    )}`,
  );
});
