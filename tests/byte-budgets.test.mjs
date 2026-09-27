// Plan §8 P0.4 / §3.1: the compressed byte and request budgets, measured on
// the staged build, with the baseline recorded in the ledger.
//
// What these tests hold in place:
//   • the §3.1 limits, verbatim — a relaxed number must fail here, because the
//     plan says only an owner-approved amendment may relax one (and the
//     amendment lives in the plan, not in this file);
//   • that each metric measures the scope the plan names: the first-result JS
//     is the TRANSITIVE module graph, not the entry file, and the registry
//     budget is per country so the worst country is the honest reading;
//   • that P0.4 enforces a RATCHET, not an absolute bar: §3.2 makes these gates
//     regression-blocking from P0 and absolute only from P6 (/next/) and P8
//     (all), so a reading already over a limit is reported, and only getting
//     WORSE is a failure.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "scripts/check-byte-budgets.mjs");

import {
  BYTE_BUDGET_LIMITS,
  brotliBytes,
  compareToBaseline,
  formatReading,
  measureStagedBuild,
  readByteBudgetBaseline,
  REGRESSION_TOLERANCE_BYTES,
} from "../scripts/lib/byte-budgets.mjs";

const KB = 1024;

// A staged build small enough to reason about by hand. The numbers are
// irrelevant except in relation to the limits, which is the point: the gate
// must not care how big a file is, only how it moved.
function fixture(overrides = {}) {
  const files = new Map();
  const add = (path, body) => files.set(path, Buffer.from(body));
  add(
    "index.html",
    `<!doctype html><html><head>
    <link rel="manifest" href="./manifest.webmanifest">
    <link rel="icon" href="./assets/icon.svg">
    <link rel="apple-touch-icon" href="./assets/apple-touch-icon.png">
    <link rel="stylesheet" href="./assets/site.css">
    <link rel="preconnect" href="https://power.larc.nasa.gov">
    <link rel="canonical" href="https://freeoffgridcalculator.com/">
    <script type="module" src="./assets/js/sizing/ui.js"></script>
    <script defer src="./assets/js/chat.js"></script>
  </head><body></body></html>`,
  );
  add("manifest.webmanifest", "{}");
  add("assets/icon.svg", "<svg/>");
  add("assets/apple-touch-icon.png", "png");
  add("assets/site.css", "body{color:#111}");
  add("assets/js/chat.js", "export const chat = 1;");
  // ui.js pulls a transitive import: the graph, not the entry file, is the
  // budget the plan names.
  add(
    "assets/js/sizing/ui.js",
    'import { engine } from "./engine.js";\nimport { cities } from "./cities.js";\nexport const ui = [engine, cities];',
  );
  add("assets/js/sizing/engine.js", "export const engine = 1;");
  add(
    "assets/js/sizing/cities.js",
    'import { money } from "./money.js";\nexport const cities = money;',
  );
  add("assets/js/sizing/money.js", "export const money = 1;");
  add(
    "assets/js/shared/locales.js",
    "export const locales = { en: {}, es: {}, pt: {} };",
  );
  add("assets/js/sizing/city-data/DE.json", JSON.stringify({ cities: [] }));
  add("assets/js/sizing/city-data/US.json", JSON.stringify({ cities: [] }));
  add(
    "solar-heatmap/index.html",
    '<script src="../assets/js/heatmap.js"></script>',
  );
  add("assets/js/heatmap.js", 'fetch("../assets/data/heatmap-grid.json");');
  add("assets/data/heatmap-grid.json", "{}");
  for (const [path, body] of Object.entries(overrides)) {
    if (body === null) files.delete(path);
    else add(path, body);
  }
  return {
    files: [...files.keys()].sort(),
    read: (rel) => {
      const buf = files.get(rel);
      if (!buf) throw new Error(`no such staged file: ${rel}`);
      return buf;
    },
  };
}

