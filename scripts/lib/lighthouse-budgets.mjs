// Plan §8 P0.4 / Q-02 + Q-03: the Lighthouse gate — which page templates are
// measured, on what, and the bar each reading is held to.
//
// WHAT THIS GATE IS, PRECISELY, because the scope matters more than the number.
// The `performance` facet the plan wants moved is three claims, verbatim from
// the pack: "warm same-location interactions are instant, no redundant network
// re-pulls (weather/NASA memoized), and the first paint stays light."
//
//   · "the first paint stays light"  — THIS IS THE GATE'S SUBJECT. LCP, FCP,
//     Speed Index, CLS and TBT on a cold-cache load under a simulated network
//     are exactly that claim's measurement.
//   · "warm same-location interactions are instant" — NOT MEASURED. Lighthouse
//     audits one page load and never performs a second interaction. Q-03 names
//     Playwright event timing for that: a different instrument, a later cluster.
//   · "no redundant re-pulls (weather/NASA memoized)" — NOT MEASURED, and not
//     measurable here. It is a claim about what does NOT happen across repeated
//     calls to one location; a single load has no re-pull to observe, so
//     memoization is invisible to Lighthouse by construction.
//
// So a green run covers ONE of the facet's three claims. That is worth having
// and is not the same as proving the facet. No reading here should be described
// as though it were.
//
// §3.2 puts this gate at "Blocks on regression from P0 / Blocks on absolute
// threshold from P5 for templates in the new shell; P8 for everything", so at
// P0.4 the bar is where the build already is and Q-02's own numbers
// (Performance >= 99, the rest = 100) are reported on every run as `breaches` —
// visible and named, not yet blocking, exactly as `compareCells` reports the
// a11y cap. They are already in the report waiting to become the gate at P5/P8.
//
// WHY ONLY THREE OF THE FOUR CATEGORIES ARE RATCHETED. This is the one place
// where the measured data overruled the obvious design, so the reasoning is
// here in full rather than in a comment above a constant.
//
// The obvious design is "ratchet all four categories at the observed minimum".
// It does not work, and the measurement says so plainly. On an UNCHANGED tree
// — `git status` over every template and `assets/` empty — Lighthouse's
// `performance` score is bimodal across repeated runs:
//
//   home/mobile,    21 runs: 61 x6, then 69 x6, 70 x4, 71 x3, 72, 73
//   heatmap/desktop, 21 runs: 40, 53, 57, 61, 62, 64 x4, 65 x2, 66, 72 x3,
//                            73 x2, 74, 75 x2, 76          (a 36-point range)
//
// The other three categories read 100/100/100 (or a fixed 63) on every single
// run — bit-identical, zero variance. So the instability is entirely in the
// `performance` composite, which is dominated by Lighthouse's SIMULATED
// throttling model rather than by anything the page did; heatmap TBT alone was
// measured ranging 192-355 ms across runs.
//
// A floor set at the median would flake, and a floor set at the observed
// minimum would be so wide that a real multi-point regression would still pass
// under it. Raising the run count was measured as the fix and does not work
// either: bootstrapping the median from the 21 observed runs, the median's
// width is 12 points at k=3 and still 10 at k=21 on home/mobile, and 36 at k=3
// still 18 at k=21 on heatmap/desktop. Because the tails are always in the
// pool, no affordable k makes the median reproducible.
//
// So `performance` is MEASURED, REPORTED and carries its measured spread on the
// record — and is deliberately not a ratchet. The three deterministic
// categories are ratcheted at their observed minimum and have real teeth: they
// would catch a contrast regression, a missing meta description, a console error
// that starts firing, or an unsized image. This is a narrower gate than
// "ratchet everything", stated rather than disguised, and the numbers that make
// it necessary are in LIGHTHOUSE_VARIANCE below so the next person can check
// them rather than take this comment's word.
import { readFileSync } from "node:fs";
import { COMPLETE_FACET_CLIP } from "./jev-complete.mjs";
import { playtestClause } from "./performance-budgets.mjs";

