// Battery re-run (2026-10-25) — the owed gaps and the named CAR sites.
//
// The re-run's disposition record (docs/jev-completion/battery-rerun-2026-10-25/)
// put nine functions in the "needs-test" band (test_priority >= 2.0). This
// suite discharges all nine — the heatmap math in scripts/generate-heatmap-data.mjs
// (annualYieldKwhPerKwp, nearestProfile, systemCostMid, computePayback,
// computeBreakeven, computeLcoe, estimateTariffBlended), NASA's parseHourly,
// and build-city-pages' workedExample — plus the named CAR #197/#201 sites
// that had no executed coverage (purchasePaths' fail-closed guards, the
// money() unknown marker behind `band`, markerOffCurveNote, the tiny helpers
// el/modeLabel/verdictKeys/usStateCode, and runSizing's message boundary),
// plus the one confirmed defect this pass hardened: haversineKm's antipodal
// floating-point overshoot.
//
// Method follows tests/audit-car6-integration.test.mjs: slice the shipped
// source out of its file and execute it, with only its collaborators stubbed —
// real modules wherever the real module is the point (engine yield math,
// pricing bands, the NASA parser itself).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

import { arrayEfficiency, tempFactor } from "../assets/js/sizing/engine.js";
import {
  costRange,
  landedMidBattKwhFor,
  estimateTariff,
  usStateCode,
} from "../assets/js/sizing/pricing.js";
import { parseHourly, buildUrl } from "../assets/js/sizing/nasa.js";
import { runSizing } from "../assets/js/sizing/run.js";
import { el } from "../assets/js/shared/dom.js";
import { modeLabel } from "../assets/js/shared/simple-mode.js";
import { verdictKeys } from "../assets/js/sizing/usecases.js";

function between(src, start, end) {
  const from = src.indexOf(start);
  assert.notEqual(from, -1, `${start} must exist in the source`);
  const to = src.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `${end} must follow ${start}`);
  return src.slice(from, to);
}

function stripExport(text) {
  return text.replace(/^export /gm, "");
}

