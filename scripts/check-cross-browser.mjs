#!/usr/bin/env node
// Plan §8 P0.4 / Q-08: cross-browser smoke over the staged build.
//
//   node scripts/check-cross-browser.mjs [--stage DIR] [--out FILE]
//                                  [--engines a,b] [--widths 320,390]
//
// Q-08 verbatim: "Chromium, Firefox and WebKit at 320 / 390 / 768 / 1440 px
// widths. 0 console errors, 0 CSP violations."
//
// Unlike the a11y matrix, this gate DOES need the Playwright downloads: Firefox
// and WebKit are the entire point of the cluster, and there is no system build
// of either that Playwright can drive. `npm run gate:cross-browser` assumes
// `npx playwright install chromium firefox webkit` has been run. This gate runs
// LOCALLY (mission decision of 2026-09-27): CI has no browsers.
//
// Exit codes:
//   0  every engine x width x template cell is inside the bar
//   1  a cell is over the bar, or a cell could not be run at all
//   2  usage error, no staged build, or an engine that will not launch
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  crossBrowserCells,
  tallyCell,
  verdict,
  CROSS_BROWSER_BAR,
} from "./lib/cross-browser.mjs";
import { jevFetchStubSource } from "./smoke/actions.mjs";
import { serveStatic } from "./serve-static.mjs";
import { exitWhenDrained } from "./lib/graceful-exit.mjs";

const USAGE =
  "usage: node scripts/check-cross-browser.mjs [--stage DIR] [--out FILE] [--engines a,b] [--widths 320,390]";
const FLAGS = {
  "--stage": "stage",
  "--out": "out",
  "--engines": "engines",
  "--widths": "widths",
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
    stage: "_pages_crossbrowser",
    out: null,
    engines: null,
    widths: null,
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
        `check-cross-browser: unknown argument ${arg}\n${USAGE}\n`,
      );
      process.exit(2);
    }
    const value = argv[++i];
    if (value === undefined || value.startsWith("--")) {
      process.stderr.write(
        `check-cross-browser: ${arg} requires a value\n${USAGE}\n`,
      );
      process.exit(2);
    }
    opts[key] = value;
  }
  return opts;
}

function codeSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

// Captures console errors, uncaught exceptions and CSP violations for one cell.
//
// A page that holds a request open never fires `load` — the heatmap page holds
// a grid fetch open — so the load is taken as it stands after a bounded wait
// rather than waited on, exactly as the a11y matrix does. Which cells did that
// is recorded, because "we audited it before it finished loading" and "we
// audited a finished page" are different claims.
async function runCell(browser, base, cell, { deadlineMs = 60000 } = {}) {
  return Promise.race([
    runCellInner(browser, base, cell),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`cell exceeded its ${deadlineMs}ms budget`)),
        deadlineMs,
      ).unref(),
    ),
  ]);
}

async function runCellInner(browser, base, cell) {
  const context = await browser.newContext({
    viewport: { width: cell.width, height: 900 },
  });
  try {
    await context.addInitScript(jevFetchStubSource());
    const errors = [];
    context.on("weberror", (e) =>
      errors.push(`pageerror: ${e.error()?.message ?? ""}`),
    );
    const page = await context.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
    });
    page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
    let loadEvent = true;
    try {
      await page.goto(`${base}/${cell.path}`, {
        waitUntil: "load",
        timeout: 30000,
      });
    } catch (err) {
      loadEvent = !/Timeout/i.test(err.message);
      if (!loadEvent) errors.length = errors.length; // recorded below, not an error
    }
    // A short settle so late async failures (fetch rejections, CSP refusals on
    // a lazily imported module) are in scope. Bounded and small: the point is to
    // catch what arrives just after load, not to wait for the page to idle.
    await page.waitForTimeout(1500);
    const tally = tallyCell(errors);
    const title = await page.title().catch(() => "");
    return { ...tally, load_event: loadEvent, title, ms: 0 };
  } finally {
    await context.close().catch(() => {});
  }
}