/**
 * The facet axes this gate IS the evidence for. Declared here, beside the
 * measurement, and read by the gate that writes the report and by the tests that
 * assert no axis is left unaccounted for — one source, so the report cannot claim
 * an axis the rest of the repo believes is typed, or vice versa.
 */
export const LIGHTHOUSE_FACET_AXES = ["performance"];

/** The four categories Q-02 names, in its order. */ export const LIGHTHOUSE_CATEGORIES =
  ["performance", "accessibility", "best-practices", "seo"];

/**
 * The three categories this gate ratchets. Chosen by measurement, not taste:
 * each read an identical value on every run of every calibration sample
 * (see LIGHTHOUSE_VARIANCE), so a floor on them is reproducible.
 */
export const LIGHTHOUSE_RATCHET_CATEGORIES = [
  "accessibility",
  "best-practices",
  "seo",
];

/**
 * The categories measured but NOT ratcheted, and why. Kept as data so the gate's
 * own report carries the reason instead of leaving it in a source comment.
 */
export const LIGHTHOUSE_REPORTED_ONLY = {
  performance:
    "measured and reported, not ratcheted: on an unchanged tree the score is " +
    "bimodal over 21 runs (home/mobile 61-73, heatmap/desktop 40-76) because " +
    "Lighthouse's performance composite is dominated by its SIMULATED " +
    "throttling model. The bootstrapped median is still 18 points wide at " +
    "k=21, so no affordable run count makes a floor reproducible and a floor " +
    "that wide would not catch a real regression. The reading is reported with " +
    "its spread so the trend is visible.",
};

/** Q-02, verbatim. Reported as a non-blocking breach at P0.4 (§3.2). */
export const LIGHTHOUSE_ABSOLUTE = {
  performance: 99,
  accessibility: 100,
  "best-practices": 100,
  seo: 100,
};

/**
 * Q-03's lab-speed ceilings. Measured and reported, not enforced at P0.4 for the
 * same §3.2 reason. `tbt_ms` and `cls` are ceilings because less is better.
 */
export const LIGHTHOUSE_SPEED_CEILINGS = {
  lcp_s: { mobile: 1.8, desktop: 1.0 },
  cls: 0.02,
  tbt_ms: 100,
};

/** How far below an observed minimum a floor may be set. */
export const LIGHTHOUSE_FLOOR_SLACK = 1;

/** Every page template, both form factors, median of 3 runs (Q-02). */
export const LIGHTHOUSE_TARGETS = [
  { id: "home/mobile", page: "index.html", formFactor: "mobile", runs: 3 },
  { id: "home/desktop", page: "index.html", formFactor: "desktop", runs: 3 },
  {
    id: "city/mobile",
    page: "solar-calculator/phoenix/index.html",
    formFactor: "mobile",
    runs: 3,
  },
  {
    id: "city/desktop",
    page: "solar-calculator/phoenix/index.html",
    formFactor: "desktop",
    runs: 3,
  },
  {
    id: "heatmap/mobile",
    page: "solar-heatmap/index.html",
    formFactor: "mobile",
    runs: 3,
  },
  {
    id: "heatmap/desktop",
    page: "solar-heatmap/index.html",
    formFactor: "desktop",
    runs: 3,
  },
  {
    id: "about/mobile",
    page: "about/index.html",
    formFactor: "mobile",
    runs: 3,
  },
  {
    id: "about/desktop",
    page: "about/index.html",
    formFactor: "desktop",
    runs: 3,
  },
  {
    id: "blog-index/mobile",
    page: "blog/index.html",
    formFactor: "mobile",
    runs: 3,
  },
  {
    id: "blog-index/desktop",
    page: "blog/index.html",
    formFactor: "desktop",
    runs: 3,
  },
  {
    id: "blog-post/mobile",
    page: "blog/battery-longevity-and-dod-reference/index.html",
    formFactor: "mobile",
    runs: 3,
  },
  {
    id: "blog-post/desktop",
    page: "blog/battery-longevity-and-dod-reference/index.html",
    formFactor: "desktop",
    runs: 3,
  },
  { id: "404/mobile", page: "404.html", formFactor: "mobile", runs: 3 },
  { id: "404/desktop", page: "404.html", formFactor: "desktop", runs: 3 },
];

