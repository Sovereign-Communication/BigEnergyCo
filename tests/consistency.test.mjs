// Consistency: the recommendation card, the curve's blue dot + data table,
// and the bill/cut sliders must always name the SAME battery.
// Regressions covered:
//   1. best follows the bill-cut slider on full runs (a bill edit used to snap
//      the recommendation back to the fixed 80% column).
//   2. the frontier curve is drawn in the recommended chemistry and its marker
//      carries the recommendation's exact hardware.
//   3. weather for one site loads exactly once per session no matter how many
//      bill/cut edits and quiet refines follow.
//   4. the accessible data table tags a row as selected only when it really is
//      the marker's system (same hardware, same chemistry).
// Run: node --test tests/consistency.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  runSizing,
  clearSiteMemo,
  siteMemoKey,
  WEATHER_MEMO_STATS,
} from "../assets/js/sizing/run.js";
import { markerMatchesPoint, renderFrontierTable } from "../assets/js/sizing/frontier-chart.js";
import { rescalePayload, oversizeCallout } from "../assets/js/sizing/rescale.js";
import { synthesizeFromProfile } from "../assets/js/sizing/nasa.js";
import {
  OFFLINE_PROFILES,
  PROFILE_YEAR,
} from "../assets/js/sizing/profiles.js";