/** Extract `function name(...){...}` (optionally exported) by brace matching. */
function fnBlock(src, name) {
  const re = new RegExp(`export\\s+function\\s+${name}\\s*\\(`);
  const m = re.exec(src);
  assert.ok(m, `function ${name} must exist`);
  // Walk the parameter list first: default params like `opts = {}` contain
  // braces of their own and would end the match at the wrong pair.
  let p = src.indexOf("(", m.index);
  let depth = 0;
  for (; p < src.length; p += 1) {
    if (src[p] === "(") depth += 1;
    else if (src[p] === ")") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  let i = src.indexOf("{", p);
  depth = 0;
  for (; i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  return src.slice(m.index, i + 1);
}

// ── heatmap math (scripts/generate-heatmap-data.mjs) ───────────────────────
//
// The payback/lcoe numbers on the heatmaps are money figures shown to
// visitors, and until now nothing executed this arithmetic: the generator
// runs at build time and its output is only shape-checked. The slices run
// against the REAL yield math (engine.js) and REAL pricing bands (pricing.js)
// — the same single-source-of-truth modules the generator itself imports —
// so these tests pin the generator's tables, guards and rounding, not the
// shared modules.

const heatSrc = readFileSync("scripts/generate-heatmap-data.mjs", "utf8");

const ANNUAL_YIELD = between(
  heatSrc,
  "function annualYieldKwhPerKwp(profile)",
  "function haversineKm",
);
const HAVERSINE = between(
  heatSrc,
  "function haversineKm(lat1, lon1, lat2, lon2)",
  "function nearestProfile",
);
const NEAREST = between(
  heatSrc,
  "function nearestProfile(lat, lon)",
  "const GRID_DEFICITS",
);
const GRID_DEFICITS = between(
  heatSrc,
  "const GRID_DEFICITS = {",
  "/* TARIFF_BOXES removed",
);
const TARIFF_BLENDED = between(
  heatSrc,
  'function estimateTariffBlended(lat, lon, region = "", countryCode = "")',
  "// Cost model",
);
const SYSTEM_COST = between(
  heatSrc,
  "function systemCostMid(pvKw, battKwhUsable, landedF = 1)",
  "const USAGE_TIERS",
);
const PAYBACK = between(
  heatSrc,
  "function computePayback(yieldKwhPerKwp, dailyKwh, tariff, landedF)",
  "function computeBreakeven",
);
const BREAKEVEN = between(
  heatSrc,
  "function computeBreakeven(yieldKwhPerKwp, dailyKwh, tariff, landedF)",
  "function computeLcoe",
);
const LCOE = between(
  heatSrc,
  "function computeLcoe(yieldKwhPerKwp, dailyKwh, landedF)",
  "console.log(",
);

function heatmapApi(profiles = []) {
  const sandbox = {
    arrayEfficiency,
    tempFactor,
    costRange,
    landedMidBattKwhFor,
    estimateTariff,
    OFFLINE_PROFILES: profiles,
  };
  vm.createContext(sandbox);
  vm.runInContext(
    [
      ANNUAL_YIELD,
      HAVERSINE,
      NEAREST,
      GRID_DEFICITS,
      TARIFF_BLENDED,
      SYSTEM_COST,
      PAYBACK,
      BREAKEVEN,
      LCOE,
      "this.api = { annualYieldKwhPerKwp, haversineKm, nearestProfile, estimateTariffBlended, systemCostMid, computePayback, computeBreakeven, computeLcoe };",
    ].join("\n"),
    sandbox,
  );
  return sandbox.api;
}

function constantProfile(ghi, tAmb) {
  return {
    ghi: Array.from({ length: 12 }, () => Array(24).fill(ghi)),
    tAmb: Array.from({ length: 12 }, () => Array(24).fill(tAmb)),
  };
}

test("rerun: annualYieldKwhPerKwp sums the real 365-day calendar and rounds", () => {
  const api = heatmapApi();
  const profile = constantProfile(100, 25);
  const expected = Math.round(
    (365 * 24 * 100 * arrayEfficiency() * tempFactor(25, 100)) / 1000,
  );
  assert.equal(api.annualYieldKwhPerKwp(profile), expected);
});

test("rerun: annualYieldKwhPerKwp treats absent sun as zero, never NaN", () => {
  const api = heatmapApi();
  assert.equal(api.annualYieldKwhPerKwp(constantProfile(0, 25)), 0);
  assert.equal(api.annualYieldKwhPerKwp(constantProfile(-5, 25)), 0);
});

test("rerun: annualYieldKwhPerKwp is monotonic in irradiance", () => {
  const api = heatmapApi();
  const lo = api.annualYieldKwhPerKwp(constantProfile(50, 25));
  const mid = api.annualYieldKwhPerKwp(constantProfile(100, 25));
  const hi = api.annualYieldKwhPerKwp(constantProfile(200, 25));
  assert.ok(lo < mid && mid < hi, `${lo} < ${mid} < ${hi}`);
});

test("rerun: haversineKm stays finite at the antipodes (fp overshoot clamped)", () => {
  const api = heatmapApi();
  // sin^2 + cos*cos*sin^2 can round a hair past 1 for antipodal pairs, where
  // asin(sqrt(a)) is NaN and the nearest-profile comparison silently loses
  // every candidate. The clamp (this pass's harden) makes the distance total.
  const pairs = [
    [0, 0, 0, 180],
    [45, 0, -45, 180],
    [37.7749, -122.4194, -37.7749, 57.5806],
    [-89.9, -179.9, 89.9, 0.1],
  ];
  for (const [a, b, c, d] of pairs) {
    const km = api.haversineKm(a, b, c, d);
    assert.ok(Number.isFinite(km), `haversineKm(${a},${b},${c},${d}) = ${km}`);
    assert.ok(km <= 20038, `antipodal distance bounded: ${km}`);
  }
  assert.equal(api.haversineKm(0, 0, 0, 0), 0);
});

test("rerun: nearestProfile returns the nearest of the bundled profiles", () => {
  const api = heatmapApi([
    { name: "A", lat: 0, lon: 0 },
    { name: "B", lat: 10, lon: 10 },
  ]);
  assert.equal(api.nearestProfile(1, 1).name, "A");
  assert.equal(api.nearestProfile(9, 9.5).name, "B");
  // Even from the far side of the planet the search returns a profile —
  // a NaN distance would otherwise leave the whole search empty.
  assert.ok(api.nearestProfile(-89, -179));
});

test("rerun: systemCostMid scales by a valid landed factor and refuses invalid ones", () => {
  const api = heatmapApi();
  const r = costRange(5, 10, "landed", "lfp");
  const mid = (r.lo + r.hi) / 2;
  assert.equal(api.systemCostMid(5, 10, 1.2), Math.round(mid * 1.2));
  // Guard: 0, negatives, NaN and null all fall back to factor 1 — a missing
  // multiplier must never zero or NaN a price shown to a visitor.
  for (const bad of [0, -1, NaN, null, undefined, "x"]) {
    assert.equal(
      api.systemCostMid(5, 10, bad),
      Math.round(mid),
      `landedF=${bad} must fall back to 1`,
    );
  }
});

test("rerun: computePayback refuses degenerate inputs instead of inventing years", () => {
  const api = heatmapApi();
  assert.equal(api.computePayback(0, 10, 0.3, 1.1), null);
  assert.equal(api.computePayback(1200, 10, 0, 1.1), null);
  assert.equal(api.computePayback(-5, 10, 0.3, 1.1), null);
  const years = api.computePayback(1200, 10, 0.3, 1.1);
  assert.ok(Number.isFinite(years) && years > 0, `payback = ${years}`);
  // A richer tariff repays faster.
  assert.ok(api.computePayback(1200, 10, 0.6, 1.1) < years);
});

test("rerun: computeBreakeven adds the battery replacement and never reads cheaper than payback", () => {
  const api = heatmapApi();
  assert.equal(api.computeBreakeven(0, 10, 0.3, 1.1), null);
  assert.equal(api.computeBreakeven(1200, 10, -0.2, 1.1), null);
  const payback = api.computePayback(1200, 10, 0.3, 1.1);
  const breakeven = api.computeBreakeven(1200, 10, 0.3, 1.1);
  assert.ok(
    Number.isFinite(breakeven) && breakeven >= payback,
    `breakeven ${breakeven} >= payback ${payback}`,
  );
});

test("rerun: computeLcoe refuses a dead yield and prices the 20-year kWh", () => {
  const api = heatmapApi();
  assert.equal(api.computeLcoe(0, 10, 1.1), null);
  assert.equal(api.computeLcoe(-1, 10, 1.1), null);
  const lcoe = api.computeLcoe(1200, 10, 1.1);
  assert.ok(Number.isFinite(lcoe) && lcoe > 0, `lcoe = ${lcoe}`);
});

test("rerun: estimateTariffBlended blends generator cost only for deficit grids", () => {
  const api = heatmapApi();
  // Nigeria: 43% unserved at $0.55/kWh generator cost, 50% outage on grid.
  const ng = api.estimateTariffBlended(9.08, 7.5, "", "NG");
  const onGridEff = (1 - 0.5) * ng.rate + 0.5 * 0.55;
  const expected = Math.round((0.43 * 0.55 + 0.57 * onGridEff) * 100) / 100;
  assert.equal(ng.realRate, expected);
  assert.ok(ng.realRate > ng.rate, "generator displacement lifts the rate");
  assert.ok(ng.deficit, "the deficit profile is attached, not hidden");
  // France: no deficit profile — the real rate IS the nominal tariff.
  const fr = api.estimateTariffBlended(48.86, 2.35, "", "FR");
  assert.equal(fr.realRate, fr.rate);
  assert.equal(fr.deficit, null);
});

// ── NASA parser (assets/js/sizing/nasa.js) ─────────────────────────────────

test("rerun: parseHourly sorts stamps, derives hours and maps -999 to NaN", () => {
  const parsed = parseHourly({
    properties: {
      parameter: {
        ALLSKY_SFC_SW_DWN: { 2020010101: 50, 2020010100: 100 },
        T2M: { 2020010101: 20, 2020010100: 25 },
      },
    },
  });
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].stamp, "2020010100");
  assert.equal(parsed[0].hourOfDay, 0);
  assert.equal(parsed[0].ghi, 100);
  assert.equal(parsed[0].tAmb, 25);
  assert.equal(parsed[1].hourOfDay, 1);
  // The POWER missing-data sentinel must become NaN (unknown), not -999 kWh.
  const sentinel = parseHourly({
    properties: {
      parameter: {
        ALLSKY_SFC_SW_DWN: { 2020010100: -999 },
        T2M: { 2020010100: -999 },
      },
    },
  });
  assert.ok(Number.isNaN(sentinel[0].ghi));
  assert.ok(Number.isNaN(sentinel[0].tAmb));
});

