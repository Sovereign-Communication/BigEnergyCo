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

export const POWER_HOURLY_URL =
  "https://power.larc.nasa.gov/api/temporal/hourly/point";

// A satellite request that hangs must never hold the sizing hostage: after
// this long with no answer, abort and let the caller fall back to bundled
// typical-year weather for the nearest city (with an honest offline flag).
export const FETCH_TIMEOUT_MS = 45000;

/**
 * Fetch N years of hourly GHI + temperature ending at the last complete year.
 * @param {object} opts
 * @param {number} opts.latitude
 * @param {number} opts.longitude
 * @param {number} [opts.years=5]
 * @param {(url:string)=>Promise<Response>} [opts.fetchImpl]
 * @returns {{hours: Array<{ghi:number,tAmb:number}>, meta: object}}
 */
export async function fetchHourlySeries({
  latitude,
  longitude,
  years = 5,
  fetchImpl = fetch,
  timeoutMs = FETCH_TIMEOUT_MS,
}) {
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

    const ctrl =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    let res;
    try {
      res = await fetchImpl(url, ctrl ? { signal: ctrl.signal } : undefined);
    } catch (e) {
      if (ctrl && ctrl.signal.aborted) {
        throw new Error(
          "NASA POWER request timed out — using nearest-city typical-year weather instead.",
        );
      }
      throw e;
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (!res.ok) throw new Error(`NASA POWER request failed (${res.status})`);
    const json = await res.json();
    hours.push(...parseHourly(json));
  }

  return {
    hours,
    meta: {
      latitude,
      longitude,
      startYear,
      endYear,
      years,
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

// ── Unified multi-layer weather cache ───────────────────────────────────────
// In-memory Map for 0ms access within the session / worker lifetime.
// In-flight Promise Map to eliminate duplicate concurrent network pulls.
// Cache Storage (and localStorage fallback) for persistence across reloads.

const CACHE_PREFIX = "beco-power-v1:";
const CACHE_STORAGE_NAME = "beco-weather-v1";

export const IN_MEMORY_WEATHER_CACHE = new Map();
export const IN_FLIGHT_WEATHER_PROMISES = new Map();

export function cacheKey(lat, lon, years) {
  const rlat = lat.toFixed(2),
    rlon = lon.toFixed(2); // ~1.1 km grid
  return `${CACHE_PREFIX}${rlat},${rlon},${years}y`;
}

async function getFromCacheStorage(key) {
  if (typeof caches === "undefined") return null;
  try {
    const cache = await caches.open(CACHE_STORAGE_NAME);
    const req = new Request(
      `https://cache.bigenergyco.internal/${encodeURIComponent(key)}`,
    );
    const resp = await cache.match(req);
    if (resp) {
      return await resp.json();
    }
  } catch {
    // Ignore cache errors in restricted environments
  }
  return null;
}

async function putToCacheStorage(key, data) {
  if (typeof caches === "undefined") return;
  try {
    const cache = await caches.open(CACHE_STORAGE_NAME);
    const req = new Request(
      `https://cache.bigenergyco.internal/${encodeURIComponent(key)}`,
    );
    const cleanPayload = { hours: data.hours, meta: data.meta };
    const resp = new Response(JSON.stringify(cleanPayload), {
      headers: { "Content-Type": "application/json" },
    });
    await cache.put(req, resp);
  } catch {
    // Ignore cache errors
  }
}

export async function fetchHourlyCached(
  opts,
  store = typeof localStorage !== "undefined" ? localStorage : null,
) {
  const key = cacheKey(opts.latitude, opts.longitude, opts.years || 5);

  // 1. In-memory cache hit: 0 ms instant return
  if (IN_MEMORY_WEATHER_CACHE.has(key)) {
    return IN_MEMORY_WEATHER_CACHE.get(key);
  }

  // 2. In-flight Promise de-duplication: wait for the active fetch
  if (IN_FLIGHT_WEATHER_PROMISES.has(key)) {
    return await IN_FLIGHT_WEATHER_PROMISES.get(key);
  }

  const fetchPromise = (async () => {
    // 3. Cache Storage hit (disk cache, available in workers and window)
    const diskHit = await getFromCacheStorage(key);
    if (diskHit && Array.isArray(diskHit.hours) && diskHit.hours.length > 0) {
      IN_MEMORY_WEATHER_CACHE.set(key, diskHit);
      return diskHit;
    }

    // 4. Custom / localStorage store fallback
    if (store) {
      try {
        const hit = store.getItem(key);
        if (hit) {
          const parsed = JSON.parse(hit);
          IN_MEMORY_WEATHER_CACHE.set(key, parsed);
          return parsed;
        }
      } catch {
        try {
          store.removeItem(key);
        } catch {}
      }
    }

    // 5. Network fetch from NASA POWER
    const data = await fetchHourlySeries(opts);
    data.meta.gridKey = key;
    IN_MEMORY_WEATHER_CACHE.set(key, data);

    putToCacheStorage(key, data).catch(() => {});

    if (store) {
      try {
        store.setItem(
          key,
          JSON.stringify({ hours: data.hours, meta: data.meta }),
        );
      } catch {
        /* quota exceeded: run uncached */
      }
    }
    return data;
  })();

  IN_FLIGHT_WEATHER_PROMISES.set(key, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    IN_FLIGHT_WEATHER_PROMISES.delete(key);
  }
}

// ── Offline typical-year synthesis ──────────────────────────────────────────

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Expand a bundled monthly/hourly profile into an hourly series shaped
 * exactly like fetchHourlySeries output, so the whole deterministic
 * pipeline (derates, SOC sim, tier search, charts) runs unchanged offline.
 */
export function synthesizeFromProfile(profile) {
  const hours = [];
  for (let m = 0; m < 12; m++) {
    for (let d = 0; d < MONTH_DAYS[m]; d++) {
      for (let h = 0; h < 24; h++) {
        hours.push({ ghi: profile.ghi[m][h], tAmb: profile.tAmb[m][h] });
      }
    }
  }
  return hours;
}

/** Preset cities so nobody needs GPS coordinates. Grouped for the dropdown. */ export const CITY_PRESETS =
  [
    // North America
    { name: "Honolulu, USA", r: "North America", lat: 21.31, lon: -157.86 },
    { name: "Los Angeles, USA", r: "North America", lat: 34.05, lon: -118.24 },
    { name: "Phoenix, USA", r: "North America", lat: 33.45, lon: -112.07 },
    { name: "Denver, USA", r: "North America", lat: 39.74, lon: -104.99 },
    { name: "Chicago, USA", r: "North America", lat: 41.88, lon: -87.63 },
    { name: "Miami, USA", r: "North America", lat: 25.76, lon: -80.19 },
    { name: "New York, USA", r: "North America", lat: 40.71, lon: -74.01 },
    { name: "Toronto, Canada", r: "North America", lat: 43.65, lon: -79.38 },
    {
      name: "Mexico City, Mexico",
      r: "North America",
      lat: 19.43,
      lon: -99.13,
    },
    // Caribbean & Central America
    {
      name: "San Juan, Puerto Rico",
      r: "Caribbean & Central America",
      lat: 18.47,
      lon: -66.11,
    },
    {
      name: "Santo Domingo, Dominican Rep.",
      r: "Caribbean & Central America",
      lat: 18.49,
      lon: -69.93,
    },
    {
      name: "Guatemala City, Guatemala",
      r: "Caribbean & Central America",
      lat: 14.63,
      lon: -90.51,
    },
    {
      name: "Panama City, Panama",
      r: "Caribbean & Central America",
      lat: 8.98,
      lon: -79.52,
    },
    {
      name: "Havana, Cuba",
      r: "Caribbean & Central America",
      lat: 23.11,
      lon: -82.37,
    },
    {
      name: "Port-au-Prince, Haiti",
      r: "Caribbean & Central America",
      lat: 18.59,
      lon: -72.31,
    },
    // South America
    { name: "Bogotá, Colombia", r: "South America", lat: 4.71, lon: -74.07 },
    { name: "Lima, Peru", r: "South America", lat: -12.05, lon: -77.04 },
    { name: "Cusco, Peru", r: "South America", lat: -13.53, lon: -71.97 },
    { name: "Santiago, Chile", r: "South America", lat: -33.45, lon: -70.67 },
    { name: "São Paulo, Brazil", r: "South America", lat: -23.55, lon: -46.63 },
    {
      name: "Buenos Aires, Argentina",
      r: "South America",
      lat: -34.6,
      lon: -58.38,
    },
    { name: "Quito, Ecuador", r: "South America", lat: -0.18, lon: -78.47 },
    { name: "La Paz, Bolivia", r: "South America", lat: -16.49, lon: -68.12 },
    // Europe
    { name: "London, UK", r: "Europe", lat: 51.51, lon: -0.13 },
    { name: "Paris, France", r: "Europe", lat: 48.86, lon: 2.35 },
    { name: "Madrid, Spain", r: "Europe", lat: 40.42, lon: -3.7 },
    { name: "Rome, Italy", r: "Europe", lat: 41.89, lon: 12.48 },
    { name: "Berlin, Germany", r: "Europe", lat: 52.52, lon: 13.41 },
    { name: "Warsaw, Poland", r: "Europe", lat: 52.23, lon: 21.01 },
    { name: "Athens, Greece", r: "Europe", lat: 37.98, lon: 23.73 },
    { name: "Oslo, Norway", r: "Europe", lat: 59.91, lon: 10.75 },
    // Africa
    { name: "Casablanca, Morocco", r: "Africa", lat: 33.57, lon: -7.59 },
    { name: "Cairo, Egypt", r: "Africa", lat: 30.04, lon: 31.24 },
    { name: "Accra, Ghana", r: "Africa", lat: 5.6, lon: -0.19 },
    { name: "Lagos, Nigeria", r: "Africa", lat: 6.52, lon: 3.38 },
    { name: "Nairobi, Kenya", r: "Africa", lat: -1.29, lon: 36.82 },
    { name: "Johannesburg, South Africa", r: "Africa", lat: -26.2, lon: 28.05 },
    { name: "Dakar, Senegal", r: "Africa", lat: 14.72, lon: -17.47 },
    { name: "Bamako, Mali", r: "Africa", lat: 12.65, lon: -8.0 },
    { name: "Ouagadougou, Burkina Faso", r: "Africa", lat: 12.37, lon: -1.52 },
    { name: "Addis Ababa, Ethiopia", r: "Africa", lat: 9.02, lon: 38.75 },
    { name: "Kinshasa, DR Congo", r: "Africa", lat: -4.44, lon: 15.27 },
    { name: "Antananarivo, Madagascar", r: "Africa", lat: -18.88, lon: 47.51 },
    // Middle East & Central Asia
    {
      name: "Istanbul, Türkiye",
      r: "Middle East & Central Asia",
      lat: 41.01,
      lon: 28.98,
    },
    {
      name: "Dubai, UAE",
      r: "Middle East & Central Asia",
      lat: 25.2,
      lon: 55.27,
    },
    {
      name: "Tashkent, Uzbekistan",
      r: "Middle East & Central Asia",
      lat: 41.3,
      lon: 69.24,
    },
    // South Asia
    { name: "Karachi, Pakistan", r: "South Asia", lat: 24.86, lon: 67.01 },
    { name: "Delhi, India", r: "South Asia", lat: 28.61, lon: 77.21 },
    { name: "Mumbai, India", r: "South Asia", lat: 19.08, lon: 72.88 },
    { name: "Colombo, Sri Lanka", r: "South Asia", lat: 6.93, lon: 79.85 },
    { name: "Dhaka, Bangladesh", r: "South Asia", lat: 23.81, lon: 90.41 },
    { name: "Kathmandu, Nepal", r: "South Asia", lat: 27.72, lon: 85.32 },
    // East & Southeast Asia
    {
      name: "Bangkok, Thailand",
      r: "East & Southeast Asia",
      lat: 13.76,
      lon: 100.5,
    },
    {
      name: "Ho Chi Minh City, Vietnam",
      r: "East & Southeast Asia",
      lat: 10.82,
      lon: 106.63,
    },
    {
      name: "Jakarta, Indonesia",
      r: "East & Southeast Asia",
      lat: -6.21,
      lon: 106.85,
    },
    {
      name: "Phnom Penh, Cambodia",
      r: "East & Southeast Asia",
      lat: 11.56,
      lon: 104.92,
    },
    {
      name: "Manila, Philippines",
      r: "East & Southeast Asia",
      lat: 14.6,
      lon: 120.98,
    },
    { name: "Hong Kong", r: "East & Southeast Asia", lat: 22.32, lon: 114.17 },
    {
      name: "Taipei, Taiwan",
      r: "East & Southeast Asia",
      lat: 25.03,
      lon: 121.57,
    },
    {
      name: "Seoul, South Korea",
      r: "East & Southeast Asia",
      lat: 37.57,
      lon: 126.98,
    },
    {
      name: "Tokyo, Japan",
      r: "East & Southeast Asia",
      lat: 35.68,
      lon: 139.69,
    },
    // Oceania & Pacific
    { name: "Suva, Fiji", r: "Oceania & Pacific", lat: -18.14, lon: 178.44 },
    {
      name: "Papeete, French Polynesia",
      r: "Oceania & Pacific",
      lat: -17.54,
      lon: -149.57,
    },
    {
      name: "Perth, Australia",
      r: "Oceania & Pacific",
      lat: -31.95,
      lon: 115.86,
    },
    {
      name: "Sydney, Australia",
      r: "Oceania & Pacific",
      lat: -33.87,
      lon: 151.21,
    },
    {
      name: "Auckland, New Zealand",
      r: "Oceania & Pacific",
      lat: -36.85,
      lon: 174.76,
    },
  ];
