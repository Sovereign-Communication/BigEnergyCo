// Regression tests: the budget slider must reach what the cut slider asks
// for, the recommendation must track the sliders in real time, and a binding
// roof-area cap must be diagnosed honestly instead of reading as "not
// practical here".
//
// Root-cause chain fixed here (and what each section pins):
//   1. The price-cut curve's outcome tops out at 100% (bill gone), so systems
//      sized ABOVE 100% (surplus + sell) never appear as curve points.
//   2. The budget slider derived its span from curve points + marker only,
//      so at a >100% cut target it clamped to the cheapest 100% system —
//      "no additional budget" no matter how far the visitor dragged.
//   3. The surplus system itself wasn't in the walkable pool, so it could
//      not even be selected.
//   4. When a cut re-size found nothing solvable, the UI kept the previous
//      target's recommendation on screen (stale best pick).
//   5. A binding envelope (roof-area cap) produced bare "not practical here"
//      cells with no hint that the visitor's own input caused it — the Keaau,
//      Hawaii report: 25.5 m² → ~1.6 kW of panels against a 71.9 kWh/day load.
//
// Sections 2–4 test BEHAVIOR through the real engine (runSizing with an
// injected weather fixture, hermetic and network-free), not source patterns:
// source-pattern assertions are kept only for UI wiring that node cannot
// execute (DOM code) and for cache-key hygiene guards.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  surplusAnchor,
  budgetSpanMax,
} from "../assets/js/sizing/budget-span.js";
import { runSizing } from "../assets/js/sizing/run.js";
import { synthesizeFromProfile } from "../assets/js/sizing/nasa.js";
import {
  OFFLINE_PROFILES,
  PROFILE_YEAR,
} from "../assets/js/sizing/profiles.js";
import { paretoFront } from "../assets/js/sizing/frontier.js";

const hon = OFFLINE_PROFILES.find((p) => p.name.includes("Honolulu"));
const fakeWeather = async () => ({
  hours: synthesizeFromProfile(hon),
  meta: {
    latitude: 21.31,
    longitude: -157.86,
    startYear: PROFILE_YEAR,
    endYear: PROFILE_YEAR,
    years: 1,
    source: "test fixture",
    offline: false,
  },
});

const MSG = {
  latitude: 21.31,
  longitude: -157.86,
  dailyKwh: 20,
  tariff: 0.42,
  exportRate: 0.15,
  years: 1,
  mode: "gridtie",
  chemistry: "auto",
  customCut: 0.8,
  autoTargetId: "cut80",
};

// A mid-capex curve system, used to sanity-check that the anchor actually
// EXTENDS the span rather than merely matching an existing point.
function curveMaxCapex(p) {
  const xs = ((p.frontier && p.frontier.points) || [])
    .map((q) => q.capexUsd)
    .filter(Number.isFinite);
  return xs.length ? Math.max(...xs) : 0;
}

// ── 1. Pure span/anchor contract ────────────────────────────────────────────

test("surplusAnchor: null at or below a 100% target", () => {
  assert.equal(
    surplusAnchor({ customCut: { fraction: 1, best: { solvable: true } } }),
    null,
  );
  assert.equal(surplusAnchor(null), null);
  assert.equal(surplusAnchor({ customCut: null }), null);
  assert.equal(
    surplusAnchor({ customCut: { fraction: 1.5, best: null } }),
    null,
    "a surplus target that solved nothing has no anchor",
  );
});

test("surplusAnchor: surfaces the sized surplus system with target %", () => {
  const p = {
    customCut: {
      fraction: 1.5,
      best: {
        solvable: true,
        pvKw: 9.2,
        battKwh: 0,
        chemistry: "lfp",
        chemLabel: "LFP (LiFePO4)",
        costLo: 3000,
        costHi: 4000,
        cutPct: 100,
      },
    },
  };
  const a = surplusAnchor(p);
  assert.ok(a, "anchor exists for a 150% target");
  assert.equal(a.pvKw, 9.2);
  assert.equal(a.outcomePct, 150, "honest display % is the target itself");
  assert.equal(a.capexUsd, 3500, "mid of lo/hi when no costMid");
});

test("budgetSpanMax: extends with the anchor, floor stays the curve's", () => {
  const pts = [{ capexUsd: 5000 }, { capexUsd: 12000 }];
  assert.equal(budgetSpanMax(pts, 9000, null), 12000);
  assert.equal(
    budgetSpanMax(pts, 9000, { capexUsd: 18500 }),
    18500,
    "surplus anchor lifts the ceiling",
  );
  assert.equal(budgetSpanMax([], NaN, { capexUsd: 7000 }), 7000);
  assert.equal(budgetSpanMax(null, null, null), 0);
});

