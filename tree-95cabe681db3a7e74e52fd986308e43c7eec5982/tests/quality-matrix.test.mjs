// Plan §8 P0.4 / Q-07: the axe-core matrix over template × state × theme ×
// text direction, and the ratchet that keeps it honest from P0.
//
// What these tests hold in place:
//   • that all FOUR of the plan's dimensions are accounted for — a dimension
//     the product does not have is reported absent, with the evidence, rather
//     than quietly dropped so the cell count looks smaller;
//   • that a state is only driven on a template that HAS it: a blog post has no
//     result card, and inventing a cell for it is a fabricated measurement;
//   • that the direction dimension follows whether the page really loads the
//     i18n module, which is what sets `dir` — not an assumption about templates;
//   • that every selector the matrix drives still exists in the staged page that
//     drives it, checked offline so a renamed id fails here and not in CI;
//   • that P0.4 RATCHETS. §3.2 makes axe regression-blocking from P0 and
//     absolute only from P5 (new shell) and P8 (everything), so a cell that is
//     already over its absolute cap is reported; only getting WORSE against the
//     declared bar fails.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  AXE_TAGS,
  compareCells,
  matrixCells,
  readA11yBaseline,
  templateMatrix,
} from "../scripts/lib/quality-matrix.mjs";

const KB = 1024;

// A staged tree with one of every page shape, three cities, one page that
// loads the i18n module and one that does not, and no theme anywhere.
function fixture(overrides = {}) {
  const files = new Map();
  const add = (path, body) => files.set(path, body);
  add(
    "index.html",
    [
      "<!doctype html><html><body>",
      '<input id="citySearch">',
      '<ul id="citySuggestions"></ul>',
      '<input type="radio" id="modeQuick" name="modeToggle" checked>',
      '<input type="radio" id="modeManual" name="modeToggle">',
      '<div id="fullControls" hidden>',
      '<select id="loadMode"><option value="bill">bill</option><option value="kwh">kwh</option></select>',
      '<input id="dailyKwhInput">',
      '<select id="systemGoal"><option value="bill-cut">bill-cut</option><option value="backup">backup</option></select>',
      '<input id="customRateVal">',
      "</div>",
      '<button id="btnRunSizing">Go</button>',
      '<div id="resultsRegion" hidden></div>',
      '<script type="module" src="./assets/js/sizing/ui.js"></script>',
      "</body></html>",
    ].join(""),
  );
  // The page reaches i18n through ui.js's import, not by naming it — which is
  // how the real home page does it, and why the matrix follows the module
  // graph rather than grepping the markup.
  add(
    "assets/js/sizing/ui.js",
    'import {\n  applyI18n,\n  translate as t,\n} from "../shared/i18n.js";\nexport const ui = [applyI18n, t];',
  );
  add(
    "assets/js/shared/i18n.js",
    "export const applyI18n = 1; export const translate = 1;",
  );
  add("berlin.html", "<!doctype html><html><body>city</body></html>");
  add("cairo.html", "<!doctype html><html><body>city</body></html>");
  add("auckland.html", "<!doctype html><html><body>city</body></html>");
  add(
    "solar-heatmap/index.html",
    '<!doctype html><html><body><script type="module" src="../assets/js/heatmap.js"></script></body></html>',
  );
  add("about/index.html", "<!doctype html><html><body>about</body></html>");
  add("blog/index.html", "<!doctype html><html><body>blog</body></html>");
  add(
    "blog/a-post/index.html",
    "<!doctype html><html><body>post</body></html>",
  );
  add("404.html", "<!doctype html><html><body>404</body></html>");
  add("assets/site.css", "body{color:#111}");
  for (const [path, body] of Object.entries(overrides)) {
    if (body === null) files.delete(path);
    else add(path, body);
  }
  return {
    files: [...files.keys()].sort(),
    read: (rel) => {
      const v = files.get(rel);
      if (v === undefined) throw new Error(`no such staged file: ${rel}`);
      return Buffer.isBuffer(v) ? v : Buffer.from(v);
    },
    text: (rel) => files.get(rel) ?? null,
  };
}

