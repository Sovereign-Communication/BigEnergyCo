// The plausibility frontier: the curve that says whether a goal is easy,
// expensive, or impossible where someone lives.
//
// These tests pin the two things that make the chart trustworthy:
//   1. it is a real Pareto frontier - monotone in both money and coverage;
//   2. its numbers agree with the dedicated searches the cards already use.
// A chart that disagrees with the cards beside it is worse than no chart.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pvLadder, battLadder, paretoFront, thinFront, findKnee, costPerPoint,
  classifyReach, buildFrontier, sweepSystems, isBoundLimited,
} from "../assets/js/sizing/frontier.js";
import { niceMax, axisTicks } from "../assets/js/sizing/frontier-chart.js";
import { runSizing } from "../assets/js/sizing/run.js";
import {
  buildE1kw, flatProfile, expandProfile, sizeForBillCut, CHEMISTRIES,
} from "../assets/js/sizing/engine.js";
import { fullRange } from "../assets/js/sizing/pricing.js";
import { synthesizeFromProfile } from "../assets/js/sizing/nasa.js";
import { OFFLINE_PROFILES, PROFILE_YEAR } from "../assets/js/sizing/profiles.js";

// ── fixtures ────────────────────────────────────────────────────────────────

function site(nameFragment, dailyKwh = 10) {
  const profile = OFFLINE_PROFILES.find((p) => p.name.includes(nameFragment));
  assert.ok(profile, `offline profile for ${nameFragment} exists`);
  const hours = synthesizeFromProfile(profile);
  const e1kw = buildE1kw(hours);
  const tempsC = Float64Array.from(hours, (h) => h.tAmb);
  const loadWh = expandProfile(flatProfile(dailyKwh), hours.length);
  return { hours, e1kw, tempsC, loadWh };
}

const LINEAR_COSTS = { costPerWpv: 0.35, costPerKwhBatt: 140, costPerKwInv: 60 };

function weatherFrom(nameFragment) {
  const profile = OFFLINE_PROFILES.find((p) => p.name.includes(nameFragment));
  return async () => ({
    hours: synthesizeFromProfile(profile),
    meta: {
      latitude: 21.31, longitude: -157.86,
      startYear: PROFILE_YEAR, endYear: PROFILE_YEAR, years: 1,
      source: "test fixture", offline: false,
    },
  });
}

// ── ladders and axis helpers ────────────────────────────────────────────────

test("PV ladder is ascending, unique, and spans the requested range", () => {
  const l = pvLadder(20, 18);
  assert.ok(l.length >= 12, "enough resolution to draw a curve");
  assert.deepEqual(l, [...l].sort((a, b) => a - b), "ascending");
  assert.equal(new Set(l).size, l.length, "no duplicates");
  assert.ok(l[l.length - 1] <= 20 + 1e-9 && l[l.length - 1] > 19, "tops out at pvMax");
  assert.ok(l[0] > 0, "no zero-kW array");
});

test("battery ladder is whole kWh, and only offers 'no battery' when asked", () => {
  const withZero = battLadder(80, 16, true);
  const without = battLadder(80, 16, false);
  assert.equal(withZero[0], 0, "grid-tie may buy panels and no bank at all");
  assert.ok(without[0] >= 1, "off-grid always needs some storage");
  for (const v of withZero) assert.equal(v, Math.round(v), "whole kWh only");
  assert.deepEqual(without, [...without].sort((a, b) => a - b), "ascending");
});

test("niceMax keeps the plot full instead of rounding away 40% of the width", () => {
  assert.equal(niceMax(3200), 4000);      // the old 1/2/5 ladder gave 5000
  assert.equal(niceMax(1050), 1200);
  assert.equal(niceMax(26300), 30000);
  assert.ok(niceMax(3200) >= 3200, "never crops the data");
  assert.equal(axisTicks(4000, 4).length, 5);
});

// ── frontier mathematics ────────────────────────────────────────────────────

test("paretoFront keeps only systems nothing cheaper beats", () => {
  const pts = [
    { capexUsd: 100, outcome: 0.30 },
    { capexUsd: 150, outcome: 0.25 },   // dearer AND worse - dominated
    { capexUsd: 200, outcome: 0.50 },
    { capexUsd: 210, outcome: 0.50 },   // no better for more money - dominated
    { capexUsd: 300, outcome: 0.70 },
  ];
  const f = paretoFront(pts);
  assert.deepEqual(f.map((p) => p.capexUsd), [100, 200, 300]);
  for (let i = 1; i < f.length; i++) {
    assert.ok(f[i].capexUsd > f[i - 1].capexUsd, "cost strictly rises");
    assert.ok(f[i].outcome > f[i - 1].outcome, "coverage strictly rises");
  }
});

