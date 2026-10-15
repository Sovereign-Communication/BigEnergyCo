// Plan §8 P0.4 / Q-07: the axe-core matrix over template × state × theme ×
// text direction, enumerated from a staged build and ratcheted against the
// baseline the ledger declares.
//
// Like the byte budgets, this module never touches a filesystem: it takes a
// staged build as data ({files, read}) so the whole matrix is testable
// offline. The browser half lives in scripts/check-a11y-matrix.mjs.
//
// Three decisions this module is careful about, because each is a way an
// accessibility matrix lies by accident:
//
//   1. A DIMENSION THE PRODUCT DOES NOT HAVE IS STILL DECLARED. The plan's
//      matrix has four dimensions. This build has no theme, so the theme
//      dimension carries one value, `none`, with the evidence for its absence
//      in the value itself. Dropping the dimension would shrink the cell count
//      and make the matrix look smaller than it is; inventing a dark theme
//      would audit something that does not exist.
//   2. A CELL IS ONLY REAL WHERE THE PRODUCT HAS THE STATE. A blog post has no
//      result card, so "blog-post / result / rtl" is not a cell — it is a
//      recorded non-applicable combination with the reason it does not apply.
//      The distinction matters when someone asks why a page was not audited:
//      "we chose not to" and "we did, and it was clean" are different answers.
//   3. THE DIRECTION FOLLOWS THE CODE. `dir` is set by shared/i18n.js, so a
//      page whose module graph never reaches that module has exactly one
//      direction no matter what template it is. That is read out of the staged
//      graph, not assumed from a list of which templates "should" be
//      translated.

import { moduleGraph, scriptEntries } from "./byte-budgets.mjs";

// Q-07 names the rule set: WCAG 2.2 A and AA plus the best-practice rules.
export const AXE_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
  "best-practice",
];

// The states the plan's "state" dimension means, and what drives each.
//
// The run sequence is the one scripts/smoke/actions.mjs performs, in the same
// order and against the same ids: a city from the picker, a load in kWh, a
// goal, a rate, then the run. Clicking the run button on its own does NOT
// produce a result — the first version of this driver did exactly that and sat
// on `#resultsRegion` until it timed out — so the state is only real once the
// inputs are the ones a visitor fills in.
//
// Two action kinds, and the difference is measured rather than preferred:
//   click  a real pointer interaction, on a control a visitor can see and press.
//   set    the value plus the input and change events, for a control that is
//          NOT visible in this state — #loadMode, #dailyKwhInput, #systemGoal
//          and #customRateVal all live inside #fullControls, which the product
//          hides until the manual radio is checked. Playwright's own fill and
//          selectOption both wait for visibility, so a driver that used them
//          here timed out on a control that is working exactly as designed.
//          The events dispatched are the ones a real interaction produces.
const RUN_INPUTS = [
  { action: "fill", selector: "#citySearch", value: "Honolulu" },
  { action: "expect-option", selector: '#citySuggestions [role="option"]' },
  { action: "click", selector: '#citySuggestions [role="option"]' },
  { action: "set", selector: "#loadMode", value: "kwh" },
  { action: "set", selector: "#dailyKwhInput", value: "10" },
  { action: "set", selector: "#systemGoal", value: "bill-cut" },
  { action: "set", selector: "#customRateVal", value: "0.42" },
  { action: "click", selector: "#btnRunSizing" },
  { action: "expect-visible", selector: "#resultsRegion" },
];

export const STATES = [
  { id: "arrival", needs: null, steps: [] },
  { id: "result", needs: "run control", steps: RUN_INPUTS },
  {
    // The advanced panel, revealed by the radio a visitor actually presses.
    // A panel nobody can open is a panel nobody has audited.
    id: "manual",
    needs: "mode radio",
    steps: [{ action: "click", selector: "#modeManual" }],
  },
];

const I18N_MODULE = /(^|\/)shared\/i18n\.js$/;
const THEME_HINT = /prefers-color-scheme|data-theme/;

// One representative per page shape. The shapes are read off the staged paths
// rather than a hand-written list, so a new template cannot slip past the
// matrix by existing.
const SHAPES = [
  { id: "home", match: (p) => p === "index.html" },
  {
    id: "heatmap",
    match: (p) => /(^|\/)[^/]*heatmap[^/]*\/index\.html$/i.test(p),
  },
  { id: "about", match: (p) => /(^|\/)about\/index\.html$/.test(p) },
  { id: "blog-index", match: (p) => /(^|\/)blog\/index\.html$/.test(p) },
  { id: "blog-post", match: (p) => /^blog\/.+\/index\.html$/.test(p) },
  { id: "404", match: (p) => p === "404.html" },
  // City pages are flat `<slug>.html` in the staged build. The shape is
  // "everything that is a top-level .html and not one of the named pages".
  {
    id: "city",
    match: (p) => /^[^/]+\.html$/.test(p),
    exclude: ["index.html", "404.html"],
  },
];