export async function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  if (!opts) return 0;
  const stage = resolve(opts.stage);
  if (!existsSync(join(stage, "index.html"))) {
    process.stderr.write(
      `check-cross-browser: no staged build at ${opts.stage} — run \`npm run deploy:check\` first\n`,
    );
    return 2;
  }
  const require = createRequire(import.meta.url);
  let pw;
  try {
    pw = require("playwright");
  } catch (err) {
    process.stderr.write(
      `check-cross-browser: playwright is a pinned devDependency (npm ci installs it): ${err.message}\n`,
    );
    return 2;
  }

  const matrix = crossBrowserCells(stagedTree(stage));
  if (opts.engines) {
    const want = new Set(opts.engines.split(",").map((s) => s.trim()));
    matrix.engines = matrix.engines.filter((e) => want.has(e));
  }
  if (opts.widths) {
    const want = new Set(opts.widths.split(",").map((s) => Number(s.trim())));
    matrix.widths = matrix.widths.filter((w) => want.has(w));
  }
  const cells = matrix.cells.filter(
    (c) => matrix.engines.includes(c.engine) && matrix.widths.includes(c.width),
  );

  const srv = await serveStatic({ dir: stage });
  const out = process.stdout;
  out.write(
    `cross-browser (plan Q-08) — ${cells.length} cells: ${matrix.engines.join(", ")} x ${matrix.widths.join(", ")} x ${matrix.templates.length} templates\n`,
  );
  out.write(
    `bar: 0 console errors, 0 CSP violations (absolute, not a ratchet)\n\n`,
  );

  // An engine that will not launch is an environment failure reported once,
  // before any cell is attempted, rather than 16 identical cell errors.
  const browsers = {};
  try {
    for (const engine of matrix.engines) {
      try {
        browsers[engine] = await pw[engine].launch();
        out.write(`launched ${engine} ${browsers[engine].version()}\n`);
      } catch (err) {
        await srv.close();
        process.stderr.write(
          `check-cross-browser: could not launch ${engine}: ${err.message.split("\n")[0]}\n` +
            `  This gate needs the Playwright downloads: \`npx playwright install chromium firefox webkit\`\n`,
        );
        return 2;
      }
    }

    const readings = [];
    for (const cell of cells) {
      const started = Date.now();
      let reading;
      try {
        const r = await runCell(browsers[cell.engine], srv.url, cell);
        reading = { ...r, ms: Date.now() - started, error: false };
      } catch (err) {
        reading = {
          console_errors: 0,
          csp_violations: 0,
          detail: [
            {
              kind: "console_error",
              text: `CELL ERROR: ${err.message.split("\n")[0].slice(0, 160)}`,
            },
          ],
          ms: Date.now() - started,
          error: true,
        };
      }
      readings.push({ ...cell, ...reading });
      const flag = reading.error
        ? "ERROR"
        : reading.console_errors || reading.csp_violations
          ? "FINDING"
          : "ok";
      out.write(
        `${cell.id.padEnd(34)}${flag.padEnd(10)}console=${reading.console_errors} csp=${reading.csp_violations}${reading.load_event === false ? "  (load event did not fire; page taken as it stands)" : ""}  (${reading.ms}ms)\n`,
      );
      for (const d of reading.detail.slice(0, 3)) {
        out.write(`${" ".padEnd(34)}  ${d.kind}: ${d.text}\n`);
      }
    }
    out.write("\n");

    const v = verdict(readings);
    const report = {
      plan_item: "P0.4",
      plan_ref: "docs/plan/MASTER_PLAN.md §8 P0.4, Q-08",
      metric: "cross_browser",
      stage: opts.stage,
      generated_at: new Date().toISOString(),
      code_sha: codeSha(),
      enforcement:
        "absolute from P0 (plan Q-08): 0 console errors, 0 CSP violations on every engine x width x template",
      engines: matrix.engines,
      widths: matrix.widths,
      browser_versions: Object.fromEntries(
        Object.entries(browsers).map(([k, b]) => [k, b.version()]),
      ),
      bar: CROSS_BROWSER_BAR,
      cells: readings,
      console_errors: v.totals.console_errors,
      csp_violations: v.totals.csp_violations,
      errored_cells: v.totals.errored,
      failures: v.failures.map((f) => ({
        id: f.id,
        path: f.path,
        engine: f.engine,
        width: f.width,
      })),
      regressions: v.failures.map((f) => ({
        id: f.id,
        console_errors: f.console_errors,
        csp_violations: f.csp_violations,
        error: !!f.error,
      })),
      breaches: [],
      unmeasured: [],
    };
    if (opts.out) {
      writeFileSync(opts.out, JSON.stringify(report, null, 2) + "\n");
      out.write(`wrote ${opts.out}\n`);
    }
    if (v.ok) {
      out.write(
        `CROSS-BROWSER OK: ${readings.length} cells, 0 console errors, 0 CSP violations across ${matrix.engines.join(", ")}\n`,
      );
      return 0;
    }
    process.stderr.write(
      `CROSS-BROWSER FAILED: ${v.failures.length} of ${readings.length} cells over the bar (totals: ${v.totals.console_errors} console errors, ${v.totals.csp_violations} CSP violations, ${v.totals.errored} cells unrunnable)\n`,
    );
    for (const f of v.failures) out.write(`  - ${f.id}\n`);
    return 1;
  } finally {
    for (const b of Object.values(browsers)) await b.close().catch(() => {});
    await srv.close();
  }
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  // Awaited, because the run is async: handing exitWhenDrained a promise is a
  // TypeError that loses the exit code, which is the one thing this gate
  // exists to report. A file:// string comparison is also not enough on
  // Windows, where process.argv[1] is a drive path and never matches.
  main().then(
    (code) => exitWhenDrained(code),
    (err) => {
      process.stderr.write(
        `check-cross-browser: ${err.stack || err.message}\n`,
      );
      exitWhenDrained(2);
    },
  );
}
