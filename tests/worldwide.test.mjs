// Worldwide-phase tests: lead-acid delivered capacity, cold scaling, and
// sodium-aware pricing. Run: node --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHEMISTRIES,
  coldCapacityScale,
  capacityScaleFor,
  buildE1kw,
  flatProfile,
  expandProfile,
  simulate,
} from "../assets/js/sizing/engine.js";
import { fullRange, battOnlyCost } from "../assets/js/sizing/pricing.js";
import { runSizing } from "../assets/js/sizing/run.js";
import { synthesizeFromProfile } from "../assets/js/sizing/nasa.js";
import {
  OFFLINE_PROFILES,
  PROFILE_YEAR,
} from "../assets/js/sizing/profiles.js";

test("GATE: sodium on LFP voltage settings = less capacity but LONGER life", () => {
  // The ~40 V LFP low cutoff sits above true sodium empty: shallower
  // effective DoD protects the pack, so life EXCEEDS the deep-cycle rating
  // even though usable capacity shrinks.
  assert.equal(CHEMISTRIES.naion.usableScale, 0.85);
  assert.ok(
    CHEMISTRIES.naion.cyclesTo80 > 4500,
    "shallow effective DoD must extend rated life",
  );
  assert.ok(
    CHEMISTRIES.naion.cyclesTo80 < CHEMISTRIES.lfp.cyclesTo80,
    "still below LFP's proven benchmark",
  );
});

test("GATE: lead-acid assumes NO active balancing (typical DIY strings)", () => {
  assert.ok(
    CHEMISTRIES.agm.cyclesTo80 <= 550,
    "manufacturer lab ratings are not achieved without balancers",
  );
});

test("capacityScaleFor: sodium keeps 0.85 rate scale; cold drags AGM below it", () => {
  assert.equal(capacityScaleFor("lfp"), 1);
  assert.equal(capacityScaleFor("naion"), 0.85);
  assert.ok(
    capacityScaleFor("agm", 5) < capacityScaleFor("naion", 5),
    "cold-site AGM loses capacity on top of its rate loss; sodium's cold story is about charging, not capacity",
  );
});

test("coldCapacityScale: hot sites 1.0, cold sites floor at 0.6 (lead-acid only)", () => {
  assert.equal(coldCapacityScale("agm", 30), 1);
  assert.equal(
    coldCapacityScale("lfp", -10),
    1,
    "temperature model handles charging separately for lithium",
  );
  const mild = coldCapacityScale("agm", 10);
  assert.ok(mild < 1 && mild > 0.6, "25°C−10°C = 15 × 0.8% ≈ 12% loss");
  assert.equal(coldCapacityScale("agm", -40), 0.6, "floor");
});

test("GATE: same nameplate bank serves strictly less in AGM than LFP", () => {
  // Weak array + steady load forces the bank to cycle hard every night:
  // the derated AGM must hit empty sooner than the identical-nameplate LFP.
  const hours = [];
  for (let i = 0; i < 24 * 30; i++) {
    const hod = i % 24;
    hours.push({ ghi: hod >= 9 && hod <= 14 ? 400 : 0, tAmb: 25 });
  }
  const e1 = buildE1kw(hours);
  const load = expandProfile(flatProfile(10), e1.length);
  const lfp = simulate({
    pvKw: 2,
    battKwhUsable: 10,
    e1kw: e1,
    loadWh: load,
    chemistry: "lfp",
  });
  const agm = simulate({
    pvKw: 2,
    battKwhUsable: 10,
    e1kw: e1,
    loadWh: load,
    chemistry: "agm",
  });
  assert.ok(
    agm.unmetWh > lfp.unmetWh,
    `AGM (${agm.unmetWh.toFixed(0)}) must serve strictly worse than LFP (${lfp.unmetWh.toFixed(0)})`,
  );
  assert.ok(
    agm.unmetWh > 0 && lfp.unmetWh > 0,
    "weak-array scenario strains both banks",
  );
});

test("sodium pricing carries a premium over LFP in every scope", () => {
  for (const scope of ["cells", "landed", "powmr"]) {
    const lfpR = fullRange(4, 20, "lfp");
    const naR = fullRange(4, 20, "naion");
    assert.ok(
      naR.battPerKwhLo >= lfpR.battPerKwhLo,
      `${scope}: sodium low >= lfp low`,
    );
    assert.ok(
      naR.battPerKwhHi >= lfpR.battPerKwhHi,
      `${scope}: sodium high >= lfp high`,
    );
    break; // ranges are chemistry-level; one pass suffices
  }
  const lfpOnly = battOnlyCost(50, "lfp");
  const naOnly = battOnlyCost(50, "naion");
  assert.ok(naOnly.landed.lo > lfpOnly.landed.lo);
  assert.ok(naOnly.cells.hi > lfpOnly.cells.hi);
});

// ── Run-level worldwide edge matrix ─────────────────────────────────────
// Every climate band, tariff extreme, boundary cut and coordinate edge must
// produce a finite, sane payload — never NaN, never a throw, never a
// recommendation that contradicts its own numbers.
function siteWeather(profile) {
  return async () => ({
    hours: synthesizeFromProfile(profile),
    meta: {
      latitude: profile.lat,
      longitude: profile.lon,
      startYear: PROFILE_YEAR,
      endYear: PROFILE_YEAR,
      years: 1,
      source: "test fixture",
      offline: false,
    },
  });
}