/**
 * The first measurement, recorded verbatim: min / median / max of 3 runs per
 * target per category, on the staged `_pages_a11y` build at 0472a0a with
 * Lighthouse 13.5.0, Chrome headless, `throttlingMethod: "simulate"`, mobile
 * 390x844 / desktop 1350x940.
 *
 * Kept separate from LIGHTHOUSE_FLOORS on purpose. If the floor were computed
 * from this table there would be nothing to check the computation against, and a
 * floor raised above a minimum here is exactly the move this file exists to make
 * impossible.
 */
export const LIGHTHOUSE_FIRST_MEASUREMENT = {
  "home/mobile": {
    performance: { min: 61, median: 64, max: 73 },
    accessibility: { min: 100, median: 100, max: 100 },
    "best-practices": { min: 100, median: 100, max: 100 },
    seo: { min: 100, median: 100, max: 100 },
  },
  "home/desktop": {
    performance: { min: 56, median: 56, max: 56 },
    accessibility: { min: 100, median: 100, max: 100 },
    "best-practices": { min: 100, median: 100, max: 100 },
    seo: { min: 100, median: 100, max: 100 },
  },
  "city/mobile": {
    performance: { min: 100, median: 100, max: 100 },
    accessibility: { min: 100, median: 100, max: 100 },
    "best-practices": { min: 100, median: 100, max: 100 },
    seo: { min: 100, median: 100, max: 100 },
  },
  "city/desktop": {
    performance: { min: 96, median: 97, max: 97 },
    accessibility: { min: 100, median: 100, max: 100 },
    "best-practices": { min: 100, median: 100, max: 100 },
    seo: { min: 100, median: 100, max: 100 },
  },
  "heatmap/mobile": {
    performance: { min: 87, median: 91, max: 91 },
    accessibility: { min: 100, median: 100, max: 100 },
    "best-practices": { min: 96, median: 96, max: 96 },
    seo: { min: 100, median: 100, max: 100 },
  },
  "heatmap/desktop": {
    performance: { min: 73, median: 75, max: 76 },
    accessibility: { min: 100, median: 100, max: 100 },
    "best-practices": { min: 100, median: 100, max: 100 },
    seo: { min: 100, median: 100, max: 100 },
  },
  "about/mobile": {
    performance: { min: 100, median: 100, max: 100 },
    accessibility: { min: 100, median: 100, max: 100 },
    "best-practices": { min: 100, median: 100, max: 100 },
    seo: { min: 100, median: 100, max: 100 },
  },
  "about/desktop": {
    performance: { min: 97, median: 97, max: 97 },
    accessibility: { min: 100, median: 100, max: 100 },
    "best-practices": { min: 100, median: 100, max: 100 },
    seo: { min: 100, median: 100, max: 100 },
  },
  "blog-index/mobile": {
    performance: { min: 99, median: 100, max: 100 },
    accessibility: { min: 100, median: 100, max: 100 },
    "best-practices": { min: 100, median: 100, max: 100 },
    seo: { min: 100, median: 100, max: 100 },
  },
  "blog-index/desktop": {
    performance: { min: 96, median: 97, max: 97 },
    accessibility: { min: 100, median: 100, max: 100 },
    "best-practices": { min: 100, median: 100, max: 100 },
    seo: { min: 100, median: 100, max: 100 },
  },
  "blog-post/mobile": {
    performance: { min: 96, median: 96, max: 100 },
    accessibility: { min: 100, median: 100, max: 100 },
    "best-practices": { min: 100, median: 100, max: 100 },
    seo: { min: 100, median: 100, max: 100 },
  },
  "blog-post/desktop": {
    performance: { min: 93, median: 93, max: 94 },
    accessibility: { min: 100, median: 100, max: 100 },
    "best-practices": { min: 100, median: 100, max: 100 },
    seo: { min: 100, median: 100, max: 100 },
  },
  "404/mobile": {
    performance: { min: 100, median: 100, max: 100 },
    accessibility: { min: 100, median: 100, max: 100 },
    "best-practices": { min: 96, median: 100, max: 100 },
    seo: { min: 63, median: 63, max: 63 },
  },
  "404/desktop": {
    performance: { min: 99, median: 100, max: 100 },
    accessibility: { min: 100, median: 100, max: 100 },
    "best-practices": { min: 100, median: 100, max: 100 },
    seo: { min: 63, median: 63, max: 63 },
  },
};

