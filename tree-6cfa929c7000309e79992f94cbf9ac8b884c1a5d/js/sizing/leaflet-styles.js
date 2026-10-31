<<<<<<< HEAD
// Leaflet stylesheet lifecycle for the heatmap.
// Read the pinned URL, SRI, and CORS mode from map-provider.js, then preload
// and promote a clone after the page has parsed. Failure resolves false so
// a missing CDN stylesheet does not break the map.
import {
  LEAFLET_STYLE_URL,
  LEAFLET_STYLE_SRI,
} from "./map-provider.js?v=20261022j";

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
=======
// Leaflet's stylesheet, for the heatmap page.//// As a stylesheet it is render-blocking: nothing paints until a third party// answers, and it sat in front of the intro paragraph — the largest text on the// page, so the LCP element. Measured on the staged build, heatmap/desktop LCP// was 4.51-4.56s against FCP 1.91-2.23s, and 1.21-2.21s once this file was off// the render-blocking path.//// So it is fetched as a preload (same bytes, same SRI, nothing waits on it to// paint) and the preload is then promoted into the stylesheet. Cloning the// preload rather than writing the values out again is what makes the promoted// sheet inherit href, integrity and crossorigin, and therefore match the// preload in the HTTP cache instead of costing a second request.//// Values come from map-provider.js, which owns every Leaflet URL and pin. They// used to be written out in solar-heatmap/index.html as well, with a test whose// only job was keeping the two copies equal.import {  LEAFLET_STYLE_URL,  LEAFLET_STYLE_SRI,} from "./map-provider.js?v=20261008a";/** * Fetch Leaflet's CSS without letting it block the first paint, then apply it. * * Resolves true when the stylesheet applied, false when it could not be * fetched. It never rejects: an unstyled map is still a working map, and * failing the page over one CDN file would be worse than an ugly one. * * Await this before revealing #map — Leaflet's layout rules decide where the * tile pane and the canvas sit, so showing the map early flashes it unstyled. */export function applyLeafletStyles() {  const preload = document.createElement("link");  preload.rel = "preload";  preload.as = "style";  preload.href = LEAFLET_STYLE_URL;  preload.integrity = LEAFLET_STYLE_SRI;  // Anonymous, and the same mode on the promoted sheet (inherited below), or the  // two are separate cache entries and the page fetches the file twice.  preload.crossOrigin = "anonymous";  document.head.append(preload);  return new Promise((resolve) => {    const stylesheet = preload.cloneNode();    stylesheet.rel = "stylesheet";    stylesheet.removeAttribute("as");    stylesheet.addEventListener("load", () => resolve(true), { once: true });    stylesheet.addEventListener("error", () => resolve(false), { once: true });    document.head.append(stylesheet);  });}
>>>>>>> b862497e (fix(ci): bump asset tokens for audit-fix JS changes; revert downsampleEnvelope validation)