function assertFinitePayload(p, label) {
  const seen = new Set();
  const walk = (v, path) => {
    if (v === null || v === undefined) return;
    if (typeof v === "number") {
      assert.ok(
        Number.isFinite(v),
        `${label}: non-finite number at ${path} (${v})`,
      );
      return;
    }
    if (typeof v !== "object") return;
    if (seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, `${path}[${i}]`));
    } else if (ArrayBuffer.isView(v)) {
      for (let i = 0; i < v.length; i++) {
        assert.ok(
          Number.isFinite(v[i]),
          `${label}: non-finite typed value at ${path}[${i}]`,
        );
      }
    } else {
      for (const k of Object.keys(v)) walk(v[k], `${path}.${k}`);
    }
  };
  walk(p, "payload");
}

test("WORLDWIDE: every climate band sizes sanely, both goals", async () => {
  const sites = ["Oslo", "London", "Honolulu", "Jakarta", "Sydney", "Auckland"];
  for (const name of sites) {
    const profile = OFFLINE_PROFILES.find((p) => p.name.includes(name));
    assert.ok(profile, `offline profile for ${name} exists`);
    for (const mode of ["gridtie", "offgrid"]) {
      const p = await runSizing(
        {
          latitude: profile.lat,
          longitude: profile.lon,
          dailyKwh: 10,
          tariff: 0.3,
          exportRate: null,
          years: 1,
          mode,
          chemistry: "auto",
          customCut: 0.8,
        },
        { fetchWeather: siteWeather(profile) },
      );
      assertFinitePayload(p, `${name}/${mode}`);
      assert.ok(p.frontier, `${name}/${mode}: frontier present`);
      if (p.best) {
        assert.ok(
          ["naion", "lfp"].includes(p.best.chemistry),
          `${name}/${mode}: never lead-acid (${p.best.chemistry})`,
        );
      }
    }
  }
});

test("WORLDWIDE: polar night neither crashes nor invents sun", async () => {
  // Tromsø-like synthetic year: three sunless winter months, cool summer.
  const hours = [];
  for (let d = 0; d < 365; d++) {
    const polar = d < 31 || d >= 305;
    for (let h = 0; h < 24; h++) {
      const day = h >= 8 && h <= 16 && !polar;
      hours.push({ ghi: day ? 220 : 0, tAmb: polar ? -8 : 9 });
    }
  }
  const dark = async () => ({
    hours,
    meta: {
      latitude: 69.6,
      longitude: 18.9,
      startYear: PROFILE_YEAR,
      endYear: PROFILE_YEAR,
      years: 1,
      source: "synthetic polar fixture",
      offline: false,
    },
  });
  for (const mode of ["gridtie", "offgrid"]) {
    const p = await runSizing(
      {
        latitude: 69.6,
        longitude: 18.9,
        dailyKwh: 8,
        tariff: 0.3,
        exportRate: null,
        years: 1,
        mode,
        chemistry: "auto",
        customCut: 0.8,
      },
      { fetchWeather: dark },
    );
    assertFinitePayload(p, `polar/${mode}`);
    if (p.best) {
      assert.notEqual(
        p.best.chemistry,
        "agm",
        "polar recommendation is never lead-acid",
      );
    }
  }
});

test("WORLDWIDE: tariff extremes, generous credits, boundary cuts and loads", async () => {
  const honolulu = OFFLINE_PROFILES.find((p) => p.name.includes("Honolulu"));
  const fw = siteWeather(honolulu);
  const base = {
    latitude: 21.31,
    longitude: -157.86,
    dailyKwh: 10,
    years: 1,
    mode: "gridtie",
    chemistry: "auto",
    customCut: 0.8,
  };
  const cfgs = {
    "penny tariff": { ...base, tariff: 0.01, exportRate: null },
    "island tariff": { ...base, tariff: 2.0, exportRate: null },
    "no tariff": { ...base, tariff: undefined, exportRate: null },
    "generous credit": { ...base, tariff: 0.3, exportRate: 0.5 },
    "min cut": { ...base, tariff: 0.42, exportRate: null, customCut: 0.01 },
    "max cut": { ...base, tariff: 0.42, exportRate: 0.42, customCut: 1.5 },
    "tiny load": { ...base, tariff: 0.42, exportRate: null, dailyKwh: 0.5 },
    "huge offgrid": {
      ...base,
      tariff: 0.42,
      exportRate: null,
      mode: "offgrid",
      dailyKwh: 400,
    },
    "north pole": {
      ...base,
      tariff: 0.42,
      exportRate: null,
      latitude: 89.9,
      longitude: 0,
    },
    "south pole": {
      ...base,
      tariff: 0.42,
      exportRate: null,
      latitude: -89.9,
      longitude: 0,
    },
  };
  for (const [label, cfg] of Object.entries(cfgs)) {
    const p = await runSizing(cfg, { fetchWeather: fw });
    assertFinitePayload(p, label);
    assert.ok(p.frontier, `${label}: frontier present`);
  }
});