/**
 * The variance calibration, so the claim "performance is not reproducible" is a
 * number a reviewer can check rather than a sentence they have to trust. Every
 * sample below is the same tree: `git status` over `assets/` and every template
 * directory was empty throughout.
 */
export const LIGHTHOUSE_VARIANCE = {
  method:
    "repeated Lighthouse runs of the same staged build with no change between " +
    "them, then a 20000-trial bootstrap of the median-of-k over the observed runs",
  performance_not_ratcheted: {
    "home/mobile": {
      n: 21,
      runs: [
        61, 61, 61, 61, 61, 61, 69, 69, 69, 69, 69, 69, 70, 70, 70, 70, 71, 71,
        71, 72, 73,
      ],
      min: 61,
      median: 69,
      max: 73,
      shape: "bimodal: six runs at 61, then nothing below 69",
      median_width_by_k: { 3: 12, 9: 12, 15: 10, 21: 10 },
    },
    "heatmap/desktop": {
      n: 21,
      runs: [
        40, 53, 57, 61, 62, 64, 64, 64, 64, 65, 65, 66, 72, 72, 72, 73, 73, 74,
        75, 75, 76,
      ],
      min: 40,
      median: 65,
      max: 76,
      shape:
        "bimodal: a 40-66 cluster and a 72-76 cluster with nothing between",
      median_width_by_k: { 3: 36, 9: 23, 15: 18, 21: 18 },
    },
  },
  ratcheted_categories_are_deterministic: {
    note:
      "over the same samples, accessibility / best-practices / seo read an " +
      "identical value on every run, which is what makes a floor on them " +
      "reproducible",
    "home/mobile": "accessibility, best-practices, seo all 100 on 21/21 runs",
    "heatmap/desktop":
      "accessibility, best-practices, seo all 100 on 21/21 runs",
  },
  best_practices_targeted_checks: {
    note:
      "two targets read 96 on best-practices in the 3-run first measurement, so " +
      "each was re-measured over 9 runs before a floor was declared on it",
    "heatmap/mobile": {
      n: 9,
      runs: [96, 96, 96, 96, 96, 96, 96, 96, 96],
      distinct: [96],
      failing_audit: "image-size-responsive",
      reading:
        "stable at 96. The floor is 96 and the failing audit is named: an image " +
        "is served larger than it is displayed. That is a finding for the page's " +
        "own cluster, not a threshold this gate may move.",
    },
    "404/mobile": {
      n: 9,
      runs: [96, 100, 100, 100, 100, 100, 100, 100, 100],
      distinct: [96, 100],
      failing_audit: "errors-in-console",
      reading:
        "NOT stable: 96 once, 100 eight times, from a console error that fires " +
        "intermittently. The floor is 96 — the observed minimum — because a " +
        "console error that starts firing on every load is a real regression this " +
        "gate should catch.",
    },
    "heatmap/desktop": {
      n: 9,
      runs: [100, 100, 100, 100, 100, 100, 100, 100, 100],
      distinct: [100],
      reading: "stable at 100",
    },
  },
};

