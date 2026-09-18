// Unified city records used by the location combobox. The seed is instant and
// offline; country partitions provide millions of additional place/coordinate
// pairs and are lazy-loaded on demand — only the countries a query or a GPS
// fix names are ever fetched, never the whole world at once.
import { usStateCode, US_STATES } from "./pricing.js?v=20260918b";

export const CITY_CATALOG = [
  ["Honolulu", "United States", "Hawaii", 21.31, -157.86],
  ["Los Angeles", "United States", "California", 34.05, -118.24],
  ["Phoenix", "United States", "Arizona", 33.45, -112.07],
  ["Denver", "United States", "Colorado", 39.74, -104.99],
  ["Chicago", "United States", "Illinois", 41.88, -87.63],
  ["Miami", "United States", "Florida", 25.76, -80.19],
  ["New York", "United States", "New York", 40.71, -74.01],
  ["Toronto", "Canada", "Ontario", 43.65, -79.38],
  ["Mexico City", "Mexico", "North America", 19.43, -99.13],
  ["San Juan", "Puerto Rico", "Caribbean", 18.47, -66.11],
  ["Santo Domingo", "Dominican Republic", "Caribbean", 18.49, -69.93],
  ["Guatemala City", "Guatemala", "Central America", 14.63, -90.51],
  ["Panama City", "Panama", "Central America", 8.98, -79.52],
  ["Havana", "Cuba", "Caribbean", 23.11, -82.37],
  ["Port-au-Prince", "Haiti", "Caribbean", 18.59, -72.31],
  ["Bogota", "Colombia", "South America", 4.71, -74.07],
  ["Lima", "Peru", "South America", -12.05, -77.04],
  ["Cusco", "Peru", "South America", -13.53, -71.97],
  ["Santiago", "Chile", "South America", -33.45, -70.67],
  ["Sao Paulo", "Brazil", "South America", -23.55, -46.63],
  ["Buenos Aires", "Argentina", "South America", -34.6, -58.38],
  ["Quito", "Ecuador", "South America", -0.18, -78.47],
  ["La Paz", "Bolivia", "South America", -16.49, -68.12],
  ["London", "United Kingdom", "Europe", 51.51, -0.13],
  ["Paris", "France", "Europe", 48.86, 2.35],
  ["Madrid", "Spain", "Europe", 40.42, -3.7],
  ["Rome", "Italy", "Europe", 41.89, 12.48],
  ["Berlin", "Germany", "Europe", 52.52, 13.41],
  ["Warsaw", "Poland", "Europe", 52.23, 21.01],
  ["Athens", "Greece", "Europe", 37.98, 23.73],
  ["Oslo", "Norway", "Europe", 59.91, 10.75],
  ["Istanbul", "Turkiye", "Europe/Asia", 41.01, 28.98],
  ["Casablanca", "Morocco", "Africa", 33.57, -7.59],
  ["Cairo", "Egypt", "Africa", 30.04, 31.24],
  ["Accra", "Ghana", "Africa", 5.6, -0.19],
  ["Lagos", "Nigeria", "Africa", 6.52, 3.38],
  ["Nairobi", "Kenya", "Africa", -1.29, 36.82],
  ["Johannesburg", "South Africa", "Africa", -26.2, 28.05],
  ["Dakar", "Senegal", "Africa", 14.72, -17.47],
  ["Addis Ababa", "Ethiopia", "Africa", 9.02, 38.75],
  ["Kinshasa", "Democratic Republic of the Congo", "Africa", -4.44, 15.27],
  ["Antananarivo", "Madagascar", "Africa", -18.88, 47.51],
  ["Dubai", "United Arab Emirates", "Middle East", 25.2, 55.27],
  ["Riyadh", "Saudi Arabia", "Middle East", 24.71, 46.67],
  ["Karachi", "Pakistan", "South Asia", 24.86, 67.01],
  ["Delhi", "India", "South Asia", 28.61, 77.21],
  ["Mumbai", "India", "South Asia", 19.08, 72.88],
  ["Colombo", "Sri Lanka", "South Asia", 6.93, 79.85],
  ["Dhaka", "Bangladesh", "South Asia", 23.81, 90.41],
  ["Kathmandu", "Nepal", "South Asia", 27.72, 85.32],
  ["Bangkok", "Thailand", "Southeast Asia", 13.76, 100.5],
  ["Ho Chi Minh City", "Vietnam", "Southeast Asia", 10.82, 106.63],
  ["Jakarta", "Indonesia", "Southeast Asia", -6.21, 106.85],
  ["Phnom Penh", "Cambodia", "Southeast Asia", 11.56, 104.92],
  ["Manila", "Philippines", "Southeast Asia", 14.6, 120.98],
  ["Hong Kong", "Hong Kong", "East Asia", 22.32, 114.17],
  ["Taipei", "Taiwan", "East Asia", 25.03, 121.57],
  ["Seoul", "South Korea", "East Asia", 37.57, 126.98],
  ["Tokyo", "Japan", "East Asia", 35.68, 139.69],
  ["Beijing", "China", "East Asia", 39.9, 116.4],
  ["Singapore", "Singapore", "Southeast Asia", 1.35, 103.82],
  ["Suva", "Fiji", "Oceania", -18.14, 178.44],
  ["Papeete", "French Polynesia", "Oceania", -17.54, -149.57],
  ["Perth", "Australia", "Oceania", -31.95, 115.86],
  ["Sydney", "Australia", "Oceania", -33.87, 151.21],
  ["Auckland", "New Zealand", "Oceania", -36.85, 174.76],
].map(([name, country, region, lat, lon]) => ({
  name,
  country,
  r: region,
  lat,
  lon,
}));

