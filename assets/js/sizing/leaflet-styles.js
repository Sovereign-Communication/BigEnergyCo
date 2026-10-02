// Leaflet's stylesheet, for the heatmap page.
//
// WHY THIS IS ITS OWN MODULE. The stylesheet's URL, SRI hash and CORS mode are
// owned by map-provider.js, which has owned every Leaflet URL and pin in this
// repo since the optional map was added. Before this module they were ALSO
// written out by hand in solar-heatmap/index.html, with a comment in
// map-provider.js acknowledging the duplication and a test in
// tests/polish-pass1.test.mjs whose only job was to keep the two copies equal.
// Two declarations of one pin is one more than a resource should have, because
// a maintainer can edit either and the failure mode is a silently unpinned
// third-party stylesheet rather than a broken build. So there is now one
// declaration, here, and the markup says nothing about Leaflet's CSS.
//
// WHAT IT DOES, and the reason it is not just a <link> in the head. As a
// stylesheet, Leaflet's CSS is render-blocking: nothing paints until a third
// party answers. That is what the heatmap's LCP is — the intro paragraph is the
// largest text on the page, so it is the largest contentful paint, and it was
// waiting behind this file. Measured on the staged build, heatmap/desktop LCP
// was 4.51-4.56s against FCP 1.91-2.23s, and 1.21-2.21s once this file was off
// the render-blocking path.
//
// So the file is fetched as a preload (same bytes, same SRI, but nothing waits
// on it to paint) and the preload is then promoted into the real stylesheet.
// Cloning the preload rather than writing the values out again is the point:
// the clone inherits href, integrity and crossorigin, which is both why the SRI
// cannot drift and why the promoted sheet matches the preload in the HTTP
// cache instead of costing a second request.
//
// The promotion is awaited before the map is revealed, because Leaflet's layout
// rules decide where the tile pane and the canvas sit and showing the map
// against an unstyled Leaflet is a visible flash. That await is what makes the
// caller responsible for starting this early — see heatmap.js init().
import {
  LEAFLET_STYLE_URL,
  LEAFLET_STYLE_SRI,
} from "./map-provider.js?v=20261001b";

// The element id, owned here for the same reason the URL is. Nothing outside
// this module needs it; nothing outside this module should have to know it.
const PRELOAD_ID = "leaflet-css";

/**
 * Fetch Leaflet's CSS without letting it block the first paint, then apply it.
 *
 * Resolves true when the stylesheet applied and false when it could not be
 * fetched. It never rejects: a missing third-party stylesheet leaves the map
 * unstyled, which is still a working map, and failing the whole page over one
 * CDN file would be worse than an ugly one.
 */
export function applyLeafletStyles(documentRef = globalThis.document) {
  if (!documentRef) return Promise.resolve(false);

  const preloaded = documentRef.createElement("link");
  preloaded.id = PRELOAD_ID;
  preloaded.rel = "preload";
  preloaded.as = "style";
  preloaded.href = LEAFLET_STYLE_URL;
  preloaded.integrity = LEAFLET_STYLE_SRI;
  // Anonymous, and the SAME mode on both tags, or they are different cache
  // entries and the page fetches the file twice.
  preloaded.crossOrigin = "anonymous";
  documentRef.head.append(preloaded);

  return new Promise((resolve) => {
    const stylesheet = preloaded.cloneNode();
    stylesheet.rel = "stylesheet";
    stylesheet.removeAttribute("as");
    stylesheet.removeAttribute("id");
    stylesheet.addEventListener("load", () => resolve(true), { once: true });
    stylesheet.addEventListener("error", () => resolve(false), { once: true });
    documentRef.head.append(stylesheet);
  });
}
