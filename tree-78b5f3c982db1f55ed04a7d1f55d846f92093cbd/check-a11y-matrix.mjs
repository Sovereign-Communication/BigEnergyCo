#!/usr/bin/env node
// Plan §8 P0.4 / Q-07: run axe-core over the template × state × theme ×
// direction matrix on a staged build, and ratchet the result against the
// baseline the ledger declares.
//
//   node scripts/check-a11y-matrix.mjs [--stage DIR] [--ledger FILE] [--out FILE]
//                                 [--only CELL] [--keep-screens]
//
// Defaults: --stage _pages_staging, --ledger docs/plan/LEDGER.jsonl, no --out.
//
// Three decisions this driver makes, and why:
//
//   1. IT DRIVES THE CHROME THE RUNNER ALREADY HAS. `channel: "chrome"` uses
//      the installed browser, so this gate needs no Playwright browser
//      download. The Firefox and WebKit downloads belong to Q-08's
//      cross-browser cluster, which is the one that genuinely requires them.
//   2. THE AUDIT CONTEXT BYPASSES CSP, DELIBERATELY. The product ships a
//      strict `script-src`, which correctly refuses to run axe injected as an
//      inline script — the first version of this probe died on exactly that.
//      `bypassCSP` is set on the audit context only. The product's own policy is
//      untouched here and is asserted where it belongs: the smoke suite's CSP
//      gate. An audit that could not run against a strict policy would be an
//      audit of nothing.
//   3. THE MATRIX IS DECLARED, NOT DISCOVERED AT RUNTIME. Every cell, and every
//      combination that does not apply, comes from scripts/lib/quality-matrix.mjs
//      so the cell set is reviewable in a diff and a baseline row means the
//      same thing on every run.
//
// Exit codes:
//   0  no cell regressed against the declared bar
//   1  a cell regressed; every reading is still printed and written out
//   2  usage error, or the staged build / ledger / browser could not be used
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  A11Y_MATRIX_CLAUSE_MAX,
  A11Y_MATRIX_FACET_AXES,
  composeA11yMatrixClause,
  compareCells,
  matrixCells,
  readA11yBaseline,
} from "./lib/quality-matrix.mjs";
import { jevFetchStubSource } from "./smoke/actions.mjs";
import { serveStatic } from "./serve-static.mjs";
import { exitWhenDrained } from "./lib/graceful-exit.mjs";

const USAGE =
  "usage: node scripts/check-a11y-matrix.mjs [--stage DIR] [--ledger FILE] [--out FILE] [--only CELL]";

// One owner for the rule, used by the report and the terminal, so the two can
// never disagree about which bar is in force. `compareCells` already computes
// `breaches` against the declared cap and its own comment says it reports them
// "so the number [is not] a surprise later" — which it did, in the JSON, and not
// on the terminal, where the summary line also mixed the two that block with
// the four that do not. Same defect as the byte-budget report and the same fix
// as check-lighthouse.mjs: name the phase, split what blocks from what is
// reported.
const ENFORCEMENT =
  "regression-blocking from P0 (plan §3.2); absolute (0 violations) from P5 for templates in the new shell and P8 for everything";
const ABSOLUTE_BINDS_FROM = "P5 (new shell) and P8 (everything)";

/** The rule that judges this run, on the terminal as well as in the report. */
export function enforcementLine() {
  return `enforcement: ${ENFORCEMENT}\n`;
}

/**
 * The counts, split by whether they block. An audit error or a regression
 * fails the run; a violation count, an unmeasured cell and a cell over the
 * declared cap do not, until the phase above. One line carrying all six is how
 * a reader cannot tell which question a number answers.
 */
export function summaryLines({
  cells,
  violationTypes,
  errors,
  regressions,
  improvements,
  unmeasured,
  breaches,
}) {
  return (
    `matrix: ${cells} cells, ${errors} audit errors, ${regressions} regressions (these block)\n` +
    `  reported: ${violationTypes} violation types, ${improvements} improvements, ` +
    `${unmeasured} unmeasured, ${breaches} over the declared cap (reported, not blocking ` +
    `until ${ABSOLUTE_BINDS_FROM})\n`
  );
}

/**
 * The cells over the declared absolute cap, each named, under a heading that
 * says the cap is not yet a bar. `compareCells` computes these and its own
 * comment says it reports them "so the number [is not] a surprise later" — which
 * it did, in the report, and not here.
 */
export function breachSection(breaches) {
  if (!breaches.length) return "";
  const lines = [
    `\nover the declared cap (reported, not blocking until ${ABSOLUTE_BINDS_FROM}):\n`,
  ];
  for (const b of breaches) {
    lines.push(`  ${b.id}: ${b.violations} > ${b.cap} violations\n`);
  }
  return lines.join("");
}
const FLAGS = {
  "--stage": "stage",
  "--ledger": "ledger",
  "--out": "out",
  "--only": "only",
};

