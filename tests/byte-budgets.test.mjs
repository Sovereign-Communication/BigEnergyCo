// Plan §8 P0.4 / §3.1: the compressed byte and request budgets, measured on
// the staged build, with the baseline recorded in the ledger.
//
// What these tests hold in place:
//   • the §3.1 limits as amended by A-002 — a relaxed number must fail here,
//     because the plan says only an owner-approved amendment may relax one
//     (and the amendment lives in the plan, not in this file), and the test
//     reads A-002's numbers back out of MASTER_PLAN.md;
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
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "scripts/check-byte-budgets.mjs");

import {
  BYTE_BUDGET_FACET_AXES,
  BYTE_BUDGET_LIMITS,
  brotliBytes,
  compareToBaseline,
  composeQualityFacetLine,
  formatReading,
  measureStagedBuild,
  moduleGraph,
  QUALITY_SIZE_CLAUSE_MAX,
  readByteBudgetBaseline,
  REGRESSION_TOLERANCE_BYTES,
  scriptEntries,
} from "../scripts/lib/byte-budgets.mjs";
import { COMPLETE_FACET_CLIP } from "../scripts/lib/jev-complete.mjs";
import { deployList } from "../scripts/lib/deploy-manifest.mjs";

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
  // The three shapes a staged module can pull in, each of which the graph walk
  // has to see — and one it must not see.
  add("assets/js/shared/interpolate.js", "export const interpolate = 1;");
  add("assets/js/shared/side-effect.js", "export const sideEffect = 1;");
  add("assets/js/shared/commented-out.js", "export const neverLoaded = 1;");
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