test("paretoFront: a >100% outcome point is never dropped as dominated", () => {
  // A higher-cost system achieving 130% (surplus) must survive the front.
  const pts = [
    { capexUsd: 5000, outcome: 30 },
    { capexUsd: 8000, outcome: 60 },
    { capexUsd: 14000, outcome: 100 },
    { capexUsd: 20000, outcome: 130 },
  ];
  const front = paretoFront(pts);
  assert.ok(
    front.some((p) => p.outcome > 100),
    "the 130% point must not be dropped",
  );
});

test("paretoFront: the 100%-cap regime collapses the top to the cheapest 100% system", () => {
  // Without an export credit the import fraction caps at 100%, so every
  // pricier system is Pareto-dominated and the curve's top — and with it the
  // budget slider's old ceiling — becomes the CHEAPEST 100% system. This is
  // the regime that made the two sliders fight; documented here so the
  // surplus anchor's reason to exist survives refactors.
  const pts = [
    { capexUsd: 5000, outcome: 100 },
    { capexUsd: 8000, outcome: 100 },
    { capexUsd: 20000, outcome: 100 },
  ];
  const front = paretoFront(pts);
  assert.equal(front.length, 1, "only the cheapest 100% system survives");
  assert.equal(front[0].capexUsd, 5000);
});

// ── 2. End-to-end coupling through the real engine ─────────────────────────
// The visitor-facing contract: drag the cut slider to 150% → the budget
// slider's ceiling moves past the curve's 100% top, and the anchor describes
// the actual sized surplus system. Testing through runSizing (not source
// patterns) is what makes this a real regression net.

test("full run at a >100% target yields an anchor that extends the budget span", async () => {
  // exportRate: null — the hard regime, where the curve itself caps at 100%.
  const p = await runSizing(
    { ...MSG, customCut: 1.4, exportRate: null },
    { fetchWeather: fakeWeather },
  );
  assert.ok(p.customCut, "customCut block present");
  assert.equal(p.customCut.fraction, 1.4);
  const best = p.customCut.best;
  assert.ok(best && best.solvable, "a 140% surplus target solves at this site");

  const anchor = surplusAnchor(p);
  assert.ok(anchor, "the payload must yield a surplus anchor");
  assert.equal(anchor.pvKw, best.pvKw, "anchor IS the sized system");
  assert.equal(anchor.outcomePct, 140);
  assert.ok(anchor.capexUsd > 0, "anchor carries a usable cost");
  assert.ok(
    Number.isFinite(best.costLo) && Number.isFinite(best.costHi)
      ? anchor.capexUsd === (best.costLo + best.costHi) / 2
      : anchor.capexUsd === best.costMid,
    "anchor cost derives from the best entry's cost fields",
  );

  // THE regression, in the regime that produced it: the curve tops out at
  // the cheapest 100% system, the surplus system costs MORE, and the budget
  // ceiling must follow the anchor — without it, the surplus system the cut
  // slider just sized is unreachable at any budget position.
  const curveTop = curveMaxCapex(p);
  assert.ok(curveTop > 0, "the payload has a priced curve");
  const without = budgetSpanMax(p.frontier.points, null, null);
  const lifted = budgetSpanMax(p.frontier.points, null, anchor);
  assert.equal(without, curveTop, "the curve alone still caps at its own top");
  assert.equal(
    lifted,
    Math.max(curveTop, anchor.capexUsd),
    "the ceiling is the span including the anchor",
  );
  assert.ok(
    lifted > without,
    `anchor (${anchor.capexUsd}) must lift the ceiling past the curve top (${curveTop})`,
  );
});