test("thinFront drops unreadable near-duplicates but never the endpoints", () => {
  const front = [];
  for (let i = 0; i < 60; i++) front.push({ capexUsd: 100 + i * 50, outcome: 0.3 + i * 0.001 });
  const thin = thinFront(front, { minOutcome: 0, minStepPp: 1, maxPoints: 22 });
  assert.ok(thin.length <= 22, "capped for legibility");
  assert.equal(thin[0].capexUsd, front[0].capexUsd, "cheapest point survives");
  assert.equal(thin[thin.length - 1].capexUsd, front[front.length - 1].capexUsd, "most capable point survives");
});

test("thinFront hides systems too weak to be a real option", () => {
  const front = [
    { capexUsd: 50, outcome: 0.05 },
    { capexUsd: 100, outcome: 0.40 },
    { capexUsd: 200, outcome: 0.90 },
  ];
  const thin = thinFront(front, { minOutcome: 0.25 });
  assert.equal(thin.length, 2);
  assert.ok(thin.every((p) => p.outcome >= 0.25));
});

test("findKnee picks the elbow of a concave curve, and abstains on short ones", () => {
  // Cheap coverage up to 80%, then a brutal tail: the elbow is that corner.
  const front = [
    { capexUsd: 0, outcome: 0.20 },
    { capexUsd: 500, outcome: 0.60 },
    { capexUsd: 1000, outcome: 0.80 },
    { capexUsd: 5000, outcome: 0.90 },
    { capexUsd: 20000, outcome: 1.00 },
  ];
  const k = findKnee(front);
  assert.equal(front[k].outcome, 0.80, "elbow is where returns stop being proportional");
  assert.equal(findKnee(front.slice(0, 2)), -1, "no knee in a two-point curve");
  assert.ok(costPerPoint(front[2], front[4]) > costPerPoint(front[0], front[2]),
    "the tail really is dearer per point");
  assert.equal(costPerPoint(front[1], front[1]), null, "no division by zero");
});

test("classifyReach names the shape without inventing prose", () => {
  const steep = [
    { capexUsd: 0, outcome: 0.20 }, { capexUsd: 1000, outcome: 0.85 },
    { capexUsd: 30000, outcome: 1.0 },
  ];
  const r = classifyReach(steep, findKnee(steep));
  assert.equal(r.id, "steep-tail");
  assert.ok(r.tailRatio > 6);
  assert.equal(typeof r.ceilingPct, "number");
  // ids only - locale files own the wording
  assert.ok(!/[a-z]{4}\s[a-z]{4}/.test(r.id), "verdict is an id, not a sentence");

  const capped = [
    { capexUsd: 0, outcome: 0.20 }, { capexUsd: 1000, outcome: 0.5 },
    { capexUsd: 30000, outcome: 0.82 },
  ];
  const c = classifyReach(capped, findKnee(capped), { pvMaxKw: 30, battMaxKwh: 250, boundLimited: true });
  assert.equal(c.id, "beyond-sweep", "falling short is reported as a limit of the SEARCH");
  assert.ok(c.kneePct !== null, "knee economics still reported when full coverage is out of range");
  assert.equal(c.pvMaxKw, 30, "the envelope searched travels with the verdict");
  assert.equal(c.battMaxKwh, 250, "so the copy can name it instead of implying physics");
});

// ── against real weather ────────────────────────────────────────────────────

test("a sunny site produces a monotone curve that reaches full coverage", () => {
  const { e1kw, loadWh, tempsC } = site("Honolulu");
  const f = buildFrontier({
    e1kw, loadWh, tempsC, chemistry: "lfp", mode: "offgrid",
    pvMax: 12, battMax: 40, ...LINEAR_COSTS,
  });
  assert.ok(f.points.length >= 6, "enough points to read a shape");
  for (let i = 1; i < f.points.length; i++) {
    assert.ok(f.points[i].capexUsd > f.points[i - 1].capexUsd, "cost rises along the curve");
    assert.ok(f.points[i].outcomePct > f.points[i - 1].outcomePct, "coverage rises along the curve");
  }
  assert.ok(f.reach.ceilingPct >= 99, `Honolulu reaches independence (got ${f.reach.ceilingPct}%)`);
  assert.notEqual(f.reach.id, "beyond-sweep");
  assert.equal(f.boundLimited, false, "a curve that reaches 100% inside the lattice is not bound-limited");
  assert.equal(f.chemistry, "lfp");
  assert.equal(f.chemLabel, CHEMISTRIES.lfp.label);
});