/**
 * The template dimension: one entry per page shape, each with the single path
 * the matrix audits. `has_i18n` is measured by walking that page's module
 * graph, because the real home page never names shared/i18n.js in its markup —
 * it reaches it through ui.js's import — so grepping the HTML would call a
 * translated page untranslated.
 */
export function templateMatrix({ files, read }) {
  const pages = files.filter((f) => f.endsWith(".html"));
  const staged = new Set(files);
  const templates = [];
  for (const shape of SHAPES) {
    const candidates = pages
      .filter(shape.match)
      .filter((p) => !(shape.exclude || []).includes(p))
      .sort();
    if (!candidates.length) continue;
    // Lexicographically first, so the audited page is the same one on every
    // run and a baseline row means something reproducible.
    const path = candidates[0];
    const html = read(path).toString("utf8");
    const graph = moduleGraph(scriptEntries(html, staged, path), read, staged);
    templates.push({
      id: shape.id,
      path,
      pages: candidates.length,
      has_i18n: [...graph].some((f) => I18N_MODULE.test(f)),
      has_run_control: /id="btnRunSizing"/.test(html),
    });
  }
  return templates;
}

/**
 * The theme dimension. A real theme is a value the matrix varies over; no theme
 * is one `none` value carrying the evidence for its absence.
 */
export function themeDimension({ files, read }) {
  const styleish = files.filter(
    (f) => f.endsWith(".css") || f.endsWith(".html") || f.endsWith(".js"),
  );
  const found = [];
  for (const f of styleish) {
    if (THEME_HINT.test(read(f).toString("utf8"))) found.push(f);
  }
  if (found.length) {
    // A theme is two renderings, not one: the default and the
    // prefers-color-scheme: dark branch both reach a visitor.
    return [
      {
        id: "light",
        present: true,
        evidence: `${found.length} staged file(s) set a theme, first ${found[0]}`,
      },
      {
        id: "dark",
        present: true,
        requires: "prefers-color-scheme: dark",
        evidence: "the dark branch of the same rule set",
      },
    ];
  }
  return [
    {
      id: "none",
      present: false,
      evidence: `no staged stylesheet, page or script mentions prefers-color-scheme or data-theme across ${styleish.length} files, so the product has no theme to vary`,
    },
  ];
}

/**
 * The full matrix: four declared dimensions, the cells they produce, and the
 * combinations that do not apply — with a reason each. Takes the staged build
 * as data, the same shape the byte budgets take, so the whole matrix is
 * testable without a browser or a disk.
 */
export function matrixCells(tree) {
  const templates = templateMatrix(tree);
  const themes = themeDimension(tree);
  const dimensions = [
    { name: "template", values: templates },
    {
      name: "state",
      values: STATES.map((s) => ({ id: s.id, needs: s.needs })),
    },
    { name: "theme", values: themes },
    { name: "direction", values: [{ id: "ltr" }, { id: "rtl" }] },
  ];

  const cells = [];
  const not_applicable = [];
  for (const t of templates) {
    for (const s of STATES) {
      if (s.needs && !t.has_run_control) {
        not_applicable.push({
          template: t.id,
          state: s.id,
          reason: `${t.path} has no run control, so it has no ${s.id} state to audit`,
        });
        continue;
      }
      for (const theme of themes) {
        const directions = t.has_i18n ? ["ltr", "rtl"] : ["ltr"];
        if (!t.has_i18n) {
          not_applicable.push({
            template: t.id,
            state: s.id,
            dimension: "direction",
            reason: `${t.path} never loads shared/i18n.js, so it never sets dir and has one text direction`,
          });
        }
        for (const dir of directions) {
          cells.push({
            id: `${t.id}/${s.id}/${theme.id}/${dir}`,
            template: t.id,
            path: t.path,
            state: s.id,
            theme: theme.id,
            direction: dir,
            steps: s.steps,
          });
        }
      }
    }
  }
  return { dimensions, cells, not_applicable, tags: AXE_TAGS };
}

/**
 * Ratchet per cell. §3.2: axe blocks on regression from P0, and on its absolute
 * cap only from P5 (new shell) and P8 (everything). So a cell over its cap is
 * reported, and only a cell that got WORSE against the bar fails.
 */