test("re-slice to a surplus target keeps the budget span lifted (slider continuity)", async () => {
  // Start at a 100% target: anchor must be null there.
  const p0 = await runSizing(
    { ...MSG, customCut: 1, exportRate: null },
    { fetchWeather: fakeWeather },
  );
  assert.equal(
    surplusAnchor(p0),
    null,
    "no anchor at a 100% target — the span is the curve's own",
  );
  const curveTop = curveMaxCapex(p0);
  assert.ok(curveTop > 0);

  // The slider path: an INCREMENTAL patch, exactly what postSlice sends.
  const patch = await runSizing(
    { ...MSG, customCut: 1.4, exportRate: null, incrementalCut: true },
    { fetchWeather: fakeWeather },
  );
  assert.ok(patch.customCut, "auto-chem patches always carry the custom block");
  assert.equal(patch.customCut.fraction, 1.4);
  assert.ok(
    patch.customCut.best && patch.customCut.best.solvable,
    "the re-slice sizes a surplus system at this site",
  );
  // The patch (not the full payload) is what mergeReSlice feeds to
  // surplusAnchor — it must carry everything the anchor needs.
  const anchor = surplusAnchor({ customCut: patch.customCut });
  assert.ok(
    anchor,
    "the PATCH yields the anchor — the span survives re-slices",
  );
  assert.equal(anchor.outcomePct, 140);
  // Whatever the surplus system costs, the ceiling must be able to reach it.
  assert.ok(
    budgetSpanMax(p0.frontier.points, null, anchor) >=
      Math.max(curveTop, anchor.capexUsd),
    "the lifted span always includes the surplus system",
  );
  // Hygiene: a patch is a patch — it must never be cached as a full payload
  // nor masquerade as one.
  assert.equal(patch.matrix, undefined, "patch carries no full-run matrix");
  assert.equal(patch.repeat, undefined, "patch is not a cache replay");
  assert.ok(
    patch.best !== undefined,
    "patch.best is always present (null when nothing solves)",
  );
});

test("re-slice at a target where nothing solves reports best:null, not silence", async () => {
  // A near-zero PV cap at a real load makes the custom target unsolvable; the
  // patch must still SAY so (patch.best = null) so the UI retires the stale
  // recommendation instead of keeping the previous target's system on screen.
  const patch = await runSizing(
    {
      ...MSG,
      dailyKwh: 71.9,
      pvMaxOverride: 1.6,
      customCut: 0.8,
      incrementalCut: true,
    },
    { fetchWeather: fakeWeather },
  );
  // The auto-chem block is always present; its emptiness is the message.
  assert.ok(patch.customCut, "the custom block itself is always built");
  assert.equal(patch.customCut.fraction, 0.8);
  assert.deepEqual(patch.customCut.entries, [], "no system solved");
  assert.equal(patch.customCut.best, null);
  assert.equal(patch.customCut.achievedPct, null);
  assert.ok(
    "best" in patch,
    "the patch distinguishes 'nothing solves' (null) from 'not recomputed'",
  );
  assert.equal(
    patch.best,
    null,
    "nothing solves under this cap — best is null",
  );
  assert.equal(patch.bestReason, null);
  assert.equal(patch.focus, null);
});

// ── 3. The Keaau class: a binding roof-area cap is diagnosed, not silent ────

test("Keaau control: the same load solves with an unconstrained envelope", async () => {
  const p = await runSizing(
    { ...MSG, dailyKwh: 71.9 },
    { fetchWeather: fakeWeather },
  );
  assert.ok(
    p.best,
    "without a roof cap the site solves — any 'not practical' here is a cap, not the sun",
  );
});

test("Keaau repro: a 25.5 m² roof cap (≈1.6 kW PV) yields no best pick", async () => {
  const p = await runSizing(
    { ...MSG, dailyKwh: 71.9, pvMaxOverride: 1.6 },
    { fetchWeather: fakeWeather },
  );
  assert.ok(!p.best, "reproduces the reported failure");
});

test("capped cells explain the cap with checkable arithmetic", async () => {
  const p = await runSizing(
    { ...MSG, dailyKwh: 71.9, pvMaxOverride: 1.6 },
    { fetchWeather: fakeWeather },
  );
  const cells = Object.values((p.matrix && p.matrix.cells) || {});
  const limited = cells.filter((c) => c.reason === "envelope-limited");
  assert.ok(limited.length, "at least one cell explains the cap");
  for (const c of limited)
    assert.match(
      c.envelopeNote,
      /1\.6 kW of panels/,
      "the note carries the visitor-checkable arithmetic",
    );
});

test("a non-binding cap never flags cells as envelope-limited", async () => {
  const p = await runSizing(
    { ...MSG, dailyKwh: 71.9, pvMaxOverride: 60 },
    { fetchWeather: fakeWeather },
  );
  assert.ok(p.best, "a 60 kW cap is no cap at all for this load");
  const cells = Object.values((p.matrix && p.matrix.cells) || {});
  assert.equal(
    cells.filter((c) => c.reason === "envelope-limited").length,
    0,
    "the honest diagnosis must not fire when the cap never bound",
  );
});

