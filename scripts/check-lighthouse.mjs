// Plan §8 P0.4 / Q-02: the Lighthouse gate over the staged build, mobile and
// desktop, median of three runs per page template.
//
// Usage:
//   node scripts/check-lighthouse.mjs --stage _pages_lighthouse --out report.json
//   node scripts/check-lighthouse.mjs --only home/mobile      # one target
//   node scripts/check-lighthouse.mjs --runs 1                 # a quick look
//
// WHY IT SERVES THE STAGE RATHER THAN A FILE PATH: the a11y matrix serves the
// staged build through scripts/serve-static.mjs, which applies the real
// `_headers` rules, so both gates measure the surface production serves. A
// Lighthouse reading taken against anything else is a reading of a different
// site.
//
// WHY CHROME IS LAUNCHED RATHER THAN ASSUMED: Lighthouse 13's programmatic API
// connects to a debugging port and does not start a browser. The path is
// discovered from a short candidate list so the same gate runs on a
// developer's machine and on the Linux runner, which has Chrome but not at a
// Windows path.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";
import { serveStatic } from "./serve-static.mjs";
import { start, sleep } from "./smoke/runtime.mjs";
import { measureWarmInteraction } from "./lib/warm-interaction.mjs";
import { COMPLETE_FACET_CLIP } from "./lib/jev-complete.mjs";
import {
  LIGHTHOUSE_CATEGORIES,
  LIGHTHOUSE_FACET_AXES,
  LIGHTHOUSE_RATCHET_CATEGORIES,
  LIGHTHOUSE_REPORTED_ONLY,
  LIGHTHOUSE_ABSOLUTE,
  LIGHTHOUSE_SPEED_CEILINGS,
  LIGHTHOUSE_TARGETS,
  LIGHTHOUSE_FLOORS,
  LIGHTHOUSE_FIRST_MEASUREMENT,
  LIGHTHOUSE_VARIANCE,
  compareLighthouse,
  compareSpeed,
  composeFacetLine,
  median,
} from "./lib/lighthouse-budgets.mjs";

/** The tree this report describes, so committed evidence can be matched to a
 *  commit and judged for freshness. */
function codeSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

function usage() {
  console.error(
    "usage: node scripts/check-lighthouse.mjs [--stage DIR] [--out FILE] " +
      "[--only ID] [--runs N] [--skip-warm]",
  );
  process.exit(2);
}

const argv = process.argv.slice(2);
const opts = {
  stage: "_pages_lighthouse",
  out: null,
  only: null,
  runs: null,
  skipWarm: false,
};
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--stage") opts.stage = argv[++i] ?? usage();
  else if (argv[i] === "--out") opts.out = argv[++i] ?? usage();
  else if (argv[i] === "--only") opts.only = argv[++i] ?? usage();
  else if (argv[i] === "--runs") opts.runs = Number(argv[++i]) ?? usage();
  // A local look at the Lighthouse numbers alone. Never for CI: the warm
  // measurement is the point of the facet line, and skipping it there would
  // publish a first-paint-only line as if it were the whole claim.
  else if (argv[i] === "--skip-warm") opts.skipWarm = true;
  else usage();
}

if (!existsSync(resolve(opts.stage))) usage();

// A Chrome path that is wrong on one platform is the classic way a browser gate
// passes everywhere except where it matters, so discovery is explicit and its
// result is printed. If nothing is found, Lighthouse's own discovery is left to
// try rather than this gate inventing a path.
const CHROME_CANDIDATES = [
  process.env.LIGHTHOUSE_CHROME_PATH,
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);
const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p));

const targets = opts.only
  ? LIGHTHOUSE_TARGETS.filter((t) => t.id === opts.only)
  : LIGHTHOUSE_TARGETS;
if (!targets.length) {
  console.error(`no target named ${opts.only}`);
  process.exit(2);
}

const srv = await serveStatic({ dir: resolve(opts.stage), port: 0 });
const chrome = await launch({
  ...(chromePath ? { chromePath } : {}),
  chromeFlags: [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
  ],
});