/**
 * The ratchet bar: the observed minimum of the first measurement, for the three
 * deterministic categories only. Every value is traceable to one number in
 * LIGHTHOUSE_FIRST_MEASUREMENT, and `performance` is absent by measurement, not
 * by oversight — see LIGHTHOUSE_REPORTED_ONLY.
 *
 * These floors are high (mostly 100) because the three deterministic categories
 * really are at 100 nearly everywhere, and the gate is meant to keep them there.
 * The two exceptions are findings, not thresholds this gate may move: heatmap
 * best-practices 96 (`image-size-responsive`) and 404 seo 63 (the page is
 * `noindex` by design while Q-02 wants 100).
 */
export const LIGHTHOUSE_FLOORS = {
  "home/mobile": { accessibility: 100, "best-practices": 100, seo: 100 },
  "home/desktop": { accessibility: 100, "best-practices": 100, seo: 100 },
  "city/mobile": { accessibility: 100, "best-practices": 100, seo: 100 },
  "city/desktop": { accessibility: 100, "best-practices": 100, seo: 100 },
  "heatmap/mobile": { accessibility: 100, "best-practices": 96, seo: 100 },
  "heatmap/desktop": { accessibility: 100, "best-practices": 100, seo: 100 },
  "about/mobile": { accessibility: 100, "best-practices": 100, seo: 100 },
  "about/desktop": { accessibility: 100, "best-practices": 100, seo: 100 },
  "blog-index/mobile": { accessibility: 100, "best-practices": 100, seo: 100 },
  "blog-index/desktop": { accessibility: 100, "best-practices": 100, seo: 100 },
  "blog-post/mobile": { accessibility: 100, "best-practices": 100, seo: 100 },
  "blog-post/desktop": { accessibility: 100, "best-practices": 100, seo: 100 },
  "404/mobile": { accessibility: 100, "best-practices": 96, seo: 63 },
  "404/desktop": { accessibility: 100, "best-practices": 100, seo: 63 },
};

/**
 * The WARM / PLAYTEST clause, delegated to scripts/lib/performance-budgets.mjs.
 *
 * It used to be built here and it now is not, for one reason: the readings it
 * formats stopped being the ones this gate took. This module's own clause knew
 * about a cold run, a warm re-run and a drag preview; the playtest also measures
 * what a warm RELOAD pulls after the page's memory is gone, and whether the first
 * result renders with the pricing model blocked. Formatting the richer shape
 * from the older module would have been formatting a claim the run never made.
 *
 * The composition itself lives with the budgets, so the numbers a line can print
 * and the numbers a gate can fail on are derived in one place and cannot drift
 * apart — which is the same reason the byte budget and the byte measurement were
 * separated in the first place.
 *
 * The absence is the load-bearing half. When there is no playtest the clause is
 * null, the line ends "first-paint claim only, not warm interactions or
 * memoization", and the judge reads the facet as unverified — which is the
 * honest reading of a first-paint-only measurement. The fix for that is a
 * measurement, not a better sentence, so no wording change can make a green
 * first-paint run read as a proven facet.
 */
function warmClause(warm) {
  return playtestClause(warm);
}