// ── 4. UI wiring contracts (DOM code node cannot execute) ───────────────────

test("ui.js feeds the anchor into the budget slider's span and pool", () => {
  const src = readFileSync(
    new URL("../assets/js/sizing/ui.js", import.meta.url),
    "utf8",
  );
  assert.match(
    src,
    /const anchor = surplusAnchor\(p\);\s*\n\s*const xs = pts\.map/,
    "syncBudgetRange feeds the anchor into the span",
  );
  assert.match(
    src,
    /hi = budgetSpanMax\(pts, m \? m\.capexUsd : null, anchor\)/,
    "the ceiling comes from budgetSpanMax",
  );
  assert.match(
    src,
    /kind: "custom",\s*\n\s*index: -1,/,
    "curvePool includes the walkable surplus point",
  );
  assert.match(
    src,
    /q\.kind === "custom"/,
    "committing the surplus point selects the custom system",
  );
});

test("ui.js retires a stale recommendation when nothing solves at the new cut", () => {
  const src = readFileSync(
    new URL("../assets/js/sizing/ui.js", import.meta.url),
    "utf8",
  );
  assert.match(
    src,
    /"best" in result/,
    "mergeReSlice acts on an explicit null best",
  );
  assert.match(
    src,
    /p\.frontier\.marker = null;/,
    "the marker clears when the recommendation retires",
  );
});

test("run.js always reports best (null included) on the incremental path", () => {
  const src = readFileSync(
    new URL("../assets/js/sizing/run.js", import.meta.url),
    "utf8",
  );
  const seg = src.slice(
    src.indexOf("Always present — including null when nothing solves"),
    src.indexOf("Always present — including null when nothing solves") + 600,
  );
  assert.ok(
    seg.includes("patch.best = customBest;"),
    "assignment is not conditional",
  );
  assert.ok(
    !/if \(customBest\) \{[\s\S]*patch\.best/.test(seg),
    "no conditional gate above the assignment",
  );
});

test("ui.js keeps the roof-cap note truthful and the input wired", () => {
  const src = readFileSync(
    new URL("../assets/js/sizing/ui.js", import.meta.url),
    "utf8",
  );
  assert.match(src, /function setupRoofAreaInput\(/, "input listener exists");
  assert.match(src, /roofAreaCapNote/, "the live cap note is wired");
  assert.match(
    src,
    /updateRoofAreaCapNote\(\)/,
    "share-link renders refresh the note too",
  );
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /id="roofAreaCapNote"/, "the note element exists");
});

test("auto-chemistry payloads always carry an auto ARRAY (empty when nothing solves)", async () => {
  // The UI router distinguishes auto mode from fixed-chemistry mode by
  // payload SHAPE: fixed-chem runs set p.auto = null, auto runs always set
  // an array. If the engine ever shipped an empty-auto run as null, the
  // router would misroute the "nothing solves" case again (found live in a
  // browser: the banner went blank instead of naming the roof-cap cause).
  const p = await runSizing(
    { ...MSG, dailyKwh: 71.9, pvMaxOverride: 1.6 },
    { fetchWeather: fakeWeather },
  );
  assert.ok(
    Array.isArray(p.auto),
    "p.auto must be an array in auto mode, never null",
  );
  assert.equal(p.auto.length, 0, "nothing solves under the cap");
});

test("ui.js routes empty-auto payloads to renderBestPick's honest empty state", () => {
  const src = readFileSync(
    new URL("../assets/js/sizing/ui.js", import.meta.url),
    "utf8",
  );
  assert.match(
    src,
    /const isAutoMode = Array\.isArray\(p\.auto\);/,
    "routing must use the payload shape, not whether anything solved",
  );
  assert.match(
    src,
    /if \(isAutoMode\) \{\s*\n\s*renderBestPick\(p\);/,
    "auto mode reaches renderBestPick even when p.auto is empty",
  );
});

test("payload cache cannot conflate an incremental patch with a full run", () => {
  const src = readFileSync(
    new URL("../assets/js/sizing/run.js", import.meta.url),
    "utf8",
  );
  const seg = src.slice(
    src.indexOf("function payloadCacheKey"),
    src.indexOf("function payloadCacheKey") + 400,
  );
  assert.match(
    seg,
    /new Set\(\["type", "seq", "epoch"\]\)/,
    "the skip set stays minimal — incrementalCut and every physics input " +
      "must remain part of the key, or a slider patch could be replayed as " +
      "a cached full payload",
  );
});
