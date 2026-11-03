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
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";
import { serveStatic } from "./serve-static.mjs";
import { start, sleep } from "./smoke/runtime.mjs";
import {
  measureWithPathsUnavailable,
  measureWarmReload,
  runPerformancePlaytest,
} from "./smoke/performance.mjs";
import {
  PERFORMANCE_FACET_AXES,
  PERFORMANCE_SCOPE_LIMIT,
  evaluatePerformance,
} from "./lib/performance-budgets.mjs";
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
  LIGHTHOUSE_FIRST_PAINT_BUDGETS,
  LIGHTHOUSE_FIRST_PAINT_MEASUREMENT,
  LIGHTHOUSE_VARIANCE,
  FIRST_PAINT_ENFORCEMENT,
  compareLighthouse,
  compareSpeed,
  composeFacetLine,
  facetLineOmitted,
  measureFirstPaintWeight,
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

/**
 * The staged build as data — a file list and a reader — which is the shape
 * `measureStagedBuild` takes.
 *
 * The same walk `scripts/check-byte-budgets.mjs` performs, and deliberately the
 * same SHAPE: a second way to describe a staged build is a second place for the
 * first-paint weight to be measured differently from the §3.1 gate's number.
 * Symlinks and unreadable files are skipped, which is what
 * `deploy-pages-local.mjs --check` stages out of the way in the first place.
 */
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
  return {
    files: files.sort(),
    read: (rel) => readFileSync(join(dir, rel)),
  };
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

// ── The first paint's WEIGHT, on the same staged build. ────────────────────
//
// THE CLAUSE THAT HAD NO MEASUREMENT. `performance` is three claims; this gate
// measured two of them (the playtest below) and had been standing in for the
// third with the Lighthouse composite — a score the module above documents as
// unreproducible and deliberately un-ratcheted. "Light" is a weight, and the
// repo measures weights: plan §3.1's budgets, on this very staged build, by
// scripts/check-byte-budgets.mjs. That gate declares no facet axis and writes no
// report, so none of it ever reached the judge.
//
// So it is measured here, on the artifact Lighthouse is about to be run against,
// with the same `measureStagedBuild` the §3.1 gate uses and the same plan limits
// read from `BYTE_BUDGET_LIMITS`. Measuring it costs one brotli pass over ~35
// modules and buys the facet's third clause a real number.
//
// It is measured BEFORE the browsers launch, so that a build this gate cannot
// read is a named failure rather than an absence discovered after six minutes of
// Lighthouse. An unreadable staged build is a HOLE and a hole fails: a gate that
// can go green by not measuring something is the same gate under a new name.
const firstPaintWeight = measureFirstPaintWeight(stagedTree(opts.stage));
for (const h of firstPaintWeight.holes)
  console.error(
    `  first paint  HOLE ${h.what}: ${h.why}. "The first paint stays light" is ` +
      "one of this facet's three claims; a claim nobody measured is not a claim " +
      "that passed.",
  );
