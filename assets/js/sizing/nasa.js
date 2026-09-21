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
 * @param {(done:number,total:number)=>void} [opts.onProgress] Optional. Called
 *   after each year-chunk lands so the UI can show a determinate progress bar
 *   (chunk counts are known before any byte arrives). Never throws.
 * @returns {{hours: Array<{ghi:number,tAmb:number}>, meta: object}}
 */
export async function fetchHourlySeries({
  latitude,
  longitude,
  years = 5,
  fetchImpl = fetch,
  timeoutMs = FETCH_TIMEOUT_MS,
  onProgress = null,
}) {
  // NASA POWER hourly solar data begins 2001-01-01. End at Dec 31 of last
  // complete year so every request covers full years (fair tier statistics).
  const now = new Date();
  const endYear = now.getUTCFullYear() - 1;
  const startYear = endYear - years + 1;

  // Request in <=2-year chunks to keep responses small and retryable.
  // Chunks fetch in PARALLEL: same total load on the API, roughly a third
  // of the wait on a typical 5-year pull. Order is restored by concatenation
  // (Promise.all preserves chunk order), so parsing downstream is untouched.
  const chunks = [];
  for (let y = startYear; y <= endYear; y += 2) {
    chunks.push([y, Math.min(y + 1, endYear)]);
  }
  const totalChunks = chunks.length;
  let doneChunks = 0;
  const fetchChunk = async ([y, yEnd]) => {
    const url = buildUrl(latitude, longitude, `${y}0101`, `${yEnd}1231`);
    const ctrl =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      const res = await fetchImpl(
        url,
        ctrl ? { signal: ctrl.signal } : undefined,
      );
      if (!res.ok) throw new Error(`NASA POWER request failed (${res.status})`);
      const parsed = parseHourly(await res.json());
      // Progress is per-chunk (chunk count is known up front): one call per
      // landed year-pair. Report-only — a throwing callback must never kill
      // a good fetch.
      doneChunks++;
      if (typeof onProgress === "function") {
        try {
          onProgress(doneChunks, totalChunks);
        } catch {}
      }
      return parsed;
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
  };
  const parts = await Promise.all(chunks.map(fetchChunk));
  const hours = [];
  for (const part of parts) hours.push(...part);

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

// Compact persistent layer (v2): stores the PARSED series as flat typed
// arrays instead of the raw ~2 MB NASA JSON. A Cache-Storage JSON blob costs
// a full JSON.parse of ~44k objects on every cold load; the typed-array
// record restores via structured-clone-like reads with no per-object parsing.
// Key grid, layering order and fallbacks are unchanged from v1.
const CACHE_PREFIX_V2 = "beco-power-v2:";
const IDB_NAME = "beco-weather-v2";
// Version 2: the v1 opener never created the object store (no upgrade
// handler), so every browser that already opened the DB carries a storeless
// database. Bumping the version forces the upgrade path to run on those.
const IDB_VERSION = 2;
const IDB_STORE = "series";

export const IN_MEMORY_WEATHER_CACHE = new Map();
export const IN_FLIGHT_WEATHER_PROMISES = new Map();

function idbOpen() {
  if (typeof indexedDB === "undefined") return null;
  try {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    // The store is created HERE, in the upgrade handler — never lazily at
    // read/write time. Without this hook the DB opened with NO object
    // store: every read missed and every write silently no-oped, so the
    // compact layer never persisted anything.
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE))
        db.createObjectStore(IDB_STORE);
    };
    return req;
  } catch {
    return null;
  }
}