/**
 * Compose the `performance` facet line the judge reads, from THIS run's report.
 *
 * The gate owns this rather than the transport that carries it, for two reasons
 * that are the whole point of the change. First, the honesty rules live next to
 * the measurement instead of next to the plumbing. Second, the line has to fit
 * `COMPLETE_FACET_CLIP` (280 characters) and a line that overflows is SILENTLY
 * clipped on its way to the judge — which for this facet means the honest tail
 * ("not ratcheted, do not read it as a fact") is exactly what gets cut.
 *
 * What goes on the line, and what deliberately does not:
 *
 *   · The playtest clause, FIRST. It is the part that was missing, and a
 *     280-char clip is finite: the least load-bearing sentence must not be the
 *     one that gets cut.
 *   · The three ratcheted categories, as facts. They read an identical value on
 *     every run on every machine measured, so their range across the 14 targets
 *     is a real measurement and belongs on the record.
 *   · The performance score WITH its spread, and the words "not ratcheted". A
 *     bare median here would be the same falsehood as the hand-typed byte proxy
 *     this line replaced, only pointing the other way: it would make a bimodal
 *     40-76 reading look like a stable 66.
 *   · The calibration envelope, which is wider than any 3-run sample could
 *     reveal, so the record cannot imply the run's own range is the truth.
 */

export function composeFacetLine(report) {
  const measured = Array.isArray(report?.measured) ? report.measured : [];
  const range = (category) => {
    const values = measured
      .map((m) => m?.scores?.[category])
      .filter((v) => typeof v === "number");
    if (!values.length) return null;
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    return lo === hi ? `${lo}` : `${lo}-${hi}`;
  };

  const ratcheted = (
    report?.ratchet_categories || LIGHTHOUSE_RATCHET_CATEGORIES
  )
    .map((c) => {
      const r = range(c);
      return r ? `${c} ${r}` : null;
    })
    .filter(Boolean);
  const perf = range("performance");

  // The calibration envelope, from the recorded 21-run samples. This is the
  // wider truth than the run's own three runs can show, and stating it is what
  // stops "57-100 this run" from reading as "57-100 is the score".
  const cal = Object.values(
    LIGHTHOUSE_VARIANCE.performance_not_ratcheted || {},
  ).filter((s) => typeof s?.min === "number" && typeof s?.max === "number");
  const envelope = cal.length
    ? `${Math.min(...cal.map((s) => s.min))}-${Math.max(...cal.map((s) => s.max))}`
    : null;
  const calN = cal.length ? Math.max(...cal.map((s) => s.n)) : 0;

  const sentences = [];
  const warm = warmClause(
    report?.warm_interaction?.ok ? report.warm_interaction : null,
  );
  if (warm) sentences.push(warm);

  const perfClause = ["perf NOT ratcheted"];
  if (perf) perfClause.push(`${perf} this run`);
  if (envelope) perfClause.push(`${envelope} over ${calN} runs`);
  if (report?.regressions?.length) perfClause.push("see regressions above");

  // ORDER IS PRIORITY, and the order is the argument.
  //
  // The playtest measurement comes first because it is the claim the facet was
  // held for. "perf NOT ratcheted" comes before the per-category list because it
  // is the sentence that tells a reader how to read the number printed next to
  // it: lose that one and a bimodal 40-76 reading arrives looking like a fact.
  // The per-category ratcheted list is last because it is genuinely the most
  // redundant thing on the line — all three of those categories are written out
  // in full in the report, and on the line they are a summary.
  sentences.push(
    `Lighthouse, ${measured.length} target${measured.length === 1 ? "" : "s"}, median of 3`,
  );
  if (perf || envelope) sentences.push(perfClause.join(", "));
  if (ratcheted.length) sentences.push(`ratcheted ${ratcheted.join(", ")}`);
  if (report?.regressions?.length)
    sentences.push(`${report.regressions.length} REGRESSIONS`);
  if (report?.holes?.length) sentences.push(`${report.holes.length} HOLES`);

  // With no playtest this is the whole honest limit. With one, the playtest
  // clause above has already stated its own narrower limit, and repeating the
  // first-paint disclaimer beside a real interaction reading would read as
  // though the interaction reading were also unmeasured.
  if (!warm)
    sentences.push(
      "first-paint claim only, not warm interactions or memoization",
    );
  return fitFacetLine(sentences, { ratcheted: ratcheted.length });
}

