// Optional map integration boundary. Importing this module never loads a map
// library, requests coordinates, or changes core sizing behavior.
import { translate as t } from "../shared/i18n.js?v=20261026c";

const PANEL_AREA_M2 = 6;
function versionedLocalAsset(path) {
  const url = new URL(path, import.meta.url);
  const version = new URL(import.meta.url).searchParams.get("v");
  if (version) url.searchParams.set("v", version);
  return url.href;
}

export const LEAFLET_SCRIPT_URL = versionedLocalAsset(
  "../../vendor/leaflet/leaflet.js",
);
// Subresource-integrity pins, identical to the static pins on
// solar-heatmap/index.html: a changed vendored response refuses to execute.
// Keep the library, stylesheet, and static page pins on one release.
export const LEAFLET_SCRIPT_SRI =
  "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
const LEAFLET_STYLE_URL = versionedLocalAsset(
  "../../vendor/leaflet/leaflet.css",
);
export const LEAFLET_STYLE_SRI =
  "sha256-M3v8pcq9A7OYFbJwD+vis7ft9VkhxZzUn4jssyghIwM=";
export const CARTO_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
// Keyless satellite basemap — same public ArcGIS Online World Imagery service
// God's Eye View uses as its default keyless "Esri Satellite" stack. No API
// key, no billing; Esri requires visible attribution, which Leaflet renders
// from the `attribution` option below.
export const ESRI_SATELLITE_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const ESRI_ATTRIBUTION =
  "Powered by Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";

export function panelCapFromArea(areaM2, panelAreaM2 = PANEL_AREA_M2) {
  const area = Number(areaM2);
  const panelArea = Number(panelAreaM2);
  if (
    !Number.isFinite(area) ||
    area <= 0 ||
    !Number.isFinite(panelArea) ||
    panelArea <= 0
  )
    return 0;
  return Math.max(0, Math.floor(area / panelArea));
}

export function pvCapKwFromArea(
  areaM2,
  // Same 550 W class the sizer caps with (bom.js PANEL_WATTS_DEFAULT): one
  // square meter means the same panels everywhere, not 400 W here and
  // 550 W there. Callers sizing odd hardware pass panelWatts explicitly.
  panelWatts = 550,
  panelAreaM2 = PANEL_AREA_M2,
) {
  const count = panelCapFromArea(areaM2, panelAreaM2);
  return (count * Number(panelWatts)) / 1000;
}

// Three-tap rotated rectangle: taps A and B are adjacent corners along one
// roof edge; tap P lands on (or near) the opposite edge. Returns the four
// corners [A, B, C, D] of the true rectangle, or null when the taps are
// degenerate (A == B, or P on the AB line). Works in a local equirectangular
// projection so roofs rotated off north-south align instead of forcing an
// axis-aligned box that over-measures.
export function rotatedRectangleCorners(a, b, p) {
  const pa = Array.isArray(a) ? a : [a?.lat, a?.lng];
  const pb = Array.isArray(b) ? b : [b?.lat, b?.lng];
  const pp = Array.isArray(p) ? p : [p?.lat, p?.lng];
  const nums = [pa[0], pa[1], pb[0], pb[1], pp[0], pp[1]].map(Number);
  if (!nums.every(Number.isFinite)) return null;
  const [latA, lonA, latB, lonB, latP, lonP] = nums;
  const metresPerDegree = 111_320;
  const meanLat = ((latA + latB + latP) / 3) * (Math.PI / 180);
  const kx = metresPerDegree * Math.cos(meanLat);
  const toXY = (lat, lon) => [lon * kx, lat * metresPerDegree];
  const fromXY = (x, y) => [y / metresPerDegree, x / kx];
  const [ax, ay] = toXY(latA, lonA);
  const [bx, by] = toXY(latB, lonB);
  const [px, py] = toXY(latP, lonP);
  const abx = bx - ax;
  const aby = by - ay;
  const edgeLen = Math.hypot(abx, aby);
  if (!(edgeLen > 0)) return null;
  // Unit normal to the AB edge; width is the signed perpendicular distance
  // from P to the AB line, so tapping either side of the edge works.
  const nx = -aby / edgeLen;
  const ny = abx / edgeLen;
  const width = (px - ax) * nx + (py - ay) * ny;
  if (!(Math.abs(width) > 0)) return null;
  const cx = bx + width * nx;
  const cy = by + width * ny;
  const dx = ax + width * nx;
  const dy = ay + width * ny;
  return [fromXY(ax, ay), fromXY(bx, by), fromXY(cx, cy), fromXY(dx, dy)];
}