const matrix = (overrides) => matrixCells(fixture(overrides));

test("Q-07: every plan dimension is measured, and an absent one says so", () => {
  const m = matrix();
  // The plan's four dimensions are all present as DECLARED dimensions, whether
  // or not the product varies along them.
  assert.deepEqual(
    m.dimensions.map((d) => d.name).sort(),
    ["direction", "state", "template", "theme"],
    "the plan's matrix is template x state x theme x direction; all four must be accounted for",
  );

  // The product has no theme: nothing sets one. That is measured here, not
  // assumed, and the dimension is still declared with the evidence.
  const theme = m.dimensions.find((d) => d.name === "theme");
  assert.equal(
    theme.values.length,
    1,
    "no theme is staged, so there is no theme to vary",
  );
  assert.equal(
    theme.values[0].id,
    "none",
    "with nothing setting a theme the dimension's only value is `none`; naming it `light` would audit a theme the product does not have",
  );
  assert.equal(
    theme.values[0].present,
    false,
    "and it says the dimension is absent, not present",
  );
  assert.match(
    theme.values[0].evidence,
    /prefers-color-scheme|data-theme/,
    "an absent dimension must carry the evidence for its absence, or a reader cannot tell it apart from an omission",
  );

  // A staged theme is a real value, and it multiplies the cells.
  const themed = matrix({
    "assets/site.css":
      "body{color:#111}@media (prefers-color-scheme: dark){body{color:#eee}}",
  });
  const darkTheme = themed.dimensions.find((d) => d.name === "theme");
  assert.equal(
    darkTheme.values.length,
    2,
    "a real theme becomes a value the matrix varies over",
  );
  assert.ok(
    themed.cells.length > m.cells.length,
    "and it multiplies the cells, which is the whole point of declaring the dimension",
  );
});

test("Q-07: one cell per page template, with a deterministic representative", () => {
  const m = matrix();
  const kinds = m.dimensions
    .find((d) => d.name === "template")
    .values.map((v) => v.id);
  assert.deepEqual(
    kinds.sort(),
    ["404", "about", "blog-index", "blog-post", "city", "heatmap", "home"],
    "the staged tree has seven page shapes and the plan asks for every template",
  );
  const city = m.dimensions
    .find((d) => d.name === "template")
    .values.find((v) => v.id === "city");
  assert.equal(
    city.path,
    "auckland.html",
    "with 70-odd city pages the representative is the lexicographically first, so the matrix is the same set on every run",
  );
  // A second reading of the same tree must choose the same cell, or the
  // baseline a run declares belongs to a page nobody can reproduce.
  assert.deepEqual(
    matrix().cells.map((c) => c.id),
    m.cells.map((c) => c.id),
  );
});

test("Q-07: a state is only driven on a template that has it", () => {
  const m = matrix();
  const resultCells = m.cells.filter((c) => c.state === "result");
  assert.ok(
    resultCells.length > 0,
    "the calculator's result state is a real cell: it is where most of the dynamic content lives",
  );
  assert.ok(
    resultCells.every((c) => c.template === "home"),
    `only the calculator has a result card; got ${[...new Set(resultCells.map((c) => c.template))].join(",")}`,
  );
  // And the inapplicable combinations are stated, not omitted: a reader must be
  // able to tell "we chose not to audit a blog post's result state" from "we
  // audited it".
  assert.ok(
    m.not_applicable.some(
      (n) => n.template === "blog-post" && n.state === "result",
    ),
    "a blog post has no result state, and that is recorded as not applicable rather than skipped",
  );
  assert.match(
    m.not_applicable.find(
      (n) => n.template === "blog-post" && n.state === "result",
    ).reason,
    /no run control/i,
    "and the reason names what is missing",
  );
});

