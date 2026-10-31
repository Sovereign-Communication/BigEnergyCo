// "The first paint stays light" is one of the three claims on the `performance`
// facet, and until this gate measured the staged build's brotli weight, it was
// the only one of the three with no measurement at all. The other two are the
// playtest's (cold run, warm re-run, drag preview, and the zero NASA count on
// both warm paths); the third stood in behind Lighthouse's `performance`
// composite, which scripts/lib/lighthouse-budgets.mjs documents — with 21 runs of
// evidence — as unreproducible and deliberately un-ratcheted.
//
// So these tests exist to prevent the two ways this clause can go wrong again:
//
//   1. It goes back to unmeasured, quietly. The byte gate that already measures
//      this number declares no facet axis and writes no report, so nothing forces
//      the lighthouse gate to keep measuring it. A removal here would not fail a
//      single other test, and the facet line would revert to a sentence that
//      says out loud that it cannot measure the claim.
//   2. It is measured against a bar somebody moved. The limit is plan §3.1's own
//      table. If the constant is copied instead of READ, someone can widen it and
//      the breach disappears with no diff on any gate file — which is exactly the
//      "threshold that exists only to make the run pass" this repo's tests have
//      been written against since the sibling gates landed.
//
// Every claim below is mutation-checked: the assertion is run against a reading
// with the property broken, and it has to go red. A gate nobody has proved bites
// is a comment with an exit code.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  FIRST_PAINT_ENFORCEMENT,
  LIGHTHOUSE_FIRST_PAINT_BUDGETS,
  LIGHTHOUSE_FIRST_PAINT_MEASUREMENT,
  composeFacetLine,
  composeFacetLineWithOmissions,
  firstPaintWeightClause,
  measureFirstPaintWeight,
} from "../scripts/lib/lighthouse-budgets.mjs";
import {
  BYTE_BUDGET_LIMITS,
  brotliBytes,
} from "../scripts/lib/byte-budgets.mjs";
import { COMPLETE_FACET_CLIP } from "../scripts/lib/jev-complete.mjs";

const GATE = "scripts/check-lighthouse.mjs";
const KB = 1024;

/**
 * A staged build small enough to reason about and shaped like the real one: an
 * index.html whose entry script statically reaches the rest of the graph, one
 * stylesheet, no web fonts. The chain is explicit so a test can remove exactly
 * one module and assert the reading falls by exactly its bytes — the property
 * that makes "before interactive" mean the graph and not the entry file.
 */
function stagedTree({
  graph = 4,
  css = 1,
  entry = "assets/js/app.js",
  drop = null,
} = {}) {
  // An explicit CHAIN, so the deepest module is reachable only through the ones
  // above it. `drop` removes a single module from the staged set: its importer's
  // specifier then resolves to nothing and the walker skips it, which is the only
  // way to move exactly one variable and assert the reading fell by exactly that
  // file's bytes. A fixture that changes two things at once would let the test
  // below pass for the wrong reason.
  const NAMES = ["dep-a", "dep-b", "dep-c"];
  const depth = Math.min(graph, NAMES.length);
  const bodies = {};
  for (let i = 0; i < depth; i++) {
    const rel = `assets/js/${NAMES[i]}.js`;
    bodies[rel] =
      i + 1 < depth
        ? `import "./${NAMES[i + 1]}.js";\n`
        : `export const v = ${i};\n`;
  }
  bodies[entry] =
    (depth ? `import "./${NAMES[0]}.js";\n` : "") + "export const app = 1;\n";
  // `drop` accepts either a bare module name or a staged path.
  const dropped = drop && (drop.includes("/") ? drop : `assets/js/${drop}.js`);
  const files = ["index.html", entry];
  for (const name of NAMES) files.push(`assets/js/${name}.js`);
  for (let i = 0; i < css; i++) files.push(`assets/site-${i}.css`);
  const html =
    `<!doctype html><html><head>` +
    `<link rel="stylesheet" href="assets/site-0.css">` +
    `<script type="module" src="${entry}"></script>` +
    `</head><body></body></html>`;
  const content = { "index.html": html };
  for (const f of files)
    if (f !== "index.html") content[f] = bodies[f] ?? `// ${f}\n`.repeat(40);
  return {
    files: [...new Set(files)].filter((f) => f !== dropped).sort(),
    read: (rel) => Buffer.from(content[rel] ?? ""),
  };
}

