// Unified city records used by the location combobox. The seed is instant and
// offline; country partitions provide millions of additional place/coordinate pairs.
import { usStateCode, US_STATES } from "./pricing.js?v=20260830o";

export const CITY_CATALOG = [
  ["Honolulu", "United States", "North America", 21.31, -157.86], ["Los Angeles", "United States", "North America", 34.05, -118.24], ["Phoenix", "United States", "North America", 33.45, -112.07], ["Denver", "United States", "North America", 39.74, -104.99], ["Chicago", "United States", "North America", 41.88, -87.63], ["Miami", "United States", "North America", 25.76, -80.19], ["New York", "United States", "North America", 40.71, -74.01], ["Toronto", "Canada", "North America", 43.65, -79.38], ["Mexico City", "Mexico", "North America", 19.43, -99.13],
  ["San Juan", "Puerto Rico", "Caribbean", 18.47, -66.11], ["Santo Domingo", "Dominican Republic", "Caribbean", 18.49, -69.93], ["Guatemala City", "Guatemala", "Central America", 14.63, -90.51], ["Panama City", "Panama", "Central America", 8.98, -79.52], ["Havana", "Cuba", "Caribbean", 23.11, -82.37], ["Port-au-Prince", "Haiti", "Caribbean", 18.59, -72.31],
  ["Bogota", "Colombia", "South America", 4.71, -74.07], ["Lima", "Peru", "South America", -12.05, -77.04], ["Cusco", "Peru", "South America", -13.53, -71.97], ["Santiago", "Chile", "South America", -33.45, -70.67], ["Sao Paulo", "Brazil", "South America", -23.55, -46.63], ["Buenos Aires", "Argentina", "South America", -34.60, -58.38], ["Quito", "Ecuador", "South America", -0.18, -78.47], ["La Paz", "Bolivia", "South America", -16.49, -68.12],
  ["London", "United Kingdom", "Europe", 51.51, -0.13], ["Paris", "France", "Europe", 48.86, 2.35], ["Madrid", "Spain", "Europe", 40.42, -3.70], ["Rome", "Italy", "Europe", 41.89, 12.48], ["Berlin", "Germany", "Europe", 52.52, 13.41], ["Warsaw", "Poland", "Europe", 52.23, 21.01], ["Athens", "Greece", "Europe", 37.98, 23.73], ["Oslo", "Norway", "Europe", 59.91, 10.75], ["Istanbul", "Turkiye", "Europe/Asia", 41.01, 28.98],
  ["Casablanca", "Morocco", "Africa", 33.57, -7.59], ["Cairo", "Egypt", "Africa", 30.04, 31.24], ["Accra", "Ghana", "Africa", 5.60, -0.19], ["Lagos", "Nigeria", "Africa", 6.52, 3.38], ["Nairobi", "Kenya", "Africa", -1.29, 36.82], ["Johannesburg", "South Africa", "Africa", -26.20, 28.05], ["Dakar", "Senegal", "Africa", 14.72, -17.47], ["Addis Ababa", "Ethiopia", "Africa", 9.02, 38.75], ["Kinshasa", "Democratic Republic of the Congo", "Africa", -4.44, 15.27], ["Antananarivo", "Madagascar", "Africa", -18.88, 47.51],
  ["Dubai", "United Arab Emirates", "Middle East", 25.20, 55.27], ["Riyadh", "Saudi Arabia", "Middle East", 24.71, 46.67], ["Karachi", "Pakistan", "South Asia", 24.86, 67.01], ["Delhi", "India", "South Asia", 28.61, 77.21], ["Mumbai", "India", "South Asia", 19.08, 72.88], ["Colombo", "Sri Lanka", "South Asia", 6.93, 79.85], ["Dhaka", "Bangladesh", "South Asia", 23.81, 90.41], ["Kathmandu", "Nepal", "South Asia", 27.72, 85.32],
  ["Bangkok", "Thailand", "Southeast Asia", 13.76, 100.50], ["Ho Chi Minh City", "Vietnam", "Southeast Asia", 10.82, 106.63], ["Jakarta", "Indonesia", "Southeast Asia", -6.21, 106.85], ["Phnom Penh", "Cambodia", "Southeast Asia", 11.56, 104.92], ["Manila", "Philippines", "Southeast Asia", 14.60, 120.98], ["Hong Kong", "Hong Kong", "East Asia", 22.32, 114.17], ["Taipei", "Taiwan", "East Asia", 25.03, 121.57], ["Seoul", "South Korea", "East Asia", 37.57, 126.98], ["Tokyo", "Japan", "East Asia", 35.68, 139.69], ["Beijing", "China", "East Asia", 39.90, 116.40], ["Singapore", "Singapore", "Southeast Asia", 1.35, 103.82],
  ["Suva", "Fiji", "Oceania", -18.14, 178.44], ["Papeete", "French Polynesia", "Oceania", -17.54, -149.57], ["Perth", "Australia", "Oceania", -31.95, 115.86], ["Sydney", "Australia", "Oceania", -33.87, 151.21], ["Auckland", "New Zealand", "Oceania", -36.85, 174.76],
].map(([name, country, region, lat, lon]) => ({ name, country, r: region, lat, lon }));