test("rerun: parseHourly throws on any other payload shape", () => {
  assert.throws(() => parseHourly(null), /unexpected NASA POWER payload shape/);
  assert.throws(
    () => parseHourly({ properties: {} }),
    /unexpected NASA POWER payload shape/,
  );
  assert.throws(
    () =>
      parseHourly({
        properties: { parameter: { ALLSKY_SFC_SW_DWN: { 2020010100: 1 } } },
      }),
    /unexpected NASA POWER payload shape/,
  );
});

test("rerun: buildUrl round-trips the parser's own payload contract", () => {
  // The URL build and the parser agree on the two parameters the engine
  // consumes; a silent drift between them would strand the -999 sentinel.
  const url = buildUrl(21.3069, -157.8583, "20200101", "20201231");
  assert.ok(url.includes("parameters=ALLSKY_SFC_SW_DWN,T2M"));
  assert.ok(url.includes("latitude=21.31"));
  assert.ok(url.includes("longitude=-157.86"));
  assert.ok(!url.includes("NaN"));
});

// ── city-page worked example (scripts/build-city-pages.mjs) ────────────────

const citySrc = readFileSync("scripts/build-city-pages.mjs", "utf8");
const FMT_KWH = between(citySrc, "function fmtKwh(v)", "// Worked example");
const WORKED = between(
  citySrc,
  "function workedExample(c, lo, hi)",
  "function cityPage",
);

