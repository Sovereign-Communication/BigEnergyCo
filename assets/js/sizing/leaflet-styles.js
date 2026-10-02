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
