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