function workedExample(c, lo, hi) {
  const sandbox = { estimateTariff, costRange };
  vm.createContext(sandbox);
  vm.runInContext(
    `${FMT_KWH}\n${WORKED}\nthis.workedExample = workedExample;`,
    sandbox,
  );
  return sandbox.workedExample(c, lo, hi);
}

test("rerun: workedExample builds three escalating rows and a tariff-true payback line", () => {
  const c = { lat: 45.5, lon: -73.6, region: "", country: "CA" };
  const wx = workedExample(c, 900, 1100);
  assert.equal(wx.rows.length, 3);
  // Spread: the slice runs in a vm realm, so .map returns a foreign Array.
  assert.deepEqual([...wx.rows.map((r) => r[0])], ["~60%", "~80%", "~95%"]);
  const pvLo = (r) => parseFloat(r[1]);
  assert.ok(pvLo(wx.rows[0]) < pvLo(wx.rows[1]));
  assert.ok(pvLo(wx.rows[1]) < pvLo(wx.rows[2]));
  for (const r of wx.rows) {
    const [lo, hi] = r[1].split("–").map(parseFloat);
    assert.ok(lo <= hi, `PV range ordered: ${r[1]}`);
    const [blo, bhi] = r[2].split("–").map(parseFloat);
    assert.ok(blo < bhi, `battery range ordered: ${r[2]}`);
  }
  // The payback line quotes the REAL local tariff, not a global default.
  const est = estimateTariff(c.lat, c.lon, c.region, c.country);
  assert.ok(wx.paybackLine.includes(`~$${est.rate.toFixed(2)}/kWh`));
  assert.ok(/repay/i.test(wx.paybackLine));
});