const honolulu = OFFLINE_PROFILES.find((p) => p.name.includes("Honolulu"));
const fakeWeather = async () => ({
  hours: synthesizeFromProfile(honolulu),
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
  dailyKwh: 10,
  tariff: 0.42,
  exportRate: null,
  years: 1,
};

test("CONSISTENCY: grid-tie AUTO recommendation follows the bill-cut slider", async () => {
  const p60 = await runSizing(
    { ...MSG, chemistry: "auto", mode: "gridtie", customCut: 0.6 },
    { fetchWeather: fakeWeather },
  );
  assert.ok(p60.customCut.best, "slider target solves for a chemistry");
  for (const k of ["chemistry", "pvKw", "battKwh", "lifetimeCostMid"]) {
    assert.equal(
      p60.best[k],
      p60.customCut.best[k],
      `best.${k} is the slider-target winner, not the fixed 80% column`,
    );
  }
  assert.equal(p60.focus.chemistry, p60.best.chemistry);
  assert.equal(p60.focus.pvKw, p60.best.pvKw);
  assert.equal(p60.focus.battKwh, p60.best.battKwh);

  // Default slider position agrees with the fixed 80% column winner.
  const p80 = await runSizing(
    { ...MSG, chemistry: "auto", mode: "gridtie", customCut: 0.8 },
    { fetchWeather: fakeWeather },
  );
  const cheapest80 = p80.auto
    .filter((a) => a.solvable)
    .reduce((a, b) => (a.lifetimeCostMid <= b.lifetimeCostMid ? a : b));
  assert.equal(p80.best.chemistry, cheapest80.chemistry);
  assert.equal(p80.best.pvKw, cheapest80.pvKw);
  assert.equal(p80.best.battKwh, cheapest80.battKwh);
});

test("CONSISTENCY: curve chemistry and marker match the recommendation", async () => {
  for (const mode of ["gridtie", "offgrid"]) {
    const p = await runSizing(
      { ...MSG, chemistry: "auto", mode, customCut: 0.6 },
      { fetchWeather: fakeWeather },
    );
    if (!p.best) continue;
    assert.equal(
      p.frontier.chemistry,
      p.best.chemistry,
      `${mode}: curve drawn in the recommended chemistry`,
    );
    const m = p.frontier.marker;
    assert.ok(m, `${mode}: marker present`);
    assert.equal(m.chemistry, p.best.chemistry, `${mode}: marker chemistry`);
    assert.equal(m.pvKw, p.best.pvKw, `${mode}: marker PV`);
    assert.equal(m.battKwh, p.best.battKwh, `${mode}: marker battery`);
    for (const pt of p.frontier.points) {
      assert.equal(
        pt.detail.chemistry,
        p.best.chemistry,
        `${mode}: every curve point is the recommended battery`,
      );
    }
    // The blue dot floats at the marker's TRUE position when the
    // lifetime-optimal recommendation sits between capex-lattice points, so
    // the readout always names the card's exact system. The table may only
    // tag the nearest-cost row when it really is that system — never by
    // cost proximity alone.
    const host = {};
    renderFrontierTable(host, p.frontier, {});
    const tagged = (host.innerHTML.match(/<b>/g) || []).length;
    const match = markerMatchesPoint(
      m,
      p.frontier.points[m.pointIndex],
      p.frontier.chemistry,
    );
    if (match) {
      assert.equal(tagged, 1, `${mode}: the marker's row is tagged`);
      assert.ok(
        host.innerHTML.includes(`<td>${m.pvKw} kW</td>`),
        `${mode}: tagged row names the recommended PV`,
      );
    } else {
      assert.equal(
        tagged,
        0,
        `${mode}: no row tagged when the recommendation sits off the lattice`,
      );
    }
  }
});

test("CONSISTENCY: rescale preserves marker identity for the refine", async () => {
  const p = await runSizing(
    { ...MSG, chemistry: "auto", mode: "gridtie", customCut: 0.8 },
    { fetchWeather: fakeWeather },
  );
  assert.ok(p.frontier?.marker, "marker present before rescale");
  const r = rescalePayload(p, 1.5);
  assert.equal(r.frontier.marker.chemistry, p.frontier.marker.chemistry);
  assert.equal(r.frontier.marker.pvKw, Math.round(p.frontier.marker.pvKw * 1.5 * 100) / 100);
  assert.equal(r.frontier.marker.battKwh, Math.round(p.frontier.marker.battKwh * 1.5));
  assert.equal(r.best.chemistry, p.best.chemistry);
});

// One site = one weather load per session. Stubs the NASA endpoint itself so
// the count covers every layer (session memo, worker cache, disk cache).
function stubPowerFetch(counter) {
  const dayMs = 24 * 3600 * 1000;
  return async (url) => {
    counter.n++;
    const m = String(url).match(/start=(\d{8})&end=(\d{8})/);
    assert.ok(m, `chunked POWER url: ${url}`);
    const d = (s) =>
      Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
    const ghi = {};
    const t2m = {};
    for (let t = d(m[1]); t < d(m[2]) + dayMs; t += 3600 * 1000) {
      const dt = new Date(t);
      const key =
        `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, "0")}` +
        `${String(dt.getUTCDate()).padStart(2, "0")}${String(dt.getUTCHours()).padStart(2, "0")}`;
      const h = dt.getUTCHours();
      ghi[key] = h >= 6 && h <= 18 ? 650 : 0;
      t2m[key] = 26;
    }
    return {
      ok: true,
      json: async () => ({
        properties: { parameter: { ALLSKY_SFC_SW_DWN: ghi, T2M: t2m } },
      }),
    };
  };
}

test("CONSISTENCY: one site loads weather exactly once per session", async () => {
  const realFetch = globalThis.fetch;
  const counter = { n: 0 };
  globalThis.fetch = stubPowerFetch(counter);
  try {
    clearSiteMemo();
    assert.equal(
      siteMemoKey(21.3100001, -157.8599999, 1),
      siteMemoKey(21.31, -157.86, 1),
      "coordinate float dust shares one session key",
    );
    const base = {
      latitude: 21.31,
      longitude: -157.86,
      dailyKwh: 8,
      tariff: 0.3,
      chemistry: "auto",
      mode: "gridtie",
      customCut: 0.8,
      years: 1,
    };
    await runSizing(base); // miss: exactly 1 chunk load for 1 year
    await runSizing({ ...base, dailyKwh: 14 }); // bill edit: memo hit
    await runSizing({
      ...base,
      dailyKwh: 14,
      customCut: 0.7,
      incrementalCut: true,
    }); // cut edit: memo hit
    assert.equal(counter.n, 1, `1 chunk load total, got ${counter.n}`);
    assert.equal(WEATHER_MEMO_STATS.misses, 1);
    assert.equal(WEATHER_MEMO_STATS.hits, 2);
    await runSizing({ ...base, latitude: 40.71, longitude: -74.01 });
    assert.equal(WEATHER_MEMO_STATS.misses, 2, "new site loads once");
    assert.equal(counter.n, 2);
  } finally {
    globalThis.fetch = realFetch;
    clearSiteMemo();
  }
});

test("CONSISTENCY: markerMatchesPoint gates the selected table tag", async () => {
  const pt = { pvKw: 4.2, battKwh: 9 };
  assert.equal(
    markerMatchesPoint({ pvKw: 4.2, battKwh: 9, chemistry: "lfp" }, pt, "lfp"),
    true,
  );
  assert.equal(
    markerMatchesPoint({ pvKw: 4.3, battKwh: 9, chemistry: "lfp" }, pt, "lfp"),
    false,
    "PV outside tolerance",
  );
  assert.equal(
    markerMatchesPoint({ pvKw: 4.2, battKwh: 10, chemistry: "lfp" }, pt, "lfp"),
    false,
    "battery outside tolerance",
  );
  assert.equal(
    markerMatchesPoint({ pvKw: 4.2, battKwh: 9, chemistry: "naion" }, pt, "lfp"),
    false,
    "chemistry mismatch never tags",
  );
  assert.equal(
    markerMatchesPoint({ pvKw: 4.2, battKwh: 9 }, pt, "lfp"),
    true,
    "legacy marker without chemistry still matches hardware",
  );
  assert.equal(markerMatchesPoint(null, pt, "lfp"), false);
  assert.equal(
    markerMatchesPoint({ pvKw: 4.2, battKwh: 9 }, null, "lfp"),
    false,
  );
});

// ── Oversize unification ──────────────────────────────────────────────────
// The reported bug: a system modal showed "Battery (usable) 5 kWh" with
// "~2x swaps" under a note claiming "This system uses an oversized battery
// (12 kWh) to avoid replacements". The note advertised a bank the card
// didn't show. Invariant, everywhere a money entry can surface (cards,
// columns, cells, targets, curve-point details, focus systems, modals):
//   swaps > 0  ⇒  scenario is never oversized_cheaper
//   scenario == oversized_cheaper  ⇒  0 swaps AND the shown bank IS the
//   note's bank (battKwh === oversizedBattKwh, named in the prose).
const london = OFFLINE_PROFILES.find((p) => p.name.includes("London"));
const londonWeather = async () => ({
  hours: synthesizeFromProfile(london),
  meta: {
    latitude: 59.9,
    longitude: 10.75,
    startYear: PROFILE_YEAR,
    endYear: PROFILE_YEAR,
    years: 1,
    source: "test fixture",
    offline: true,
  },
});

function moneyEntries(p) {
  const out = [];
  const take = (label, e) => {
    if (e && e.solvable !== false && Number.isFinite(e.battKwh)) {
      out.push([label, e]);
    }
  };
  take("best", p.best);
  for (const e of p.auto || []) take(`auto:${e.chemistry}`, e);
  for (const e of (p.customCut && p.customCut.entries) || [])
    take(`custom:${e.chemistry}`, e);
  take("customCut.best", p.customCut && p.customCut.best);
  for (const [k, e] of Object.entries((p.matrix && p.matrix.cells) || {}))
    take(`cell:${k}`, e);
  for (const e of p.targets || []) take(`target:${e.id}`, e);
  take("customTarget", p.customTarget);
  for (const pt of (p.frontier && p.frontier.points) || [])
    take(`point:${pt.pvKw}+${pt.battKwh}`, pt.detail);
  take("focusSystem", p.focusSystem);
  return out;
}

function assertOversizeUnified(entries) {
  assert.ok(entries.length > 0, "payload must surface money entries");
  for (const [label, e] of entries) {
    if (e.replacementsHorizon > 0) {
      assert.notEqual(
        e.oversizeScenario,
        "oversized_cheaper",
        `${label}: ${e.replacementsHorizon} swaps under note "${e.bestPriceCallout}"`,
      );
    }
    if (e.oversizeScenario === "oversized_cheaper") {
      assert.equal(
        e.replacementsHorizon,
        0,
        `${label}: oversized note with swaps still showing`,
      );
      assert.equal(
        e.battKwh,
        e.oversizedBattKwh,
        `${label}: shown ${e.battKwh} kWh but note names ${e.oversizedBattKwh} kWh`,
      );
      assert.ok(
        typeof e.bestPriceCallout === "string" &&
          e.bestPriceCallout.includes(`(${e.battKwh} kWh)`),
        `${label}: note must name the shown bank`,
      );
    }
  }
}

test("CONSISTENCY: no money entry pairs swaps with an oversized note", async () => {
  const cfgs = [
    {
      ...MSG,
      dailyKwh: 54,
      tariff: 0.15,
      mode: "gridtie",
      chemistry: "auto",
      customCut: 0.82,
    },
    { ...MSG, mode: "gridtie", chemistry: "auto", customCut: 0.8 },
    { ...MSG, mode: "gridtie", chemistry: "lfp", dailyKwh: 30, customCut: 0.95 },
    {
      latitude: 59.9,
      longitude: 10.75,
      dailyKwh: 25,
      tariff: 0.3,
      exportRate: null,
      years: 1,
      mode: "offgrid",
      chemistry: "auto",
    },
  ];
  for (const [i, cfg] of cfgs.entries()) {
    const p = await runSizing(
      cfg,
      { fetchWeather: cfg.latitude === 59.9 ? londonWeather : fakeWeather },
    );
    assertOversizeUnified(moneyEntries(p));
  }
});

test("CONSISTENCY: oversizeCallout templates stay byte-identical", () => {
  assert.equal(
    oversizeCallout("oversized_cheaper", { battKwh: 12, savingsUsd: 544 }),
    "This system uses an oversized battery (12 kWh) to avoid replacements, giving you the lowest 20-year cost — saving ~$544 vs. smaller banks with swaps.",
  );
  assert.equal(
    oversizeCallout("swaps_cheaper", { replacements: 2, savingsUsd: 1813 }),
    "Best 20-year price: standard sizing with 2 replacement(s) is ~$1,813 cheaper over 20 years than paying upfront to oversize.",
  );
  assert.equal(oversizeCallout("swaps_cheaper", {}), null);
  assert.equal(oversizeCallout("zero_swap_natural", {}), null);
});

test("CONSISTENCY: rescale regenerates the scenario note from scaled parts", () => {
  const entry = {
    solvable: true,
    chemistry: "lfp",
    chemLabel: "LFP",
    pvKw: 4,
    battKwh: 5,
    battNameplateKwh: 5.6,
    costLo: 2000,
    costHi: 7000,
    replacementsHorizon: 0,
    lifetimeCostMid: 5000,
    oversizeScenario: "oversized_cheaper",
    oversizedBattKwh: 12,
    oversizeSavingsUsd: 544,
    bestPriceCallout: oversizeCallout("oversized_cheaper", {
      battKwh: 12,
      savingsUsd: 544,
    }),
  };
  const r = rescalePayload({ annualGridSpendUsd: 1000, best: entry }, 2);
  assert.equal(r.best.battKwh, 10);
  assert.equal(r.best.oversizedBattKwh, 24);
  assert.equal(r.best.oversizeSavingsUsd, 1088);
  assert.ok(
    r.best.bestPriceCallout.includes("(24 kWh)"),
    "note names the scaled bank",
  );
  assert.ok(r.best.bestPriceCallout.includes("$1,088"), "note scales the $");

  // $-claiming swaps notes scale too; number-free notes stay byte-identical.
  const swaps = {
    ...entry,
    battKwh: 5,
    replacementsHorizon: 2,
    oversizeScenario: "swaps_cheaper",
    oversizedBattKwh: 12,
    oversizeSavingsUsd: 544,
    bestPriceCallout: oversizeCallout("swaps_cheaper", {
      replacements: 2,
      savingsUsd: 544,
    }),
  };
  const r2 = rescalePayload({ annualGridSpendUsd: 1000, best: swaps }, 2);
  assert.ok(r2.best.bestPriceCallout.includes("$1,088"));
  assert.ok(r2.best.bestPriceCallout.includes("2 replacement(s)"));
  const plain = { ...swaps, oversizeSavingsUsd: 0, bestPriceCallout: "Best 20-year price: standard sizing with battery replacements is the practical pick." };
  const r3 = rescalePayload({ annualGridSpendUsd: 1000, best: plain }, 2);
  assert.equal(
    r3.best.bestPriceCallout,
    plain.bestPriceCallout,
    "number-free notes untouched",
  );
});

// ── Solar-only edge audit ─────────────────────────────────────────────────
// Same root cause family as the oversize note: physics the metric ignores.
// The cut metric used to count imports only, so solar-only stalled at the
// daytime fraction even with 1:1 net metering entered, and its monthly bill
// ignored the credit it already credited in the cumulative chart.
test("SOLAR-EDGE: 1:1 credits let solar-only zero the bill", async () => {
  const p = await runSizing(
    {
      ...MSG,
      mode: "gridtie",
      chemistry: "auto",
      hardwareConfig: "solar",
      tariff: 0.42,
      exportRate: 0.42,
      customCut: 1.0,
    },
    { fetchWeather: fakeWeather },
  );
  // With a credit, solar-only runs the standard targets, not daytime caps.
  assert.ok(
    p.matrix.cols.some((c) => c.id === "cut80"),
    "standard targets with export",
  );
  assert.ok(
    !p.matrix.cols.some((c) => c.id === "cut30"),
    "no daytime cap with export",
  );
  const best = p.customCut.best;
  assert.ok(best, "solar-only reaches 100% at 1:1");
  assert.equal(best.battKwh, 0, "still no battery");
  assert.ok(best.cutPct >= 99, `net-metered cut ${best.cutPct}% zeroes it`);
  assert.ok(
    best.billAfterMonthlyUsd <= 0,
    `net monthly bill ${best.billAfterMonthlyUsd} is ~zero, not gross imports`,
  );
  assertOversizeUnified(moneyEntries(p));
});

test("SOLAR-EDGE: no-export solar-only honestly caps below storage territory", async () => {
  const p = await runSizing(
    {
      ...MSG,
      mode: "gridtie",
      chemistry: "auto",
      hardwareConfig: "solar",
      tariff: 0.42,
      exportRate: null,
      customCut: 0.8,
    },
    { fetchWeather: fakeWeather },
  );
  assert.ok(
    p.matrix.cols.some((c) => c.id === "cut30"),
    "daytime caps without export",
  );
  const best = p.customCut.best;
  assert.ok(
    !best || best.cutPct < 80,
    "cannot honestly hit 80% solar-only without storage or credits",
  );
  assertOversizeUnified(moneyEntries(p));
});

test("SOLAR-EDGE: offgrid solar-only is impossible and says why", async () => {
  const p = await runSizing(
    {
      ...MSG,
      mode: "offgrid",
      chemistry: "auto",
      hardwareConfig: "solar",
    },
    { fetchWeather: fakeWeather },
  );
  assert.equal(p.unreachableReason, "needs-battery");
  assert.equal(p.best, null);
  assert.ok(
    Object.values(p.matrix.cells).every(
      (c) => !c.solvable && c.reason === "needs-battery",
    ),
    "every cell names the structural reason",
  );
  assert.ok(
    p.frontier && p.frontier.points.length === 0,
    "no curve where nothing can build",
  );
});

test("SOLAR-EDGE: hardware×mode×credit edge matrix stays sane", async () => {
  const cfgs = [
    { mode: "offgrid", hardwareConfig: "both", chemistry: "auto" },
    {
      mode: "gridtie",
      hardwareConfig: "battery",
      chemistry: "auto",
      customCut: 0.15,
    },
    {
      mode: "gridtie",
      hardwareConfig: "battery",
      chemistry: "auto",
      customCut: 1.05,
      exportRate: null,
    },
    {
      mode: "gridtie",
      hardwareConfig: "solar",
      chemistry: "lfp",
      exportRate: 0.21,
      customCut: 0.8,
    },
    {
      mode: "offgrid",
      hardwareConfig: "battery",
      chemistry: "auto",
    },
  ];
  for (const cfg of cfgs) {
    const p = await runSizing(
      { ...MSG, tariff: 0.42, ...cfg },
      { fetchWeather: fakeWeather },
    );
    assert.equal(p.contract, 13, `${cfg.hardwareConfig}/${cfg.mode} contract`);
    assert.ok(p.frontier, "frontier field always present");
    const entries = moneyEntries(p);
    if (!entries.length) {
      // Structurally impossible combos surface nothing — but must say why.
      assert.ok(
        p.unreachableReason,
        `${cfg.hardwareConfig}/${cfg.mode}: impossibility explained`,
      );
    } else {
      assertOversizeUnified(entries);
    }
  }
  // Battery-only surplus without panels is structurally impossible.
  const p = await runSizing(
    {
      ...MSG,
      tariff: 0.42,
      mode: "gridtie",
      hardwareConfig: "battery",
      chemistry: "auto",
      customCut: 1.05,
      exportRate: null,
    },
    { fetchWeather: fakeWeather },
  );
  assert.equal(p.unreachableReason, "needs-pv-surplus");
  assert.equal(p.customCut.best, null);
});
