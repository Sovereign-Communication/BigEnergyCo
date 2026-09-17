// Optional map integration boundary. Importing this module never loads a map
// library, requests coordinates, or changes core sizing behavior.
export const PANEL_AREA_M2 = 6;
export const LEAFLET_SCRIPT_URL =
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
// Subresource-integrity pins, identical to the static pins on
// solar-heatmap/index.html: a compromised CDN response refuses to execute
// instead of running inside the page. Keep all three files on one version.
export const LEAFLET_SCRIPT_SRI =
  "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
export const LEAFLET_STYLE_URL =
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
export const LEAFLET_STYLE_SRI =
  "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
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
      active = provider;
      return provider.init(options);
    },
    onClick(handler) {
      return active?.onClick?.(handler) || (() => {});
    },
    drawRectangle(bounds) {
      return active?.drawRectangle?.(bounds) || null;
    },
    cleanup() {
      const result = active?.cleanup?.();
      active = null;
      return result;
    },
  });
}

export function manualRoofHint(areaM2) {
  const panels = panelCapFromArea(areaM2);
  return `${Math.round(Number(areaM2) || 0)} m² is about ${panels} panels at ~${PANEL_AREA_M2} m² each.`;
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
  let scriptHost = "";
  try {
    scriptHost = new URL(scriptUrl).hostname;
  } catch {
    return false;
  }
  if (scriptHost !== optionalMapPolicy.allowedScriptHost) return false;
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
        maxZoom: 19,
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
  allowedScriptHost: "unpkg.com",
  allowedTileHosts: Object.freeze([
    "server.arcgisonline.com",
    "basemaps.cartocdn.com",
  ]),
});
