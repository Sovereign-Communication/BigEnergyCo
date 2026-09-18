// Google-quality polish pass 1: regression gates for the deep-audit fixes.
// Every fix in this pass (pipeline stepper, NaN guards, timeouts, a11y
// affordances, SEO consistency, PWA shell) is pinned here so later work can
// only make the site cleaner, never dirtier.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applianceProfile } from "../assets/js/sizing/engine.js";
import { axisTicks } from "../assets/js/sizing/frontier-chart.js";
import {
  lookupCityOnline,
  CITY_LOOKUP_TIMEOUT_MS,
} from "../assets/js/sizing/cities.js";
import {
  LEAFLET_SCRIPT_SRI,
  LEAFLET_STYLE_SRI,
  createLeafletProvider,
} from "../assets/js/sizing/map-provider.js";
import {
  explainElement,
  jargonEntry,
  JARGON,
} from "../assets/js/shared/jargon-dict.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// ── engine: applianceProfile never emits NaN ────────────────────────────────

test("applianceProfile skips zero-hour items instead of 0/0 NaN", () => {
  const day = applianceProfile([
    { watts: 100, hoursPerDay: 0, startHour: 18, count: 1 },
  ]);
  assert.equal(day.length, 24);
  for (const v of day) assert.equal(v, 0);
});

test("applianceProfile still spreads normal items evenly", () => {
  const day = applianceProfile([
    { watts: 100, hoursPerDay: 2, startHour: 18, count: 1 },
  ]);
  assert.equal(day[18], 100);
  assert.equal(day[19], 100);
  assert.equal(
    [...day].reduce((a, b) => a + b, 0),
    200,
  );
});

// ── frontier-chart: integer tick iteration ──────────────────────────────────

test("axisTicks lands exactly on round steps", () => {
  assert.deepEqual(axisTicks(4000, 4), [0, 1000, 2000, 3000, 4000]);
});

test("axisTicks output is finite, ascending, and bounded by max", () => {
  for (const max of [1, 7, 9, 320, 1050, 26300]) {
    const ticks = axisTicks(max, 5);
    assert.ok(ticks.length >= 2, `max=${max}: at least two ticks`);
    assert.equal(ticks[0], 0);
    for (const t of ticks) assert.ok(Number.isFinite(t), `max=${max}`);
    assert.deepEqual(
      [...ticks].sort((a, b) => a - b),
      ticks,
      "ascending",
    );
    assert.ok(ticks[ticks.length - 1] <= Math.round(max), "within max");
  }
});

// ── cities: geocoder lookup is time-bounded ─────────────────────────────────

test("lookupCityOnline rejects short queries without fetching", async () => {
  let called = false;
  const out = await lookupCityOnline("x", () => {
    called = true;
    throw new Error("must not fetch");
  });
  assert.equal(out, null);
  assert.equal(called, false);
});

test("lookupCityOnline passes an abort signal to the fetch", async () => {
  let seenSignal = null;
  await lookupCityOnline("Lagos", (url, opts = {}) => {
    seenSignal = opts.signal || null;
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
  assert.ok(seenSignal, "signal is passed through");
  assert.equal(typeof seenSignal.aborted, "boolean");
});

test("lookupCityOnline resolves the first Nominatim row", async () => {
  const out = await lookupCityOnline("Lagos", () =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            name: "Lagos",
            display_name: "Lagos, Nigeria",
            address: { country_code: "ng", state: "Lagos" },
            lat: "6.45",
            lon: "3.39",
          },
        ]),
    }),
  );
  assert.deepEqual(out, {
    name: "Lagos",
    country: "NG",
    r: "Lagos",
    lat: 6.45,
    lon: 3.39,
  });
});

test("lookupCityOnline returns null instead of hanging forever", async () => {
  assert.ok(
    CITY_LOOKUP_TIMEOUT_MS <= 15000,
    "lookup deadline stays user-tolerable",
  );
  const hanging = (_url, opts = {}) =>
    new Promise((_resolve, reject) => {
      opts.signal?.addEventListener("abort", () =>
        reject(new Error("aborted")),
      );
    });
  const t0 = Date.now();
  const out = await lookupCityOnline("Somewhere Remote", hanging);
  assert.equal(out, null);
  assert.ok(
    Date.now() - t0 < CITY_LOOKUP_TIMEOUT_MS + 5000,
    "bounded by the abort deadline",
  );
});