test("a dark high-latitude site reports the SEARCH limit, never impossibility", () => {
  const { e1kw, loadWh, tempsC } = site("Oslo");
  const f = buildFrontier({
    e1kw, loadWh, tempsC, chemistry: "lfp", mode: "offgrid",
    pvMax: 30, battMax: 100, ...LINEAR_COSTS,
  });
  assert.equal(f.reach.id, "beyond-sweep", `Oslo reached ${f.reach.ceilingPct}%`);
  assert.ok(f.reach.ceilingPct < 99, "no false promise of full independence");
  assert.equal(f.boundLimited, true, "the best system sat on the edge of the sweep");
  assert.ok(f.reach.pvMaxKw > 0 && f.reach.battMaxKwh > 0,
    "the verdict carries the envelope so the copy can name it");
  assert.ok(f.reach.tailCostPerPoint > f.reach.headCostPerPoint,
    "the last percent costs more than the first");
});

// The bug this test exists to prevent: an early version reported Oslo's 88.1%
// as "the ceiling, at any price". It was the corner of the lattice. Widen the
// box and the number moves, every time - so it can never be stated as physics.
test("REGRESSION: a bound-limited ceiling moves when the sweep widens", () => {
  const { e1kw, loadWh, tempsC } = site("Oslo");
  const reach = (pvMax, battMax) => buildFrontier({
    e1kw, loadWh, tempsC, chemistry: "lfp", mode: "offgrid",
    pvMax, battMax, ...LINEAR_COSTS,
  });
  const small = reach(30, 100);
  const large = reach(60, 400);
  assert.ok(large.reach.ceilingPct > small.reach.ceilingPct + 1,
    `widening the sweep must raise the reported ceiling ` +
    `(${small.reach.ceilingPct}% -> ${large.reach.ceilingPct}%)`);
  // Both ran out of lattice before they ran out of coverage, so both must
  // flag it - the wider one simply gets further before it does.
  assert.equal(small.boundLimited, true);
  assert.equal(large.boundLimited, true);
  assert.equal(small.reach.id, "beyond-sweep");
  assert.ok(large.reach.ceilingPct < 99,
    "the wider sweep still has not reached full independence");
  // No verdict in the vocabulary is allowed to mean "impossible".
  for (const f of [small, large]) {
    assert.ok(["already-covered", "beyond-sweep", "steep-tail", "tapering", "linear"].includes(f.reach.id));
    assert.notEqual(f.reach.id, "unreachable");
  }
});

// Independence is a ratio, not an amount: a phone-and-lights load needs almost
// nothing, even at 60 degrees north. The tool used to render nothing at all for
// these visitors, because the curve collapsed to a single point.
test("a load small enough to be covered by the smallest system says so", () => {
  const { e1kw, loadWh, tempsC } = site("Honolulu", 0.05);
  const f = buildFrontier({
    e1kw, loadWh, tempsC, chemistry: "lfp", mode: "offgrid",
    pvMax: 3, battMax: 10, ...LINEAR_COSTS,
  });
  assert.equal(f.reach.id, "already-covered",
    `smallest buildable system covers the load (got ${f.reach.id})`);
  assert.ok(f.reach.entryPvKw > 0 && f.reach.entryBattKwh > 0 && f.reach.entryCostUsd > 0,
    "the verdict names the system and its price, so the sentence can be written");
  assert.equal(f.reach.kneePct, null, "no knee: there is no trade-off to make");
});

test("the same site at a household load still gets a real curve", () => {
  const { e1kw, loadWh, tempsC } = site("Honolulu", 10);
  const f = buildFrontier({
    e1kw, loadWh, tempsC, chemistry: "lfp", mode: "offgrid",
    pvMax: 12, battMax: 40, ...LINEAR_COSTS,
  });
  assert.notEqual(f.reach.id, "already-covered", "10 kWh/day is a real sizing problem");
  assert.ok(f.points.length > 5);
});