test("BUDGET: the section 3.1 limits are the plan's, verbatim", () => {
  // Every byte budget is a KB figure in the plan. The one that is not bytes is
  // a COUNT, and it is held as a count so nobody "fixes" it into 10 KB later.
  const byteLimits = {
    home_document: 30,
    css_total: 20,
    js_before_interactive: 35,
    js_to_first_result: 200,
    locale_strings: 25,
    registry_country: 6,
    web_fonts: 0,
    heatmap_initial: 300,
  };
  for (const [metric, kb] of Object.entries(byteLimits)) {
    assert.equal(
      BYTE_BUDGET_LIMITS[metric],
      kb * KB,
      `${metric} is ${kb} KB in plan §3.1. Only an owner-approved amendment may relax it, and the amendment lives in the plan — not here.`,
    );
  }
  assert.equal(
    BYTE_BUDGET_LIMITS.requests_before_interaction,
    10,
    "requests before first interaction is a count (≤ 10), not a byte budget",
  );
  // A 6 KB country budget against a city catalogue is the one the plan already
  // flagged as possibly unreachable; it is kept at the plan's value so the
  // breach stays visible until an amendment says otherwise.
  assert.equal(BYTE_BUDGET_LIMITS.registry_country, 6 * KB);
});

test("BUDGET: a staged build is measured on every plan budget", () => {
  const { metrics } = measureStagedBuild(fixture());
  assert.deepEqual(
    Object.keys(metrics).sort(),
    Object.keys(BYTE_BUDGET_LIMITS).sort(),
    "every §3.1 budget must be reported, including the ones that are comfortable — a quiet metric is a metric nobody is watching",
  );
  for (const [name, m] of Object.entries(metrics)) {
    assert.equal(
      m.limit,
      BYTE_BUDGET_LIMITS[name],
      `${name} carries the plan's limit`,
    );
    assert.equal(typeof m.value, "number");
  }
  // The document itself is one of the requests before first interaction.
  assert.ok(metrics.requests_before_interaction.value >= 6);
});

test("BUDGET: JS before interaction is the transitive module graph", () => {
  const base =
    measureStagedBuild(fixture()).metrics.js_before_interactive.value;
  // Add one more file to the transitive graph, far from the entry script.
  const deeper = measureStagedBuild(
    fixture({
      "assets/js/sizing/money.js": "export const money = 'x'.repeat(4000);",
    }),
  ).metrics.js_before_interactive.value;
  assert.ok(
    deeper > base,
    "a module the browser must fetch to make step 1 interactive is part of the budget, even though the document never names it",
  );

  // A file nothing on the first-result path imports must NOT count, so the
  // reading has to be the untouched one, not the deepened one.
  const withUnrelated = measureStagedBuild(
    fixture({ "assets/js/heatmap.js": "export const h = 'y'.repeat(8000);" }),
  ).metrics.js_before_interactive.value;
  assert.equal(
    withUnrelated,
    base,
    "only the graph the first result reaches is the first-result budget",
  );
});

test("BUDGET: the registry budget is per country, so the worst country is reported", () => {
  const { metrics } = measureStagedBuild(
    fixture({
      "assets/js/sizing/city-data/US.json": JSON.stringify({
        cities: "x".repeat(9000),
      }),
    }),
  );
  const r = metrics.registry_country;
  assert.equal(
    r.worst_country,
    "US",
    "the country a visitor may actually hit is the honest reading, not the first one alphabetically",
  );
  assert.ok(
    r.value >= r.by_country.DE,
    "the reported value is the worst country, never an average",
  );
  assert.equal(
    typeof r.by_country.DE,
    "number",
    "and every country is still measured, so a single fat file is visible",
  );
});

test("BUDGET: a web font fails a 0-byte budget however it got staged", () => {
  const clean = measureStagedBuild(fixture()).metrics.web_fonts.value;
  assert.equal(
    clean,
    0,
    "this build ships no web fonts, which is the plan's 0-byte budget met",
  );
  const withFont = measureStagedBuild(
    fixture({ "assets/fonts/inter.woff2": "woff" }),
  ).metrics.web_fonts.value;
  assert.ok(
    withFont > 0,
    "a staged web font is bytes against a budget of zero; ignoring the extension hides it",
  );
});

test("BUDGET: only same-origin resources count toward the request budget", () => {
  const { metrics } = measureStagedBuild(fixture());
  const n = metrics.requests_before_interaction.value;
  // The document names 5 same-origin references (manifest, icon, apple-touch,
  // css, 2 scripts => 6 refs, one of which is the document itself), plus a
  // preconnect and a canonical to a different origin, which are not requests
  // for a staged asset.
  assert.ok(
    n <= 10,
    `this fixture must fit the plan's 10-request budget, got ${n}`,
  );
  const withFontFace = measureStagedBuild(
    fixture({ "index.html": fixture().read("index.html").toString() }),
  );
  assert.equal(
    withFontFace.metrics.requests_before_interaction.value,
    n,
    "an unchanged document is the same request count",
  );
});