const ALIASES = { nyc: "new york", sf: "san francisco", la: "los angeles", dc: "washington", sao: "sao paulo", bombay: "mumbai", calcutta: "kolkata" };

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
export function normalizeCityQuery(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
export function searchCities(query, cities = CITY_CATALOG, limit = 8) {
  const q = normalizeCityQuery(query); if (!q) return [];
  const target = ALIASES[q] || q; const terms = target.split(" ");
  return cities.map((city) => { const name = normalizeCityQuery(city.name), country = normalizeCityQuery(city.country), hay = `${name} ${country} ${normalizeCityQuery(city.r)}`; const score = name === target ? 0 : name.startsWith(target) ? 1 : country === target ? 2 : country.startsWith(target) ? 3 : hay.includes(target) ? 4 : terms.every((term) => hay.includes(term)) ? 5 : 99; const populationBonus = Number.isFinite(city.population) ? Math.max(0, Math.min(2, city.population / 1000000)) : 0; return { city, score, populationBonus }; }).filter((x) => x.score < 99).sort((a, b) => a.score - b.score || b.populationBonus - a.populationBonus || a.city.name.localeCompare(b.city.name)).slice(0, limit).map((x) => x.city);
}
export function mergeCities(base, extra) { const seen = new Set(base.map((city) => `${normalizeCityQuery(city.name)}|${normalizeCityQuery(city.country)}`)); return base.concat(extra.filter((city) => { const key = `${normalizeCityQuery(city.name)}|${normalizeCityQuery(city.country)}`; if (seen.has(key)) return false; seen.add(key); return true; })); }
export function parseCityRows(rows) { return (Array.isArray(rows) ? rows : []).map((row) => ({ name: row.name || row.city, country: row.country || row.countryName, r: row.region || row.admin_name || row.country || row.countryName || "Worldwide", lat: Number(row.lat ?? row.latitude), lon: Number(row.lon ?? row.lng ?? row.longitude), population: Number(row.population || 0) })).filter((city) => city.name && city.country && Number.isFinite(city.lat) && Number.isFinite(city.lon) && city.lat >= -90 && city.lat <= 90 && city.lon >= -180 && city.lon <= 180); }

export function formatCityLabel(city) {
  if (!city) return "";
  const st = city.country === "US" ? usStateCode(city.r) : null;
  let region = null;
  if (st) region = US_STATES[st].name;
  else if (city.r && /[A-Za-z]/.test(city.r) && city.r !== city.country) region = city.r;
  const country = city.country === "US" ? "USA" : city.country;
  return [city.name, region, country].filter(Boolean).join(", ");
}

// Closest catalog city to a coordinate pair (haversine). Returns null when no
// city is within maxKm, so GPS in the middle of nowhere falls back to the
// coordinate-only estimate instead of inheriting a far-away state's tariff.
export function nearestCity(lat, lon, cities = CITY_CATALOG, maxKm = 60) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  let best = null, bestKm = Infinity;
  const R = 6371, toRad = Math.PI / 180;
  for (const c of cities) {
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lon)) continue;
    const dLat = (c.lat - lat) * toRad, dLon = (c.lon - lon) * toRad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * toRad) * Math.cos(c.lat * toRad) * Math.sin(dLon / 2) ** 2;
    const km = 2 * R * Math.asin(Math.sqrt(a));
    if (km < bestKm) { bestKm = km; best = c; }
  }
  return bestKm <= maxKm ? best : null;
}
export async function lookupCityOnline(query, fetchImpl = globalThis.fetch) {
  const q = String(query || "").trim();
  if (q.length < 2) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(q)}`;
    const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const row = (await response.json())?.[0];
    if (!row) return null;
    return { name: row.name || row.display_name.split(",")[0], country: row.address?.country_code?.toUpperCase() || row.address?.country || "", r: row.address?.state || row.address?.region || row.address?.country || "Worldwide", lat: Number(row.lat), lon: Number(row.lon) };
  } catch { return null; }
}

export async function loadCityCatalog({ fetchImpl = globalThis.fetch, storage = globalThis.localStorage } = {}) {
  const cacheKey = "beco-city-catalog-v6-pop10k-us";
  try { const cached = storage?.getItem(cacheKey); if (cached) return mergeCities(CITY_CATALOG, parseCityRows(JSON.parse(cached))); } catch { /* optional cache */ }
  try { const response = await fetchImpl("./assets/js/sizing/city-data/index.json", { cache: "force-cache" }); if (!response.ok) throw new Error(`city index HTTP ${response.status}`); const index = await response.json(); const all = []; for (const item of index) { const part = await fetchImpl(`./assets/js/sizing/city-data/${encodeURIComponent(item.file)}.json`, { cache: "force-cache" }); if (part.ok) all.push(...parseCityRows(await part.json())); } try { storage?.setItem(cacheKey, JSON.stringify(all)); } catch { /* optional cache */ } return mergeCities(CITY_CATALOG, all); } catch { return CITY_CATALOG; }
}