export function compareCells(measured, baseline = {}) {
  const regressions = [];
  const improvements = [];
  const unmeasured = [];
  const breaches = [];
  for (const cell of measured) {
    const bar = baseline[cell.id];
    if (!bar || typeof bar.violations !== "number") {
      unmeasured.push({ id: cell.id, violations: cell.violations });
    } else if (cell.violations > bar.violations) {
      regressions.push({
        id: cell.id,
        from: bar.violations,
        to: cell.violations,
        message: `${cell.id}: ${bar.violations} -> ${cell.violations} violations against the declared baseline`,
      });
    } else if (cell.violations < bar.violations) {
      improvements.push({
        id: cell.id,
        from: bar.violations,
        to: cell.violations,
        message: `${cell.id}: ${bar.violations} -> ${cell.violations} violations`,
      });
    }
    // The absolute cap, where one is declared. Reported either way; it becomes
    // blocking in P5/P8, and saying so now keeps the number from being a
    // surprise later.
    if (typeof bar?.cap === "number" && cell.violations > bar.cap) {
      breaches.push({ id: cell.id, violations: cell.violations, cap: bar.cap });
    }
  }
  return { regressions, improvements, unmeasured, breaches };
}

/**
 * The declared bar, from the newest `baseline` ledger row that carries an
 * `a11y_matrix` cell map. Per cell, so a later cluster's rows (Lighthouse,
 * cross-browser) cannot erase this one. A `gate-run` row never sets a bar.
 */
export function readA11yBaseline(ledgerText) {
  const lines = String(ledgerText || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const skipped = [];
  const found = { cells: {}, source: null };
  for (const [i, line] of lines.entries()) {
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      skipped.push(`line ${i + 1}: not JSON`);
      continue;
    }
    if (row?.kind !== "baseline") continue;
    const cells = row?.evidence?.metrics?.a11y_matrix?.cells;
    if (!cells || typeof cells !== "object" || Array.isArray(cells)) {
      if (row?.evidence?.metrics?.a11y_matrix) {
        skipped.push(
          `line ${i + 1}: an a11y_matrix baseline row (${row?.ref || "no ref"}) carries no cell map, so it sets no bar`,
        );
      }
      continue;
    }
    for (const [id, cell] of Object.entries(cells)) {
      if (cell && typeof cell.violations === "number") {
        found.cells[id] = { ...cell, from_ref: row.ref || null };
      }
    }
    if (Object.keys(found.cells).length) found.source = row.ref || null;
  }
  return { ...found, skipped };
}

/**
 * The one axis this run of the matrix speaks for, beside the controls walk's
 * own declaration of the same axis in scripts/lib/a11y-controls.mjs: two
 * instruments, one facet, and a test asserts the two declarations agree so
 * they can never drift into two axes or none.
 */
export const A11Y_MATRIX_FACET_AXES = ["accessibility"];

/**
 * The most characters this clause may take inside the joined accessibility
 * line. The controls half declares its own bound (A11Y_CONTROLS_CLAUSE_MAX in
 * scripts/lib/a11y-controls.mjs, 240) and 240 + 1 + 39 = the 280-char clip
 * exactly, so the pair is bounded from both ends: a half over its own bound is
 * a NAMED problem in the evidence builder, never a silent trim — a trim would
 * eat whichever sentence limits the claim.
 */
export const A11Y_MATRIX_CLAUSE_MAX = 39;

/**
 * Compose this run's clause of the `accessibility` facet line from the report
 * itself: the instrument, the coverage, and the count, in 39 characters.
 *
 * One shape, chosen by the WORST thing this run found — never two: an audit
 * error is never a pass, a regression blocks, an unmeasured cell is a hole,
 * and only a run with none of those reports its violation count. The shapes
 * fit the half-bound by the DECLARED matrix's own envelope (six templates x
 * three states x one theme x two directions = 36 cells; a no-regression run
 * can only count violations its baseline declared) — and a counter that ever
 * outgrows the half does not get trimmed: the gate's backstop and the
 * builder's join both name it and fail the run.
 *
 * It deliberately does NOT repeat the controls walk's claims (keyboard,
 * names, contrast, motion): that half words them, and this half answers the
 * limit sentence it ends on — `no theme/RTL matrix` — with the run that
 * measured exactly that matrix.
 */
export function composeA11yMatrixClause(report) {
  const cells = Array.isArray(report?.cells) ? report.cells.length : 0;
  const unmeasured = Array.isArray(report?.unmeasured)
    ? report.unmeasured.length
    : 0;
  const errors = Array.isArray(report?.audit_errors)
    ? report.audit_errors.length
    : 0;
  const regressions = Array.isArray(report?.regressions)
    ? report.regressions.length
    : 0;
  const violations = Array.isArray(report?.cells)
    ? report.cells.reduce(
        (n, c) => n + (Array.isArray(c?.violations) ? c.violations.length : 0),
        0,
      )
    : 0;
  const total = cells + unmeasured;
  if (errors)
    return `axe matrix: ${errors} cell${errors === 1 ? "" : "s"} unaudited`;
  if (regressions)
    return `axe matrix: ${regressions} of ${cells} cells regressed`;
  if (unmeasured)
    return `axe matrix: ${cells}/${total} cells, ${unmeasured} unmeasured`;
  return `axe matrix: ${cells}/${total} cells, ${violations} violations`;
}