// ── map-provider: SRI pins match the heatmap's static pins ──────────────────

test("dynamic Leaflet SRI matches the static heatmap pins", () => {
  const heatmap = read("solar-heatmap/index.html");
  assert.ok(
    heatmap.includes(LEAFLET_SCRIPT_SRI),
    "script SRI identical to heatmap pin",
  );
  assert.ok(
    heatmap.includes(LEAFLET_STYLE_SRI),
    "stylesheet SRI identical to heatmap pin",
  );
});

test("Leaflet provider sets integrity + crossorigin on injected tags", async () => {
  const created = [];
  const listeners = new Map();
  const fakeScript = {
    tag: "script",
    addEventListener: (ev, fn) => listeners.set("script:" + ev, fn),
  };
  const fakeLink = { tag: "link" };
  const appended = [];
  const tileStub = { addTo: () => tileStub };
  const leafletStub = {
    map: () => ({ setView: () => ({}), remove: () => {} }),
    tileLayer: () => tileStub,
  };
  // No L yet: init must inject the script, then L appears on load.
  const windowRef = {};
  const documentRef = {
    querySelector: () => null,
    createElement: (tag) => {
      const el = tag === "script" ? fakeScript : fakeLink;
      created.push(tag);
      return el;
    },
    head: {
      appendChild: (el) => {
        appended.push(el);
        if (el.tag === "script")
          queueMicrotask(() => {
            windowRef.L = leafletStub;
            listeners.get("script:load")?.();
          });
      },
    },
  };
  const provider = createLeafletProvider({ windowRef, documentRef });
  await provider.init({ element: {}, latitude: 0, longitude: 0 });
  assert.equal(fakeScript.integrity, LEAFLET_SCRIPT_SRI);
  assert.equal(fakeScript.crossOrigin, "anonymous");
  assert.equal(fakeLink.integrity, LEAFLET_STYLE_SRI);
  assert.equal(fakeLink.crossOrigin, "anonymous");
});

// ── jargon-dict: localized overlays with English fallback ───────────────────

function fakeEl() {
  return {
    attrs: {},
    setAttribute(k, v) {
      this.attrs[k] = v;
    },
  };
}

test("explainElement serves the requested locale overlay", () => {
  const el = fakeEl();
  assert.equal(explainElement(el, "inverter", "es"), true);
  assert.match(el.attrs["data-eli5"], /inversor/i);
  const de = fakeEl();
  assert.equal(explainElement(de, "tariff", "de"), true);
  assert.match(de.attrs["data-eli5"], /Tarif/);
});

test("explainElement falls back to English for missing locale terms", () => {
  const el = fakeEl();
  assert.equal(explainElement(el, "kWh", "xx"), true);
  assert.equal(el.attrs["data-eli5"], JARGON.kWh.long);
  const partial = fakeEl();
  assert.equal(explainElement(partial, "BMS", "es"), true);
  assert.equal(partial.attrs["data-eli5"], JARGON.BMS.long);
});

test("explainElement reports unknown terms so callers skip wiring", () => {
  assert.equal(explainElement(fakeEl(), "not-a-term", "en"), false);
  assert.equal(jargonEntry("not-a-term"), null);
});

// ── ui.js static gates ──────────────────────────────────────────────────────

test("pipeline stepper normalizes caller case", () => {
  const src = read("assets/js/sizing/ui.js");
  assert.match(src, /function pipelineKey\(stage\)/);
  assert.match(src, /function pipelineStart\(stage = "City"\)/);
  assert.match(
    src,
    /"pipe" \+ s\.charAt\(0\)\.toUpperCase\(\) \+ s\.slice\(1\)/,
  );
});