/** The reading this gate took on the real tree, as a starting point. */
const realReading = () => ({
  ok: true,
  modules: 35,
  budgets: {
    js_before_interactive: { value: 193804, limit: 35840, unit: "bytes" },
    home_document: { value: 19050, limit: 30720, unit: "bytes" },
    css_total: { value: 10049, limit: 20480, unit: "bytes" },
    requests_before_interaction: { value: 9, limit: 10, unit: "count" },
    web_fonts: { value: 0, limit: 0, unit: "bytes" },
  },
  over: [
    {
      metric: "js_before_interactive",
      value: 193804,
      limit: 35840,
      unit: "bytes",
      message: "js_before_interactive over the §3.1 line",
    },
  ],
  holes: [],
});

// ── 1. the bar is the plan's, read — not copied ──────────────────────────────

test("FIRST PAINT: every first-paint limit is READ from plan §3.1, not restated", () => {
  // The whole defence against "the threshold was moved to pass" is that this
  // module has no number of its own. If someone types a limit here instead of
  // reading it, the breach can be silenced without touching the §3.1 gate, and
  // that is the change no other test in the repo would notice.
  for (const [name, budget] of Object.entries(LIGHTHOUSE_FIRST_PAINT_BUDGETS)) {
    assert.equal(
      budget.limit,
      BYTE_BUDGET_LIMITS[name],
      `${name}'s limit here must BE the §3.1 constant, not a copy of it — a copy ` +
        "is a second number that can move on its own",
    );
    assert.ok(
      typeof budget.why === "string" && budget.why.length > 20,
      `${name} must say why it is one of the first paint's budgets`,
    );
  }
  assert.equal(
    LIGHTHOUSE_FIRST_PAINT_BUDGETS.js_before_interactive.limit,
    35 * KB,
    "plan §3.1: 'JavaScript executed before step 1 is interactive ≤ 35 KB'. " +
      "This is the facet's first-paint line and it is 35 KB in the plan.",
  );
});

test("FIRST PAINT: the measurement behind the claim is recorded, not asserted", () => {
  assert.match(
    LIGHTHOUSE_FIRST_PAINT_MEASUREMENT.conditions.surface,
    /staged/i,
    "the reading says what it was measured on",
  );
  assert.match(
    LIGHTHOUSE_FIRST_PAINT_MEASUREMENT.conditions.compression,
    /brotli q11/i,
    "a byte count without its compressor is not comparable to the §3.1 line",
  );
  assert.match(
    LIGHTHOUSE_FIRST_PAINT_MEASUREMENT.reading,
    /js_before_interactive/,
    "the recorded reading must name the budget it is about",
  );
});

test("FIRST PAINT: the enforcement rule is the plan's §3.2 rule, quoted not paraphrased", () => {
  assert.match(
    FIRST_PAINT_ENFORCEMENT,
    /§3\.1 line; regression-blocking from P0, absolute from P6 \(\/next\/\) and P8 \(all\)/,
    `the rule that decides whether a breach blocks must be the plan's, in full: ${FIRST_PAINT_ENFORCEMENT}`,
  );
});

// ── 2. the measurement is real ───────────────────────────────────────────────

test("FIRST PAINT: the gate measures the staged build it serves", () => {
  const src = readFileSync(GATE, "utf8");
  assert.match(
    src,
    /measureFirstPaintWeight\(stagedTree\(opts\.stage\)\)/,
    "the weight must be measured on the SAME stage Lighthouse audits; measuring " +
      "a different directory measures a different site",
  );
  assert.match(
    src,
    /first_paint_weight: firstPaintWeight/,
    "the reading must travel in the report, or the judge never sees it",
  );
});