const score = (lhr, category) => {
  const s = lhr.categories[category]?.score;
  // Lighthouse reports 0..1 with one decimal; null means the category did not
  // produce a score, which must stay null so the comparator calls it a hole
  // rather than rounding a missing reading into a zero.
  return typeof s === "number" ? Math.round(s * 100) : null;
};

const measured = [];
for (const target of targets) {
  const runs = [];
  for (let i = 0; i < (opts.runs || target.runs); i++) {
    const { lhr } = await lighthouse(new URL(target.page, srv.url).href, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: LIGHTHOUSE_CATEGORIES,
      formFactor: target.formFactor,
      screenEmulation: {
        mobile: target.formFactor === "mobile",
        width: target.formFactor === "mobile" ? 390 : 1350,
        height: target.formFactor === "mobile" ? 844 : 940,
        deviceScaleFactor: target.formFactor === "mobile" ? 2.75 : 1,
        disabled: false,
      },
      throttlingMethod: "simulate",
    });
    const a = lhr.audits;
    const perRun = {};
    for (const c of LIGHTHOUSE_CATEGORIES) perRun[c] = score(lhr, c);
    runs.push({
      scores: perRun,
      lcp_s: a["largest-contentful-paint"]?.numericValue / 1000 ?? null,
      cls: a["cumulative-layout-shift"]?.numericValue ?? null,
      tbt_ms: a["total-blocking-time"]?.numericValue ?? null,
      fcp_s: a["first-contentful-paint"]?.numericValue / 1000 ?? null,
    });
  }

  // Q-02 asks for the median, so the median is what the gate reports and
  // compares. The min is carried too: it is the reading the floor was declared
  // from, and a report that hid it would hide the gate's own headroom.
  const scores = {};
  for (const c of LIGHTHOUSE_CATEGORIES) {
    const values = runs.map((r) => r.scores[c]);
    scores[c] = median(values);
  }
  measured.push({
    id: target.id,
    page: target.page,
    formFactor: target.formFactor,
    runs: runs.length,
    scores,
    runScores: runs.map((r) => r.scores),
    speed: {
      lcp_s: median(runs.map((r) => r.lcp_s)),
      cls: median(runs.map((r) => r.cls)),
      tbt_ms: median(runs.map((r) => r.tbt_ms)),
      fcp_s: median(runs.map((r) => r.fcp_s)),
    },
  });
  const s = scores;
  const sp = measured[measured.length - 1].speed;
  console.log(
    `${target.id.padEnd(20)} ` +
      LIGHTHOUSE_CATEGORIES.map(
        (c) => `${c.slice(0, 4)}=${String(s[c]).padStart(4)}`,
      ).join(" ") +
      `  lcp=${sp.lcp_s?.toFixed(2)}s cls=${sp.cls?.toFixed(3)} tbt=${Math.round(sp.tbt_ms)}ms`,
  );
}

// Chrome's temp profile is left behind on Windows if the browser still holds a
// handle; that must not decide the gate's exit code.
try {
  await chrome.kill();
} catch (e) {
  console.error(`note: chrome teardown reported ${e.code}; continuing`);
}