export function rotatedRectangleAreaM2(a, b, p) {
  const corners = rotatedRectangleCorners(a, b, p);
  if (!corners) return 0;
  // Adjacent edges in the equirectangular plane: |AB| * |BC|.
  const metresPerDegree = 111_320;
  const meanLat = ((corners[0][0] + corners[2][0]) / 2) * (Math.PI / 180);
  const kx = metresPerDegree * Math.cos(meanLat);
  const edge = (q, r) =>
    Math.hypot((r[1] - q[1]) * kx, (r[0] - q[0]) * metresPerDegree);
  return Math.max(
    0,
    edge(corners[0], corners[1]) * edge(corners[1], corners[2]),
  );
}

export function rectangleAreaM2(first, second) {
  const a = Array.isArray(first) ? first : [first?.lat, first?.lng];
  const b = Array.isArray(second) ? second : [second?.lat, second?.lng];
  const lat1 = Number(a[0]);
  const lon1 = Number(a[1]);
  const lat2 = Number(b[0]);
  const lon2 = Number(b[1]);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return 0;
  const metresPerDegree = 111_320;
  const meanLat = ((lat1 + lat2) / 2) * (Math.PI / 180);
  const width = Math.abs(lon2 - lon1) * metresPerDegree * Math.cos(meanLat);
  const height = Math.abs(lat2 - lat1) * metresPerDegree;
  return Math.max(0, width * height);
}

export function createMapProviderRegistry(providers = []) {
  let active = null;
  const registry = providers.filter(
    (provider) => provider && typeof provider.init === "function",
  );
  return Object.freeze({
    available: () =>
      registry.some((provider) => provider.available?.() !== false),
    providers: () => [...registry],
    async init(options = {}) {
      const provider = registry.find(
        (candidate) => candidate.available?.() !== false,
      );
      if (!provider) return null;
      // Install only AFTER a successful init. Assigning first meant a
      // provider whose init rejected stayed reachable: onClick,
      // drawRectangle and drawPolygon would call into a map that was never
      // created, and the registry would look ready to every later caller.
      // ui.js happens to cleanup() in its catch, so no shipped path breaks
      // today - but that compensation sits a module away from the invariant
      // and the next caller would not know to repeat it.
      const result = await provider.init(options);
      active = provider;
      return result;
    },
    onClick(handler) {
      return active?.onClick?.(handler) || (() => {});
    },
    drawRectangle(bounds) {
      return active?.drawRectangle?.(bounds) || null;
    },
    drawPolygon(corners) {
      return active?.drawPolygon?.(corners) || null;
    },
    cleanup() {
      const result = active?.cleanup?.();
      active = null;
      return result;
    },
  });
}

// Dictionary-first with an English fallback (the chat.js chatText contract):
// translate echoes the KEY until the deferred dictionary lands, and this copy
// is composed synchronously — a key echo must never reach a visitor or a
// caller. tests/map-feature.test.mjs holds the unbooted path to the English.
export function manualRoofHint(areaM2) {
  const area = Math.round(Number(areaM2) || 0);
  const panels = panelCapFromArea(areaM2);
  const value = t("roofPanelEstimate", {
    area,
    panels,
    panelArea: PANEL_AREA_M2,
  });
  return value !== "roofPanelEstimate"
    ? value
    : `${area} m² is about ${panels} panels at ~${PANEL_AREA_M2} m² each.`;
}

// Policy enforcement: the constants above are the ONLY network destinations
// the optional map may touch. If a future edit points them elsewhere, init
// refuses loudly instead of leaking coordinates to an unreviewed host.
function templateHost(template) {
  try {
    return new URL(String(template).replace("{s}.", "a.")).hostname;
  } catch {
    return "";
  }
}