// ── GENERATED: country partition index (scripts/sync-country-files.mjs) ──
// Space-separated ISO-2 codes; membership via COUNTRY_SET below.
export const COUNTRY_FILES =
  "AD AE AF AG AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BM BN BO BQ BR BS BT BW BY BZ CA CD CF CG CH CI CK CL CM CN CO CR CU CV CW CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FM FO FR GA GB GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MP MQ MR MT MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NZ OM PA PE PF PG PH PK PL PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SI SK SL SN SO SR SS ST SV SY SZ TC TD TG TH TJ TL TM TN TO TR TT TW TZ UA UG US UY UZ VC VE VI VN VU WS XK YE YT ZA ZM ZW";
// ── END GENERATED ──

export const COUNTRY_SET = new Set(COUNTRY_FILES.split(" "));

const ALIASES = {
  nyc: "new york",
  sf: "san francisco",
  la: "los angeles",
  dc: "washington",
  sao: "sao paulo",
  bombay: "mumbai",
  calcutta: "kolkata",
};

// Auto-lookup guard: should a typed query still be auto-resolved after the
// typing cadence stops? Pure so the debounce decision is unit-testable without
// a DOM. Returns false when the query is empty (nothing to resolve) or when it
// normalizes to the city already resolved (typing more of an already-resolved
// name must not re-trigger the lookup). Everything else — a new query, a
// partial that normalizes differently — is fair game for the debounce timer.
export function shouldAutoResolve(query, lastResolved) {
  const q = normalizeCityQuery(query);
  if (!q) return false;
  const last = normalizeCityQuery(lastResolved);
  return q !== last;
}
export function normalizeCityQuery(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
export function searchCities(query, cities = CITY_CATALOG, limit = 8) {
  const q = normalizeCityQuery(query);
  if (!q) return [];
  const target = ALIASES[q] || q;
  const terms = target.split(" ");
  return cities
    .map((city) => {
      const name = normalizeCityQuery(city.name),
        country = normalizeCityQuery(city.country),
        hay = `${name} ${country} ${normalizeCityQuery(city.r)}`;
      const score =
        name === target
          ? 0
          : name.startsWith(target)
            ? 1
            : country === target
              ? 2
              : country.startsWith(target)
                ? 3
                : hay.includes(target)
                  ? 4
                  : terms.every((term) => hay.includes(term))
                    ? 5
                    : 99;
      const populationBonus = Number.isFinite(city.population)
        ? Math.max(0, Math.min(2, city.population / 1000000))
        : 0;
      return { city, score, populationBonus };
    })
    .filter((x) => x.score < 99)
    .sort(
      (a, b) =>
        a.score - b.score ||
        b.populationBonus - a.populationBonus ||
        a.city.name.localeCompare(b.city.name),
    )
    .slice(0, limit)
    .map((x) => x.city);
}
export function mergeCities(base, extra) {
  const seen = new Set(
    base.map(
      (city) =>
        `${normalizeCityQuery(city.name)}|${normalizeCityQuery(city.country)}`,
    ),
  );
  return base.concat(
    extra.filter((city) => {
      const key = `${normalizeCityQuery(city.name)}|${normalizeCityQuery(city.country)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  );
}
export function parseCityRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      name: row.name || row.city,
      country: row.country || row.countryName,
      r:
        row.r ||
        row.region ||
        row.admin_name ||
        row.country ||
        row.countryName ||
        "Worldwide",
      lat: Number(row.lat ?? row.latitude),
      lon: Number(row.lon ?? row.lng ?? row.longitude),
      population: Number(row.population || 0),
    }))
    .filter(
      (city) =>
        city.name &&
        city.country &&
        Number.isFinite(city.lat) &&
        Number.isFinite(city.lon) &&
        city.lat >= -90 &&
        city.lat <= 90 &&
        city.lon >= -180 &&
        city.lon <= 180,
    );
}

export function formatCityLabel(city) {
  if (!city) return "";
  const isUS =
    city.country === "US" ||
    city.country === "United States" ||
    city.country === "USA";
  const st = isUS ? usStateCode(city.r) : null;
  let region = null;
  if (st) region = US_STATES[st].name;
  else if (city.r && /[A-Za-z]/.test(city.r) && city.r !== city.country)
    region = city.r;
  const country = isUS ? "USA" : city.country;
  return [city.name, region, country].filter(Boolean).join(", ");
}

// Closest catalog city to a coordinate pair (haversine). Returns null when no
// city is within maxKm, so GPS in the middle of nowhere falls back to the
// coordinate-only estimate instead of inheriting a far-away state's tariff.
export function nearestCity(lat, lon, cities = CITY_CATALOG, maxKm = 60) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  let best = null,
    bestKm = Infinity;
  const R = 6371,
    toRad = Math.PI / 180;
  for (const c of cities) {
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lon)) continue;
    const dLat = (c.lat - lat) * toRad,
      dLon = (c.lon - lon) * toRad;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat * toRad) * Math.cos(c.lat * toRad) * Math.sin(dLon / 2) ** 2;
    const km = 2 * R * Math.asin(Math.sqrt(a));
    if (km < bestKm) {
      bestKm = km;
      best = c;
    }
  }
  return bestKm <= maxKm ? best : null;
}

// ── On-demand country partitions ─────────────────────────────────────────
// The old loader fetched every partition up front (~221 requests in one
// Promise.all, all cache-DYNAMIC at the edge). Now a query or GPS fix names
// its countries and ONLY those partitions are fetched, memoized per page
// load; failures fall back to the seed + online geocoder and never throw.

export const CITY_LOOKUP_TIMEOUT_MS = 12000;

export async function lookupCityOnline(query, fetchImpl = globalThis.fetch) {
  const q = String(query || "").trim();
  if (q.length < 2) return null;
  // A hung geocoder must never leave "Looking up your city…" on screen
  // forever: bound the whole lookup, then fall through to the offline path.
  const ctrl =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl
    ? setTimeout(() => ctrl.abort(), CITY_LOOKUP_TIMEOUT_MS)
    : null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(q)}`;
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
      ...(ctrl ? { signal: ctrl.signal } : {}),
    });
    if (!response.ok) return null;
    const row = (await response.json())?.[0];
    if (!row) return null;
    return {
      name: row.name || row.display_name.split(",")[0],
      country:
        row.address?.country_code?.toUpperCase() || row.address?.country || "",
      r:
        row.address?.state ||
        row.address?.region ||
        row.address?.country ||
        "Worldwide",
      lat: Number(row.lat),
      lon: Number(row.lon),
    };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Reverse-geocode a GPS fix to country context. Same endpoint as
// lookupCityOnline; null on any failure so GPS falls back to seed context.
export async function lookupCountryOnline(
  lat,
  lon,
  fetchImpl = globalThis.fetch,
) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const ctrl =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl
    ? setTimeout(() => ctrl.abort(), CITY_LOOKUP_TIMEOUT_MS)
    : null;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10`;
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
      ...(ctrl ? { signal: ctrl.signal } : {}),
    });
    if (!response.ok) return null;
    const row = await response.json();
    if (!row) return null;
    return {
      country:
        row.address?.country_code?.toUpperCase() || row.address?.country || "",
      r: row.address?.state || row.address?.region || "Worldwide",
      name: row.name || row.address?.city || row.address?.town || "",
    };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Which country partitions can contain the query? A query that normalizes to
// (or starts with, or contains) a seed city's name tags that city's country —
// "Aust" loads AT + AU (Austin, Australia); "Berlin" loads DE. Pure and
// unit-testable: the table is generated data, this is deterministic logic.
export function countryCodesFor(query, catalog = CITY_CATALOG) {
  const q = normalizeCityQuery(query);
  if (!q || q.length < 2) return [];
  const target = ALIASES[q] || q;
  const terms = target.split(" ");
  const codes = new Set();
  for (const city of catalog) {
    const name = normalizeCityQuery(city.name),
      country = normalizeCityQuery(city.country);
    if (
      name === target ||
      name.startsWith(target) ||
      target.startsWith(name) ||
      terms.some((term) => name.startsWith(term)) ||
      country === target ||
      country.startsWith(target)
    ) {
      const cc = iso2ForCountry(city.country);
      if (cc) codes.add(cc);
    }
  }
  return [...codes].filter((c) => COUNTRY_SET.has(c));
}

// ISO-2 for every seed-catalog country (typed "Japan" must reach JP.json).
const ISO2 = {
  "united states": "US",
  canada: "CA",
  mexico: "MX",
  "puerto rico": "PR",
  "dominican republic": "DO",
  guatemala: "GT",
  panama: "PA",
  cuba: "CU",
  haiti: "HT",
  colombia: "CO",
  peru: "PE",
  chile: "CL",
  brazil: "BR",
  argentina: "AR",
  ecuador: "EC",
  bolivia: "BO",
  "united kingdom": "GB",
  france: "FR",
  spain: "ES",
  italy: "IT",
  germany: "DE",
  poland: "PL",
  greece: "GR",
  norway: "NO",
  turkiye: "TR",
  morocco: "MA",
  egypt: "EG",
  ghana: "GH",
  nigeria: "NG",
  kenya: "KE",
  "south africa": "ZA",
  senegal: "SN",
  ethiopia: "ET",
  "democratic republic of the congo": "CD",
  madagascar: "MG",
  "united arab emirates": "AE",
  "saudi arabia": "SA",
  pakistan: "PK",
  india: "IN",
  "sri lanka": "LK",
  bangladesh: "BD",
  nepal: "NP",
  thailand: "TH",
  vietnam: "VN",
  indonesia: "ID",
  cambodia: "KH",
  philippines: "PH",
  "hong kong": "HK",
  taiwan: "TW",
  "south korea": "KR",
  japan: "JP",
  china: "CN",
  singapore: "SG",
  fiji: "FJ",
  "french polynesia": "PF",
  australia: "AU",
  "new zealand": "NZ",
};

function iso2ForCountry(country) {
  return ISO2[normalizeCityQuery(country)] || null;
}

const partitionCache = new Map();
const partitionInFlight = new Map();
export const COUNTRY_FETCH_TIMEOUT_MS = 8000;

// The one place that fetches country data: memoized per country per page
// load; failures are negative-cached so a dead partition never retries.
export async function loadCountryCities(
  code,
  fetchImpl = globalThis.fetch,
  storage = globalThis.localStorage,
) {
  const cc = String(code || "").toUpperCase();
  if (!COUNTRY_SET.has(cc)) return [];
  const memoKey = `${cc}:${fetchImpl === globalThis.fetch}`;
  if (partitionCache.has(memoKey)) return partitionCache.get(memoKey);
  if (partitionInFlight.has(memoKey)) return partitionInFlight.get(memoKey);

  const promise = (async () => {
    const ctrl =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl
      ? setTimeout(() => ctrl.abort(), COUNTRY_FETCH_TIMEOUT_MS)
      : null;
    try {
      const response = await fetchImpl(
        `./assets/js/sizing/city-data/${cc}.json?v=20260918b`,
        { cache: "force-cache", ...(ctrl ? { signal: ctrl.signal } : {}) },
      );
      if (!response.ok) return [];
      const rows = parseCityRows(await response.json());
      if (rows.length) {
        try {
          storage?.setItem(`beco-city-${cc}-v1`, JSON.stringify(rows));
        } catch {
          /* optional cache */
        }
      }
      return rows;
    } catch {
      return [];
    } finally {
      if (timer) clearTimeout(timer);
    }
  })();

  partitionInFlight.set(memoKey, promise);
  try {
    const rows = await promise;
    partitionCache.set(memoKey, rows);
    return rows;
  } finally {
    partitionInFlight.delete(memoKey);
  }
}

// LocalStorage rows for one country (no network); v1 keys keep old caches out.
export function cachedCountryCities(code, storage = globalThis.localStorage) {
  const cc = String(code || "").toUpperCase();
  if (!COUNTRY_SET.has(cc)) return [];
  try {
    return parseCityRows(
      JSON.parse(storage?.getItem(`beco-city-${cc}-v1`) || "[]"),
    );
  } catch {
    return [];
  }
}

// The async search face: always includes the full seed (callers may replace
// their working set with the result), plus cached partitions, then the
// query's countries from the network.
export async function typedCityCandidates(query) {
  const codes = countryCodesFor(query);
  const local = searchCities(query);
  const cached = codes.flatMap((cc) => cachedCountryCities(cc));
  const extras = mergeCities(local, cached);
  if (!codes.length) return mergeCities(CITY_CATALOG, extras);
  const rows = await Promise.all(codes.map((cc) => loadCountryCities(cc)));
  return mergeCities(mergeCities(CITY_CATALOG, extras), rows.flat());
}