// ── The WARM half of the performance facet, in a real browser. ──
//
// Lighthouse is a first-paint instrument, and its composite is a simulated
// throttling number so wide (40-76 across 21 calibration runs) that no
// affordable floor reproduces it. The facet also claims the sizing interaction
// is measured and that a warm path pulls nothing redundant — and nothing
// measured either, so the facet line could only say "first paint only" and the
// judge read it as unverified. This is that measurement.
//
// A failure here is recorded and NOT fatal: the gate still reports first paint,
// the composed line falls back to saying the warm claims are unmeasured, and an
// absent measurement stays visible as an absent one rather than being invented.
let warmInteraction = null;
if (!opts.skipWarm) {
  let ctx = null;
  try {
    ctx = await start();
    await ctx.send("Page.enable");
    const loaded = new Promise((res) => {
      const prev = ctx.ws.onmessage;
      ctx.ws.onmessage = (ev) => {
        prev(ev);
        try {
          if (JSON.parse(ev.data).method === "Page.loadEventFired") {
            ctx.ws.onmessage = prev;
            res();
          }
        } catch {
          /* not a frame we care about */
        }
      };
    });
    await ctx.send("Page.navigate", { url: srv.url });
    await Promise.race([loaded, sleep(60000)]);
    await sleep(4000);
    warmInteraction = await measureWarmInteraction(ctx, { url: srv.url });
    console.log(
      `warm interaction: ${JSON.stringify(
        {
          cold_run_ms: warmInteraction.cold_run?.ms,
          warm_rerun_ms: warmInteraction.warm_rerun?.ms,
          // Both sliders of the result-stage pair, on their own paths. The
          // budget slider's numbers are reported here beside the cut
          // slider's, so neither is inferred from the other's side effect.
          cut_preview_median_ms:
            warmInteraction.warm_adjustments?.preview_median_ms,
          cut_confirm_median_ms:
            warmInteraction.warm_adjustments?.confirm_median_ms,
          budget_preview_median_ms:
            warmInteraction.warm_budget_adjustments?.preview_median_ms,
          budget_confirm_median_ms:
            warmInteraction.warm_budget_adjustments?.confirm_median_ms,
          warm_network_requests: warmInteraction.warm_network_requests,
        },
        null,
        0,
      )}`,
    );
  } catch (e) {
    warmInteraction = { ok: false, error: String(e.message || e) };
    console.error(
      `note: warm-interaction measurement failed (${e.message || e}); the ` +
        "report carries the hole and the facet line falls back to first paint",
    );
  } finally {
    await ctx?.close().catch(() => {});
  }
}
await srv.close();

const { regressions, improvements, breaches, holes, unmeasured } =
  compareLighthouse(measured, LIGHTHOUSE_FLOORS);
const speedOver = compareSpeed(measured);

const report = {
  plan_item: "P0.4",
  plan_refs: ["Q-02", "Q-03"],
  metric: "lighthouse",
  // When the run happened and which tree it measured, so the no-browser
  // validator (scripts/lib/quality-evidence.mjs) can tell a current reading from
  // a committed one that has since gone stale.
  generated_at: new Date().toISOString(),
  code_sha: codeSha(),
  // Which facet axes this report IS the evidence for, declared by the gate that
  // measured them. The judge discovers this from the report rather than holding
  // a list of gate names beside itself — the same derivation that stopped
  // ci_green reading a list of three job names while a fourth gate ran.
  facet_axes: LIGHTHOUSE_FACET_AXES,
  unit: "score 0-100, median of 3 runs, on the staged build",
  stage: opts.stage,
  lighthouse_version: "13.5.0",
  chrome: chromePath || "(lighthouse discovery)",
  throttling: "simulate (Lighthouse default mobile/desktop)",
  categories: LIGHTHOUSE_CATEGORIES,
  ratchet_categories: LIGHTHOUSE_RATCHET_CATEGORIES,
  reported_only: LIGHTHOUSE_REPORTED_ONLY,
  variance_calibration: LIGHTHOUSE_VARIANCE,
  targets,
  measured,
  warm_interaction: warmInteraction,
  first_measurement: LIGHTHOUSE_FIRST_MEASUREMENT,
  floors: LIGHTHOUSE_FLOORS,
  absolute_targets: LIGHTHOUSE_ABSOLUTE,
  speed_ceilings: LIGHTHOUSE_SPEED_CEILINGS,
  regressions,
  improvements,
  breaches,
  speed_over: speedOver,
  holes,
  unmeasured,
  enforcement:
    "regression-blocking from P0 on " +
    LIGHTHOUSE_RATCHET_CATEGORIES.join(", ") +
    "; the other categories are measured and reported but not ratcheted, for " +
    "the measured reason in `reported_only`. Absolute Q-02 thresholds become " +
    "blocking at P5 (new shell) / P8 (everything) per plan §3.2, and are " +
    "reported as breaches until then.",
  scope_limit: warmInteraction?.ok
    ? "this gate measures the first-paint claim with Lighthouse's SIMULATED " +
      "throttling, and the warm claims (cold sizing run, warm re-run, " +
      "both result-stage sliders driven on their own paths — drag preview " +
      "and confirm re-slice for the bill-cut slider and for the budget " +
      "slider — and the requests a warm path " +
      "issues) with one unthrottled Chrome on one machine, one city and three " +
      "adjustments each. It is a real reading of this machine, not a device matrix " +
      +"and not a population claim. The warm request count is whatever the " +
      "browser put on the wire: a non-zero count is a finding about the " +
      "product and is reported, never tuned away."
    : "this gate measures the first-paint claim of the performance facet only. " +
      "Warm interactions and NASA/weather memoization are not Lighthouse's " +
      "subject and are not measured here." +
      (warmInteraction
        ? " The warm measurement did not run this time, so " +
          "that limit stands in full."
        : ""),
};

