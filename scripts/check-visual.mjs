#!/usr/bin/env node
// Plan §8 P0.4 / Q-09: visual-regression scaffolding over the staged build.
//
//   node scripts/check-visual.mjs [--stage DIR] [--baseline DIR] [--out FILE]
//                             [--update-baseline] [--only CELL]
//
// WHAT THIS IS. The scaffolding P0.4 asks for: a declared snapshot matrix
// (template x width x theme x direction), a capture, a pixel comparator, and a
// COMMITTED baseline to compare against. Q-09's "0 unapproved visual diffs" is
// the bar that scaffolding measures against, and it binds from the second run
// on — the first run has nothing to differ from. The reasoning is at the top of
// scripts/lib/visual-budgets.mjs and is not repeated here.
//
// WHY THERE IS NO PIXEL-DIFF DEPENDENCY. This repo keeps zero runtime
// dependencies and pins its devDependencies exactly; adding pngjs + pixelmatch
// to compare two images would be a new supply-chain surface for a hundred lines
// of work. Instead the browser that just took the screenshot is the image
// engine: both PNGs are handed to a page as data URLs, drawn to a canvas, and
// compared through getImageData. The comparison runs in the same Chromium that
// produced the pixels, so it cannot disagree with them about colour, and the
// repo gains no new dependency for it.
//
// WHY ONE ENGINE. A cross-engine visual diff compares three font rasterisers
// and reports their differences as if they were the product's. Q-08 covers the
// engines; Q-09 covers pixel stability on one. Declared as SNAPSHOT_ENGINE.
//
// Exit codes:
//   0  no snapshot differs by more than 0.1% of its pixels
//   1  a snapshot is over the threshold
//   2  usage error, no staged build, or Chromium would not launch
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  visualCells,
  classifySnapshot,
  visualVerdict,
  isMeasuredUnstable,
  MEASURED_UNSTABLE_TEMPLATES,
  PIXEL_THRESHOLD,
  SNAPSHOT_ENGINE,
  WIDTHS,
} from "./lib/visual-budgets.mjs";
import { jevFetchStubSource } from "./smoke/actions.mjs";
import { serveStatic } from "./serve-static.mjs";
import { exitWhenDrained } from "./lib/graceful-exit.mjs";

const USAGE =
  "usage: node scripts/check-visual.mjs [--stage DIR] [--baseline DIR] [--out FILE] [--update-baseline] [--only CELL]";
const FLAGS = {
  "--stage": "stage",
  "--baseline": "baseline",
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
    stage: "_pages_visual",
    baseline: join(".quality-evidence", "visual-baseline"),
    out: null,
    only: null,
    update: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      process.stdout.write(`${USAGE}\n`);
      return null;
    }
    if (arg === "--update-baseline") {
      opts.update = true;
      continue;
    }
    const key = FLAGS[arg];
    if (!key) {
      process.stderr.write(`check-visual: unknown argument ${arg}\n${USAGE}\n`);
      process.exit(2);
    }
    const value = argv[++i];
    if (value === undefined || value.startsWith("--")) {
      process.stderr.write(`check-visual: ${arg} requires a value\n${USAGE}\n`);
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

// Counts differing pixels between two PNG buffers, in the browser.
//
// A size mismatch returns -1 rather than 0: a layout that changed the page
// height is a diff of a kind that has no pixel count, and reporting it as zero
// differences would let the single largest possible visual change read as the
// smallest one.
async function pixelDiff(page, bufA, bufB) {
  const [a, b] = [bufA.toString("base64"), bufB.toString("base64")];
  return page.evaluate(
    async ([da, db]) => {
      const load = (d) =>
        new Promise((res, rej) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = () =>
            rej(new Error("snapshot could not be decoded as PNG"));
          i.src = `data:image/png;base64,${d}`;
        });
      const [ia, ib] = await Promise.all([load(da), load(db)]);
      const total = ia.width * ia.height;
      if (ia.width !== ib.width || ia.height !== ib.height) {
        return { mismatch: true, diff: -1, total };
      }
      const c = document.createElement("canvas");
      c.width = ia.width;
      c.height = ia.height;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(ia, 0, 0);
      const pa = g.getImageData(0, 0, c.width, c.height).data;
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(ib, 0, 0);
      const pb = g.getImageData(0, 0, c.width, c.height).data;
      let diff = 0;
      for (let i = 0; i < pa.length; i += 4) {
        if (
          pa[i] !== pb[i] ||
          pa[i + 1] !== pb[i + 1] ||
          pa[i + 2] !== pb[i + 2] ||
          pa[i + 3] !== pb[i + 3]
        ) {
          diff += 1;
        }
      }
      return { mismatch: false, diff, total };
    },
    [a, b],
  );
}

