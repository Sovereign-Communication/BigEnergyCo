// Google-quality polish pass 2: regression gates for focus isolation, locale
// parity, currency-correct notes, cache-shape validation, bounded loads,
// and subpage consistency. Complements tests/polish-pass1.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  oversizeCallout,
  oversizeSavingsUsd,
  relocalizeOversizeCallout,
} from "../assets/js/sizing/rescale.js";
import { isUsableWeather } from "../assets/js/sizing/nasa.js";
import { climateClass } from "../assets/js/sizing/climate.js";
import {
  mapUrlsAllowed,
  LEAFLET_SCRIPT_URL,
  ESRI_SATELLITE_TILE_URL,
  CARTO_TILE_URL,
} from "../assets/js/sizing/map-provider.js";
import {
  markerMatchesPoint,
  FRONTIER_MARKER_PV_TOL_KW,
  FRONTIER_MARKER_BATT_TOL_KWH,
} from "../assets/js/sizing/frontier-chart.js";
import { CITY_CATALOG_TIMEOUT_MS } from "../assets/js/sizing/cities.js";
import { LOCALES } from "../assets/js/shared/locales.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// ── rescale: currency-relocalizable oversize notes ──────────────────────────

test("oversize prose keeps its exact USD shape (parser contract)", () => {
  const text = oversizeCallout("oversized_cheaper", {
    battKwh: 14,
    savingsUsd: 1234.4,
  });
  assert.match(text, /saving ~\$1,234 vs\. smaller banks/);
  assert.equal(oversizeSavingsUsd(text), 1234);
});

test("relocalize rewrites the figure, leaves the rest alone", () => {
  const text = oversizeCallout("swaps_cheaper", {
    replacements: 2,
    savingsUsd: 2500,
  });
  const out = relocalizeOversizeCallout(text, (usd) => `${usd} EUR`);
  assert.match(out, /~2500 EUR cheaper/);
  assert.match(out, /2 replacement\(s\)/);
});

test("relocalize passes prose through when there is nothing to convert", () => {
  const plain = "Best 20-year price: standard sizing is cheaper, period.";
  assert.equal(
    relocalizeOversizeCallout(plain, (v) => `${v} EUR`),
    plain,
  );
  const text = oversizeCallout("oversized_cheaper", {
    battKwh: 14,
    savingsUsd: 999,
  });
  assert.equal(relocalizeOversizeCallout(text), text);
  assert.equal(relocalizeOversizeCallout(text, null), text);
});

// ── nasa: persisted-weather shape gate ──────────────────────────────────────

test("usable weather passes, corrupt shapes fail", () => {
  const good = {
    hours: [{ ghi: 500, tAmb: 25 }],
    meta: { years: 5 },
  };
  assert.equal(isUsableWeather(good), true);
  // Fresh-network -999 gaps surface as NaN numbers: still shaped correctly.
  assert.equal(
    isUsableWeather({ hours: [{ ghi: NaN, tAmb: NaN }], meta: { years: 5 } }),
    true,
  );
  for (const bad of [
    null,
    undefined,
    42,
    "json",
    [],
    {},
    { hours: [], meta: { years: 5 } },
    { hours: [{ ghi: "500", tAmb: 25 }], meta: { years: 5 } },
    { hours: [{ ghi: 500 }], meta: { years: 5 } },
    { hours: [{ ghi: 500, tAmb: 25 }] },
    { hours: [{ ghi: 500, tAmb: 25 }], meta: {} },
    { hours: [{ ghi: 500, tAmb: 25 }], meta: { years: 0 } },
  ]) {
    assert.equal(
      isUsableWeather(bad),
      false,
      JSON.stringify(bad)?.slice(0, 60),
    );
  }
});

// ── climate: tropical-before-maritime is intentional ────────────────────────

function series(tAmb, ghi, n = 48) {
  return Array.from({ length: n }, () => ({ tAmb, ghi }));
}

test("warm-wet sites read tropical, cool-dim sites read maritime", () => {
  assert.equal(climateClass(series(26, 150)), "tropical");
  assert.equal(climateClass(series(10, 150)), "maritime");
  assert.equal(climateClass(series(35, 400)), "desert");
});

// ── map: host allowlist is enforced ─────────────────────────────────────────

test("bundled map URLs pass the policy, strangers fail", () => {
  assert.equal(mapUrlsAllowed(), true);
  assert.equal(
    mapUrlsAllowed(LEAFLET_SCRIPT_URL, [
      ESRI_SATELLITE_TILE_URL,
      CARTO_TILE_URL,
    ]),
    true,
  );
  assert.equal(
    mapUrlsAllowed("https://evil.example/leaflet.js", [CARTO_TILE_URL]),
    false,
  );
  assert.equal(
    mapUrlsAllowed(LEAFLET_SCRIPT_URL, [
      "https://evil.example/{z}/{x}/{y}.png",
    ]),
    false,
  );
  assert.equal(mapUrlsAllowed("not a url", []), false);
});