test("Q-07: the direction dimension follows the i18n module, not a guess", () => {
  const m = matrix();
  const direction = m.dimensions.find((d) => d.name === "direction");
  assert.deepEqual(
    direction.values.map((v) => v.id).sort(),
    ["ltr", "rtl"],
    "the product ships an RTL locale, so both directions are audited",
  );
  const homeCells = m.cells.filter((c) => c.template === "home");
  assert.ok(
    !fixture().text("index.html").includes("shared/i18n.js"),
    "the home page's markup never names the i18n module - it reaches it through ui.js, which is why the matrix follows the graph",
  );
  assert.ok(
    homeCells.some((c) => c.direction === "rtl"),
    "the page whose graph reaches the i18n module is audited right-to-left",
  );
  // A page that never loads i18n never sets `dir`, so an RTL cell for it is a
  // measurement of the default layout wearing a label.
  const heatmapCells = m.cells.filter((c) => c.template === "heatmap");
  assert.ok(
    heatmapCells.every((c) => c.direction === "ltr"),
    "a page without the i18n module has one direction, not two",
  );
  assert.ok(
    m.not_applicable.some(
      (n) => n.template === "heatmap" && n.dimension === "direction",
    ),
    "and that is recorded as not applicable, with the reason",
  );

  // Give the heatmap page the i18n module and it gains the RTL cell.
  const wired = matrix({
    "solar-heatmap/index.html":
      '<!doctype html><html><body><script type="module" src="../assets/js/heatmap.js"></script></body></html>',
    "assets/js/heatmap.js": 'import { applyI18n } from "./shared/i18n.js";',
  });
  assert.ok(
    wired.cells.some((c) => c.template === "heatmap" && c.direction === "rtl"),
    "i18n in the page's module graph is what makes the RTL cell real",
  );
});

test("Q-07: every selector the matrix drives exists in the page it drives", () => {
  // Caught here, offline, rather than as a CI timeout: a renamed id would
  // otherwise show up as one flaky audit cell.
  const m = matrix();
  const driven = m.cells.flatMap((c) => c.steps);
  assert.ok(
    driven.length > 0,
    "the result state is driven by real steps, not by magic",
  );
  for (const step of driven) {
    const page = m.cells.find((c) => c.steps.includes(step));
    const html = fixture().text(page.path);
    assert.ok(html, `${page.path} is staged`);
    const id = /#([A-Za-z0-9_-]+)/.exec(step.selector)?.[1];
    if (!id) continue;
    assert.ok(
      html.includes(`id="${id}"`),
      `${page.path} must still carry id="${id}", which ${page.id}'s step ${step.action} drives`,
    );
  }
  assert.deepEqual(
    AXE_TAGS,
    ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"],
    "Q-07 names WCAG 2.2 A/AA plus the best-practice rules, so that is the tag set and no subset of it",
  );
});

test("Q-07: the bar is per cell, and P0.4 ratchets rather than enforcing", () => {
  const m = matrix();
  const counts = m.cells.map((c) => ({ id: c.id, violations: 0 }));
  assert.deepEqual(compareCells(counts, {}).regressions, []);

  // Worse than the bar: a regression, and it names the cell.
  const worse = compareCells(
    m.cells.map((c) => ({
      id: c.id,
      violations: c.id.includes("home") ? 2 : 0,
    })),
    Object.fromEntries(m.cells.map((c) => [c.id, { violations: 1 }])),
  );
  assert.ok(
    worse.regressions.length > 0,
    "a cell that gained violations is a regression",
  );
  assert.ok(
    worse.regressions.every((r) => r.id.includes("home")),
    `only the home cells changed, so only they regress: ${worse.regressions.map((r) => r.id).join(",")}`,
  );
  assert.match(
    worse.regressions[0].message,
    /1/,
    "and the message carries both counts",
  );

  // §3.2: axe is absolute only from P5/P8. A cell already over its cap is
  // reported, and is not a P0.4 failure.
  const overCap = Object.fromEntries(
    m.cells.map((c) => [c.id, { violations: 40, cap: 0 }]),
  );
  const held = compareCells(
    m.cells.map((c) => ({ id: c.id, violations: 40 })),
    overCap,
  );
  assert.deepEqual(
    held.regressions,
    [],
    "a reading that matches a baseline which also breached the absolute cap is not a regression",
  );
  assert.ok(
    held.breaches.length > 0,
    "but the breach against the absolute cap stays visible",
  );
  assert.equal(held.breaches[0].cap, 0);

  // A cell the bar does not mention is unmeasured, never a pass.
  const partial = compareCells(counts, { [m.cells[0].id]: { violations: 0 } });
  assert.equal(
    partial.unmeasured.length,
    counts.length - 1,
    "every cell the bar says nothing about is unmeasured",
  );
  assert.deepEqual(partial.regressions, []);

  // Better than the bar is an improvement worth naming, so a shrinking count is
  // visible in the ledger rather than silent.
  const better = compareCells(
    counts,
    Object.fromEntries(m.cells.map((c) => [c.id, { violations: 3 }])),
  );
  assert.equal(better.improvements.length, counts.length);
});