async function capture(browser, base, cell) {
  const context = await browser.newContext({
    viewport: { width: cell.width, height: 900 },
  });
  try {
    await context.addInitScript(jevFetchStubSource());
    if (cell.direction === "rtl") {
      // `ar` is the RTL locale, set through the product's own mechanism
      // (shared/i18n.js reads beco-lang), exactly as the a11y matrix does it.
      await context.addInitScript(
        `try { localStorage.setItem("beco-lang", "ar"); } catch (e) {}`,
      );
    }
    const page = await context.newPage();
    try {
      await page.goto(`${base}/${cell.path}`, {
        waitUntil: "load",
        timeout: 30000,
      });
    } catch {
      // A page that holds a request open never fires `load` (the heatmap holds a
      // grid fetch open). Taken as it stands, and recorded, rather than waited on.
    }
    await page.waitForTimeout(1200);
    const buf = await page.screenshot({ fullPage: true });
    return buf;
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
      `check-visual: no staged build at ${opts.stage} — run \`npm run deploy:check\` first\n`,
    );
    return 2;
  }
  const require = createRequire(import.meta.url);
  let pw;
  try {
    pw = require("playwright");
  } catch (err) {
    process.stderr.write(
      `check-visual: playwright is a pinned devDependency: ${err.message}\n`,
    );
    return 2;
  }

  const matrix = visualCells(stagedTree(stage));
  const cells = opts.only
    ? matrix.cells.filter((c) => c.id === opts.only)
    : matrix.cells;
  if (!cells.length) {
    process.stderr.write(`check-visual: no cell matches --only ${opts.only}\n`);
    return 2;
  }

  mkdirSync(opts.baseline, { recursive: true });
  const srv = await serveStatic({ dir: stage });
  const out = process.stdout;
  out.write(
    `visual (plan Q-09) — ${cells.length} of ${matrix.cells.length} snapshots, engine ${SNAPSHOT_ENGINE}, threshold ${(PIXEL_THRESHOLD * 100).toFixed(2)}% of pixels\n`,
  );
  out.write(`baseline ${opts.baseline}\n\n`);
  out.write(`${"cell".padEnd(30)}${"status".padEnd(10)}detail\n`);

  let browser;
  let diffPage;
  try {
    browser = await pw[SNAPSHOT_ENGINE].launch();
    const diffContext = await browser.newContext();
    diffPage = await diffContext.newPage();
  } catch (err) {
    await srv.close();
    process.stderr.write(
      `check-visual: could not launch ${SNAPSHOT_ENGINE}: ${err.message.split("\n")[0]}\n` +
        "  This gate needs the Playwright download: `npx playwright install chromium`\n",
    );
    return 2;
  }

  const readings = [];
  try {
    for (const cell of cells) {
      const started = Date.now();
      let buf;
      let error = null;
      try {
        buf = await capture(browser, srv.url, cell);
      } catch (err) {
        error = err.message.split("\n")[0].slice(0, 160);
      }
      if (error) {
        readings.push({ ...cell, status: "error", ratio: null, error });
        out.write(`${cell.id.padEnd(30)}${"ERROR".padEnd(10)}${error}\n`);
        continue;
      }
      const basePath = join(
        opts.baseline,
        `${cell.id.replace(/[\\/]/g, "__")}.png`,
      );
      const exists = existsSync(basePath);
      const unstable = isMeasuredUnstable(cell.template);
      let status = "new";
      let ratio = null;
      let detail = "recorded, no baseline to differ from yet";
      if (exists) {
        const r = await pixelDiff(diffPage, readFileSync(basePath), buf);
        if (unstable) {
          // Measured, not gated. The diff is still measured and printed — the
          // point is that it is not a pass/fail, because on this page the
          // reading does not describe the product.
          const v = classifySnapshot({
            diff: r.diff,
            total: r.total,
            baseline_exists: true,
            unstable: true,
          });
          status = v.status;
          ratio = v.ratio;
          detail = r.mismatch
            ? "snapshot size varies run to run (external Leaflet load)"
            : `${r.diff}/${r.total} px = ${(v.ratio * 100).toFixed(4)}% — MEASURED, not gated: ${cell.template} is declared unreproducible`;
        } else if (r.mismatch) {
          status = "diff";
          ratio = 1;
          detail = "snapshot SIZE changed — the page's own dimensions moved";
        } else {
          const v = classifySnapshot({
            diff: r.diff,
            total: r.total,
            baseline_exists: true,
          });
          status = v.status;
          ratio = v.ratio;
          detail = `${r.diff}/${r.total} px = ${(v.ratio * 100).toFixed(4)}%`;
        }
      }
      if (opts.update || !exists) {
        writeFileSync(basePath, buf);
        if (opts.update) detail = `${detail} (baseline updated)`;
      }
      // The baseline's OWN digest, so the committed report identifies the exact
      // pixels this reading was compared against. The PNGs themselves stay out
      // of git: the plan asks P0.4 for committed REPORTS plus the baseline row,
      // and 28 full-page PNGs is 14 MB of binary that would be rewritten by every
      // baseline update. The digest means a reviewer with a local baseline can
      // confirm it is the same one, and `npm run gate:visual -- --update-baseline`
      // regenerates it.
      const baselineSha = exists
        ? createHash("sha256").update(readFileSync(basePath)).digest("hex")
        : null;
      readings.push({
        ...cell,
        status,
        ratio,
        detail,
        gated: !unstable,
        baseline_sha256: baselineSha,
      });
      out.write(
        `${cell.id.padEnd(30)}${status.padEnd(10)}${detail}  (${Date.now() - started}ms)\n`,
      );
    }
  } finally {
    await browser.close().catch(() => {});
    await srv.close();
  }

  const errors = readings.filter((r) => r.status === "error");
  const v = visualVerdict(readings.filter((r) => r.status !== "error"));
  const report = {
    plan_item: "P0.4",
    plan_ref: "docs/plan/MASTER_PLAN.md §8 P0.4, Q-09",
    metric: "visual",
    stage: opts.stage,
    generated_at: new Date().toISOString(),
    code_sha: codeSha(),
    enforcement:
      "absolute from P0 for diffs above the threshold (plan Q-09: > 0.1% of pixels); the FIRST run has no baseline to differ from, so every cell reads 'new' and the bar binds from the second run",
    engine: SNAPSHOT_ENGINE,
    engine_version: null,
    threshold: PIXEL_THRESHOLD,
    widths: WIDTHS,
    dimensions: [
      { name: "template", values: matrix.templates.map((t) => t.id) },
      { name: "width", values: WIDTHS },
      { name: "theme", values: matrix.themes.map((t) => t.id) },
      { name: "direction", values: matrix.directions },
    ],
    not_applicable: matrix.not_applicable,
    cells: readings,
    new_snapshots: v.new_snapshots,
    unstable_snapshots: v.unstable_snapshots,
    unapproved_diffs: v.unapproved_diffs + errors.length,
    errored_cells: errors.length,
    worst_diffs: v.worst,
    regressions: readings
      .filter((r) => r.status === "diff" || r.status === "error")
      .map((r) => ({ id: r.id, status: r.status, ratio: r.ratio })),
    breaches: [],
    unmeasured: [
      ...(v.new_snapshots
        ? [
            {
              note: `${v.new_snapshots} snapshot(s) recorded with no baseline to differ from; the 0.1% bar applies from the next run`,
            },
          ]
        : []),
      ...(v.unstable_snapshots
        ? [
            {
              note: `${v.unstable_snapshots} snapshot(s) measured but NOT gated: ${MEASURED_UNSTABLE_TEMPLATES.map((u) => u.template).join(", ")} — see measured_unstable in this report for the run numbers and the cause`,
            },
          ]
        : []),
      ...(errors.length
        ? [
            {
              note: `${errors.length} cell(s) could not be captured: ${errors.map((e) => e.id).join(", ")}`,
            },
          ]
        : []),
    ],
    measured_unstable: MEASURED_UNSTABLE_TEMPLATES.map((u) => ({
      ...u,
      excluded_cells: matrix.cells
        .filter((c) => c.template === u.template)
        .map((c) => c.id),
    })),
  };
  if (opts.out) {
    writeFileSync(opts.out, JSON.stringify(report, null, 2) + "\n");
    out.write(`\nwrote ${opts.out}\n`);
  }

  if (v.ok && errors.length === 0) {
    out.write(
      `\nVISUAL OK: ${readings.length} snapshots, ${v.new_snapshots} new, ${v.unstable_snapshots} measured-not-gated, ${v.unapproved_diffs} unapproved diffs (> ${(PIXEL_THRESHOLD * 100).toFixed(2)}%)\n`,
    );
    return 0;
  }
  process.stderr.write(
    `\nVISUAL FAILED: ${v.unapproved_diffs} unapproved diff(s), ${errors.length} cell(s) unrunnable\n`,
  );
  for (const f of readings.filter(
    (r) => r.status === "diff" || r.status === "error",
  )) {
    out.write(`  - ${f.id}  ${f.detail ?? f.error}\n`);
  }
  return 1;
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().then(
    (code) => exitWhenDrained(code),
    (err) => {
      process.stderr.write(`check-visual: ${err.stack || err.message}\n`);
      exitWhenDrained(2);
    },
  );
}