function stagedTree(dir) {
  const files = [];
  const walk = (rel) => {
    for (const entry of readdirSync(join(dir, rel), { withFileTypes: true })) {
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile()) files.push(child);
    }
  };
  walk("");
  return { files: files.sort(), read: (rel) => readFileSync(join(dir, rel)) };
}

function parseArgs(argv) {
  const opts = {
    stage: "_pages_staging",
    ledger: join("docs", "plan", "LEDGER.jsonl"),
    out: null,
    only: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      process.stdout.write(`${USAGE}\n`);
      return null;
    }
    const key = FLAGS[arg];
    if (!key) {
      process.stderr.write(
        `check-a11y-matrix: unknown argument ${arg}\n${USAGE}\n`,
      );
      process.exit(2);
    }
    const value = argv[++i];
    if (value === undefined || value.startsWith("--")) {
      process.stderr.write(
        `check-a11y-matrix: ${arg} requires a value\n${USAGE}\n`,
      );
      process.exit(2);
    }
    opts[key] = value;
  }
  return opts;
}

// One cell, one reading, one BROWSER. A shared browser across the whole matrix
// is a trap: when one page takes its renderer down — the heatmap cell did
// exactly that, and the browser stayed dead, so every later cell reported
// "Target page, context or browser has been closed" and the run took eight
// minutes to say nothing useful. A fresh browser per cell costs about 0.4s and
// bounds the damage to the cell that caused it.
//
// The cell is also given a hard deadline. A page that never settles must not be
// able to spend the job's whole budget, and a cell that runs out of time is
// recorded as an error, which is never a pass.
async function auditCell(
  base,
  cell,
  axeSource,
  tags,
  { deadlineMs = 180000, launch = launchChrome } = {},
) {
  return Promise.race([
    auditCellInner(base, cell, axeSource, tags, launch),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`cell exceeded its ${deadlineMs}ms budget`)),
        deadlineMs,
      ).unref(),
    ),
  ]);
}

async function launchChrome() {
  const require = createRequire(import.meta.url);
  const { chromium } = require("playwright");
  return chromium.launch({ channel: "chrome" });
}

/** The tree this report describes, so the evidence can be matched to a commit. */
function codeSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

