// Performance budget gates (Phase 0 of the responsiveness plan).
//
// Two layers:
//   1. HARD SIZE BUDGETS — the eager first-load payload must stay lean.
//      ui.js is 298 KB today; without a gate it grows silently forever.
//      profiles.js is deliberately EXCLUDED: it is only dynamically
//      imported on the offline-fallback path and never blocks first load.
//   2. RESPONSIVENESS CONTRACTS — the warm-path behavior that makes the
//      tool feel instant must not regress:
//        - prefetchSiteWeather warms the site memo so the subsequent run
//          counts a memo HIT and performs ZERO additional chunk fetches.
//        - an identical repeat run replays the cached payload instantly
//          (same object identity), regardless of worker seq/epoch noise.
//
// All functional tests are hermetic: global fetch is stubbed, no network.
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// ── 1. Size budgets ────────────────────────────────────────────────────────

test("PERF-BUDGET: eager first-load payload stays within budget", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");
  const css = readFileSync(join(root, "assets/site.css"), "utf8");

  const sizingDir = join(root, "assets/js/sizing");
  const sharedDir = join(root, "assets/js/shared");
  const eagerSizing = [
    "ui.js",
    "run.js",
    "engine.js",
    "frontier.js",
    "frontier-chart.js",
    "nasa.js",
    "cities.js",
    "pricing.js",
    "money.js",
    "climate.js",
    "wizard.js",
    "appliances.js",
    "map-provider.js",
    "tilt-harvest.js",
    "rescale.js",
    "bom.js",
    "sizing-worker.js",
  ];
  const eagerShared = [
    "content.js",
    "locales.js",
    "escape.js",
    "jargon-dict.js",
    "i18n.js",
    "simple-mode.js",
  ];
  let jsBytes = 0;
  for (const name of [...eagerSizing, ...eagerShared]) {
    const base = eagerSizing.includes(name) ? sizingDir : sharedDir;
    jsBytes += readFileSync(join(base, name)).length;
  }

  const htmlBytes = Buffer.byteLength(html);
  const cssBytes = Buffer.byteLength(css);

  // Budgets = today's measured baseline plus a small, explicit headroom.
  // The eager graph is ~700 KB of source (the browser mostly serves it from
  // the immutable cache, so this is a parse-cost guard, not a download
  // guard). The point: growth must be a decision, never an accident.
  // History: 720,000 until Sep 2026, then 745,000 — the German locale parity
  // (~+10 KB of user-facing strings, no code) and modal focus isolation
  // (~+3 KB) were reviewed as worth it. 746,000 (+1 KB, same day): honest
  // split of area-limited vs envelope-limited infeasibility reasons.
  assert.ok(
    htmlBytes <= 125_000,
    `index.html ${htmlBytes} bytes exceeds 125,000 budget`,
  );
  assert.ok(
    cssBytes <= 40_000,
    `site.css ${cssBytes} bytes exceeds 40,000 budget`,
  );
  assert.ok(
    jsBytes <= 746_000,
    `eager JS ${jsBytes} bytes exceeds 745,000 budget — you added eager code; lazy-load it or raise the budget deliberately`,
  );
});

// ── 2. Warm-path contracts ────────────────────────────────────────────────