/**
 * Fit the sentences to the transport's per-axis clip, in the priority order they
 * were pushed, WITHOUT quietly losing one.
 *
 * The clip is COMPLETE_FACET_CLIP (280) and the transport cuts the tail. A naive
 * composer therefore does the worst possible thing: it puts the load-bearing
 * sentence last and lets the cut take it. This one puts it first, and then
 * degrades the least load-bearing sentence — the per-category ratcheted list,
 * which is fully written out in the report anyway — into a short form that says
 * on its face that it is a summary.
 *
 * If even the short form does not fit, the sentence is DROPPED, not truncated,
 * and `facetLineOmitted` records that it happened so the gate can print it. A
 * sentence silently missing from the judge's line while the run reports green is
 * the exact defect this file was written to end.
 *
 * Returns the line. The caller compares against COMPLETE_FACET_CLIP and refuses
 * to publish if the HIGH-priority sentences did not fit, because at that point
 * the measurement itself is too long for the transport and the fix is a shorter
 * clause, not a smaller claim.
 */
function fitFacetLine(sentences, meta = {}) {
  const SHORTENABLE = /^ratcheted /;
  const kept = [];
  const dropped = [];
  for (const sentence of sentences) {
    const candidate = [...kept, sentence].join(". ") + ".";
    if (candidate.length <= COMPLETE_FACET_CLIP) {
      kept.push(sentence);
      continue;
    }
    // It did not fit whole. Try the one documented short form.
    if (SHORTENABLE.test(sentence) && meta.ratcheted) {
      const short = `${meta.ratcheted} categories ratcheted (in report)`;
      const withShort = [...kept, short].join(". ") + ".";
      if (withShort.length <= COMPLETE_FACET_CLIP) {
        kept.push(short);
        dropped.push({ sentence, replaced_with: short });
        continue;
      }
    }
    dropped.push({ sentence });
  }
  facetLineOmitted.push(...dropped);
  return kept.join(". ") + ".";
}

/**
 * What the last fit had to leave off, so the gate can print it and the report
 * can carry it. Module-level because composeFacetLine is a pure function the
 * tests call directly; the gate reads and clears it around its own call.
 */
export const facetLineOmitted = [];

/** The median of a numeric list. Odd counts get the middle value. */
export function median(values) {
  const s = values.filter((v) => typeof v === "number").sort((a, b) => a - b);
  if (!s.length) return null;
  return s[Math.floor(s.length / 2)];
}

/**
 * Compare measured medians against the floors.
 *
 * Four outcomes, and the fourth is the one that bit the a11y matrix:
 *
 *   regressions  — a RATCHETED category below its floor. Blocking, with both
 *                  numbers in the message, because "failed" without "100 -> 96"
 *                  makes the reader re-run the gate to learn how far it moved.
 *   improvements — a ratcheted category above its floor. Reported, so the report
 *                  says which way the number went and not merely that it passed.
 *   breaches     — short of Q-02's absolute bar. NOT blocking at P0.4 (§3.2), and
 *                  deliberately kept out of `regressions`: these are the checks
 *                  P5 and P8 make blocking, and folding them into a blocking
 *                  list today would either fail a build over a threshold the plan
 *                  has not switched on, or train everyone to ignore the list.
 *   holes        — a target or category that produced no number. Never a pass.
 *                  This is the exact failure that held `quality-lab` red through
 *                  P0.4(a-c) on the heatmap cell, and a gate that can go green
 *                  by not measuring something is the same gate with a new name.
 *
 * `performance` is compared only for `breaches`: it is reported and never
 * ratcheted, so a low reading there is information and not a failure.
 */