test("BUDGET: a count is never printed as a byte budget", () => {
  // §3.1's request line is "≤ 10", a count. The first run of this gate printed
  // "0.0 KB" beside a limit of "10 req" for a reading of 8, which reads like a
  // budget met by nothing at all. The unit travels with the metric.
  const { metrics } = measureStagedBuild(fixture());
  assert.equal(
    metrics.requests_before_interaction.unit,
    "count",
    "requests before first interaction is a count, so it carries the count unit",
  );
  assert.equal(
    formatReading(metrics.requests_before_interaction.value, "count"),
    String(metrics.requests_before_interaction.value),
    "a count prints as a count, exactly",
  );
  assert.ok(
    !formatReading(metrics.requests_before_interaction.value, "count").includes(
      "KB",
    ),
    "and never with a byte suffix",
  );
  assert.equal(
    formatReading(metrics.home_document.value, "bytes"),
    formatReading(metrics.home_document.value, "bytes"),
  );
  assert.match(
    formatReading(metrics.home_document.value, "bytes"),
    /KB$/,
    "a byte reading still prints in KB",
  );
  for (const [name, m] of Object.entries(metrics)) {
    if (name === "requests_before_interaction") continue;
    assert.equal(m.unit, "bytes", `${name} is a byte budget`);
  }
});

test("BUDGET: the heatmap budget is measured on the page that fetches the grid", () => {
  const grid = JSON.stringify({ cells: "x".repeat(5000) });
  const { metrics } = measureStagedBuild(
    fixture({ "assets/data/heatmap-grid.json": grid }),
  );
  const h = metrics.heatmap_initial;
  assert.equal(
    h.status,
    "measured",
    "the heatmap page is a real staged page; a path typo that finds nothing must not read as a met budget",
  );
  // Its initial payload is the entry script plus the data that script fetches
  // on load — nothing more, nothing less.
  assert.equal(
    h.value,
    brotliBytes(Buffer.from('fetch("../assets/data/heatmap-grid.json");')) +
      brotliBytes(Buffer.from(grid)),
    "the reading is the entry script plus the grid it fetches, compressed",
  );
  assert.deepEqual(h.parts.slice().sort(), [
    "assets/data/heatmap-grid.json",
    "assets/js/heatmap.js",
  ]);
});

test("BUDGET: a budget whose subject is absent is unmeasured, never zero", () => {
  // Nothing named heatmap in this build. The honest reading is "not measured":
  // a 0 would satisfy a 300 KB budget without anything having been fetched,
  // which is the one thing this gate must not be able to say.
  const bare = fixture({
    "solar-heatmap/index.html": null,
    "assets/js/heatmap.js": null,
    "assets/data/heatmap-grid.json": null,
    "assets/js/sizing/city-data/DE.json": null,
    "assets/js/sizing/city-data/US.json": null,
    "assets/js/shared/locales.js": null,
    "assets/site.css": null,
  });
  const { metrics } = measureStagedBuild(bare);
  assert.equal(metrics.heatmap_initial.value, null);
  assert.equal(metrics.heatmap_initial.status, "not_found");
  assert.equal(
    metrics.registry_country.value,
    null,
    "no country data staged is no measurement, not an empty country",
  );
  assert.equal(metrics.registry_country.status, "not_found");
  assert.equal(
    metrics.css_total.value,
    null,
    "a sum over an empty set of stylesheets is 0 bytes of CSS, which is not a measurement either",
  );
  assert.equal(metrics.css_total.status, "not_found");
  assert.equal(
    metrics.locale_strings.value,
    null,
    "no strings file staged is no per-locale reading",
  );
  // A web font budget of 0 bytes IS a real zero: an empty font set is the
  // measurement, because the budget is about the absence of fonts.
  assert.equal(metrics.web_fonts.value, 0);
  assert.equal(metrics.web_fonts.status, "measured");

  // And a null reading is never compared against a baseline that has a number:
  // that arithmetic is NaN, and NaN compares false to everything.
  const result = compareToBaseline(metrics, {
    ...metrics,
    heatmap_initial: { value: 999 },
  });
  assert.ok(
    result.unmeasured.some((u) => u.metric === "heatmap_initial"),
    "a metric that cannot be read is reported unmeasured, whatever the baseline says",
  );
  assert.deepEqual(result.regressions, [], "and it is never a regression");
  assert.ok(
    !result.improvements.some((i) => i.metric === "heatmap_initial"),
    "nor an improvement from a number nobody measured",
  );
});