// Hourly NASA-shaped stub: one full year of hourly keys per chunk request.
function stubPowerFetch(counter) {
  return async (url) => {
    counter.n++;
    const start = Number(url.match(/start=(\d{8})/)[1]);
    const end = Number(url.match(/end=(\d{8})/)[1]);
    const ghi = {};
    const t2m = {};
    const d0 = new Date(
      Date.UTC(
        Math.floor(start / 10000),
        Math.floor((start % 10000) / 100) - 1,
        start % 100,
      ),
    );
    const d1 = new Date(
      Date.UTC(
        Math.floor(end / 10000),
        Math.floor((end % 10000) / 100) - 1,
        end % 100,
      ),
    );
    for (let t = d0.getTime(); t <= d1.getTime(); t += 3600_000) {
      const d = new Date(t);
      const key = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}${String(d.getUTCHours()).padStart(2, "0")}`;
      const hour = d.getUTCHours();
      ghi[key] = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI)) * 600;
      t2m[key] = 20;
    }
    return {
      ok: true,
      json: async () => ({
        properties: { parameter: { ALLSKY_SFC_SW_DWN: ghi, T2M: t2m } },
      }),
    };
  };
}

test("PERF-CONTRACT: prefetch warms the memo so the run fetches nothing", async () => {
  const { runSizing, prefetchSiteWeather, clearSiteMemo, WEATHER_MEMO_STATS } =
    await import("../assets/js/sizing/run.js");

  const realFetch = globalThis.fetch;
  const counter = { n: 0 };
  globalThis.fetch = stubPowerFetch(counter);
  try {
    clearSiteMemo();
    const pre = await prefetchSiteWeather(21.31, -157.86, 1);
    assert.equal(pre.hit, false, "first prefetch is a cache miss");
    assert.equal(counter.n, 1, "prefetch performs exactly one chunk load");
    assert.equal(WEATHER_MEMO_STATS.misses, 1);

    const msg = {
      latitude: 21.31,
      longitude: -157.86,
      dailyKwh: 8,
      tariff: 0.3,
      chemistry: "lfp",
      mode: "gridtie",
      customCut: 0.8,
      years: 1,
    };
    await runSizing(msg);
    assert.equal(counter.n, 1, "run after prefetch performs NO new fetches");
    assert.equal(WEATHER_MEMO_STATS.hits, 1, "run counts a memo hit");

    // Prefetching the same site again is a no-op hit.
    const again = await prefetchSiteWeather(21.31, -157.86, 1);
    assert.equal(again.hit, true, "second prefetch recognizes the warm memo");
    assert.equal(counter.n, 1);
  } finally {
    globalThis.fetch = realFetch;
    clearSiteMemo();
  }
});

test("PERF-CONTRACT: identical repeat run replays the cached payload", async () => {
  const { runSizing, clearSiteMemo, clearRunPayloadCache, RUN_PAYLOAD_CACHE } =
    await import("../assets/js/sizing/run.js");

  const realFetch = globalThis.fetch;
  const counter = { n: 0 };
  globalThis.fetch = stubPowerFetch(counter);
  try {
    clearSiteMemo();
    clearRunPayloadCache();
    const msg = {
      latitude: 40.71,
      longitude: -74.01,
      dailyKwh: 12,
      tariff: 0.3,
      chemistry: "lfp",
      mode: "gridtie",
      customCut: 0.8,
      years: 1,
    };
    const first = await runSizing(msg);
    const nAfterFirst = counter.n;

    // Worker-transport noise (type/seq/epoch) must not split cache keys.
    // Hits return a shallow copy stamped repeat:true (the UI's instant-badge
    // signal); the payload BODY must equal the fresh compute exactly, and a
    // fresh compute is never stamped.
    const repeat = await runSizing({ ...msg, type: "run", seq: 77, epoch: 9 });
    const { repeat: marker, ...repeatBody } = repeat;
    assert.deepEqual(
      repeatBody,
      first,
      "repeat replays the same payload values",
    );
    assert.equal(marker, true, "hit is stamped as a repeat");
    assert.equal(first.repeat, undefined, "fresh compute is not a repeat");
    assert.equal(RUN_PAYLOAD_CACHE.hits, 1);
    assert.equal(
      counter.n,
      nAfterFirst,
      "repeat performs no network or engine work",
    );

    // A changed input misses the slot and recomputes (weather still memoized).
    const changed = await runSizing({ ...msg, dailyKwh: 14 });
    assert.notEqual(changed, first);
    assert.equal(counter.n, nAfterFirst, "weather memo still serves the site");
    assert.equal(RUN_PAYLOAD_CACHE.hits, 1);

    // Clearing the cache forces a genuine recompute.
    clearRunPayloadCache();
    const recompute = await runSizing({ ...msg, dailyKwh: 14 });
    assert.notEqual(recompute, changed);
    assert.equal(RUN_PAYLOAD_CACHE.hits, 0);
  } finally {
    globalThis.fetch = realFetch;
    clearSiteMemo();
    clearRunPayloadCache();
  }
});

test("PERF-CONTRACT: injected test weather bypasses the payload cache", async () => {
  const { runSizing, clearRunPayloadCache, RUN_PAYLOAD_CACHE } =
    await import("../assets/js/sizing/run.js");
  clearRunPayloadCache();
  // Full-year hourly series (the engine's climate summary needs 12 months).
  const hours = [];
  for (let d = 0; d < 365; d++) {
    for (let h = 0; h < 24; h++) {
      hours.push({
        ghi: Math.max(0, Math.sin(((h - 6) / 12) * Math.PI)) * 550,
        tAmb: 20,
      });
    }
  }
  const fake = async () => ({
    hours,
    meta: { years: 1, startYear: 2024, endYear: 2024 },
  });
  const msg = {
    latitude: 1,
    longitude: 2,
    dailyKwh: 5,
    tariff: 0.3,
    chemistry: "lfp",
    mode: "gridtie",
    customCut: 0.8,
    years: 1,
  };
  const a = await runSizing(msg, { fetchWeather: fake });
  const b = await runSizing(msg, { fetchWeather: fake });
  assert.notEqual(a, b, "hermetic fixtures must never share cached payloads");
  assert.equal(RUN_PAYLOAD_CACHE.hits, 0);
  clearRunPayloadCache();
});