test("FIRST PAINT: a staged build is measured on every first-paint budget", () => {
  const reading = measureFirstPaintWeight(stagedTree());
  assert.equal(
    reading.ok,
    true,
    `the fixture must measure: ${JSON.stringify(reading)}`,
  );
  assert.deepEqual(
    Object.keys(reading.budgets).sort(),
    Object.keys(LIGHTHOUSE_FIRST_PAINT_BUDGETS).sort(),
    "a budget the plan sets but this clause does not carry is a reading nobody reads",
  );
  for (const [name, b] of Object.entries(reading.budgets))
    assert.equal(
      b.limit,
      BYTE_BUDGET_LIMITS[name],
      `${name} carries the plan's line`,
    );
});

test("FIRST PAINT: the weight is the transitive graph, not the entry file", () => {
  // Fixed contents, ONE variable: whether the deepest module is on disk. It is
  // reachable only transitively (entry -> dep-a -> dep-b -> dep-c), and when it
  // is absent its importer's specifier resolves to nothing and the walker skips
  // it — so the reading must fall by exactly that module's own bytes. If it did
  // not, "before interactive" would mean "the entry script", and the 35 KB line
  // would be measuring the wrong thing.
  const full = measureFirstPaintWeight(stagedTree());
  const shallow = measureFirstPaintWeight(stagedTree({ drop: "dep-c" }));
  assert.ok(
    shallow.budgets.js_before_interactive.value <
      full.budgets.js_before_interactive.value,
    "dropping a module off the graph must lower the pre-interactive weight",
  );
  assert.equal(
    full.budgets.js_before_interactive.value -
      shallow.budgets.js_before_interactive.value,
    brotliBytes(Buffer.from("export const v = 2;\n")),
    "the weight must be the SUM over the graph, so removing one file removes " +
      "exactly its bytes",
  );
});

test("FIRST PAINT: an unreadable staged build is a hole, and a hole fails", () => {
  const reading = measureFirstPaintWeight({
    files: [],
    read: () => Buffer.from(""),
  });
  assert.equal(
    reading.ok,
    false,
    "a build with no index.html must not read as ok",
  );
  assert.ok(
    reading.holes.length > 0,
    "an unmeasured first-paint weight must be a named hole, not a zero",
  );

  const src = readFileSync(GATE, "utf8");
  assert.match(
    src,
    /firstPaintWeight\.holes\.length > 0 \|\|/,
    "a hole must take the gate red: the axis line claims a measured first-paint " +
      "weight, so a run that could not measure it cannot exit green beside it",
  );
});

// ── 3. the clause states the truth, in both directions ──────────────────────

test("FIRST PAINT: a breach is stated as a breach, with its reading and its bar", () => {
  const line = firstPaintWeightClause(realReading());
  assert.match(line, /first paint 189KB brotli JS pre-interactive/, line);
  assert.match(
    line,
    /§3\.1 35KB/,
    `the line must carry the bar it is over: ${line}`,
  );
  assert.match(line, /5\.4x over/, `the magnitude is the claim: ${line}`);
  // MUTATION. The same reading with the breach list emptied must NOT produce a
  // breach sentence. Without this, a change that stops comparing against the
  // plan's limit passes every other test in this file and silently flatters the
  // facet's unmeasured clause.
  const laundered = firstPaintWeightClause({ ...realReading(), over: [] });
  assert.doesNotMatch(
    laundered,
    /over/,
    `a reading under its bar must not be described as over: ${laundered}`,
  );
  assert.match(laundered, /all within/, laundered);
});

test("FIRST PAINT: a bar that cannot move without the gate noticing", () => {
  // The mutation this guards: widen the constant the clause reads. Nothing else
  // in the repo fails when that happens — the §3.1 gate would still report its
  // own breach against the plan, but THIS axis's line would read "all within"
  // and the judge would be told the first paint is light.
  const widened = {
    ...realReading(),
    budgets: {
      ...realReading().budgets,
      js_before_interactive: { value: 193804, limit: 250 * KB, unit: "bytes" },
    },
    over: [],
  };
  assert.match(
    firstPaintWeightClause(widened),
    /all within/,
    "with the bar widened the reading is within it — which is exactly why the " +
      "bar has to be the plan's constant and the clause has to read it",
  );
  assert.notEqual(
    LIGHTHOUSE_FIRST_PAINT_BUDGETS.js_before_interactive.limit,
    250 * KB,
    "this module's limit must not have been widened",
  );
});