/** Promise wrapper over the tiny IDB subset we need. Null when unavailable. */
function idbReq(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(key) {
  const openReq = idbOpen();
  if (!openReq) return null;
  const db = await new Promise((resolve, reject) => {
    openReq.onsuccess = () => resolve(openReq.result);
    openReq.onerror = () => reject(openReq.error);
  });
  try {
    if (!db.objectStoreNames.contains(IDB_STORE)) return null;
    const tx = db.transaction(IDB_STORE, "readonly");
    const rec = await idbReq(tx.objectStore(IDB_STORE).get(key));
    db.close();
    if (
      !rec ||
      !(rec.ghi instanceof Float32Array) ||
      !(rec.tAmb instanceof Float32Array) ||
      rec.ghi.length !== rec.tAmb.length ||
      rec.ghi.length === 0
    )
      return null;
    const hours = new Array(rec.ghi.length);
    for (let i = 0; i < rec.ghi.length; i++) {
      hours[i] = { ghi: rec.ghi[i], tAmb: rec.tAmb[i] };
    }
    return { hours, meta: rec.meta };
  } catch {
    try {
      db.close();
    } catch {}
    return null;
  }
}

async function idbPut(key, data) {
  const openReq = idbOpen();
  if (!openReq) return;
  const db = await new Promise((resolve, reject) => {
    openReq.onsuccess = () => resolve(openReq.result);
    openReq.onerror = () => reject(openReq.error);
  });
  try {
    if (!db.objectStoreNames.contains(IDB_STORE)) return;
    const n = data.hours.length;
    const ghi = new Float32Array(n);
    const tAmb = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      ghi[i] = data.hours[i].ghi;
      tAmb[i] = data.hours[i].tAmb;
    }
    // NaN (NASA fill −999 → NaN) survives Float32Array storage and the
    // structured clone, so gaps in the satellite record restore exactly.
    const meta = { ...data.meta, fromCache: true };
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put({ ghi, tAmb, meta }, key);
    await idbReq(tx.complete !== undefined ? tx.complete : tx);
    db.close();
  } catch {
    try {
      db.close();
    } catch {}
  }
}

async function idbDelete(key) {
  const openReq = idbOpen();
  if (!openReq) return;
  try {
    const db = await new Promise((resolve, reject) => {
      openReq.onsuccess = () => resolve(openReq.result);
      openReq.onerror = () => reject(openReq.error);
    });
    if (!db.objectStoreNames.contains(IDB_STORE)) return;
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(key);
    await idbReq(tx.complete !== undefined ? tx.complete : tx);
    db.close();
  } catch {
    try {
      db.close();
    } catch {}
  }
}

function v2Key(lat, lon, years) {
  return cacheKey(lat, lon, years).replace(CACHE_PREFIX, CACHE_PREFIX_V2);
}

/** Test/ops hook: drop the compact persistent layer for one site. */
export async function clearCompactCache(latitude, longitude, years = 5) {
  IN_MEMORY_WEATHER_CACHE.delete(cacheKey(latitude, longitude, years));
  await idbDelete(v2Key(latitude, longitude, years));
}

export function cacheKey(lat, lon, years) {
  const rlat = lat.toFixed(2),
    rlon = lon.toFixed(2); // ~1.1 km grid
  return `${CACHE_PREFIX}${rlat},${rlon},${years}y`;
}

/** The exact year window fetchHourlySeries would request right now. */
function currentYearWindow(years) {
  const endYear = new Date().getUTCFullYear() - 1;
  return { startYear: endYear - years + 1, endYear };
}