test("bill slider math cannot anchor negative kWh", () => {
  const src = read("assets/js/sizing/ui.js");
  assert.match(src, /Math\.max\(0, \(bill - fixedDisplay\(\)\)/);
});

test("formatters render an em dash, never NaN/undefined", () => {
  const src = read("assets/js/sizing/ui.js");
  assert.match(src, /if \(!Number\.isFinite\(Number\(n\)\)\) return "–";/);
  assert.match(src, /if \(!Number\.isFinite\(Number\(x\)\)\) return "–";/);
  assert.match(src, /if \(!Number\.isFinite\(Number\(usd\)\)\) return "–";/);
  assert.match(
    src,
    /if \(!Number\.isFinite\(Number\(lo\)\) \|\| !Number\.isFinite\(Number\(hi\)\)\) return "–";/,
  );
});

test("shared-link bill-cut bound matches the engine (150%)", () => {
  const src = read("assets/js/sizing/ui.js");
  assert.match(src, /o\.cc <= 1\.5/);
  assert.doesNotMatch(src, /o\.cc <= 1\.11/);
});

test("tariff display keeps sub-cent precision", () => {
  const src = read("assets/js/sizing/ui.js");
  assert.match(src, /est\.rate \* fx\.rate\)\.toFixed\(4\)/);
});

test("unknown jargon terms stay plain text", () => {
  const src = read("assets/js/sizing/ui.js");
  assert.match(
    src,
    /if \(!explainElement\(node, node\.dataset\.jargon, lang\)\) return;/,
  );
});

test("background FX refresh is time-bounded", () => {
  const src = read("assets/js/sizing/ui.js");
  assert.match(src, /AbortSignal\.timeout\(10000\)/);
});