test("FIRST PAINT: an unmeasured reading produces NO clause, never a zero", () => {
  // "0KB brotli JS pre-interactive" from a run that measured nothing is the most
  // dangerous sentence this axis can publish: it is a passing number.
  for (const bad of [
    null,
    undefined,
    {},
    { ok: false, budgets: {}, over: [], holes: [{ what: "x" }] },
    { ok: true, budgets: { js_before_interactive: { value: null } } },
  ]) {
    assert.equal(
      firstPaintWeightClause(bad),
      null,
      `an absent or partial reading must compose no clause at all: ${JSON.stringify(bad)}`,
    );
  }
});

// ── 4. the number reaches the judge's line, with the other two clauses ───────

const PERF = [61, 56, 100, 96, 87, 71, 73, 100, 57, 64, 100, 94, 93, 63];
const report = (extra) => ({
  measured: PERF.map((performance, i) => ({
    scores: {
      performance,
      accessibility: 100,
      "best-practices": i === 0 || i === 4 ? 96 : 100,
      seo: [5, 8, 13].includes(i) ? 63 : 100,
    },
  })),
  regressions: [],
  holes: [],
  ratchet_categories: ["accessibility", "best-practices", "seo"],
  ...extra,
});
const warmReading = (extra = {}) => ({
  ok: true,
  cold_run: { ms: 5010, completed: true, started_run: true },
  warm_rerun: { ms: 41, started: true, cardPresent: true },
  warm_adjustments: {
    taken: 3,
    preview_median_ms: 8,
    confirm_median_ms: 1823,
    all_previews_rendered: true,
    all_followed_through: true,
  },
  warm_network: { total: 0, nasa: 0, urls: [] },
  warm_reload: { ok: true, ms: 4024, warm_network: { nasa: 0 } },
  paths_unavailable: {
    ok: true,
    blocked_attempts: 1,
    card_rendered: true,
    paths_panel_rendered: false,
    eli5_rendered: false,
  },
  ...extra,
});

test("FIRST PAINT: all three rubric clauses reach the judge's line", () => {
  const line = composeFacetLine(
    report({
      first_paint_weight: realReading(),
      warm_interaction: warmReading(),
    }),
  );
  // Clause 1 — "warm same-location interactions are instant".
  assert.match(line, /repeat 41ms/, `warm interaction missing: ${line}`);
  assert.match(line, /drag 8ms/, `warm interaction missing: ${line}`);
  // Clause 2 — "no redundant network re-pulls (weather/NASA memoized)".
  assert.match(line, /0 NASA warm\/reload/, `memoization missing: ${line}`);
  // Clause 3 — "the first paint stays light". This is the one that had nothing.
  assert.match(
    line,
    /first paint 189KB brotli JS pre-interactive/,
    `weight missing: ${line}`,
  );
  assert.match(
    line,
    /5\.4x over/,
    `the breach must travel to the judge: ${line}`,
  );
  // …and the score it must NOT be read as.
  assert.match(
    line,
    /perf NOT ratcheted/i,
    `the honesty tail was cut: ${line}`,
  );
  assert.match(
    line,
    /over 21 runs/,
    `the calibration envelope was cut: ${line}`,
  );
  assert.ok(
    line.length <= COMPLETE_FACET_CLIP,
    `the line is ${line.length} chars, over the ${COMPLETE_FACET_CLIP}-char clip: ` +
      "it would be cut in transit and the axis would arrive without a clause",
  );
});