/** A persisted hit is only usable if it covers NASA's current year window. */
function coversCurrentWindow(meta, years) {
  const { startYear, endYear } = currentYearWindow(years);
  return (
    Number(meta && meta.startYear) === startYear &&
    Number(meta && meta.endYear) === endYear
  );
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

async function deleteFromCacheStorage(key) {
  if (typeof caches === "undefined") return;
  try {
    const cache = await caches.open(CACHE_STORAGE_NAME);
    await cache.delete(
      new Request(
        `https://cache.bigenergyco.internal/${encodeURIComponent(key)}`,
      ),
    );
  } catch {
    // Ignore cache errors
  }
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

/**
 * Shape gate for persisted weather (Cache Storage v1 JSON, localStorage).
 * A corrupt or version-stale entry (wrong fields, stringified numbers,
 * missing meta) must fall through to a refetch — never poison the memo.
 * Fresh-network NaN gaps (-999 fills) still count as numbers, so they pass.
 */
export function isUsableWeather(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
  if (!Array.isArray(entry.hours) || entry.hours.length === 0) return false;
  const h0 = entry.hours[0];
  if (!h0 || typeof h0.ghi !== "number" || typeof h0.tAmb !== "number")
    return false;
  if (!entry.meta || !(Number(entry.meta.years) > 0)) return false;
  return true;
}

export async function fetchHourlyCached(
  opts,
  store = typeof localStorage !== "undefined" ? localStorage : null,
) {
  const key = cacheKey(opts.latitude, opts.longitude, opts.years || 5);

  // 1. In-memory cache hit: 0 ms instant return. Every writer stores a
  // `{hours, meta}` record, so the hit always carries meta.
  if (IN_MEMORY_WEATHER_CACHE.has(key)) {
    return IN_MEMORY_WEATHER_CACHE.get(key);
  }

  // 2. In-flight Promise de-duplication: wait for the active fetch
  if (IN_FLIGHT_WEATHER_PROMISES.has(key)) {
    return await IN_FLIGHT_WEATHER_PROMISES.get(key);
  }

  const fetchPromise = (async () => {
    // 3. Compact persistent cache (IndexedDB, v2): parsed Float32 pairs —
    // restores with no JSON parsing of a ~2 MB blob.
    try {
      const fast = await idbGet(
        v2Key(opts.latitude, opts.longitude, opts.years || 5),
      );
      if (fast) {
        if (coversCurrentWindow(fast.meta, opts.years || 5)) {
          fast.meta.gridKey = key;
          IN_MEMORY_WEATHER_CACHE.set(key, fast);
          return fast;
        }
        // The series covers an older year window than NASA would return
        // today: drop it and fall through (the fresh fetch re-persists all
        // layers with the new window). One refetch per New Year, ever.
        idbDelete(v2Key(opts.latitude, opts.longitude, opts.years || 5)).catch(
          () => {},
        );
      }
    } catch {
      /* fall through to older layers */
    }

    // 4. Cache Storage hit (v1 JSON layer; available in workers and window)
    const diskHit = await getFromCacheStorage(key);
    if (
      isUsableWeather(diskHit) &&
      coversCurrentWindow(diskHit.meta, opts.years || 5)
    ) {
      IN_MEMORY_WEATHER_CACHE.set(key, diskHit);
      // Async side-grade into the compact layer so the NEXT cold start is
      // fast too; this request already has its data.
      idbPut(
        v2Key(opts.latitude, opts.longitude, opts.years || 5),
        diskHit,
      ).catch(() => {});
      return diskHit;
    }
    if (diskHit) {
      // Unusable or stale window: drop the blob so it cannot shadow future
      // lookups (the fresh network path below re-persists it).
      deleteFromCacheStorage(key).catch(() => {});
    }

    // 5. Custom / localStorage store fallback
    if (store) {
      try {
        const hit = store.getItem(key);
        if (hit) {
          const parsed = JSON.parse(hit);
          if (!isUsableWeather(parsed)) throw new Error("stale weather shape");
          if (!coversCurrentWindow(parsed.meta, opts.years || 5)) {
            store.removeItem(key); // stale year window: refetch fresh below
          } else {
            IN_MEMORY_WEATHER_CACHE.set(key, parsed);
            idbPut(
              v2Key(opts.latitude, opts.longitude, opts.years || 5),
              parsed,
            ).catch(() => {});
            return parsed;
          }
        }
      } catch {
        try {
          store.removeItem(key);
        } catch {}
      }
    }

    // 6. Network fetch from NASA POWER (chunk progress reported to the UI)
    const data = await fetchHourlySeries(opts);
    data.meta.gridKey = key;
    IN_MEMORY_WEATHER_CACHE.set(key, data);

    // Compact persistent write (primary): typed-array record, ~0.35 MB.
    idbPut(v2Key(opts.latitude, opts.longitude, opts.years || 5), data).catch(
      () => {},
    );
    // Legacy v1 layers kept for downgrade-safety; the v2 read wins.
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