if (firstPaintWeight.over.length) {
  console.log(
    `  first paint  ${firstPaintWeight.over.length} over the plan §3.1 line ` +
      `(${FIRST_PAINT_ENFORCEMENT}):`,
  );
  for (const o of firstPaintWeight.over) console.log(`    ${o.message}`);
}
console.log(
  `  first paint  js before interactive: ` +
    `${firstPaintWeight.budgets?.js_before_interactive?.value ?? "unmeasured"} B ` +
    `vs §3.1 ${LIGHTHOUSE_FIRST_PAINT_BUDGETS.js_before_interactive.limit} B, ` +
    `across ${firstPaintWeight.modules ?? "?"} modules on the critical path`,
);

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
const playtestRegressions = [];
const playtestHoles = [];
let axisOwnershipConflict = false;
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
    // THE PLAYTEST, in the order the claims are actually independent. The cold
    // run first because it is the slow interaction and it is the stage that
    // populates every cache the later stages claim not to re-read. The warm
    // reload second because it is the warm path that survives a page load, and
    // the pricing model comes LAST because that stage blocks a URL on every
    // session: run it after the stages that need a working build, never before.
    const play = await runPerformancePlaytest(ctx, { url: srv.url });
    if (play?.ok) {
      play.warm_reload = await measureWarmReload(ctx, { url: srv.url });
      play.paths_unavailable = await measureWithPathsUnavailable(ctx, {
        url: srv.url,
      });
    }
    warmInteraction = play;
    const verdict = evaluatePerformance(warmInteraction);
    for (const n of verdict.notes) console.log(`  playtest  ${n}`);
    // A HOLE and a REGRESSION both stop this gate, and that is a change worth
    // naming. It used to be non-fatal, on the reasoning that a browser hiccup
    // should not fail a Lighthouse run. But this gate OWNS the performance axis,
    // and its facet line says the interaction claims are measured. A run that
    // could not measure them and exited green would publish a first-paint line
    // with a green gate beside it — which is precisely how this facet spent a
    // whole cycle reading as verified while nothing but a byte count was ever
    // checked. So: measured-and-wrong fails, and not-measured fails harder.
    for (const h of verdict.holes) {
      console.error(`  playtest  HOLE ${h.what}: ${h.why}`);
      playtestHoles.push(h);
    }
    for (const r of verdict.regressions) {
      console.error(`  playtest  REGRESSION ${r.message}`);
      playtestRegressions.push(r);
    }
    console.log(
      `warm interaction: ${JSON.stringify(
        {
          cold_run_ms: warmInteraction?.cold_run?.ms,
          warm_rerun_ms: warmInteraction?.warm_rerun?.ms,
          preview_median_ms:
            warmInteraction?.warm_adjustments?.preview_median_ms,
          confirm_median_ms:
            warmInteraction?.warm_adjustments?.confirm_median_ms,
          warm_network: warmInteraction?.warm_network,
          warm_reload_ms: warmInteraction?.warm_reload?.ms,
          warm_reload_nasa: warmInteraction?.warm_reload?.warm_network?.nasa,
          paths_blocked_attempts:
            warmInteraction?.paths_unavailable?.blocked_attempts,
          paths_blocked_card: warmInteraction?.paths_unavailable?.card_rendered,
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
  // The axis is declared by two modules now — the Lighthouse side and the
  // playtest side — and the evidence builder OVERWRITES prose.facet_evidence by
  // axis, so a second gate declaring `performance` would not add a second proof
  // line, it would silently delete the first. Asserted here rather than assumed:
  // a disagreement between the two declarations is a build-time fact about which
  // owner is wrong, and the report says which.
  playtest_facet_axes: PERFORMANCE_FACET_AXES,
  playtest_regressions: playtestRegressions,
  playtest_holes: playtestHoles,
  // The first paint's WEIGHT, measured on the same staged artifact, plus the
  // budgets it was measured against and the phase at which a breach starts
  // blocking. Carried whole — every budget, not only the over ones — so a
  // comfortable reading is on the record beside the uncomfortable one, which is
  // what stops `js_before_interactive` being the only number anyone looks at.
  first_paint_weight: firstPaintWeight,
  first_paint_budgets: LIGHTHOUSE_FIRST_PAINT_BUDGETS,
  first_paint_measurement: LIGHTHOUSE_FIRST_PAINT_MEASUREMENT,
  first_paint_enforcement: FIRST_PAINT_ENFORCEMENT,
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
    ? "this gate measures the first-paint claim in TWO forms — the staged " +
      "build's brotli WEIGHT against plan §3.1's budgets, and Lighthouse's " +
      "LCP/FCP/CLS/TBT TIMING under SIMULATED throttling — and the interaction " +
      "claims (cold sizing run, warm re-run, slider drag preview, confirm " +
      "re-slice, the requests a warm path issues, the requests a warm RELOAD " +
      "issues after the page's RAM is gone, and whether the first result " +
      "renders with the pricing model blocked) with one unthrottled Chrome on " +
      `one machine, one city and three adjustments. ${PERFORMANCE_SCOPE_LIMIT}. ` +
      "Every count is whatever the browser put on the wire, worker sessions " +
      "included: a non-zero count is a finding about the product and is " +
      "reported, never tuned away."
    : "this gate measures the first-paint claim of the performance facet — its " +
      "staged brotli weight against plan §3.1, and its Lighthouse timings — " +
      "but nothing else. Interactions, memoization across a reload, and " +
      "first-result independence are not Lighthouse's subject and were not " +
      "measured this run." +
      (warmInteraction
        ? " The playtest did not complete, so that limit stands in full."
        : ""),
};

// The facet line the judge will read is composed HERE, from this run, and
// travels inside the report. A hand-typed line in the evidence file was the
// defect this replaces; composing it at the measurement means the numbers on
// the judge's record and the numbers in this report cannot drift apart.
report.facet_line = composeFacetLine(report);
// What the fit to the transport's clip had to leave off, named rather than
// assumed. The composer degrades the least load-bearing sentence in place and
// records the swap; the gate prints it, because a sentence that quietly did not
// make the judge's line while the run reports green is the defect the clip
// itself creates.
report.facet_line_omitted = facetLineOmitted.slice();
if (facetLineOmitted.length) {
  for (const o of facetLineOmitted)
    console.warn(
      `note: the ${COMPLETE_FACET_CLIP}-char axis clip dropped` +
        (o.replaced_with
          ? ` detail (${o.sentence} -> ${o.replaced_with})`
          : ` "${o.sentence}"`) +
        "; it is in this report in full",
    );
}
console.log(
  `facet line (${report.facet_line.length} chars):\n  ${report.facet_line}`,
);

// The axis's two declarations must agree, and the reason is written into the
// report rather than left to a reader: the evidence builder overwrites a prose
// proof line by axis, so two owners of `performance` means one of them vanishes
// without a word.
if (
  JSON.stringify(report.facet_axes) !==
  JSON.stringify(report.playtest_facet_axes)
) {
  console.error(
    `\nFACET AXIS OWNERSHIP DISAGREES: the Lighthouse side declares ` +
      `[${report.facet_axes.join(", ")}] and the playtest side ` +
      `[${report.playtest_facet_axes.join(", ")}]. Two gates owning one axis ` +
      "means the evidence builder overwrites one of them silently.",
  );
  axisOwnershipConflict = true;
}
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
  `first paint weight: ${firstPaintWeight.over.length} over the plan §3.1 line, ` +
    `${firstPaintWeight.holes.length} hole(s) — ${FIRST_PAINT_ENFORCEMENT}`,
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

const failed =
  regressions.length > 0 ||
  holes.length > 0 ||
  playtestRegressions.length > 0 ||
  playtestHoles.length > 0 ||
  // An UNREADABLE staged build is not a warning. This gate owns the
  // `performance` axis and the axis line now states a first-paint weight; if the
  // run could not measure it, the line says so and the gate is red, so a missing
  // artifact can never again read as a facet whose first paint was fine.
  firstPaintWeight.holes.length > 0 ||
  axisOwnershipConflict;
if (playtestRegressions.length || playtestHoles.length)
  console.log(
    `\nPLAYTEST: ${playtestRegressions.length} regression(s), ` +
      `${playtestHoles.length} hole(s). Both stop this gate: the axis line ` +
      "says the interaction claims are measured, so a run that could not " +
      "measure them, or measured them wrong, cannot exit green beside it.",
  );
console.log(
  failed
    ? "\nno regression allowed against the declared floor, and a hole is not a pass"
    : "\nno regression against the declared floor",
);
process.exit(failed ? 1 : 0);
