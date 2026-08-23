// NASA POWER hourly data client.
// Browser-first (localStorage cache) with an injectable fetch so the same
// parser runs under Node for tests and fixtures.
//
// Verified API contract (probed 2026-08-22, API v2.9.9):
//   GET https://power.larc.nasa.gov/api/temporal/hourly/point
//       ?parameters=ALLSKY_SFC_SW_DWN,T2M
//       &community=RE&latitude=..&longitude=..
//       &start=YYYYMMDD&end=YYYYMMDD&format=JSON
//   -> GeoJSON Feature; properties.parameter.<PARAM>["YYYYMMDDHH"] = value
//   ALLSKY_SFC_SW_DWN is W/m² averaged over the hour; T2M is °C.
//   Timestamps are LOCAL SOLAR TIME (time_standard=LST) — hour-of-day lines up
//   with load profiles without timezone math. Fill value: -999.

export const POWER_HOURLY_URL = "https://power.larc.nasa.gov/api/temporal/hourly/point";

/**
 * Fetch N years of hourly GHI + temperature ending at the last complete year.
 * @param {object} opts
 * @param {number} opts.latitude
 * @param {number} opts.longitude
 * @param {number} [opts.years=5]
 * @param {(url:string)=>Promise<Response>} [opts.fetchImpl]
 * @returns {{hours: Array<{ghi:number,tAmb:number}>, meta: object}}
 */
export async function fetchHourlySeries({ latitude, longitude, years = 5, fetchImpl = fetch }) {
  // NASA POWER hourly solar data begins 2001-01-01. End at Dec 31 of last
  // complete year so every request covers full years (fair tier statistics).
  const now = new Date();
  const endYear = now.getUTCFullYear() - 1;
  const startYear = endYear - years + 1;

  // Request in <=2-year chunks to keep responses small and retryable.
  const hours = [];
  for (let y = startYear; y <= endYear; y += 2) {
    const yEnd = Math.min(y + 1, endYear);
    const url = buildUrl(latitude, longitude, `${y}0101`, `${yEnd}1231`);
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`NASA POWER request failed (${res.status})`);
    const json = await res.json();
    hours.push(...parseHourly(json));
  }

  return {
    hours,
    meta: {
      latitude, longitude,
      startYear, endYear, years,
      source: "NASA POWER MERRA2/SYN1DEG via power.larc.nasa.gov",
      retrievedAt: now.toISOString(),
      timeStandard: "LST",
      parameters: ["ALLSKY_SFC_SW_DWN", "T2M"],
    },
  };
}

export function buildUrl(latitude, longitude, start, end) {
  return (
    `${POWER_HOURLY_URL}?parameters=ALLSKY_SFC_SW_DWN,T2M` +
    `&community=RE&latitude=${latitude}&longitude=${longitude}` +
    `&start=${start}&end=${end}&format=JSON`
  );
}

/** Parse a POWER hourly JSON response into [{ghi, tAmb}] in LST order. */
export function parseHourly(json) {
  const ghi = json?.properties?.parameter?.ALLSKY_SFC_SW_DWN;
  const t2m = json?.properties?.parameter?.T2M;
  if (!ghi || !t2m) throw new Error("unexpected NASA POWER payload shape");
  const keys = Object.keys(ghi).sort();
  return keys.map((k) => ({
    stamp: k,
    hourOfDay: parseInt(k.slice(8, 10), 10),
    ghi: ghi[k] === -999 ? NaN : ghi[k],
    tAmb: t2m[k] === -999 ? NaN : t2m[k],
  }));
}

// ── Browser cache (localStorage) ────────────────────────────────────────────

const CACHE_PREFIX = "beco-power-v1:";

function cacheKey(lat, lon, years) {
  const rlat = lat.toFixed(2), rlon = lon.toFixed(2); // ~1.1 km grid
  return `${CACHE_PREFIX}${rlat},${rlon},${years}y`;
}

export async function fetchHourlyCached(opts, store = typeof localStorage !== "undefined" ? localStorage : null) {
  const key = cacheKey(opts.latitude, opts.longitude, opts.years || 5);
  if (store) {
    const hit = store.getItem(key);
    if (hit) {
      try { return JSON.parse(hit); } catch { store.removeItem(key); }
    }
  }
  const data = await fetchHourlySeries(opts);
  data.meta.gridKey = key;
  if (store) {
    try { store.setItem(key, JSON.stringify(data)); } catch { /* quota exceeded: run uncached */ }
  }
  return data;
}

/** Preset cities so users can skip coordinates. */
export const CITY_PRESETS = [
  { name: "Pahoa, Hawaiʻi", lat: 19.5, lon: -155.0 },
  { name: "Denver, USA", lat: 39.74, lon: -104.99 },
  { name: "Berlin, Germany", lat: 52.52, lon: 13.41 },
  { name: "Lagos, Nigeria", lat: 6.52, lon: 3.38 },
  { name: "Delhi, India", lat: 28.61, lon: 77.21 },
  { name: "Cusco, Peru", lat: -13.53, lon: -71.97 },
];