test("sun-path diagram has an accessible name", () => {
  const src = read("assets/js/sizing/ui.js");
  assert.match(src, /role="img" aria-label="Sun-path diagram/);
});

test("system modal returns focus and has keyboard dismissal", () => {
  const src = read("assets/js/sizing/ui.js");
  assert.match(src, /systemModalOpener/);
  assert.match(src, /systemModalOpener\.focus\(\)/);
});

// ── chat.js static gates ────────────────────────────────────────────────────

test("advisor POST is time-bounded", () => {
  const src = read("assets/js/chat.js");
  assert.match(src, /AbortSignal\.timeout\(30000\)/);
});

test("storage calculator ignores empty input instead of NaN", () => {
  const src = read("assets/js/chat.js");
  assert.match(
    src,
    /if \(!isFinite\(targetKwh\) \|\| targetKwh <= 0\) return;/,
  );
});

test("modals hand focus back to their opener", () => {
  const src = read("assets/js/chat.js");
  assert.match(src, /lastModalOpener/);
  assert.match(src, /restoreOpener\(\);/);
});

// ── index.html static gates ─────────────────────────────────────────────────

test("homepage hreflang is exactly en + x-default", () => {
  const html = read("index.html");
  const tags = [...html.matchAll(/hreflang="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(tags, ["en", "x-default"]);
  // No hreflang *target* may be a ?lang= URL (the explanatory comment is
  // allowed to name the pattern, so match link targets, not bare text).
  assert.doesNotMatch(html, /hreflang="[^"]+"\s+href="[^"]*\?lang=/);
});

test("homepage div-CTAs expose static button semantics", () => {
  const html = read("index.html");
  for (const id of [
    "btnNavSizeArray",
    "btnHeroSizing",
    "btnGeoLocate",
    "btnSendChat",
  ]) {
    const tag = html.match(new RegExp(`<div[^>]*id="${id}"[^>]*>`, "s"))?.[0];
    assert.ok(tag, `${id} present`);
    assert.match(tag, /role="button"/, `${id} role`);
    assert.match(tag, /tabindex="0"/, `${id} focusable`);
  }
});

test("homepage chat input has a real label", () => {
  const html = read("index.html");
  assert.match(html, /<label class="sr-only" for="chatInput"\s*>/);
});

test("homepage zoom buttons have accessible names", () => {
  const html = read("index.html");
  assert.match(html, /id="btnSocZoomIn"[^>]*aria-label="Zoom chart in"/s);
  assert.match(html, /id="btnSocZoomOut"[^>]*aria-label="Zoom chart out"/s);
});

test("homepage canvases have names and no-JS fallback text", () => {
  const html = read("index.html");
  assert.match(html, /id="socCanvas"[^>]*role="img"/s);
  assert.match(html, /id="cumCostCanvas"[^>]*role="img"/s);
  // Wrap-agnostic: Prettier may reflow the phrase across lines.
  assert.match(html, /renders\s+here\s+after\s+you\s+run\s+a\s+sizing\./);
});

test("homepage two-column grids collapse on narrow phones", () => {
  const html = read("index.html");
  assert.equal(
    [...html.matchAll(/class="form-grid-2col"/g)].length,
    3,
    "lat/lon, derates, currency grids",
  );
  const css = read("assets/site.css");
  assert.match(
    css,
    /@media \(max-width: 480px\) \{\s*\n?\s*\.form-grid-2col \{\s*\n?\s*grid-template-columns: 1fr !important;/,
  );
});

test("homepage money ranges use en dashes", () => {
  const html = read("index.html");
  assert.match(html, /\$80–125 per usable kWh/);
  assert.doesNotMatch(html, /\$80-125/);
});

test("homepage preset buttons name their units", () => {
  const html = read("index.html");
  for (const label of [
    "Camper Van (2.5 kWh/day)",
    "Cabin (5 kWh/day)",
    "Critical Backup (8 kWh/day)",
    "Homestead (15 kWh/day)",
  ]) {
    assert.ok(html.includes(label), label);
  }
});

test("system modal Close routes through the focus-returning closer", () => {
  // The markup used to carry the call inline; CSP no longer allows inline
  // script, so the same route (click the wired closer, which returns focus to
  // the opener) is bound in chat.js instead.
  const html = read("index.html");
  assert.match(html, /id="btnCloseSystemSheet"/);
  assert.doesNotMatch(
    html,
    /\son[a-z]+\s*=/,
    "no inline event handler attribute may return",
  );
  const src = read("assets/js/chat.js");
  assert.match(src, /getElementById\("btnCloseSystemSheet"\)/);
  assert.match(src, /getElementById\("btnCloseSystem"\)/);
});

// ── site.css static gates ───────────────────────────────────────────────────

test("touch targets meet the minimum size", () => {
  const css = read("assets/site.css");
  assert.match(css, /\.nav-toggle \{[^}]*width: 48px/s);
  assert.match(css, /\.close-btn \{[^}]*width: 48px/s);
  assert.match(
    css,
    /@media \(pointer: coarse\) \{\s*\n?\s*\.btn-xs \{\s*\n?\s*min-height: 44px;/,
  );
});

test("screen-reader-only utility exists for form labels", () => {
  assert.match(read("assets/site.css"), /\.sr-only \{/);
});

test("roof map placeholder stays dark while tiles load", () => {
  const css = read("assets/site.css");
  assert.match(css, /\.roof-map \{[^}]*background: #0d1117;/s);
  assert.doesNotMatch(css, /background: #dfe8e3;/);
});

// ── subpage consistency gates ───────────────────────────────────────────────

const CONTENT_PAGES = [
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
  "solar-calculator/honolulu/index.html",
  "solar-calculator/index.html",
];

test("every content page sets theme-color and links the manifest", () => {
  for (const p of CONTENT_PAGES) {
    const html = read(p);
    assert.match(html, /name="theme-color" content="#090d16"/, `${p} theme`);
    assert.match(
      html,
      /rel="manifest" href="[^"]*manifest\.webmanifest"/,
      `${p} manifest`,
    );
  }
});

test("no content page advertises ?lang= hreflang targets", () => {
  for (const p of ["index.html", ...CONTENT_PAGES]) {
    assert.doesNotMatch(read(p), /hreflang="[^"]+"\s+href="[^"]*\?lang=/, p);
  }
});

test("heatmap controls are grouped, named, and motion-safe", () => {
  const html = read("solar-heatmap/index.html");
  assert.match(html, /role="group"\s*aria-labelledby="lblMetric"/s);
  assert.match(html, /role="group"\s*aria-labelledby="lblBasis"/s);
  assert.match(html, /role="group"\s*aria-labelledby="lblUsage"/s);
  assert.doesNotMatch(html, /<label>View \/ Metric<\/label>/);
  assert.match(html, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(html, /id="map"[^>]*role="application"/s);
  assert.match(html, /id="loading" role="status"/);
});

test("blog hub keeps a clean heading outline and rich postings", () => {
  const html = read("blog/index.html");
  assert.match(html, /Solar &amp; Battery Benchmarks for 66 Cities/);
  assert.doesNotMatch(html, /<h3[\s>][\s\S]{0,80}Benchmarks for 66 Cities/);
  const block = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );
  const data = JSON.parse(block[1]);
  // The hub nests postings under a top-level Blog node (no @graph).
  assert.equal(data["@type"], "Blog");
  const posts = data.blogPost;
  assert.ok(posts?.length >= 10, "all guides listed");
  for (const post of posts) {
    assert.ok(post.image?.length, `${post.url} has an image`);
    assert.ok(post.dateModified, `${post.url} has dateModified`);
  }
});

test("thin post now matches the rich Article shape", () => {
  const html = read("blog/off-grid-vs-grid-tie-payback/index.html");
  assert.match(html, /"dateModified": "2026-08-23T00:00:00Z"/);
  assert.match(
    html,
    /"mainEntityOfPage": "https:\/\/freeoffgridcalculator\.com\/blog\/off-grid-vs-grid-tie-payback\/"/,
  );
  assert.match(html, /<caption>/);
  assert.match(html, /<th scope="col">/);
});

test("city generator emits the polished template", () => {
  const gen = read("scripts/build-city-pages.mjs");
  assert.match(gen, /"mainEntityOfPage": "\${url}"/);
  assert.match(gen, /<caption>Worked sizing bands/);
  assert.match(gen, /<th scope="col">/);
  assert.match(gen, /class="skip-link" href="#main"/);
  assert.match(gen, /rel="manifest"/);
  assert.match(gen, /name="theme-color"/);
  assert.doesNotMatch(gen, /\?lang=es/);
  const sample = read("solar-calculator/honolulu/index.html");
  assert.match(
    sample,
    /"mainEntityOfPage": "https:\/\/freeoffgridcalculator\.com\/solar-calculator\/honolulu\/"/,
  );
  assert.match(sample, /<caption>Worked sizing bands/);
});

// ── PWA / infra / repo hygiene gates ────────────────────────────────────────

test("service worker precache lists explicit files only", () => {
  const sw = read("sw.js");
  const shell = sw.match(/const SHELL = \[([\s\S]*?)\];/)?.[1] ?? "";
  assert.ok(shell.length, "SHELL array found");
  assert.doesNotMatch(shell, /"\.\/blog\/"/);
  assert.doesNotMatch(shell, /"\.\/solar-calculator\/"/);
  for (const entry of [
    '"./blog/index.html"',
    '"./solar-calculator/index.html"',
    '"./about/index.html"',
    '"./solar-heatmap/index.html"',
    '"./assets/site.css"',
  ]) {
    assert.ok(sw.includes(entry), `SHELL contains ${entry}`);
  }
});

test("manifest carries a stable id", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.equal(manifest.id, "./");
});

test("llms.txt lists every sitemap guide", () => {
  const llms = read("llms.txt");
  const sitemap = read("sitemap.xml");
  const guides = [
    ...sitemap.matchAll(
      /<loc>(https:\/\/freeoffgridcalculator\.com\/blog\/[^<]*)<\/loc>/g,
    ),
  ].map((m) => m[1]);
  assert.ok(guides.length >= 10, "sitemap guides found");
  for (const url of guides) {
    assert.ok(llms.includes(url), `llms.txt lists ${url}`);
  }
});

test("legacy stylesheet is marked deprecated, not loaded", () => {
  assert.match(read("styles.css"), /DEPRECATED/);
  for (const p of ["index.html", "about/index.html", "blog/index.html"]) {
    assert.doesNotMatch(read(p), /styles\.css/, `${p} loads site.css`);
  }
});