test("BUDGET: the limits are the plan's — §3.1's table, as amended by A-002", () => {
  // Every byte budget is a KB figure in the plan. The one that is not bytes is
  // a COUNT, and it is held as a count so nobody "fixes" it into 10 KB later.
  //
  // Seven lines are §3.1 verbatim. Three are A-002's interim lines (owner-
  // approved 2026-09-29): measured shipped bytes +10 %, binding until the
  // P6/P8 absolute phases. BOTH sets live in the plan — this test reads the
  // amendment's own numbers out of MASTER_PLAN.md, so a constant that drifts
  // from the plan fails here, and a real relaxation must be made where §3.1
  // says it may be: measured evidence plus an owner-approved amendment.
  const plan = readFileSync(join(ROOT, "docs/plan/MASTER_PLAN.md"), "utf8");
  const tableLimits = {
    home_document: 30,
    css_total: 20,
    js_to_first_result: 200,
    locale_strings: 25,
    web_fonts: 0,
  };
  const amendedLimits = {
    js_before_interactive: 206,
    registry_country: 83,
    heatmap_initial: 460,
  };
  for (const [metric, kb] of Object.entries(tableLimits)) {
    assert.equal(
      BYTE_BUDGET_LIMITS[metric],
      kb * KB,
      `${metric} is ${kb} KB in plan §3.1's table, unchanged by A-002.`,
    );
  }
  for (const [metric, kb] of Object.entries(amendedLimits)) {
    assert.equal(
      BYTE_BUDGET_LIMITS[metric],
      kb * KB,
      `${metric} is ${kb} KB under A-002. Only an owner-approved amendment may relax it, and the amendment lives in the plan — not here.`,
    );
    assert.ok(
      plan.includes(`\`${metric}\` ≤ ${kb} KB`),
      `plan §3.1 must carry A-002's line \`${metric}\` ≤ ${kb} KB — the gate reads the amendment from the plan, never the other way`,
    );
  }
  assert.ok(
    plan.includes("A-002 (owner-approved 2026-09-29)"),
    "the relaxation must be recorded as a numbered amendment entry, not as prose the gate happens to agree with",
  );
  assert.equal(
    BYTE_BUDGET_LIMITS.requests_before_interaction,
    10,
    "requests before first interaction is a count (≤ 10), not a byte budget",
  );
  // A 6 KB country budget against a city catalogue is the one §3.1 flagged as
  // possibly unreachable; A-002 relaxed it to the measured 75.1 KB +10 %.
  assert.equal(BYTE_BUDGET_LIMITS.registry_country, 83 * KB);
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

test("BUDGET: the graph walk sees every import shape a module can use", () => {
  // The first walk matched `import|export ... from "x"` on a single line, so a
  // multi-line import statement was invisible — and that is exactly how
  // assets/js/sizing/ui.js pulls in shared/i18n.js. It understated the
  // first-result JavaScript by 78.6 KB on the real build, which is the failure
  // this test exists to prevent.
  const { metrics } = measureStagedBuild(
    fixture({
      "assets/js/sizing/ui.js": [
        'import { engine } from "./engine.js";',
        "// A comment is not an import. The walk used to read this line and",
        "// pull in ./commented-out.js, which is staged and never loaded:",
        "//   import { ghost } from '../shared/commented-out.js';",
        "import {",
        "  // the multi-line form, with a comment inside the braces",
        "  money,",
        '} from "./money.js";',
        'import "../shared/side-effect.js";',
        'import { interpolate } from "../shared/interpolate.js";',
        "export const ui = [engine, money, interpolate];",
      ].join("\n"),
    }),
  );
  const files = metrics.js_before_interactive.files;
  const seen = Object.keys(metrics.js_before_interactive.by_file);
  assert.ok(
    seen.includes("assets/js/sizing/money.js"),
    "a from-clause on its own line after a multi-line import list is still an import",
  );
  assert.ok(
    seen.includes("assets/js/shared/interpolate.js"),
    "a relative path that walks up out of the importing module's directory resolves",
  );
  assert.ok(
    seen.includes("assets/js/shared/side-effect.js"),
    "a side-effect import with no bindings is still a fetch the browser makes",
  );
  assert.ok(
    !seen.includes("assets/js/shared/commented-out.js"),
    "a commented-out import is not an import; a graph that reads comments is a graph that counts files nobody loads",
  );
  assert.equal(
    files,
    seen.length,
    "and the reported file count is the graph it walked",
  );
});

test("BUDGET: HTML is matched case-insensitively, so no request can hide in UPPERCASE", () => {
  // CodeQL flagged the tag matchers as case-sensitive (a high-severity
  // "does not match upper case <SCRIPT> tags"). The staged pages are ours, but
  // a budget gate that silently misses a tag under-counts by exactly the amount
  // someone wanted hidden, and HTML tag and attribute names are
  // case-insensitive by spec, so an upper-case one is a real request.
  const shouted = fixture({
    "index.html": `<!doctype html><html><head>
    <LINK REL="stylesheet" HREF="./assets/site.css">
    <SCRIPT TYPE="module" SRC="./assets/js/sizing/ui.js"></SCRIPT>
    </head><body></body></html>`,
  });
  const loud = measureStagedBuild(shouted);
  assert.equal(
    loud.metrics.requests_before_interaction.value,
    3,
    "the document, the stylesheet and the upper-case script are all requests",
  );
  const sameDocLowercase = measureStagedBuild(
    fixture({
      "index.html": shouted
        .read("index.html")
        .toString()
        .replace(/SCRIPT/g, "script")
        .replace(/SRC=/g, "src=")
        .replace(/TYPE=/g, "type="),
    }),
  );
  assert.equal(
    loud.metrics.js_before_interactive.value,
    sameDocLowercase.metrics.js_before_interactive.value,
    "the same document reads the same either way: an upper-case entry script pulls the module graph too",
  );
  // The preconnect skip has to survive the same case change. It points at a
  // STAGED path on purpose: a preconnect to a third-party origin is excluded by
  // the same-origin rule anyway, so an off-origin fixture would pass whether or
  // not the skip worked.
  const shoutedPreconnect = measureStagedBuild(
    fixture({
      "index.html": `<!doctype html><html><head>
      <LINK REL="stylesheet" HREF="./assets/site.css">
      <LINK REL="PRECONNECT" HREF="./manifest.webmanifest">
      </head></html>`,
    }),
  );
  assert.equal(
    shoutedPreconnect.metrics.requests_before_interaction.value,
    2,
    "an upper-case PRECONNECT is still not a request for a staged asset",
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

// ── The `quality` facet line: what a run of this gate says on the record ─────
//
// The line the judge reads for QUALITY used to be hand-typed ("prettier clean
// repo-wide; the two duplications the design audit found are gone") with no run
// behind it, which is the same defect the performance and accessibility axes
// already had fixed. The gate that measures the shipped payload now composes it
// from the run it just measured. These tests pin what the line may and may not
// claim — and that every shape this report can produce fits the per-axis
// transport clip, because an over-long line is SILENTLY cut and the sentence
// that gets cut here is the one saying the measurement is a payload size and
// not a verdict on the code.

/** A report shaped like the real one: every §3.1 budget measured. */
function budgetReport(overrides = {}) {
  const names = Object.keys(BYTE_BUDGET_LIMITS);
  return {
    metrics: Object.fromEntries(
      names.map((n) => [n, { value: 1, limit: 1024, unit: "bytes" }]),
    ),
    regressions: [],
    improvements: names.slice(0, 2).map((metric) => ({ metric })),
    unmeasured: [],
    breaches: names.slice(0, 3).map((metric) => ({ metric })),
    tolerance_bytes: REGRESSION_TOLERANCE_BYTES,
    ...overrides,
  };
}

test("FACET: the SIZE clause is composed from the run and names what it measured", () => {
  const line = composeQualityFacetLine(budgetReport());
  assert.deepEqual(BYTE_BUDGET_FACET_AXES, ["quality"]);
  assert.match(
    line,
    /0\/9 regressed/,
    "the ratchet verdict is the size half's own concision claim",
  );
  assert.match(line, /2 improved/, "…with the improvements the run found");
  assert.match(line, /3 over limits/, "and the plan's debt, named as debt");
  assert.match(
    line,
    /home_document \(\+2\)/,
    "…naming a budget and counting the rest, so a reader can check the claim without the clause growing with the list",
  );
  assert.match(
    line,
    /binds at P6\/P8/,
    "a breach is not a bar until its phase, and the phase belongs on the clause so debt is not read as a verdict",
  );
  // The clause is HALF of the axis, and it must not pretend otherwise: the
  // sentence that says what a size measurement cannot see belongs to the
  // contract clause the builder appends, and a size clause claiming the axis
  // from here is the defect this split exists to prevent.
  assert.doesNotMatch(
    line,
    /duplication|dead code|minimal|clarity/i,
    "the size clause must claim the shipped-size half only; the clarity half is measured by the required test job",
  );
});

test("FACET: a regressed payload withdraws the concision claim", () => {
  const names = Object.keys(BYTE_BUDGET_LIMITS);
  const line = composeQualityFacetLine(
    budgetReport({ regressions: names.map((metric) => ({ metric })) }),
  );
  assert.match(line, /9\/9 REGRESSED/);
  assert.match(
    line,
    /not the smallest version that keeps the proven behavior/,
    "the axis's own words, withdrawn — not a green sentence over a red reading",
  );
  assert.doesNotMatch(
    line,
    /improved|over limits/,
    "…and the budgets that did not move are not reported as though the run were fine",
  );
});

test("FACET: a run that measured nothing says so, and claims nothing", () => {
  const line = composeQualityFacetLine({ metrics: {}, regressions: [] });
  assert.match(line, /NOT measured this run/);
  assert.match(line, /nothing here measures the smallest version/);
  assert.doesNotMatch(
    line,
    /regressed|improved/,
    "no reading means no verdict, in either direction — not even a flattering one",
  );
});

test("FACET: every size-clause shape this report can produce fits its budget", () => {
  const names = Object.keys(BYTE_BUDGET_LIMITS);
  // The bound is a measurement, not a hope: this report's metric set is
  // `BYTE_BUDGET_LIMITS`, and all nine can be an improvement, a breach AND
  // unmeasured at once, so that shape is the longest the gate can produce.
  const shapes = {
    worst: budgetReport({
      improvements: names.map((metric) => ({ metric })),
      unmeasured: names.map((metric) => ({ metric })),
      breaches: names.map((metric) => ({ metric })),
    }),
    regressed: budgetReport({
      regressions: names.map((metric) => ({ metric })),
    }),
    single_regression: budgetReport({
      regressions: [{ metric: names[0] }],
    }),
    clean: budgetReport({ improvements: [], breaches: [] }),
    partial: budgetReport({
      metrics: Object.fromEntries(
        names.slice(0, 3).map((n) => [n, { value: 1, limit: 1024 }]),
      ),
      unmeasured: names.slice(3).map((metric) => ({ metric })),
    }),
    none: {},
    // A pathological metric name is clipped, never allowed to stretch the line.
    long_names: budgetReport({
      breaches: names.map((metric) => ({ metric: metric.repeat(4) })),
    }),
  };
  for (const [shape, report] of Object.entries(shapes)) {
    const line = composeQualityFacetLine(report);
    assert.ok(
      line.length <= QUALITY_SIZE_CLAUSE_MAX,
      `${shape} composes to ${line.length} chars, over the ${QUALITY_SIZE_CLAUSE_MAX}-char ` +
        "budget for the size half; the clarity clause has to fit beside it",
    );
  }
  assert.ok(
    composeQualityFacetLine(shapes.worst).length >= 100,
    "the bound is only worth pinning if the worst case is actually long",
  );
});

test("FACET: the two quality clauses fit the transport clip TOGETHER, by construction", async () => {
  // The invariant the split rests on: one axis, two instruments, one per-axis
  // slot. Each clause is bounded by its own declared maximum, and the sum of
  // those two maxima must fit the clip — otherwise the builder's join would be
  // the first thing to overflow, and an over-long line is CUT in transit, which
  // for this axis means losing the sentence that limits the claim.
  const { QUALITY_CONTRACT_CLAUSE_MAX } =
    await import("../scripts/lib/jev-evidence.mjs");
  assert.ok(
    QUALITY_SIZE_CLAUSE_MAX + 1 + QUALITY_CONTRACT_CLAUSE_MAX <=
      COMPLETE_FACET_CLIP,
    `${QUALITY_SIZE_CLAUSE_MAX} + 1 + ${QUALITY_CONTRACT_CLAUSE_MAX} must fit ${COMPLETE_FACET_CLIP}`,
  );
});

test("FACET: the CLI publishes the composed line in the report it writes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "jev-budget-facet-"));
  const ledger = join(dir, "ledger.jsonl");
  try {
    writeFileSync(
      join(dir, "index.html"),
      '<!doctype html><html><head><link rel="stylesheet" href="./site.css"></head></html>',
    );
    writeFileSync(join(dir, "site.css"), "body{color:#111}");
    writeFileSync(ledger, "");
    const out = join(dir, "report.json");
    const run = spawnSync(
      process.execPath,
      [CLI, "--stage", dir, "--ledger", ledger, "--out", out],
      { encoding: "utf8" },
    );
    assert.equal(run.status, 0, run.stderr);
    const report = JSON.parse(readFileSync(out, "utf8"));
    assert.deepEqual(
      report.facet_axes,
      ["quality"],
      "the report must declare the axis it speaks for, or the builder discovers nothing",
    );
    assert.equal(
      report.facet_line,
      composeQualityFacetLine(report),
      "the line must be the one THIS report's reading composes, or the judge's line and the numbers behind it can drift apart",
    );
    assert.match(
      run.stdout,
      /facet line \(\d+ chars\)/,
      "and the run prints it, so a human sees the sentence the judge will read",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The slider-workflow byte diet's regression gate, measured on the REAL tree:
// js_before_interactive is the transitive module graph of the page's script
// entries, and the drag preview needs interpolateCurveTarget synchronously —
// but the 47 KB deterministic search engine, the frontier builder and the
// sims memo are worker-side code. A static ui.js import of any of them is
// exactly the mistake that once cost +11,201 compressed bytes against the
// declared baseline, and it must fail HERE, in a second, not in CI.
//
// What the slider workflow may carry eagerly: the curve projection and drift
// policy (budget-span.js, cut-targets.js) and the pure chemistry/cell model
// (chem-model.js — extracted so the engine itself could leave the payload).
// What it must never carry: engine.js, frontier.js, run.js, sim-cache.js.
function realEagerGraph() {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const staged = new Set(deployList());
  const entries = scriptEntries(html, staged);
  return moduleGraph(entries, (rel) => readFileSync(join(ROOT, rel)), staged);
}

test("GRAPH: the pre-interactive slider graph carries the projection, never the engine", () => {
  const graph = realEagerGraph();
  for (const eager of [
    "assets/js/sizing/budget-span.js",
    "assets/js/shared/cut-targets.js",
    "assets/js/sizing/chem-model.js",
  ]) {
    assert.ok(graph.has(eager), `${eager} must ship pre-interactive`);
  }
  for (const workerOnly of [
    "assets/js/sizing/engine.js",
    "assets/js/sizing/frontier.js",
    "assets/js/sizing/run.js",
    "assets/js/sizing/sim-cache.js",
  ]) {
    assert.ok(
      !graph.has(workerOnly),
      `${workerOnly} is worker-side code — a static eager import re-bloats js_before_interactive`,
    );
  }
});

// Module-graph integrity, the class of breakage a unit test cannot see: a
// named import that no export satisfies is a LINK error, so the browser
// kills the whole module (and everything that imports it) at boot — while
// every node:test stays green, because the tests never import the browser
// modules. That happened for real: ui.js named an export that only
// budget-span.js provides while importing it from cut-targets.js, and only
// the browser smoke noticed the app was dead. This walks every shipped
// module in assets/js and proves each named import resolves.
function shippedModules(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) shippedModules(p, out);
    else if (name.endsWith(".js")) out.push(p);
  }
  return out;
}

// Import/export braces may carry comments; they are not names. Exports name
// their RIGHT side (`x as y` ships y); imports bind their LEFT side (importing
// x as y requires the target to export x).
const clauseNames = (clause, side) =>
  clause
    .replace(/\/\/[^\n\r]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(",")
    .map((spec) => {
      const parts = spec.trim().split(/\s+as\s+/);
      return (parts[side === "left" ? 0 : 1] || parts[0]).trim();
    })
    .filter(Boolean);

function exportsOf(src) {
  const names = new Set();
  for (const m of src.matchAll(
    /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([\w$]+)/g,
  ))
    names.add(m[1]);
  for (const m of src.matchAll(/\bexport\s*\{([^}]*)\}/g))
    for (const name of clauseNames(m[1])) names.add(name);
  return names;
}

test("GRAPH: every named import in the shipped modules resolves to a real export", () => {
  const root = join(ROOT, "assets", "js");
  const exported = new Map();
  const files = shippedModules(root);
  for (const f of files) exported.set(f, exportsOf(readFileSync(f, "utf8")));
  const missing = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(
      /\bimport\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g,
    )) {
      const spec = m[2];
      if (!spec.startsWith(".")) continue;
      const target = join(dirname(f), spec.split("?")[0]);
      const exp = exported.get(target);
      if (!exp) {
        missing.push(`${f} imports from missing module ${spec}`);
        continue;
      }
      for (const name of clauseNames(m[1], "left")) {
        if (!exp.has(name))
          missing.push(`${f}: { ${name} } is not exported by ${spec}`);
      }
    }
  }
  assert.deepEqual(missing, [], missing.join("; "));
});