test("Q-07: a cell that could not be audited never reads as a clean cell", () => {
  // The heatmap cell is the live case: axe's best-practice tag does not finish
  // on that page and takes the renderer down. The bar it leaves behind must not
  // be a number, because a number would read as a pass and the next run would
  // ratchet a hole.
  const m = matrix();
  const hole = m.cells[0].id;
  const result = compareCells(
    [
      { id: hole, violations: 0 },
      { id: "other", violations: 0 },
    ],
    { [hole]: { violations: null, status: "unauditable" } },
  );
  assert.ok(
    result.unmeasured.some((u) => u.id === hole),
    "a bar with no violation count is no bar, so the cell is unmeasured rather than clean",
  );
  assert.deepEqual(result.regressions, [], "and never a regression");
  assert.ok(
    !result.improvements.some((i) => i.id === hole),
    "nor an improvement from zero violations nobody measured",
  );

  // And the reader refuses it too: only a numeric count can set a bar.
  const base = readA11yBaseline(
    JSON.stringify({
      ts: "2026-09-26",
      kind: "baseline",
      ref: "P0.4",
      summary: "s",
      evidence: {
        metrics: {
          a11y_matrix: {
            cells: { [hole]: { violations: null, status: "unauditable" } },
          },
        },
      },
    }),
  );
  assert.deepEqual(
    base.cells,
    {},
    "a baseline row of holes sets no bar at all, and says so",
  );

  // A numeric zero IS a bar, and it is compared like any other.
  const clean = readA11yBaseline(
    JSON.stringify({
      ts: "2026-09-26",
      kind: "baseline",
      ref: "P0.4",
      summary: "s",
      evidence: {
        metrics: { a11y_matrix: { cells: { [hole]: { violations: 0 } } } },
      },
    }),
  );
  assert.equal(
    clean.cells[hole].violations,
    0,
    "a measured zero is a reading, and it is kept",
  );
});

test("Q-07: the bar is read from the newest declared baseline, per cell", () => {
  const row = (cells) =>
    JSON.stringify({
      ts: "2026-09-26",
      kind: "baseline",
      ref: "P0.4",
      summary: "s",
      evidence: { metrics: { a11y_matrix: { cells } } },
    });
  const base = readA11yBaseline(
    [
      row({ "home/arrival/ltr": { violations: 4 } }),
      JSON.stringify({
        ts: "2026-09-26",
        kind: "note",
        ref: "P0.4",
        summary: "no cells",
      }),
      row({ "home/arrival/ltr": { violations: 1 } }),
    ].join("\n"),
  );
  assert.equal(
    base.cells["home/arrival/ltr"].violations,
    1,
    "the newest declared reading of a cell is the bar",
  );
  assert.deepEqual(
    readA11yBaseline(row({ a: { violations: 0 } })).cells.a.violations,
    0,
  );
  const none = readA11yBaseline(
    JSON.stringify({
      ts: "2026-09-26",
      kind: "gate-run",
      ref: "P0.4",
      summary: "s",
    }),
  );
  assert.deepEqual(
    none.cells,
    {},
    "no declared baseline is its own state, not a bar of zero",
  );
  assert.equal(none.source, null);
  assert.ok(KB > 0);
});