test("isBoundLimited spots a frontier pinned to the edge of its lattice", () => {
  const pvs = [1, 2, 4], bats = [1, 5, 20];
  assert.equal(isBoundLimited([{ pvKw: 2, battKwh: 5 }], pvs, bats), false, "interior point");
  assert.equal(isBoundLimited([{ pvKw: 4, battKwh: 5 }], pvs, bats), true, "PV pinned");
  assert.equal(isBoundLimited([{ pvKw: 2, battKwh: 20 }], pvs, bats), true, "battery pinned");
  assert.equal(isBoundLimited([], pvs, bats), false, "nothing to judge");
});

test("grid-tie curves start with solar-only - the cheapest useful first step", () => {
  const { e1kw, loadWh, tempsC } = site("Honolulu");
  const f = buildFrontier({
    e1kw, loadWh, tempsC, chemistry: "lfp", mode: "gridtie",
    pvMax: 12, battMax: 40, ...LINEAR_COSTS,
  });
  assert.equal(f.points[0].battKwh, 0,
    "on a grid-connected site the first useful dollar buys panels, not a battery");
  assert.ok(f.points.some((p) => p.battKwh > 0), "storage still appears further along");
});

test("off-grid sweeps never propose a system with no battery at all", () => {
  const { e1kw, loadWh, tempsC } = site("Honolulu");
  const all = sweepSystems({
    e1kw, loadWh, tempsC, chemistry: "lfp", mode: "offgrid",
    pvMax: 8, battMax: 20, ...LINEAR_COSTS,
  });
  assert.ok(all.length > 0);
  assert.ok(all.every((p) => p.battKwh > 0), "an off-grid home with no storage is not a system");
});

// ── the gate that matters: chart agrees with the cards ──────────────────────

test("GATE: the curve's price for an 80% bill cut matches the dedicated search", () => {
  const { e1kw, loadWh, tempsC } = site("Honolulu");
  const chem = "lfp";
  const landedF = 1.1;
  const costFn = (pv, b) => {
    const r = fullRange(pv, b, chem, landedF);
    return { mid: r.objectiveMid, lo: r.lo, hi: r.hi };
  };

  const searched = sizeForBillCut({
    e1kw, loadWh, tempsC, chemistry: chem, minFraction: 0.8, years: 1,
    costPerWpv: 0.32, costPerKwhBatt: 150, costPerKwInv: 90,
    pvMax: 30, battMax: 100, battStep: 1, laborPerKwh: [0, 0, 0],
  });
  assert.ok(searched, "the search itself solves 80% at this site");
  const searchedCost = fullRange(searched.pvKw, searched.battKwh, chem, landedF).objectiveMid;

  const f = buildFrontier({
    e1kw, loadWh, tempsC, chemistry: chem, mode: "gridtie",
    costFn, pvMax: 12, battMax: 40,
  });
  const curve = f.points.find((p) => p.outcomePct >= 80);
  assert.ok(curve, "the curve reaches 80% too");

  // The coarse lattice can only be a little dearer than the fine search, and
  // must never look implausibly cheaper - either would make the chart lie
  // about the cards printed right beside it.
  const ratio = curve.capexUsd / searchedCost;
  assert.ok(ratio > 0.6 && ratio < 1.45,
    `curve ${curve.capexUsd} vs search ${searchedCost} (ratio ${ratio.toFixed(2)})`);
});

// ── payload contract ────────────────────────────────────────────────────────

test("runSizing ships a frontier the renderer can draw, in every mode", async () => {
  const w = weatherFrom("Honolulu");
  const base = { latitude: 21.31, longitude: -157.86, dailyKwh: 10, tariff: 0.42 };
  for (const [mode, chemistry] of [["offgrid", "auto"], ["gridtie", "auto"], ["offgrid", "lfp"], ["gridtie", "agm"]]) {
    const p = await runSizing({ ...base, mode, chemistry }, { fetchWeather: w });
    assert.equal(p.contract, 9, `${mode}/${chemistry}: contract bumped for the new field`);
    const f = p.frontier;
    assert.ok(f, `${mode}/${chemistry}: frontier present`);
    assert.equal(f.mode, mode);
    assert.ok(f.points.length >= 2, `${mode}/${chemistry}: drawable`);
    for (const pt of f.points) {
      for (const k of ["pvKw", "battKwh", "outcomePct", "capexUsd", "capexLoUsd", "capexHiUsd"]) {
        assert.ok(Number.isFinite(pt[k]), `${mode}/${chemistry}: point.${k} is a number`);
      }
      assert.ok(pt.capexLoUsd <= pt.capexUsd && pt.capexUsd <= pt.capexHiUsd,
        "price band brackets the typical cost");
      assert.ok(!("result" in pt), "raw simulation objects stripped before postMessage");
    }
    assert.ok(["already-covered", "beyond-sweep", "steep-tail", "tapering", "linear"].includes(f.reach.id));
    assert.equal(typeof f.boundLimited, "boolean", "every payload says whether the sweep ran out of road");
    if (p.focus) {
      assert.ok(f.marker, `${mode}/${chemistry}: the option being read is marked`);
      assert.ok(Number.isFinite(f.marker.capexUsd) && Number.isFinite(f.marker.outcomePct));
      assert.ok(f.marker.outcomePct >= 0 && f.marker.outcomePct <= 100);
    }
  }
});

