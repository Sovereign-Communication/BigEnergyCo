// The heatmap page's FIRST PAINT, and specifically the one thing on it that
// was render-blocking and had no business being.
//
// WHY THIS IS PINNED. The LCP element on /solar-heatmap/ is the intro
// paragraph under the h1 — the largest text on the page, so by definition the
// largest contentful paint, and it is in the very first paint with no font, no
// image and no data of its own behind it. Measured on the staged build, with
// `init()` never called so that no JavaScript on the page could be
// responsible:
//
//   desktop, Leaflet CSS as a stylesheet : FCP 1.91-2.23s, LCP 4.51-4.56s
//   desktop, Leaflet CSS non-blocking   : FCP 1.06-1.83s, LCP 1.21-2.21s
//
// A ~2.6s gap that came and went with one third-party link. So the fix is
// structural and it is asserted here rather than trusted to review: if a future
// edit puts Leaflet's CSS back in front of the first paint, this fails loudly
// instead of costing a third of a second on every visitor's first frame.
//
// It also pins WHERE the values live. They used to be written out twice — once
// in this markup and once in assets/js/heatmap.js — and a comment in
// map-provider.js plus a test in tests/polish-pass1.test.mjs existed only to
// keep the two copies equal. Two declarations of one SRI pin means a maintainer
// can edit either and the failure is a silently unpinned third-party file rather
// than a broken build. One declaration, in the module, is the property now.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(
  new URL("../solar-heatmap/index.html", import.meta.url),
  "utf8",
);
const styles = fs.readFileSync(
  new URL("../assets/js/sizing/leaflet-styles.js", import.meta.url),
  "utf8",
);
const provider = fs.readFileSync(
  new URL("../assets/js/sizing/map-provider.js", import.meta.url),
  "utf8",
);
const heatmap = fs.readFileSync(
  new URL("../assets/js/heatmap.js", import.meta.url),
  "utf8",
);
const headers = fs.readFileSync(
  new URL("../_headers", import.meta.url),
  "utf8",
);

const csp = headers
  .split("\n")
  .find((l) => l.trim().startsWith("Content-Security-Policy"));

test("the markup declares nothing about Leaflet's stylesheet", () => {
  // Not "not as a stylesheet" — nothing at all. A preload link here would put
  // the values back in a second place, which is the state this test exists to
  // end. The file is fetched and promoted by the module instead.
  const links = [...html.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]);
  assert.deepEqual(
    links.filter((l) => /leaflet\.css/.test(l)),
    [],
    "leaflet.css must not be declared in the markup at all",
  );
  assert.doesNotMatch(html, /leaflet@1\.9\.4\/dist\/leaflet\.css/);
  assert.doesNotMatch(html, /rel="preload"[^>]*as="style"/);
});

test("the module owns the href, the SRI hash and the CORS mode, once each", () => {
  // Sourced, not restated: the values live in map-provider.js, which has owned
  // every Leaflet URL and pin in this repo, and leaflet-styles.js reads them.
  assert.match(
    styles,
    /import \{[^}]*LEAFLET_STYLE_URL[^}]*LEAFLET_STYLE_SRI[^}]*\} from "\.\/map-provider\.js/,
    "the stylesheet module reads the values rather than declaring them",
  );
  assert.doesNotMatch(styles, /unpkg\.com\/leaflet/, "no URL literal here");
  assert.doesNotMatch(styles, /sha256-/, "no SRI literal here");
  // And map-provider.js declares each exactly once.
  assert.equal(
    [...provider.matchAll(/unpkg\.com\/leaflet@[\d.]+\/dist\/leaflet\.css/g)]
      .length,
    1,
    "one declaration of the stylesheet URL in the repo",
  );
  assert.equal(
    [
      ...provider.matchAll(
        /sha256-p4NxAoJBhIIN\+hmNHrzRCf9tD\/miZyoHS5obTRR9BMY=/g,
      ),
    ].length,
    1,
    "one declaration of the stylesheet SRI in the repo",
  );
});

test("the stylesheet is preloaded, then cloned into a stylesheet", () => {
  // Cloning is load-bearing twice over: the clone inherits href, integrity and
  // crossorigin, so the pin cannot drift and the promoted sheet matches the
  // preload in cache rather than costing a second request.
  assert.match(styles, /\.rel = "preload"/);
  assert.match(
    styles,
    /\.as = "style"/,
    "a preload that is not `as=style` is not used",
  );
  assert.match(styles, /cloneNode\(\)/);
  assert.match(styles, /\.rel = "stylesheet"/);
  assert.match(styles, /removeAttribute\("as"\)/, "a stylesheet keeps no `as`");
  assert.match(
    styles,
    /removeAttribute\("id"\)/,
    "the clone must not duplicate the preload's id",
  );
  // Same anonymous CORS mode on both tags, or they are two cache entries and the
  // page fetches the file twice. It is written ONCE, on the preload, and the
  // clone inherits it — so the two tags cannot disagree.
  assert.equal(
    [...styles.matchAll(/crossOrigin = "anonymous"/g)].length,
    1,
    "the CORS mode is declared once and inherited by the clone",
  );
});

test("the map is not revealed before the stylesheet has applied", () => {
  // Not waiting would mean a visible flash of unstyled map: Leaflet's layout
  // rules decide where the tile pane and the canvas sit.
  const awaitIdx = heatmap.indexOf("await stylesReady;");
  const revealIdx = heatmap.indexOf(
    'document.getElementById("map").style.display',
  );
  assert.ok(awaitIdx > -1, "init awaits the stylesheet");
  assert.ok(revealIdx > -1, "init still reveals the map");
  assert.ok(
    awaitIdx < revealIdx,
    "the await has to come BEFORE the map is shown, not after",
  );
  // heatmap.js delegates rather than owning it, so the seventh concern does not
  // grow a sixth.
  assert.match(
    heatmap,
    /import \{ applyLeafletStyles \} from "\.\/sizing\/leaflet-styles\.js/,
    "heatmap.js takes the stylesheet lifecycle from its module",
  );
  assert.doesNotMatch(heatmap, /function applyLeafletStyles/, "no local copy");
  assert.doesNotMatch(heatmap, /leaflet-css/, "the id lives in the module");
});

test("a missing document or a failed stylesheet degrades, never throws", () => {
  // Failing init over a third-party CSS file would be worse than an unstyled
  // map, so both resolve rather than reject.
  assert.match(
    styles,
    /if \(!documentRef\) return Promise\.resolve\(false\)/,
    "no document is not an error",
  );
  assert.match(
    styles,
    /addEventListener\("error", \(\) => resolve\(false\)/,
    "a failed stylesheet resolves instead of rejecting",
  );
});

test("the swap is in a module because this page's CSP forbids an inline one", () => {
  assert.ok(csp, "the repo ships a Content-Security-Policy");
  const scriptSrc = csp.match(/script-src ([^;]+);/)[1];
  assert.ok(
    !/unsafe-inline/.test(scriptSrc),
    "script-src has no 'unsafe-inline', so onload=\"this.media='all'\" would be blocked",
  );
  // Which is why nothing may reach for it in the markup.
  assert.doesNotMatch(
    html,
    /<link\b[^>]*onload=/,
    "no inline onload on a link",
  );
});