async function auditCellInner(base, cell, axeSource, tags, launch) {
  const browser = await launch();
  try {
    const context = await browser.newContext({ bypassCSP: true });
    try {
      // The same deterministic Jev stub the smoke suite uses, so the audit never
      // waits on a network round trip and the badge renders the same way twice.
      await context.addInitScript(jevFetchStubSource());
      if (cell.direction === "rtl") {
        // `ar` is the RTL locale. localStorage is the product's own mechanism
        // (shared/i18n.js reads beco-lang), so the matrix sets what a visitor sets.
        await context.addInitScript(
          `try { localStorage.setItem("beco-lang", "ar"); } catch (e) {}`,
        );
      }
      if (cell.theme === "dark")
        await context.emulateMedia({ colorScheme: "dark" });
      const page = await context.newPage();
      const started = Date.now();
      // `load` is bounded, and a page whose load event never fires is RECORDED
      // rather than waited on. The heatmap page holds a 412 KB grid fetch open
      // and never fires it: waiting for `load` there cost 150 seconds per run and
      // produced nothing, while the same cell audits in under three seconds once
      // the page is taken as it stands. Which pages do that is worth knowing, so
      // it lands in the report instead of being hidden by a timeout.
      let loadEvent = true;
      try {
        await page.goto(`${base}/${cell.path}`, {
          waitUntil: "load",
          timeout: 30000,
        });
      } catch (err) {
        loadEvent = /Timeout/i.test(err.message) ? false : true;
      }
      for (const step of cell.steps) {
        if (step.action === "click")
          await page.click(step.selector, { timeout: 20000 });
        else if (step.action === "fill")
          await page.fill(step.selector, step.value, { timeout: 20000 });
        else if (step.action === "set") {
          // A control the product is hiding in this state. Playwright's own
          // fill and selectOption both wait for visibility, so this sets the
          // value and fires the events a real interaction fires — which is what
          // scripts/smoke/a11y.js does for the same controls.
          await page.$eval(
            step.selector,
            (el, v) => {
              el.value = v;
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
            },
            step.value,
          );
        } else if (step.action === "expect-option") {
          await page.waitForFunction(
            (sel) => document.querySelectorAll(sel).length > 0,
            step.selector,
            { timeout: 30000 },
          );
        } else if (step.action === "expect-visible") {
          await page.waitForSelector(step.selector, {
            state: "visible",
            timeout: 90000,
          });
        } else {
          throw new Error(`unknown matrix step action: ${step.action}`);
        }
      }
      const observed = await page.evaluate(() => ({
        dir: document.documentElement.dir || "ltr",
        lang: document.documentElement.lang || "",
        title: document.title,
        readyState: document.readyState,
      }));
      observed.load_event = loadEvent;
      await page.addScriptTag({ content: axeSource });
      const result = await page.evaluate(async (t) => {
        const r = await window.axe.run(document, {
          runOnly: { type: "tag", values: t },
        });
        return JSON.parse(
          JSON.stringify(
            r.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              help: v.help,
              nodes: v.nodes.length,
              example: v.nodes[0]?.target?.join(" ") ?? "",
            })),
          ),
        );
      }, tags);
      return {
        id: cell.id,
        path: cell.path,
        state: cell.state,
        theme: cell.theme,
        direction: cell.direction,
        observed,
        violations: result,
        ms: Date.now() - started,
      };
    } finally {
      await context.close().catch(() => {});
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

export async function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  if (!opts) return 0;
  const stage = resolve(opts.stage);
  if (!existsSync(stage)) {
    process.stderr.write(
      `check-a11y-matrix: no staged build at ${opts.stage} — run \`npm run deploy:check\` first\n`,
    );
    return 2;
  }
  if (!existsSync(join(stage, "index.html"))) {
    process.stderr.write(
      `check-a11y-matrix: ${opts.stage} has no index.html, so it is not a staged build\n`,
    );
    return 2;
  }
  if (!existsSync(opts.ledger)) {
    process.stderr.write(
      `check-a11y-matrix: no ledger at ${opts.ledger}; the declared bar lives there\n`,
    );
    return 2;
  }
  const require = createRequire(import.meta.url);
  let axeSource;
  try {
    axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
  } catch (err) {
    process.stderr.write(
      `check-a11y-matrix: axe-core and playwright are pinned devDependencies (npm ci installs them): ${err.message}\n`,
    );
    return 2;
  }

  const matrix = matrixCells(stagedTree(stage));
  const cells = opts.only
    ? matrix.cells.filter((c) => c.id === opts.only)
    : matrix.cells;
  if (!cells.length) {
    process.stderr.write(
      `check-a11y-matrix: no cell matches --only ${opts.only}\n`,
    );
    return 2;
  }
  const baseline = readA11yBaseline(readFileSync(opts.ledger, "utf8"));
  for (const note of baseline.skipped) {
    process.stderr.write(`check-a11y-matrix: ledger ${note}\n`);
  }

  return audit({
    opts,
    stage,
    matrix,
    cells,
    baseline,
    axeSource,
    tags: matrix.tags,
  });
}