export function compareLighthouse(measured, floors = LIGHTHOUSE_FLOORS) {
  const regressions = [];
  const improvements = [];
  const breaches = [];
  const holes = [];
  const unmeasured = [];

  // A run that measured NOTHING is the hole this whole function exists to catch,
  // and the empty-array case is the one that reads most like a pass. Every loop
  // below iterates over `measured`, so an empty array produced five empty lists
  // and the gate's `failed` came out false: a browser that refused to launch, a
  // target list that resolved to nothing, or a run interrupted before the first
  // audit would all have exited GREEN, and composeFacetLine would still have
  // printed a well-formed line about a measurement that never happened.
  //
  // Found by tests/gate-self-audit.test.mjs, which feeds this function an empty
  // set precisely because it is the input a green gate is most likely to receive
  // by accident.
  if (!Array.isArray(measured) || measured.length === 0) {
    holes.push({
      id: "*",
      category: "*",
      message:
        "no Lighthouse target was measured at all. An empty measurement set " +
        "produces no regression and no hole by construction, so it would read " +
        "as a clean run; it is the one input this function must refuse rather " +
        "than pass.",
    });
    return { regressions, improvements, breaches, holes, unmeasured };
  }

  for (const entry of measured) {
    const bar = floors[entry.id];
    if (!bar) {
      unmeasured.push({ id: entry.id });
      continue;
    }
    for (const category of LIGHTHOUSE_CATEGORIES) {
      const score = entry.scores?.[category];
      if (typeof score !== "number") {
        holes.push({
          id: entry.id,
          category,
          message:
            `${entry.id}/${category}: no score. A target that did not measure ` +
            "is a hole, never a pass.",
        });
        continue;
      }
      const ratcheted = LIGHTHOUSE_RATCHET_CATEGORIES.includes(category);
      const floor = bar[category];

      if (ratcheted && typeof floor === "number") {
        if (score < floor) {
          regressions.push({
            id: entry.id,
            category,
            from: floor,
            to: score,
            message: `${entry.id}/${category}: ${floor} -> ${score} against the declared floor`,
          });
        } else if (score > floor) {
          improvements.push({
            id: entry.id,
            category,
            from: floor,
            to: score,
            message: `${entry.id}/${category}: ${floor} -> ${score}`,
          });
        }
      } else if (ratcheted) {
        unmeasured.push({ id: entry.id, category });
      }

      const absolute = LIGHTHOUSE_ABSOLUTE[category];
      if (typeof absolute === "number" && score < absolute) {
        breaches.push({
          id: entry.id,
          category,
          score,
          absolute,
          blocking_from: "P5 (new shell) / P8 (everything), plan §3.2",
        });
      }
    }
  }
  return { regressions, improvements, breaches, holes, unmeasured };
}

/**
 * Q-03's lab-speed ceilings against the measured medians. Reported, not
 * blocking, for the same §3.2 reason the score breaches are not.
 */
export function compareSpeed(measured) {
  const over = [];
  for (const entry of measured) {
    const s = entry.speed;
    if (!s) continue;
    const lcpCeiling = LIGHTHOUSE_SPEED_CEILINGS.lcp_s[entry.formFactor];
    if (
      typeof s.lcp_s === "number" &&
      typeof lcpCeiling === "number" &&
      s.lcp_s > lcpCeiling
    )
      over.push({
        id: entry.id,
        metric: "lcp_s",
        value: s.lcp_s,
        ceiling: lcpCeiling,
      });
    if (typeof s.cls === "number" && s.cls > LIGHTHOUSE_SPEED_CEILINGS.cls)
      over.push({
        id: entry.id,
        metric: "cls",
        value: s.cls,
        ceiling: LIGHTHOUSE_SPEED_CEILINGS.cls,
      });
    if (
      typeof s.tbt_ms === "number" &&
      s.tbt_ms > LIGHTHOUSE_SPEED_CEILINGS.tbt_ms
    )
      over.push({
        id: entry.id,
        metric: "tbt_ms",
        value: s.tbt_ms,
        ceiling: LIGHTHOUSE_SPEED_CEILINGS.tbt_ms,
      });
  }
  return over;
}