test("BUDGET: P0.4 ratchets — a worse reading fails, an over-limit reading is reported", () => {
  const small = measureStagedBuild(fixture()).metrics;
  // The fixture is tiny, so nothing is over a limit and the run is clean.
  assert.deepEqual(compareToBaseline(small, small).regressions, []);

  // A budget that is ALREADY over its limit is not a P0.4 failure: §3.2 makes
  // these gates regression-blocking from P0 and absolute only from P6/P8, and
  // §3.1 says P0.4 measures the baseline.
  const overLimit = {
    ...small,
    home_document: { ...small.home_document, value: 31 * KB },
  };
  const stillClean = compareToBaseline(overLimit, {
    ...overLimit,
    home_document: { ...overLimit.home_document, value: 32 * KB },
  });
  assert.deepEqual(
    stillClean.regressions,
    [],
    "being over a limit the baseline also exceeded is not a regression",
  );

  // Getting worse against the same baseline is, and it names the metric and
  // both numbers. (First argument is the reading now, second the baseline.)
  const worse = compareToBaseline(
    {
      ...overLimit,
      home_document: { ...overLimit.home_document, value: 32 * KB },
    },
    overLimit,
  );
  assert.equal(worse.regressions.length, 1);
  assert.equal(worse.regressions[0].metric, "home_document");
  assert.ok(
    worse.regressions[0].message.includes("31.0 KB") &&
      worse.regressions[0].message.includes("32.0 KB"),
    `a regression must carry both readings: ${worse.regressions[0].message}`,
  );
});

test("BUDGET: a move inside the compressor tolerance is noise, not a regression", () => {
  const base = measureStagedBuild(fixture()).metrics;
  const nudged = {
    ...base,
    home_document: {
      ...base.home_document,
      value: base.home_document.value + REGRESSION_TOLERANCE_BYTES - 1,
    },
  };
  assert.deepEqual(
    compareToBaseline(nudged, base).regressions,
    [],
    "brotli output moves a byte or two between compressor versions and platforms; that is noise, not a regression",
  );
  const real = {
    ...base,
    home_document: {
      ...base.home_document,
      value: base.home_document.value + REGRESSION_TOLERANCE_BYTES + 1,
    },
  };
  assert.equal(
    compareToBaseline(real, base).regressions.length,
    1,
    "a move past the tolerance is a real change and must be reported",
  );
});

test("BUDGET: a metric that shrinks is an improvement, not a regression", () => {
  // The fat stylesheet has to be VARIED. Brotli squeezes `a{color:red}` repeated
  // fifty times down to a handful of bytes, so a repetitive fixture would prove
  // nothing about the compressed reading this gate actually makes.
  const varied = Array.from(
    { length: 200 },
    (_, i) =>
      `.r${i} { color: rgb(${i % 255},${(i * 7) % 255},${(i * 13) % 255}); }`,
  ).join("\n");
  const big = measureStagedBuild(
    fixture({ "assets/site.css": varied }),
  ).metrics;
  const small = measureStagedBuild(fixture()).metrics;
  assert.ok(
    big.css_total.value > small.css_total.value + 100,
    "the fixture must actually move the compressed reading",
  );
  const result = compareToBaseline(small, big);
  assert.deepEqual(result.regressions, []);
  assert.ok(
    result.improvements.some((i) => i.metric === "css_total"),
    "a smaller CSS reading is worth naming, so the trend is visible in the ledger",
  );
});

test("BUDGET: a baseline missing a metric is measured, not silently ignored", () => {
  const { metrics } = measureStagedBuild(fixture());
  const partial = { ...metrics };
  delete partial.registry_country;
  const result = compareToBaseline(metrics, partial);
  assert.ok(
    result.unmeasured.some((u) => u.metric === "registry_country"),
    "a metric the baseline does not carry is reported as unmeasured, never assumed to have held",
  );
  assert.deepEqual(
    result.regressions,
    [],
    "and it is not treated as a regression either — there is nothing to compare against yet",
  );
});