test("a frontier failure never takes the whole result down", async () => {
  // profiles with no sun at all must still yield a payload the page can render
  const p = await runSizing(
    { latitude: 0, longitude: 0, dailyKwh: 10, tariff: 0.42, mode: "offgrid", chemistry: "lfp" },
    { fetchWeather: async () => ({
        hours: Array.from({ length: 8760 }, () => ({ ghi: 0, tAmb: 15 })),
        meta: { latitude: 0, longitude: 0, startYear: 2025, endYear: 2025, years: 1, source: "dark fixture" },
      }) },
  );
  assert.equal(p.contract, 9);
  assert.ok("frontier" in p, "the field always exists, even when there is nothing to draw");
});

// The reported bug: a visitor shares "London, 50 kWh/day, grid-tie, 95% cut"
// and gets NO battery/solar cards at all, because no chemistry can hit a 95%
// bill cut inside the searched envelope at a dark or heavy site. The cards are
// the product - so AUTO falls back to the nearest workable cut and says so.
test("AUTO: an unreachable cut target falls back to the nearest workable cut, never a blank grid", async () => {
  const oslo = OFFLINE_PROFILES.find((p) => p.name.includes("Oslo"));
  const w = async () => ({
    hours: synthesizeFromProfile(oslo),
    meta: { latitude: 59.9, longitude: 10.75, startYear: 2025, endYear: 2025, years: 1, source: "fixture", offline: true },
  });
  const p = await runSizing({
    latitude: 59.9, longitude: 10.75, dailyKwh: 30, chemistry: "auto", mode: "gridtie",
    autoTargetId: "cut95", tariff: 0.42,
  }, { fetchWeather: w });
  assert.ok(p.auto && p.auto.length > 0, "the visitor still gets battery/solar cards to compare");
  assert.equal(p.autoFallback, true, "the fallback is flagged so the UI can say so");
  assert.equal(p.effectiveTargetId, "cut80", "the nearest reachable cut is used");
  assert.ok(p.frontier && p.frontier.marker, "the recommended option is still marked on the curve");
  for (const a of p.auto) assert.ok(a.cutPct >= 55 && a.cutPct <= 90, `honest cut ${a.cutPct}% (was 0 / -100 before the fix)`);
});

// Cut-% used to divide the multi-YEAR accumulated grid import by a single-year
// load, so a 5-year run reported ~16% for a system actually cutting ~80%. It
// must be per-year.
test("REGRESSION: multi-year bill-cut % is per-year, not the accumulated total", async () => {
  const hon = OFFLINE_PROFILES.find((p) => p.name.includes("Honolulu"));
  const one = synthesizeFromProfile(hon);
  const hours = [...one, ...one, ...one, ...one, ...one];
  const w = async () => ({
    hours,
    meta: { latitude: 21.31, longitude: -157.86, startYear: 2025, endYear: 2029, years: 5, source: "fixture", offline: false },
  });
  const p = await runSizing({
    latitude: 21.31, longitude: -157.86, dailyKwh: 10, chemistry: "auto", mode: "gridtie",
    autoTargetId: "cut80", tariff: 0.42, years: 5,
  }, { fetchWeather: w });
  assert.ok(p.auto && p.auto.length > 0, "cards present on a multi-year run");
  for (const a of p.auto) {
    assert.ok(a.cutPct >= 55 && a.cutPct <= 95,
      `a ${a.chemistry} card sized for an ~80% cut should read ~80%, not ${a.cutPct}%`);
  }
});
