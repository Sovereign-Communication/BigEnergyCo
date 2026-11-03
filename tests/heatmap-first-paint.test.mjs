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
// edit puts Leaflet's CSS back in front of the first paint, or declares it a
// second time, this fails loudly instead of costing a third of a second on
// every visitor's first frame.
//
// Only the properties that can rot are asserted. That the promoted sheet
// inherits its href, integrity and crossorigin, and that the page fetches the
// file once, is established by the map drawing styled off one network request —
// not by reading the source back.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { dirname, join } from "node:path";

import { deployList } from "../scripts/lib/deploy-manifest.mjs";

const read = (p) =>
  fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const html = read("solar-heatmap/index.html");
const styles = read("assets/js/sizing/leaflet-styles.js");
const provider = read("assets/js/sizing/map-provider.js");
const heatmap = read("assets/js/heatmap.js");
const headers = read("_headers");

test("the markup declares nothing about Leaflet's stylesheet", () => {
  // Not "not as a stylesheet" — nothing at all. A link here would put the
  // values back in a second place, which is the state this test exists to end,
  // and a stylesheet one would put a third party back in front of the LCP.
  assert.doesNotMatch(html, /leaflet@[\d.]+\/dist\/leaflet\.css/);
  assert.doesNotMatch(html, /rel="preload"[^>]*as="style"/);
});

test("the stylesheet's URL and SRI are declared exactly once, and sourced", () => {
  assert.match(
    styles,
    /import \{[^}]*LEAFLET_STYLE_URL[^}]*LEAFLET_STYLE_SRI[^}]*\} from "\.\/map-provider\.js/,
    "the module reads the values rather than declaring them",
  );
  assert.doesNotMatch(styles, /unpkg\.com|sha256-/, "no literal here");
  for (const [name, re] of [
    ["URL", /unpkg\.com\/leaflet@[\d.]+\/dist\/leaflet\.css/g],
    ["SRI", /sha256-p4NxAoJBhIIN\+hmNHrzRCf9tD\/miZyoHS5obTRR9BMY=/g],
  ]) {
    assert.equal(
      [
        ...provider.matchAll(re),
        ...styles.matchAll(re),
        ...html.matchAll(re),
        ...heatmap.matchAll(re),
      ].length,
      1,
      `one declaration of the stylesheet ${name} across the repo`,
    );
  }
});

test("the map is not revealed before the stylesheet has applied", () => {
  // Not waiting means a visible flash of unstyled map: Leaflet's layout rules
  // decide where the tile pane and the canvas sit.
  assert.ok(
    heatmap.indexOf("await stylesReady;") <
      heatmap.indexOf('document.getElementById("map").style.display'),
    "the await must come before the map is shown, not after",
  );
  assert.match(
    heatmap,
    /import \{ applyLeafletStyles \} from "\.\/sizing\/leaflet-styles\.js/,
    "heatmap.js takes the stylesheet lifecycle from its module",
  );
  assert.doesNotMatch(
    heatmap,
    /leaflet\.css|function applyLeafletStyles/,
    "no second copy, and no element id that only existed to look one up",
  );
});

test("a failed stylesheet resolves rather than rejecting", () => {
  // Failing the page over one CDN file would be worse than an unstyled map.
  assert.match(
    styles,
    /addEventListener\("error", \(\) => resolve\(false\)/,
    "a failed stylesheet resolves false",
  );
});

test("the swap lives in a module because this page's CSP forbids an inline one", () => {
  const scriptSrc = headers
    .split("\n")
    .find((l) => l.trim().startsWith("Content-Security-Policy"))
    .match(/script-src ([^;]+);/)[1];
  assert.ok(
    !/unsafe-inline/.test(scriptSrc),
    "script-src has no 'unsafe-inline', so onload=\"this.media='all'\" would be blocked",
  );
  assert.doesNotMatch(
    html,
    /<link\b[^>]*onload=/,
    "nothing reaches for it instead",
  );
});

test("the map is loaded as a module, and the page says so", () => {
  // The rebased head shipped the tag without `type="module"` while
  // heatmap.js kept its imports: the browser threw "Cannot use import
  // statement outside a module", the map never initialized, and Lighthouse
  // charged the page four best-practices points for the console error. The
  // two facts are pinned together because each one alone looks fine.
  assert.ok(
    /^\s*import /m.test(heatmap),
    "heatmap.js is a module — it imports its grid, dots and stylesheet modules",
  );
  assert.match(
    html,
    /<script type="module" src="\.\.\/assets\/js\/heatmap\.js\?v=[^"]+"><\/script>/,
    "so the page must declare it as one — a classic tag throws on the first import",
  );
});

test("every shipped page declares the module it loads", () => {
  // The heatmap tag is the instance; this is the rule. A page that takes a
  // classic <script> for a file that imports is broken in the browser and
  // invisible to every read of the source: the module looks fine and only
  // the tag is wrong, which is exactly how the rebase broke this page.
  const bad = [];
  for (const page of deployList().filter((p) => p.endsWith(".html"))) {
    const source = read(page);
    for (const m of source.matchAll(
      /<script\b([^>]*?)src="([^"]+)"([^>]*?)>/g,
    )) {
      const attrs = `${m[1]} ${m[3]}`;
      const src = m[2].split("?")[0];
      if (/^(?:[a-z]+:)?\/\//i.test(m[2])) continue; // third party
      let js;
      try {
        js = read(join(dirname(page), src));
      } catch {
        continue; // a missing first-party script is another gate's finding
      }
      if (/^\s*(?:import|export)\s/m.test(js) && !/type="module"/.test(attrs)) {
        bad.push(`${page} -> ${src} (a module loaded as a classic script)`);
      }
    }
  }
  assert.deepEqual(
    bad,
    [],
    `shipped page(s) load a module as a classic script:\n  ${bad.join("\n  ")}`,
  );
});