// ── CAR #197 named site: purchasePaths' fail-closed guards ─────────────────

const uiSrc = readFileSync("assets/js/sizing/ui.js", "utf8");
const PURCHASE_PATHS = between(
  uiSrc,
  "function purchasePaths(p, sys)",
  "export function turnkeyQuoteText",
);
const MONEY = between(uiSrc, "function money(usd)", "function localRate");

function purchasePathsHarness() {
  const calls = [];
  const sandbox = {
    pathsApi: {
      systemForPaths: (sys, ctx) => ({ sys, ctx }),
      priceAllPaths: (s, c) => {
        calls.push({ s, c });
        return { priced: true };
      },
    },
    pathsCache: { key: "", result: null },
    resolvedCountry: "us",
    pathsInstrument: "ppa",
  };
  vm.createContext(sandbox);
  vm.runInContext(
    `${PURCHASE_PATHS}\nthis.purchasePaths = purchasePaths;`,
    sandbox,
  );
  return { purchasePaths: sandbox.purchasePaths, calls, sandbox };
}

const SYS = {
  pvKw: 5,
  battKwh: 10,
  servedKwhPerYear: 4000,
  replacementsHorizon: 1,
  batteryLifeYears: 10,
};

test("rerun: purchasePaths refuses to price anything it cannot price honestly", () => {
  const { purchasePaths, calls } = purchasePathsHarness();
  // The historical defect: an undefined baseline turned every break-even into
  // "not within 20 years" — a whole column of honest-looking wrong answers.
  assert.equal(purchasePaths(null, SYS), null);
  assert.equal(purchasePaths({ annualGridSpendUsd: 2400 }, null), null);
  assert.equal(
    purchasePaths({ annualGridSpendUsd: 2400 }, { ...SYS, solvable: false }),
    null,
  );
  for (const bad of [undefined, null, NaN, Infinity, "2400", {}]) {
    assert.equal(
      purchasePaths({ annualGridSpendUsd: bad }, SYS),
      null,
      `baseline ${String(bad)} must refuse to price`,
    );
  }
  assert.equal(calls.length, 0, "nothing priced, so nothing cached as priced");
});

test("rerun: purchasePaths prices once per input key and caches the honest result", () => {
  const { purchasePaths, calls, sandbox } = purchasePathsHarness();
  const p = { annualGridSpendUsd: 2400, tariff: 0.3 };
  const first = purchasePaths(p, SYS);
  const second = purchasePaths(p, SYS);
  assert.equal(first.priced, true);
  assert.equal(second, first, "same key returns the cached object");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].c.country, "us");
  assert.equal(calls[0].c.instrument, "ppa");
  // A changed baseline is a different key: re-priced, not served stale.
  purchasePaths({ ...p, annualGridSpendUsd: 1800 }, SYS);
  assert.equal(calls.length, 2);
  assert.ok(sandbox.pathsCache.key.includes("1800"));
});

// ── CAR #197 named site: `band`'s formatter cannot fabricate a price ───────

function moneyHarness() {
  const sandbox = { fxActive: () => null, CURRENCIES: {} };
  vm.createContext(sandbox);
  vm.runInContext(`${MONEY}\nthis.money = money;`, sandbox);
  return sandbox.money;
}

test("rerun: money renders an explicit unknown marker, never a plausible price", () => {
  // `band` (inside turnkeyQuoteText) feeds year0 values straight to money();
  // the whole needs-human-look question was whether a missing year0 could
  // surface as a price. It cannot: every non-finite input renders "–".
  const money = moneyHarness();
  for (const bad of [undefined, NaN, Infinity, -Infinity, "x", {}]) {
    assert.equal(money(bad), "–", `money(${String(bad)}) must render "–"`);
  }
  // null is the one exception, and it is pinned here on purpose: Number(null)
  // coerces to 0, so a null amount renders "$0". That is the shipped coercion
  // every other Number() call in the codebase shares — recorded so a future
  // change to it fails loudly instead of sliding by.
  assert.equal(money(null), "$0");
  assert.match(money(1234.5), /^\$[\d,.]+$/);
});