export function mapUrlsAllowed(
  scriptUrl = LEAFLET_SCRIPT_URL,
  tileUrls = [ESRI_SATELLITE_TILE_URL, CARTO_TILE_URL],
) {
  let script;
  let expectedScript;
  try {
    script = new URL(scriptUrl);
    expectedScript = new URL(LEAFLET_SCRIPT_URL);
  } catch {
    return false;
  }
  if (
    script.origin !== expectedScript.origin ||
    script.pathname !== expectedScript.pathname
  )
    return false;
  const tiles = optionalMapPolicy.allowedTileHosts || [];
  return tileUrls.every((u) => {
    const host = templateHost(u);
    return (
      host !== "" && tiles.some((t) => host === t || host.endsWith(`.${t}`))
    );
  });
}

function loadStylesheet(documentRef, href, integrity) {
  if (!documentRef || documentRef.querySelector(`link[href="${href}"]`))
    return null;
  const link = documentRef.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  if (integrity) {
    link.integrity = integrity;
    link.crossOrigin = "anonymous";
  }
  documentRef.head.appendChild(link);
  return link;
}

export function createLeafletProvider({
  windowRef = globalThis.window,
  documentRef = globalThis.document,
} = {}) {
  let map = null;
  let script = null;
  let style = null;
  return {
    available: () => !!windowRef && !!documentRef,
    async init({ element, latitude, longitude, zoom = 19 } = {}) {
      if (!element || !this.available()) return null;
      if (!mapUrlsAllowed())
        throw new Error("Optional map provider blocked by host policy");
      style = loadStylesheet(documentRef, LEAFLET_STYLE_URL, LEAFLET_STYLE_SRI);
      if (!windowRef.L) {
        script = documentRef.createElement("script");
        script.src = LEAFLET_SCRIPT_URL;
        script.integrity = LEAFLET_SCRIPT_SRI;
        script.crossOrigin = "anonymous";
        script.async = true;
        documentRef.head.appendChild(script);
        await new Promise((resolve, reject) => {
          script.addEventListener("load", resolve, { once: true });
          script.addEventListener(
            "error",
            () => reject(new Error("Optional map provider failed to load")),
            { once: true },
          );
        });
      }
      if (!windowRef.L) throw new Error("Leaflet did not initialize");
      map = windowRef.L.map(element).setView([latitude, longitude], zoom);
      // Satellite imagery first (keyless Esri World Imagery, like God's Eye
      // View), with the CARTO street map as the named fallback so the picker
      // still works if Esri tiles are unreachable.
      windowRef.L.tileLayer(ESRI_SATELLITE_TILE_URL, {
        // Esri World Imagery ships native tiles to z19; allow zooming to
        // z21 (upscaled) so users get the closest possible look at their roof.
        maxNativeZoom: 19,
        maxZoom: 21,
        attribution: ESRI_ATTRIBUTION,
      }).addTo(map);
      windowRef.L.tileLayer(CARTO_TILE_URL, {
        maxZoom: 20,
        opacity: 0,
        attribution: "© OpenStreetMap © CARTO",
      }).addTo(map);
      return map;
    },
    onClick(handler) {
      if (!map || typeof handler !== "function") return () => {};
      const listener = (event) => handler(event.latlng?.lat, event.latlng?.lng);
      map.on("click", listener);
      return () => map.off("click", listener);
    },
    drawRectangle(bounds) {
      if (!map || !windowRef.L || !bounds) return null;
      return windowRef.L.rectangle(bounds, {
        color: "#00e699",
        weight: 2,
        fillColor: "#00e699",
        fillOpacity: 0.16,
      }).addTo(map);
    },
    drawPolygon(corners) {
      if (!map || !windowRef.L || !Array.isArray(corners) || corners.length < 3)
        return null;
      return windowRef.L.polygon(corners, {
        color: "#00e699",
        weight: 2,
        fillColor: "#00e699",
        fillOpacity: 0.16,
      }).addTo(map);
    },
    cleanup() {
      map?.remove?.();
      map = null;
      script?.remove?.();
      style?.remove?.();
      script = null;
      style = null;
    },
  };
}

// Leaflet is deliberately not imported at module evaluation time. The UI may
// register this provider after an explicit user action; core sizing remains
// usable when scripts, tiles, or geolocation are blocked.
export const optionalMapPolicy = Object.freeze({
  lazy: true,
  stored: false,
  allowedScriptOrigin: new URL(LEAFLET_SCRIPT_URL).origin,
  allowedScriptPath: new URL(LEAFLET_SCRIPT_URL).pathname,
  allowedTileHosts: Object.freeze([
    "server.arcgisonline.com",
    "basemaps.cartocdn.com",
  ]),
});
