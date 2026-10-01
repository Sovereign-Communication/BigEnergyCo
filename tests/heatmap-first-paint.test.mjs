// Keep Leaflet CSS off the render-blocking path and reveal the map only
// after the stylesheet is ready.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(
  new URL("../solar-heatmap/index.html", import.meta.url),
  "utf8",
);
const js = fs.readFileSync(
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

test("Leaflet's CSS is preloaded, not linked as a render-blocking stylesheet", () => {
  // A <link rel="stylesheet"> for leaflet.css anywhere in the document puts a
  // third-party round trip in front of the LCP element. Assert the absence,
  // not just the presence of the preload, so a leftover second link is caught.
  const stylesheetLinks = [...html.matchAll(/<link\b[^>]*>/g)].filter(
    (m) => /rel="stylesheet"/.test(m[0]) && /leaflet\.css/.test(m[0]),
  );
  assert.deepEqual(
    stylesheetLinks.map((m) => m[0]),
    [],
    "leaflet.css must not be a render-blocking stylesheet",
  );

  const preloads = [...html.matchAll(/<link\b[^>]*>/g)].filter(
    (m) =>
      /rel="preload"/.test(m[0]) &&
      /as="style"/.test(m[0]) &&
      /leaflet\.css/.test(m[0]),
  );
  assert.equal(preloads.length, 1, "exactly one leaflet.css preload");
  assert.match(preloads[0][0], /integrity="sha256-/, "the preload keeps SRI");
  assert.match(
    preloads[0][0],
    /crossorigin=""/,
    "the preload keeps the CORS mode",
  );
});

test("the preload carries the id heatmap.js promotes it by", () => {
  assert.match(
    html,
    /<link\b[^>]*id="leaflet-css"[^>]*>/,
    "the preload needs id=leaflet-css so the module can find it",
  );
  assert.match(html, /<link\b[^>]*id="leaflet-css"[^>]*rel="preload"/);
});

test("heatmap.js promotes the preload by CLONING it, so SRI survives", () => {
  assert.match(
    js,
    /getElementById\("leaflet-css"\)/,
    "the module promotes the declared preload",
  );
  assert.match(
    js,
    /cloneNode\(\)/,
    "clone, so href/integrity/crossorigin carry over",
  );
  assert.match(js, /link\.rel = "stylesheet"/);
  assert.match(
    js,
    /removeAttribute\("as"\)/,
    "a stylesheet must not keep as=style",
  );
  assert.match(
    js,
    /removeAttribute\("id"\)/,
    "the clone must not duplicate the id",
  );
  // A literal URL here would be a second declaration that can drift from the
  // markup's, and the whole point of the clone is that there is only one.
  assert.doesNotMatch(
    js,
    /unpkg\.com\/leaflet@[\d.]+\/dist\/leaflet\.css/,
    "the URL is declared once, in the markup",
  );
});

test("the map is not revealed before the stylesheet has applied", () => {
  // Not waiting would mean a visible flash of unstyled map: Leaflet's layout
  // rules decide where the tile pane and the canvas sit.
  const awaitIdx = js.indexOf("await stylesReady;");
  const revealIdx = js.indexOf('document.getElementById("map").style.display');
  assert.ok(awaitIdx > -1, "init awaits the stylesheet");
  assert.ok(revealIdx > -1, "init still reveals the map");
  assert.ok(
    awaitIdx < revealIdx,
    "the await has to come BEFORE the map is shown, not after",
  );
});

test("a missing preload degrades to an unstyled map, never a broken page", () => {
  // Failing init over a third-party CSS file would be worse than an unstyled
  // map, so both the absent link and a failed load resolve rather than throw.
  assert.match(
    js,
    /if \(!preloaded\) return Promise\.resolve\(false\)/,
    "no preload is not an error",
  );
  assert.match(
    js,
    /addEventListener\("error", \(\) => resolve\(false\)/,
    "a failed stylesheet resolves instead of rejecting",
  );
});

test("the swap is in the module because this page's CSP forbids an inline one", () => {
  assert.ok(csp, "the repo ships a Content-Security-Policy");
  const scriptSrc = csp.match(/script-src ([^;]+);/)[1];
  assert.ok(
    !/unsafe-inline/.test(scriptSrc),
    "script-src has no 'unsafe-inline', so onload=\"this.media='all'\" would be blocked",
  );
  // Which is why the markup must not have reached for it in the first place.
  assert.doesNotMatch(
    html,
    /<link\b[^>]*onload=/,
    "no inline onload on a link (blocked by CSP)",
  );
});