async function audit({
  opts,
  matrix,
  cells,
  baseline,
  axeSource,
  chromium,
  tags,
}) {
  const srv = await serveStatic({ dir: resolve(opts.stage) });
  const out = process.stdout;
  out.write(
    `a11y matrix (plan Q-07) — ${cells.length} cells of ${matrix.cells.length}, tags ${tags.join(" ")}\n`,
  );
  out.write(
    `stage ${opts.stage} · baseline ${baseline.source || "NONE DECLARED — every cell is unmeasured"}\n`,
  );
  out.write(`${enforcementLine()}\n`);
  out.write(`${"cell".padEnd(34)}${"violations".padEnd(12)}detail\n`);

  // A browser that will not launch at all is a usage/environment failure, not a
  // cell that failed: reported once, before any cell is attempted.
  try {
    const probe = await launchChrome();
    await probe.close();
  } catch (err) {
    await srv.close();
    process.stderr.write(
      `check-a11y-matrix: could not launch the installed Chrome (${err.message.split("\n")[0]}). ` +
        "This gate drives the runner's own Chrome, not a Playwright download.\n",
    );
    return 2;
  }

  const readings = [];
  try {
    for (const cell of cells) {
      let reading;
      try {
        reading = await auditCell(srv.url, cell, axeSource, tags);
      } catch (err) {
        // A cell that could not be audited is not a clean cell. It is reported
        // as an error with zero violations recorded, so it can never be read as
        // a pass, and it fails the run until it is fixed.
        reading = {
          id: cell.id,
          path: cell.path,
          state: cell.state,
          theme: cell.theme,
          direction: cell.direction,
          observed: {},
          violations: [
            {
              id: `AUDIT ERROR: ${err.message.split("\n")[0].slice(0, 120)}`,
              impact: "error",
              help: "",
              nodes: 0,
              example: "",
            },
          ],
          ms: 0,
          error: true,
        };
      }
      readings.push(reading);
      const detail = reading.violations
        .map(
          (v) =>
            `${v.id}${v.impact ? ` (${v.impact})` : ""}${v.example ? ` @ ${v.example}` : ""}`,
        )
        .join("; ");
      out.write(
        `${cell.id.padEnd(34)}${String(reading.violations.length).padEnd(12)}${detail}${reading.error ? "" : `  (${reading.ms}ms)`}\n`,
      );
    }
  } finally {
    await srv.close();
  }

  // The unit of the bar is the violation COUNT per cell, so a cell is compared
  // on its total; the detail is what makes the count actionable.
  const measured = readings.map((r) => ({
    id: r.id,
    violations: r.violations.length,
    error: r.error,
  }));
  const { regressions, improvements, unmeasured, breaches } = compareCells(
    measured,
    baseline.cells,
  );
  const errors = readings.filter((r) => r.error);

  const report = {
    plan_item: "P0.4",
    plan_ref: "docs/plan/MASTER_PLAN.md §8 P0.4, §3.2, Q-07",
    metric: "a11y_matrix",
    stage: opts.stage,
    // When the run happened and what tree it measured. Added because the
    // committed evidence this gate writes is what the no-browser CI validator
    // (scripts/lib/quality-evidence.mjs) checks for freshness, and a report
    // that cannot say when it was produced cannot be checked for being current.
    // The committed P0.4c report carried neither field, which is exactly how a
    // superseded report stayed in the tree reading as evidence long after #162
    // had fixed the cell it claimed was broken.
    generated_at: new Date().toISOString(),
    code_sha: codeSha(),
    ledger: opts.ledger,
    baseline_ref: baseline.source,
    enforcement: ENFORCEMENT,
    tags,
    dimensions: matrix.dimensions.map((d) => ({
      name: d.name,
      values: d.values,
    })),
    not_applicable: matrix.not_applicable,
    cells: readings,
    regressions,
    improvements,
    unmeasured,
    breaches,
    audit_errors: errors.map((r) => r.id),
    ledger_notes: baseline.skipped,
  };
  // The facet line, composed from the report just built. Both fields are set
  // together or neither: a report declaring facet_axes with no line is a named
  // problem in the builder, by design — the axis gets its proof line from the
  // run that measured it, or it gets no claim at all.
  report.facet_axes = A11Y_MATRIX_FACET_AXES;
  report.facet_line = composeA11yMatrixClause(report);
  if (opts.out)
    writeFileSync(opts.out, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  out.write(`\nreport: ${opts.out || "not written (pass --out FILE)"}\n`);
  out.write(
    summaryLines({
      cells: readings.length,
      violationTypes: readings.reduce((n, r) => n + r.violations.length, 0),
      errors: errors.length,
      regressions: regressions.length,
      improvements: improvements.length,
      unmeasured: unmeasured.length,
      breaches: breaches.length,
    }),
  );
  out.write(breachSection(breaches));
  if (matrix.not_applicable.length) {
    out.write(
      `not applicable: ${matrix.not_applicable.length} combinations, recorded in the report\n`,
    );
  }

  if (errors.length) {
    process.stderr.write(
      `check-a11y-matrix: ${errors.length} cell(s) could not be audited, which is never a pass:\n${errors.map((r) => `  - ${r.id}`).join("\n")}\n`,
    );
    return 1;
  }
  if (regressions.length) {
    process.stderr.write(
      `check-a11y-matrix: ${regressions.length} cell(s) regressed against the declared bar:\n${regressions.map((r) => `  - ${r.message}`).join("\n")}\n`,
    );
    return 1;
  }
  // The clause-length backstop, same rule as the byte gate's
  // QUALITY_SIZE_CLAUSE_MAX: a clause that outgrew its half of the per-axis
  // clip would be refused (or cut) on its way to the judge, so the gate that
  // composed it fails it here, by name, where the fix is — the composer's own
  // shapes are bounded, so reaching this means a counter grew past what the
  // bound anticipated.
  if (report.facet_line.length > A11Y_MATRIX_CLAUSE_MAX) {
    process.stderr.write(
      `check-a11y-matrix: the accessibility clause is ${report.facet_line.length} chars, over its ${A11Y_MATRIX_CLAUSE_MAX}-char half of the clip: ${report.facet_line}\n`,
    );
    return 1;
  }
  out.write("no regression against the declared bar\n");
  return 0;
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  // Awaited, because the audit is async: handing exitWhenDrained a promise is
  // a TypeError that loses the exit code, which is the one thing this gate
  // exists to report.
  main().then(
    (code) => exitWhenDrained(code),
    (err) => {
      process.stderr.write(`check-a11y-matrix: ${err.stack || err.message}\n`);
      exitWhenDrained(2);
    },
  );
}

export { stagedTree, auditCell };