// ── CAR #201 named gap: markerOffCurveNote ─────────────────────────────────

const frontierSrc = readFileSync("assets/js/sizing/frontier-chart.js", "utf8");
const MARKER_NOTE = stripExport(fnBlock(frontierSrc, "markerOffCurveNote"));

function markerNote(frontier, t) {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(
    `${MARKER_NOTE}\nthis.markerOffCurveNote = markerOffCurveNote;`,
    sandbox,
  );
  return sandbox.markerOffCurveNote(frontier, t ? { t } : {});
}

test("rerun: markerOffCurveNote stays silent without a marker and speaks when the pick is off-curve", () => {
  assert.equal(markerNote(null), "");
  assert.equal(markerNote({ points: [], marker: null }), "");
  assert.equal(
    markerNote({
      points: [{ capexUsd: 10000, outcomePct: 80 }],
      marker: { capexUsd: NaN, outcomePct: 80 },
    }),
    "",
  );
  // A strictly cheaper point at equal-or-better coverage: the note fires.
  const note = markerNote({
    points: [{ capexUsd: 9000, outcomePct: 82 }],
    marker: { capexUsd: 12000, outcomePct: 80 },
  });
  assert.equal(note, "frontierMarkerOffCurve");
});

// ── CAR #201 named gaps: the tiny helpers ──────────────────────────────────

test("rerun: el builds elements with attrs, class and text", () => {
  const made = [];
  globalThis.document = {
    createElement(tag) {
      const node = {
        tag,
        style: {},
        className: "",
        textContent: "",
        attrs: {},
        setAttribute(k, v) {
          this.attrs[k] = v;
        },
      };
      made.push(node);
      return node;
    },
  };
  try {
    const node = el(
      "div",
      { id: "x", class: "card", style: "color:red", "data-k": "1" },
      "hello",
    );
    assert.equal(node.tag, "div");
    assert.equal(node.attrs.id, "x");
    assert.equal(node.attrs["data-k"], "1");
    assert.equal(node.className, "card");
    assert.equal(node.style.cssText, "color:red");
    assert.equal(node.textContent, "hello");
    const bare = el("span");
    assert.equal(bare.textContent, "", "no text passed, no text set");
  } finally {
    delete globalThis.document;
  }
});

test("rerun: modeLabel names both modes", () => {
  assert.equal(modeLabel(true), "Simple mode");
  assert.equal(modeLabel(false), "Technical mode");
});

test("rerun: verdictKeys enumerates the use-case verdict keys deterministically", () => {
  const keys = verdictKeys();
  assert.ok(Array.isArray(keys) && keys.length > 0);
  assert.ok(keys.every((k) => typeof k === "string"));
  assert.deepEqual(verdictKeys(), keys);
});

test("rerun: usStateCode canonicalizes codes and names, refuses the rest", () => {
  assert.equal(usStateCode("la"), "LA");
  assert.equal(usStateCode("LA"), "LA");
  assert.equal(usStateCode("  Louisiana "), "LA");
  assert.equal(usStateCode("ZZ"), null);
  assert.equal(usStateCode(""), null);
  assert.equal(usStateCode(null), null);
  assert.equal(usStateCode("Not A State"), null);
});

// ── CAR #197 named site: runSizing's message boundary ──────────────────────

test("rerun: runSizing rejects malformed messages before they size anything", async () => {
  for (const bad of [null, undefined, 42, "hi", [], [1, 2]]) {
    await assert.rejects(
      () => runSizing(bad),
      /msg must be an object/,
      `runSizing(${JSON.stringify(bad)}) must reject`,
    );
  }
});