test("catalog load deadline stays bounded", () => {
  assert.ok(
    Number.isFinite(CITY_CATALOG_TIMEOUT_MS) &&
      CITY_CATALOG_TIMEOUT_MS <= 60000,
  );
});

// ── frontier: documented marker tolerances ──────────────────────────────────

test("marker tolerances are exported and behave", () => {
  assert.equal(FRONTIER_MARKER_PV_TOL_KW, 0.06);
  assert.equal(FRONTIER_MARKER_BATT_TOL_KWH, 0.6);
  const marker = { pvKw: 4, battKwh: 10 };
  assert.equal(markerMatchesPoint(marker, { pvKw: 4.05, battKwh: 10.5 }), true);
  assert.equal(markerMatchesPoint(marker, { pvKw: 4.5, battKwh: 10 }), false);
});

// ── locales: full parity with en ────────────────────────────────────────────

test("every English key exists in every locale", () => {
  const enKeys = Object.keys(LOCALES.en);
  assert.ok(enKeys.length >= 90, "en vocabulary intact");
  for (const loc of Object.keys(LOCALES)) {
    if (loc === "en") continue;
    const missing = enKeys.filter((k) => LOCALES[loc][k] === undefined);
    assert.deepEqual(missing, [], `${loc} is missing: ${missing.join(", ")}`);
  }
});

test("translated placeholders match English exactly", () => {
  const ph = (s) =>
    [...String(s).matchAll(/\{(\w+)\}/g)]
      .map((m) => m[1])
      .sort()
      .join(",");
  for (const loc of Object.keys(LOCALES)) {
    if (loc === "en") continue;
    for (const k of Object.keys(LOCALES.en)) {
      const v = LOCALES[loc][k];
      if (v === undefined) continue;
      assert.equal(ph(v), ph(LOCALES.en[k]), `${loc}.${k} placeholders`);
    }
  }
});

// ── chat.js static gates ────────────────────────────────────────────────────

test("modals trap focus and isolate the background", () => {
  const src = read("assets/js/chat.js");
  assert.match(src, /function becoVisibleModal\(\)/);
  assert.match(src, /function becoFocusables\(root\)/);
  assert.match(src, /getClientRects\(\)\.length > 0/);
  assert.match(src, /setAttribute\("inert", ""\)/);
  assert.match(src, /MutationObserver/);
  assert.match(src, /document\.documentElement\.style\.overflow/);
});

test("system modal Esc returns focus via the wired closer", () => {
  const src = read("assets/js/chat.js");
  assert.match(src, /getElementById\("btnCloseSystem"\)/);
  assert.match(src, /sysCloser\.click\(\)/);
});

test("intake mode toggle preserves typed values per mode", () => {
  const src = read("assets/js/chat.js");
  assert.match(src, /var intakeMemory = \{\};/);
  assert.match(src, /intakeMemory\[intakeLastMode\] = input\.value;/);
  assert.doesNotMatch(src, /input\.value === "35"/);
  assert.doesNotMatch(src, /input\.value === "400"/);
});

test("short inverter answers are judged by pattern, not length", () => {
  const src = read("assets/js/chat.js");
  assert.doesNotMatch(src, /t\.length < 12/);
});

test("chat errors log status only, never payloads", () => {
  const src = read("assets/js/chat.js");
  assert.match(src, /console\.error\("Chat API error:", err && err\.status\);/);
});

// ── ui.js static gates ──────────────────────────────────────────────────────

test("dead preset import stays out of the bundle", () => {
  const src = read("assets/js/sizing/ui.js");
  assert.doesNotMatch(src, /import \{ CITY_PRESETS \}/);
});

test("oversize notes render through the currency-aware helper", () => {
  const src = read("assets/js/sizing/ui.js");
  assert.match(src, /function bestPriceNote\(text\)/);
  assert.match(src, /relocalizeOversizeCallout\(text, money\)/);
  assert.equal(
    [...src.matchAll(/bestPriceNote\(\w+\.bestPriceCallout\)/g)].length,
    5,
    "all five render sites convert",
  );
});

