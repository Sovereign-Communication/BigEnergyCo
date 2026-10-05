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
import { dirname, join, relative } from "node:path";

import { committedBytes } from "../scripts/lib/deploy-blobs.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// ── 1. Size budgets ────────────────────────────────────────────────────────

test("PERF-BUDGET: eager first-load payload stays within budget", () => {
  // Measured from the COMMITTED bytes — the ones the deploy staging builder now
  // copies. A budget is a claim about what ships, so it has to measure the
  // artifact that ships.
  //
  // This replaces a hand-rolled `.replace(/\r\n/g, "\n")` applied only to the JS.
  // That was a second, local normalization: it left index.html and site.css
  // raw, so a `core.autocrlf = true` checkout measured index.html at 125,266
  // bytes — 266 OVER this very budget — while CI measured the committed 121,825
  // and passed. The gate was not lying about the checkout; it was measuring the
  // CRLF working tree rather than the site. Reading the index fixes all three
  // files at once and leaves `.gitattributes` the single source of truth.
  const html = committedBytes(root, "index.html").toString("utf8");
  const css = committedBytes(root, "assets/site.css").toString("utf8");

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
    // The use-case registry. It was missing from this list when it was
    // written, which would have let a whole new eager module grow outside
    // the budget — the exact thing the budget exists to catch. It is eager
    // because both run.js and ui.js import it on first paint.
    "usecases.js",
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
    "simple-view.js",
    "cut-targets.js",
  ];
  let jsBytes = 0;
  for (const name of [...eagerSizing, ...eagerShared]) {
    const rel = relative(
      root,
      join(eagerSizing.includes(name) ? sizingDir : sharedDir, name),
    );
    // Committed bytes, so a CRLF checkout cannot measure ~20 KB larger than the
    // identical source on CI. No local newline pass is needed or wanted: the
    // index already holds the post-.gitattributes form.
    jsBytes += committedBytes(root, rel).length;
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
  // 758,000 (+12 KB): real Simple mode — the pure view model (simple-view.js),
  // its render path in ui.js, simple-mode strings in all six locales, and the
  // hide-scoping CSS. User-facing feature, reviewed deliberately.
  // 761,000 (+3 KB): cut-targets.js single-owner extraction (dedup of three
  // inline maps); net new bytes ≈ one module shell.
  // 778,000 (+17 KB): the cumulative-cost caption became translated copy.
  // It was an English-only string built in charts.js; enforcing "this system's
  // own cost" (not the SOLAR system's) on a panel-free run, and replacing the
  // claim that a NEGATIVE 20-year gap is money "back in your pocket", meant
  // routing its sentences through the dictionary — 14 keys in all six locales,
  // no code beyond a pure composer. Same trade as the German parity raise:
  // user-facing strings, reviewed deliberately.
  // 790,000 (+12 KB measured 786,390): the whole-surface sweep. Three more
  // dictionary keys x six locales (a panel-free Simple-mode explainer, a
  // battery-only curve method note, and the best-value range tail that was
  // glued onto translated verdicts as an English literal), plus one small
  // owner for the levelized-cost row and the reasoning that goes with each
  // fix. No new module, no new eager feature: strings and comments.
  // 803,000 (+13 KB measured 802,202): the degraded advisor reply became
  // translated copy. It was English-only prose shipped from the worker on the
  // exact surface that signals something went wrong, so a German or Arabic
  // visitor read the failure in the wrong language. Ten keys x six locales,
  // +123 lines in locales.js and -0: the same trade as every raise above, for
  // the same reason — a string a user can read, no new code path.
  // 815,000 (+12 KB measured 804,402): every country gets its own currency.
  // assets/js/sizing/country-currency.js is 11.5 KB of ISO 3166-1 -> ISO 4217
  // data, plus 127 currency rows the table made reachable in pricing.js. It is
  // consulted on the exact path that already had the wrong answer: a location
  // in one of sixteen countries was being shown a currency that country does
  // not use, silently, because its bounding box was shared with a neighbour.
  // That is not a string a reviewer can accept being wrong; it is the whole
  // point of the feature. Trade approved by the operator against a submission
  // deadline. If the budget ever needs to come back down, this table is the
  // thing to move behind a click, not the country mapping to be deleted.
  // 130,000 (+5 KB measured 129,073): the six D-16 use cases became six real
  // offers. Four of them had no form at all — backup, reserve, portable and the
  // time-of-use rates are the only way a visitor can hand the engine what those
  // cases are sized on, and shipping them lazily would have meant a field
  // registry plus a descriptor-to-DOM layer purely to save ~7 KB of static
  // markup. That trade buys a clean per-case budget, not fewer bytes for its
  // own sake. The thing to move behind a click if this budget ever needs to
  // come back down is the portable and backup input panels, not the use-case
  // chooser itself: the chooser is 2 KB and is the whole product surface.
  assert.ok(
    htmlBytes <= 130_000,
    `index.html ${htmlBytes} bytes exceeds 130,000 budget`,
  );
  assert.ok(
    cssBytes <= 40_000,
    `site.css ${cssBytes} bytes exceeds 40,000 budget`,
  );
  // 895,000 (+80 KB measured ~889,900): all six D-16 use cases became six real
  // offers, and three of them needed engines that did not exist — an outage
  // simulator, a reserve floor and a portable day model (+11.6 KB in
  // engine.js). On top of that: +27.3 KB in locales.js for 45 new keys x six
  // locales (the same trade the country-currency raise above records), and
  // +15.2 KB in run.js for the measurement pass that turns a sized system into
  // one outcome per use case. usecases.js itself was ALSO missing from the
  // eager list above, so a brand-new eager module could have grown outside
  // this budget entirely — it is listed now, and its bytes are in the number.
  // This is the one place where "lazy-load it" was the better answer and was
  // not taken: the portable and backup panels are the fields that make those
  // two cases real, and rendering them behind a click would have hidden the
  // question the visitor came to answer.
  assert.ok(
    jsBytes <= 895_000,
    `eager JS ${jsBytes} bytes exceeds 895,000 budget — you added eager code; lazy-load it or raise the budget deliberately`,
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