// The facet line the judge will read is composed HERE, from this run, and
// travels inside the report. A hand-typed line in the evidence file was the
// defect this replaces; composing it at the measurement means the numbers on
// the judge's record and the numbers in this report cannot drift apart.
report.facet_line = composeFacetLine(report);
console.log(
  `facet line (${report.facet_line.length} chars):\n  ${report.facet_line}`,
);
// An over-long line is SILENTLY cut in transit by the evidence builder, and the
// part that gets cut is the tail — which here is the warm measurement, the whole
// reason this gate now carries a second instrument. So the gate refuses to
// publish rather than let the axis decay to a truncated prefix: a red gate with
// the line printed beats a green one whose claim quietly lost its numbers.
if (report.facet_line.length > COMPLETE_FACET_CLIP) {
  console.error(
    `\nfacet line is ${report.facet_line.length} chars, over the ` +
      `${COMPLETE_FACET_CLIP}-char per-axis clip. It would be cut on the way to ` +
      "the judge, so the `performance` axis would arrive without its warm " +
      "numbers. Shorten the clause in composeFacetLine rather than raising the " +
      "clip.\n  " +
      report.facet_line,
  );
  process.exitCode = 1;
}

if (opts.out) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(opts.out, JSON.stringify(report, null, 2) + "\n");
  console.log(`\nreport written: ${opts.out}`);
}

console.log(
  `\nlighthouse: ${measured.length} targets, ${regressions.length} regressions, ` +
    `${improvements.length} improvements, ${holes.length} holes, ` +
    `${breaches.length} Q-02 breaches (non-blocking until P5/P8), ` +
    `${speedOver.length} Q-03 speed readings over ceiling (non-blocking until P5/P8)`,
);
console.log(
  `ratcheted: ${LIGHTHOUSE_RATCHET_CATEGORIES.join(", ")} | ` +
    `reported only: ${Object.keys(LIGHTHOUSE_REPORTED_ONLY).join(", ")}`,
);
for (const [category, why] of Object.entries(LIGHTHOUSE_REPORTED_ONLY))
  console.log(`\n${category} is not ratcheted: ${why}`);

if (breaches.length) {
  console.log(
    "\nshort of the plan's absolute Q-02 bar (reported, not blocking at P0.4):",
  );
  for (const b of breaches)
    console.log(`  ${b.id}/${b.category}: ${b.score} < ${b.absolute}`);
}
if (speedOver.length) {
  console.log(
    "\nover Q-03's lab-speed ceiling (reported, not blocking at P0.4):",
  );
  for (const s of speedOver)
    console.log(
      `  ${s.id}/${s.metric}: ${typeof s.value === "number" ? Number(s.value.toFixed(3)) : s.value} > ${s.ceiling}`,
    );
}
if (unmeasured.length) {
  console.log("\nunmeasured (no floor declared):");
  for (const u of unmeasured)
    console.log(`  ${u.id}${u.category ? "/" + u.category : ""}`);
}

if (regressions.length) {
  console.log("\nREGRESSIONS against the declared floor:");
  for (const r of regressions) console.log(`  ${r.message}`);
}
if (holes.length) {
  console.log("\nHOLES — a target that did not measure is never a pass:");
  for (const h of holes) console.log(`  ${h.message}`);
}

const failed = regressions.length > 0 || holes.length > 0;
console.log(
  failed
    ? "\nno regression allowed against the declared floor, and a hole is not a pass"
    : "\nno regression against the declared floor",
);
process.exit(failed ? 1 : 0);