test("bill slider uses a 1-2-5 ladder step", () => {
  const src = read("assets/js/sizing/ui.js");
  assert.match(src, /norm >= 5 \? 5 : norm >= 2 \? 2 : 1/);
  assert.doesNotMatch(src, /Math\.max\(1, Math\.round\(\(maxBill - minBill\)/);
});

test("speed badge formats coordinates with fixed decimals", () => {
  const src = read("assets/js/sizing/ui.js");
  assert.match(src, /\$\{lat\.toFixed\(2\)\}, \$\{lon\.toFixed\(2\)\}/);
});

test("roof-cap note names its 6 m²-per-panel assumption", () => {
  const src = read("assets/js/sizing/ui.js");
  assert.match(src, /≈6 m² per panel with access space/);
});

test("map init refuses off-policy hosts", () => {
  const src = read("assets/js/sizing/map-provider.js");
  assert.match(
    src,
    /throw new Error\("Optional map provider blocked by host policy"\)/,
  );
});

test("roof-cap math shares the 550 W panel class", () => {
  const src = read("assets/js/sizing/map-provider.js");
  assert.match(src, /panelWatts = 550,/);
});

// ── index.html / site.css static gates ──────────────────────────────────────

test("homepage copy casing is consistent", () => {
  const html = read("index.html");
  assert.ok(html.includes("Off-grid / Backup"));
  assert.doesNotMatch(html, /Off-Grid \/ Backup/);
  assert.ok(html.includes("Sodium-ion vs LFP"));
});

test("RTL mirrors the skip link without touching LTR", () => {
  const css = read("assets/site.css");
  assert.match(css, /\[dir="rtl"\] \.skip-link \{/);
  assert.match(css, /\[dir="rtl"\] \.skip-link:focus \{/);
});

// ── 404 static gates ────────────────────────────────────────────────────────

test("404 has one estimator link plus a real site nav", () => {
  const html = read("404.html");
  assert.match(html, /name="theme-color" content="#090d16"/);
  assert.match(html, /<nav aria-label="Site">/);
  for (const href of [
    "/solar-calculator/",
    "/solar-heatmap/",
    "/blog/",
    "/about/",
  ]) {
    assert.ok(html.includes(`href="${href}"`), href);
  }
  assert.equal(
    [...html.matchAll(/>Go to the estimator</g)].length,
    1,
    "single primary action",
  );
});

// ── subpage consistency gates ───────────────────────────────────────────────

const SUBPAGES = [
  "about/index.html",
  "solar-heatmap/index.html",
  "blog/index.html",
  "blog/battery-longevity-and-dod-reference/index.html",
  "blog/diy-vs-prebuilt-sodium-ion-lifepo4-battery-storage/index.html",
  "blog/escape-load-shedding/index.html",
  "blog/how-to-cut-electricity-bill-with-solar/index.html",
  "blog/is-a-home-battery-worth-it/index.html",
  "blog/off-grid-battery-bank-sizing/index.html",
  "blog/off-grid-vs-grid-tie-payback/index.html",
  "blog/solar-vs-generator-cost/index.html",
  "blog/time-of-use-tariffs-battery/index.html",
  "blog/what-size-solar-system-for-off-grid/index.html",
];

test("every subpage has a skip link, a main target, and focus styles", () => {
  for (const p of SUBPAGES) {
    const html = read(p);
    assert.match(
      html,
      /<a class="skip-link" href="#main">Skip to content<\/a>/,
      `${p} skip link`,
    );
    assert.match(html, /<main id="main"/, `${p} main target`);
    assert.match(html, /:focus-visible/, `${p} focus ring`);
    assert.match(html, /prefers-reduced-motion/, `${p} reduced motion`);
  }
});

test("every post table has caption, thead, and scoped headers", () => {
  const posts = SUBPAGES.filter((p) => /^blog\/[^/]+\/index\.html$/.test(p));
  assert.ok(posts.length === 10, "all ten posts covered");
  for (const p of posts) {
    const html = read(p);
    const tables = [...html.matchAll(/<table>([\s\S]*?)<\/table>/g)];
    assert.ok(tables.length >= 1, `${p} has tables`);
    for (const [, body] of tables) {
      assert.match(body, /<caption>[\s\S]*<\/caption>/, `${p} caption`);
      assert.match(body, /<thead>[\s\S]*<\/thead>/, `${p} thead`);
      assert.match(body, /<tbody>[\s\S]*<\/tbody>/, `${p} tbody`);
      const bare = [...body.matchAll(/<th((?:\s[^>]*)?)>/g)].filter(
        (m) => !m[1].includes("scope="),
      );
      assert.deepEqual(
        bare.map((m) => m[0]),
        [],
        `${p} all headers scoped`,
      );
    }
  }
});

// ── PWA icon gates ──────────────────────────────────────────────────────────

test("maskable icon is a dedicated file wired through manifest and SW", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  const maskable = manifest.icons.find((i) => i.purpose === "maskable");
  assert.equal(maskable.src, "./assets/icon-maskable-512.png");
  assert.ok(
    fs.existsSync(path.join(ROOT, "assets/icon-maskable-512.png")),
    "maskable png exists",
  );
  const anyIcon = manifest.icons.find((i) => i.purpose === "any");
  assert.notEqual(anyIcon.src, maskable.src, "maskable differs from any");
  assert.ok(
    read("sw.js").includes('"./assets/icon-maskable-512.png"'),
    "SW precaches the maskable icon",
  );
});