test("FIRST PAINT: the line survives the slowest plausible run", () => {
  const line = composeFacetLine(
    report({
      first_paint_weight: realReading(),
      warm_interaction: warmReading({
        cold_run: { ms: 24500 },
        warm_rerun: { ms: 1500 },
        warm_adjustments: {
          taken: 3,
          preview_median_ms: 120,
          confirm_median_ms: 12400,
          all_previews_rendered: true,
          all_followed_through: true,
        },
        warm_network: { total: 12, nasa: 0, urls: [] },
        warm_reload: { ok: true, ms: 19000, warm_network: { nasa: 0 } },
      }),
    }),
  );
  assert.ok(
    line.length <= COMPLETE_FACET_CLIP,
    `worst case composes to ${line.length} chars: shorten the clause, do not raise the clip`,
  );
  assert.match(
    line,
    /first paint 189KB/,
    `the weight must survive a slow run: ${line}`,
  );
  assert.match(
    line,
    /perf NOT ratcheted/i,
    `the honesty tail must survive too: ${line}`,
  );
});

test("FIRST PAINT: an unmeasured weight says so, and never as a number", () => {
  const line = composeFacetLine(report({ warm_interaction: warmReading() }));
  assert.match(
    line,
    /first-paint weight not measured/,
    `an absent weight must be visible as absent, in the slot the reading occupies: ${line}`,
  );
  assert.doesNotMatch(
    line,
    /first paint \d+KB/,
    `no weight number may be composed from a measurement that did not happen: ${line}`,
  );
});

test("FIRST PAINT: an empty measurement set names the absence, never the envelope", () => {
  const line = composeFacetLine({
    measured: [],
    regressions: [],
    holes: [{ id: "*", message: "no Lighthouse target was measured at all" }],
    first_paint_weight: realReading(),
    warm_interaction: warmReading(),
  });
  // The calibration envelope is the 21-run set, NOT this run. Quoting it beside
  // an empty measurement set would compose a line that reads as a finished
  // measurement of a run that measured nothing — the exact substitution the
  // composite caveat exists to prevent, pointed the other way.
  assert.doesNotMatch(
    line,
    /over 21 runs/,
    `a run that scored no target must not quote the calibration envelope as its own reading: ${line}`,
  );
  assert.match(
    line,
    /perf unmeasured/,
    `the absence must be stated by name, in the slot the score would occupy: ${line}`,
  );
});

test("FIRST PAINT: whatever the clip drops, it names", () => {
  const { omitted } = composeFacetLineWithOmissions(
    report({
      first_paint_weight: realReading(),
      warm_interaction: warmReading(),
    }),
  );
  assert.ok(
    omitted.length > 0,
    "this fixture is the regime where the clip actually bites; a loop over an " +
      "empty report would assert nothing about what the gate prints",
  );
  for (const o of omitted)
    assert.ok(
      typeof o.sentence === "string" && o.sentence.length > 0,
      "an omission must name what was omitted",
    );
});

test("FIRST PAINT: the omission report is returned, not state a caller clears", () => {
  // The defect this replaces: the composer returned the line and PUSHED the
  // omissions into a module-level array, so the report accumulated across calls
  // and every caller had to remember to clear it. Two composes with no clearing
  // in between must each describe only their own run.
  const drops = composeFacetLineWithOmissions(
    report({
      ratchet_categories: [
        "accessibility",
        "best-practices",
        "seo",
        "performance",
        "pwa",
      ],
      first_paint_weight: realReading(),
      warm_interaction: warmReading(),
    }),
  );
  assert.ok(
    drops.omitted.length > 0,
    `this case must drop something for the assertion below to mean anything: ${drops.line}`,
  );
  const clean = composeFacetLineWithOmissions(report({}));
  assert.deepEqual(
    clean.omitted,
    [],
    "a report with nothing to drop must report nothing",
  );
  const again = composeFacetLineWithOmissions(
    report({
      ratchet_categories: [
        "accessibility",
        "best-practices",
        "seo",
        "performance",
        "pwa",
      ],
      first_paint_weight: realReading(),
      warm_interaction: warmReading(),
    }),
  );
  assert.deepEqual(
    again.omitted,
    drops.omitted,
    "each call must carry its own report; an accumulated one would grow with " +
      "every compose since the process started",
  );
});