test("BUDGET: a budget over its limit is named a breach, never 'ok'", () => {
  // The table's verdict column said "ok" beside a 3.3x breach, which is exactly
  // how a breach stops being read. §3.2 makes these gates regression-blocking
  // from P0, so the run still exits 0 — but the word in the column is the
  // difference between a visible breach and a buried one.
  const dir = mkdtempSync(join(tmpdir(), "jev-budget-breach-"));
  const ledger = join(dir, "ledger.jsonl");
  try {
    // Pseudo-random, so brotli cannot squeeze it back under the limit: 20 KB of
    // CSS budget has to be beaten by real bytes.
    let seed = 123456789;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
    const css = Array.from(
      { length: 4000 },
      (_, i) =>
        `.c${i}{color:rgb(${next() % 255},${next() % 255},${next() % 255});margin:${next() % 97}px}`,
    ).join("");
    assert.ok(
      brotliBytes(Buffer.from(css)) > BYTE_BUDGET_LIMITS.css_total,
      "the fixture must actually exceed the plan's CSS budget, or this test proves nothing",
    );
    writeFileSync(
      join(dir, "index.html"),
      '<!doctype html><html><head><link rel="stylesheet" href="./site.css"></head></html>',
    );
    writeFileSync(join(dir, "site.css"), css);
    writeFileSync(ledger, "");

    const run = spawnSync(
      process.execPath,
      [CLI, "--stage", dir, "--ledger", ledger, "--out", join(dir, "r.json")],
      { encoding: "utf8" },
    );
    assert.equal(
      run.status,
      0,
      "an over-limit reading is reported, not failed, until P6/P8 (plan §3.2)",
    );
    const row = run.stdout.split("\n").find((l) => l.startsWith("css_total"));
    assert.ok(row, `the table must print a css_total row:\n${run.stdout}`);
    assert.match(
      row,
      /breach/,
      `an over-limit budget says so in its own row: ${row}`,
    );
    assert.match(
      row,
      /unmeasured/,
      `and with no baseline declared it says both: over the limit, and nothing to compare against. ${row}`,
    );
    assert.doesNotMatch(
      row,
      /\bok\b/,
      `a breach must never be printed as ok: ${row}`,
    );
    assert.match(
      run.stdout,
      /over the plan's limit/,
      "and the breach still names the plan's own limit, not just the baseline",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("BUDGET: the baseline is read from the latest ledger row that carries one", () => {
  // The P0.3d baseline row was nested wrongly and readRatchetBaseline skipped
  // it in silence, so the gate kept ratcheting against an older bar while the
  // ledger claimed a newer one. This reader is written so that cannot recur
  // quietly: a row without metrics is skipped, and the LAST one wins.
  const row = (ref, home) =>
    JSON.stringify({
      ts: "2026-09-26",
      kind: "baseline",
      ref,
      summary: "s",
      evidence: { metrics: { home_document: { value: home, limit: 30 * KB } } },
    });
  const ledger = [
    row("P0.4", 1 * KB),
    JSON.stringify({
      ts: "2026-09-26",
      kind: "note",
      ref: "P0.4",
      summary: "no metrics here",
    }),
    row("P0.4", 2 * KB),
  ].join("\n");
  const base = readByteBudgetBaseline(ledger);
  assert.equal(
    base.metrics.home_document.value,
    2 * KB,
    "the newest declared baseline is the bar; an older row must not win",
  );

  // No byte baseline at all is its own state, never a silent pass.
  const none = readByteBudgetBaseline(
    JSON.stringify({
      ts: "2026-09-26",
      kind: "gate-run",
      ref: "P0.3e",
      summary: "s",
      evidence: { jev: { scoped: { score: 96.63 } } },
    }),
  );
  assert.deepEqual(
    none.metrics,
    {},
    "with no declared baseline the gate reports everything as unmeasured, rather than inventing a bar of zero and failing against it",
  );
  assert.equal(none.source, null);

  // A gate run also carries metrics, and it is the newest line in the ledger.
  // If it could become the bar, the gate would ratchet against whatever the
  // last run happened to measure and would never fail anything.
  const runAfter = [
    row("P0.4", 1 * KB),
    JSON.stringify({
      ts: "2026-09-26",
      kind: "gate-run",
      ref: "P0.4",
      summary: "the run",
      evidence: {
        metrics: { home_document: { value: 9 * KB, limit: 30 * KB } },
      },
    }),
  ].join("\n");
  assert.equal(
    readByteBudgetBaseline(runAfter).metrics.home_document.value,
    1 * KB,
    "only a declared baseline row sets the bar; a gate run must not move it",
  );
});

test("BUDGET: each metric's bar is its own newest declared reading", () => {
  // P0.4 declares more than one family of metric as its clusters land: byte
  // budgets, then Lighthouse and axe. If the bar were "whatever the last row
  // said", the first family would silently stop being enforced the moment the
  // second family's baseline was appended. Per metric, newest wins; a row that
  // says nothing about a metric leaves that metric's bar alone.
  const wide = (metrics) =>
    JSON.stringify({
      ts: "2026-09-26",
      kind: "baseline",
      ref: "P0.4",
      summary: "s",
      evidence: { metrics },
    });
  const ledger = [
    wide({ home_document: { value: 1 * KB, limit: 30 * KB } }),
    wide({ css_total: { value: 2 * KB, limit: 20 * KB } }),
  ].join("\n");
  const base = readByteBudgetBaseline(ledger);
  assert.deepEqual(
    Object.keys(base.metrics).sort(),
    ["css_total", "home_document"],
    "a later row that declares a different metric must not erase the earlier one",
  );
  assert.equal(base.metrics.home_document.value, 1 * KB);
  assert.equal(
    base.metrics.home_document.from_ref,
    "P0.4",
    "each metric records which row declared it",
  );

  // A later row re-declaring the SAME metric does move its bar.
  const moved = readByteBudgetBaseline(
    `${ledger}\n${wide({ home_document: { value: 3 * KB, limit: 30 * KB } })}`,
  );
  assert.equal(
    moved.metrics.home_document.value,
    3 * KB,
    "and the newest declared reading of a metric is the bar",
  );
  assert.equal(
    moved.metrics.css_total.value,
    2 * KB,
    "the other metric keeps its own bar",
  );
});

test("BUDGET: the CLI measures a real staged tree and exits on a regression", async () => {
  const dir = mkdtempSync(join(tmpdir(), "jev-budget-cli-"));
  const ledger = join(dir, "ledger.jsonl");
  try {
    // A staged tree on disk, which is what CI and the runbook hand the gate.
    writeFileSync(
      join(dir, "index.html"),
      '<!doctype html><html><head><link rel="stylesheet" href="./site.css"><script type="module" src="./ui.js"></script></head></html>',
    );
    writeFileSync(join(dir, "site.css"), "body{color:#111}");
    writeFileSync(
      join(dir, "ui.js"),
      'import {e} from "./engine.js";export const ui=e;',
    );
    writeFileSync(join(dir, "engine.js"), "export const e=1;");

    // No baseline declared yet: everything is unmeasured, and the run passes.
    writeFileSync(ledger, "");
    const first = spawnSync(
      process.execPath,
      [CLI, "--stage", dir, "--ledger", ledger, "--out", join(dir, "r1.json")],
      { encoding: "utf8" },
    );
    assert.equal(first.status, 0, first.stderr);
    const firstReport = JSON.parse(readFileSync(join(dir, "r1.json"), "utf8"));
    assert.equal(
      Object.keys(firstReport.metrics).length,
      Object.keys(BYTE_BUDGET_LIMITS).length,
      "every budget is written, including the ones with no data in this fixture",
    );

    // Declare THAT reading as the baseline, then make the CSS fatter: the same
    // command must now fail, and must say which budget moved.
    const asBaseline = (m) =>
      Object.fromEntries(
        Object.entries(m).map(([k, v]) => [
          k,
          { value: v.value, limit: v.limit },
        ]),
      );
    writeFileSync(
      ledger,
      JSON.stringify({
        ts: "2026-09-26",
        kind: "baseline",
        ref: "P0.4",
        summary: "byte budgets",
        evidence: { metrics: asBaseline(firstReport.metrics) },
      }) + "\n",
    );
    const css = Array.from(
      { length: 300 },
      (_, i) => `.s${i}{margin:${i % 17}px}`,
    ).join("");
    writeFileSync(join(dir, "site.css"), css);
    const worse = spawnSync(
      process.execPath,
      [CLI, "--stage", dir, "--ledger", ledger, "--out", join(dir, "r2.json")],
      { encoding: "utf8" },
    );
    assert.equal(
      worse.status,
      1,
      "a metric that grew past the declared baseline fails the run",
    );
    assert.match(worse.stderr, /css_total/, "and the failing budget is named");
    assert.match(worse.stderr, /regression/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
