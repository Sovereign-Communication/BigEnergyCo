<<<<<<< HEAD
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { applyLeafletStyles } from "../assets/js/sizing/leaflet-styles.js?v=20261022p";
import {
  LEAFLET_STYLE_SRI,
  LEAFLET_STYLE_URL,
} from "../assets/js/sizing/map-provider.js?v=20261022p";

const html = readFileSync(
  new URL("../solar-heatmap/index.html", import.meta.url),
  "utf8",
);
const js = readFileSync(
  new URL("../assets/js/heatmap.js", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../assets/js/sizing/leaflet-styles.js", import.meta.url),
  "utf8",
);
const provider = readFileSync(
  new URL("../assets/js/sizing/map-provider.js", import.meta.url),
  "utf8",
);
const headers = readFileSync(new URL("../_headers", import.meta.url), "utf8");
const csp = headers
  .split("\n")
  .find((line) => line.trim().startsWith("Content-Security-Policy"));

function mockLink() {
  const listeners = new Map();
  const link = {
    id: "",
    rel: "",
    as: "",
    href: "",
    integrity: "",
    crossOrigin: "",
    cloneNode() {
      return Object.assign(mockLink(), {
        id: this.id,
        rel: this.rel,
        as: this.as,
        href: this.href,
        integrity: this.integrity,
        crossOrigin: this.crossOrigin,
      });
    },
    removeAttribute(name) {
      delete this[name];
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    listeners,
  };
  return link;
}

function mockDocument(outcome) {
  const appended = [];
  return {
    appended,
    createElement(tag) {
      assert.equal(tag, "link");
      return mockLink();
    },
    head: {
      append(link) {
        appended.push(link);
        if (link.rel === "stylesheet") link.listeners.get(outcome)?.();
      },
    },
  };
}

test("Leaflet CSS is module-owned and fetched as a nonblocking same-origin preload", () => {
  assert.doesNotMatch(html, /leaflet\.css|LEAFLET_STYLE_(URL|SRI)/);
  assert.match(js, /import \{\s*applyLeafletStyles\s*\} from/);
  assert.match(styles, /preloaded\.rel = "preload"/);
  assert.match(styles, /preloaded\.as = "style"/);
  assert.match(provider, /LEAFLET_STYLE_URL = versionedLocalAsset/);
  assert.match(provider, /\.\.\/\.\.\/vendor\/leaflet\/leaflet\.css/);
  assert.equal(
    LEAFLET_STYLE_SRI,
    "sha256-" +
      createHash("sha256")
        .update(
          readFileSync(
            new URL("../assets/vendor/leaflet/leaflet.css", import.meta.url),
          ),
        )
        .digest("base64"),
  );
  const url = new URL(LEAFLET_STYLE_URL);
  assert.ok(url.pathname.endsWith("/assets/vendor/leaflet/leaflet.css"));
  assert.equal(url.searchParams.get("v"), "20261022p");
});

test("stylesheet promotion preserves URL, SRI and CORS and is awaited before the map appears", async () => {
  const documentRef = mockDocument("load");
  assert.equal(await applyLeafletStyles(documentRef), true);
  assert.equal(documentRef.appended.length, 2);
  const [preload, stylesheet] = documentRef.appended;
  assert.equal(preload.rel, "preload");
  assert.equal(preload.as, "style");
  assert.equal(preload.id, "leaflet-css");
  assert.equal(preload.href, LEAFLET_STYLE_URL);
  assert.equal(preload.integrity, LEAFLET_STYLE_SRI);
  assert.equal(preload.crossOrigin, "anonymous");
  assert.equal(stylesheet.rel, "stylesheet");
  assert.equal(stylesheet.as, undefined);
  assert.equal(stylesheet.id, undefined);
  assert.equal(stylesheet.href, preload.href);
  assert.equal(stylesheet.integrity, preload.integrity);
  assert.equal(stylesheet.crossOrigin, preload.crossOrigin);

  const awaitIndex = js.indexOf("await stylesReady;");
  const revealIndex = js.indexOf(
    'document.getElementById("map").style.display',
  );
  assert.ok(awaitIndex >= 0 && awaitIndex < revealIndex);
});

test("missing stylesheet document or failed load degrades without rejecting", async () => {
  assert.equal(await applyLeafletStyles(null), false);
  assert.equal(await applyLeafletStyles(mockDocument("error")), false);
});

test("the stylesheet loader does not depend on inline event handlers", () => {
  assert.ok(csp, "the repo ships a Content-Security-Policy");
  const scriptSrc = csp.match(/script-src ([^;]+);/)[1];
  assert.ok(!/unsafe-inline/.test(scriptSrc));
  assert.doesNotMatch(html, /<link\b[^>]*onload=/);
});
=======
// The heatmap page's FIRST PAINT, and specifically the one thing on it that// was render-blocking and had no business being.//// WHY THIS IS PINNED. The LCP element on /solar-heatmap/ is the intro// paragraph under the h1 — the largest text on the page, so by definition the// largest contentful paint, and it is in the very first paint with no font, no// image and no data of its own behind it. Measured on the staged build, with// `init()` never called so that no JavaScript on the page could be// responsible:////   desktop, Leaflet CSS as a stylesheet : FCP 1.91-2.23s, LCP 4.51-4.56s//   desktop, Leaflet CSS non-blocking   : FCP 1.06-1.83s, LCP 1.21-2.21s//// A ~2.6s gap that came and went with one third-party link. So the fix is// structural and it is asserted here rather than trusted to review: if a future// edit puts Leaflet's CSS back in front of the first paint, or declares it a// second time, this fails loudly instead of costing a third of a second on// every visitor's first frame.//// Only the properties that can rot are asserted. That the promoted sheet// inherits its href, integrity and crossorigin, and that the page fetches the// file once, is established by the map drawing styled off one network request —// not by reading the source back.import { test } from "node:test";import assert from "node:assert/strict";import fs from "node:fs";const read = (p) =>  fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");const html = read("solar-heatmap/index.html");const styles = read("assets/js/sizing/leaflet-styles.js");const provider = read("assets/js/sizing/map-provider.js");const heatmap = read("assets/js/heatmap.js");const headers = read("_headers");test("the markup declares nothing about Leaflet's stylesheet", () => {  // Not "not as a stylesheet" — nothing at all. A link here would put the  // values back in a second place, which is the state this test exists to end,  // and a stylesheet one would put a third party back in front of the LCP.  assert.doesNotMatch(html, /leaflet@[\d.]+\/dist\/leaflet\.css/);  assert.doesNotMatch(html, /rel="preload"[^>]*as="style"/);});test("the stylesheet's URL and SRI are declared exactly once, and sourced", () => {  assert.match(    styles,    /import \{[^}]*LEAFLET_STYLE_URL[^}]*LEAFLET_STYLE_SRI[^}]*\} from "\.\/map-provider\.js/,    "the module reads the values rather than declaring them",  );  assert.doesNotMatch(styles, /unpkg\.com|sha256-/, "no literal here");  for (const [name, re] of [    ["URL", /unpkg\.com\/leaflet@[\d.]+\/dist\/leaflet\.css/g],    ["SRI", /sha256-p4NxAoJBhIIN\+hmNHrzRCf9tD\/miZyoHS5obTRR9BMY=/g],  ]) {    assert.equal(      [        ...provider.matchAll(re),        ...styles.matchAll(re),        ...html.matchAll(re),        ...heatmap.matchAll(re),      ].length,      1,      `one declaration of the stylesheet ${name} across the repo`,    );  }});test("the map is not revealed before the stylesheet has applied", () => {  // Not waiting means a visible flash of unstyled map: Leaflet's layout rules  // decide where the tile pane and the canvas sit.  assert.ok(    heatmap.indexOf("await stylesReady;") <      heatmap.indexOf('document.getElementById("map").style.display'),    "the await must come before the map is shown, not after",  );  assert.match(    heatmap,    /import \{ applyLeafletStyles \} from "\.\/sizing\/leaflet-styles\.js/,    "heatmap.js takes the stylesheet lifecycle from its module",  );  assert.doesNotMatch(    heatmap,    /leaflet\.css|function applyLeafletStyles/,    "no second copy, and no element id that only existed to look one up",  );});test("a failed stylesheet resolves rather than rejecting", () => {  // Failing the page over one CDN file would be worse than an unstyled map.  assert.match(    styles,    /addEventListener\("error", \(\) => resolve\(false\)/,    "a failed stylesheet resolves false",  );});test("the swap lives in a module because this page's CSP forbids an inline one", () => {  const scriptSrc = headers    .split("\n")    .find((l) => l.trim().startsWith("Content-Security-Policy"))    .match(/script-src ([^;]+);/)[1];  assert.ok(    !/unsafe-inline/.test(scriptSrc),    "script-src has no 'unsafe-inline', so onload=\"this.media='all'\" would be blocked",  );  assert.doesNotMatch(    html,    /<link\b[^>]*onload=/,    "nothing reaches for it instead",  );});
>>>>>>> 14f70278 (refactor(heatmap): delete what the ownership fix did not need)
