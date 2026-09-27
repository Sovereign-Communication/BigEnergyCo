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
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";
import { serveStatic } from "./serve-static.mjs";
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

function usage() {
  console.error(
    "usage: node scripts/check-lighthouse.mjs [--stage DIR] [--out FILE] " +
      "[--only ID] [--runs N]",
  );
  process.exit(2);
}

const argv = process.argv.slice(2);
const opts = { stage: "_pages_lighthouse", out: null, only: null, runs: null };
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--stage") opts.stage = argv[++i] ?? usage();
  else if (argv[i] === "--out") opts.out = argv[++i] ?? usage();
  else if (argv[i] === "--only") opts.only = argv[++i] ?? usage();
  else if (argv[i] === "--runs") opts.runs = Number(argv[++i]) ?? usage();
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
await srv.close();

const { regressions, improvements, breaches, holes, unmeasured } =
  compareLighthouse(measured, LIGHTHOUSE_FLOORS);
const speedOver = compareSpeed(measured);

const report = {
  plan_item: "P0.4",
  plan_refs: ["Q-02", "Q-03"],
  metric: "lighthouse",
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
  scope_limit:
    "this gate measures the first-paint claim of the performance facet only. " +
    "Warm interactions and NASA/weather memoization are not Lighthouse's " +
    "subject and are not measured here.",
};

// The facet line the judge will read is composed HERE, from this run, and
// travels inside the report. A hand-typed line in the evidence file was the
// defect this replaces; composing it at the measurement means the numbers on
// the judge's record and the numbers in this report cannot drift apart.
report.facet_line = composeFacetLine(report);
console.log(
  `facet line (${report.facet_line.length} chars):\n  ${report.facet_line}`,
);

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
