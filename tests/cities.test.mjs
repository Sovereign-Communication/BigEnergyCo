import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CITY_CATALOG,
  mergeCities,
  normalizeCityQuery,
  parseCityRows,
  searchCities,
  loadCityCatalog,
  lookupCityOnline,
  formatCityLabel,
  nearestCity,
  shouldAutoResolve,
} from "../assets/js/sizing/cities.js";
import { estimateTariff } from "../assets/js/sizing/pricing.js";

test("auto-resolve debounce guard skips empty and already-resolved queries", () => {
  // Nothing typed: never resolve.
  assert.equal(shouldAutoResolve("", ""), false);
  assert.equal(shouldAutoResolve("   ", "honolulu"), false);
  // Fresh query: resolve.
  assert.equal(shouldAutoResolve("honolulu", ""), true);
  // Same city already resolved (case/accents aside): do not re-resolve.
  assert.equal(shouldAutoResolve("Honolulu", "Honolulu"), false);
  assert.equal(shouldAutoResolve("sao paulo", "São Paulo"), false);
  // Changed query: resolve again.
  assert.equal(shouldAutoResolve("lagos", "honolulu"), true);
});

test("the UI wires a 2s auto-resolve debounce that reuses resolveTypedCity", () => {
  const ui = readFileSync(
    new URL("../assets/js/sizing/ui.js", import.meta.url),
    "utf8",
  );
  assert.match(ui, /shouldAutoResolve/);
  assert.match(ui, /, 2000\)/);
  assert.match(ui, /cancelAutoResolve/);
  assert.match(ui, /resolveTypedCity\(\)/);
});

test("city queries ignore case, accents, and punctuation", () => {
  assert.equal(normalizeCityQuery("  São-Paulo! "), "sao paulo");
  assert.equal(searchCities("sao paulo")[0].name, "Sao Paulo");
});

test("exact and prefix matches rank first", () => {
  assert.equal(searchCities("Tokyo")[0].country, "Japan");
  assert.equal(searchCities("new")[0].name, "New York");
});

test("country-qualified and aliases return useful results", () => {
  assert.equal(searchCities("India")[0].country, "India");
  assert.equal(searchCities("nyc")[0].name, "New York");
});

test("the public UI uses type-ahead only and keeps My location backup", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /id="citySearch"/);
  assert.match(html, /id="btnGeoLocate"/);
  assert.match(
    html,
    /press\s*<strong>Enter<\/strong>\s*or\s*<strong>Tab<\/strong>/,
  );
  assert.match(html, /exact\/custom coordinates/);
  assert.doesNotMatch(html, /id="cityPreset"/);
});

test("major US cities are present and rank ahead of lesser same-name places", () => {
  const us = JSON.parse(
    readFileSync(
      new URL("../assets/js/sizing/city-data/US.json", import.meta.url),
    ),
  );
  for (const [query, lat, lon] of [
    ["New Orleans", 29.95, -90.08],
    ["Chicago", 41.88, -87.63],
    ["Seattle", 47.61, -122.33],
    ["Boston", 42.36, -71.06],
    ["San Diego", 32.72, -117.16],
  ]) {
    const result = searchCities(query, us, 1)[0];
    assert.ok(result, query);
    assert.ok(
      Math.abs(result.lat - lat) < 0.2 && Math.abs(result.lon - lon) < 0.2,
      query,
    );
  }
});

test("representative cities on every inhabited-region seed are searchable", () => {
  for (const [query, expected] of [
    ["Honolulu", "United States"],
    ["Sao Paulo", "Brazil"],
    ["London", "United Kingdom"],
    ["Nairobi", "Kenya"],
    ["Dubai", "United Arab Emirates"],
    ["Tokyo", "Japan"],
    ["Sydney", "Australia"],
  ]) {
    assert.equal(searchCities(query)[0].country, expected);
  }
});

test("empty and unknown queries are safe", () => {
  assert.deepEqual(searchCities(""), []);
  assert.deepEqual(searchCities("not-a-real-place"), []);
});

test("catalog coordinates are valid and results are bounded", () => {
  assert.ok(CITY_CATALOG.length >= 60);
  assert.ok(searchCities("a", CITY_CATALOG, 3).length <= 3);
  for (const city of CITY_CATALOG) {
    assert.ok(city.lat >= -90 && city.lat <= 90);
    assert.ok(city.lon >= -180 && city.lon <= 180);
  }
});

test("catalog merging deduplicates the existing seed", () => {
  const merged = mergeCities(CITY_CATALOG, [
    { name: "Tokyo", country: "Japan", r: "Asia", lat: 35.68, lon: 139.69 },
    {
      name: "Springfield",
      country: "United States",
      r: "North America",
      lat: 39.8,
      lon: -89.6,
    },
  ]);
  assert.equal(merged.length, CITY_CATALOG.length + 1);
  assert.equal(searchCities("springfield", merged)[0].lat, 39.8);
});

test("city rows accept common dataset coordinate formats and reject invalid rows", () => {
  assert.deepEqual(
    parseCityRows([
      { name: "Testville", country: "Testland", lat: "1.25", lng: "2.5" },
      { city: "Bad", country: "Nowhere", latitude: "100", longitude: "2" },
    ]),
    [
      {
        name: "Testville",
        country: "Testland",
        r: "Testland",
        lat: 1.25,
        lon: 2.5,
        population: 0,
      },
    ],
  );
  assert.equal(
    parseCityRows([
      { name: "Phoenix", country: "US", r: "AZ", lat: 33.45, lon: -112.07 },
    ])[0].r,
    "AZ",
  );
});

test("bundled worldwide catalog contains broad coverage and valid coordinates", () => {
  const data = JSON.parse(
    readFileSync(
      new URL("../assets/js/sizing/city-data/US.json", import.meta.url),
    ),
  );
  assert.ok(data.length >= 4000);
  assert.ok(data.every((city) => city.population >= 10000));
  assert.ok(data.every((city) => city.country === "US"));
  for (const query of [
    "Anchorage",
    "Springfield",
    "Rochester",
    "Fresno",
    "Boise",
    "Boulder",
  ])
    assert.ok(searchCities(query, data, 1).length, query);
  for (const city of data.slice(0, 10000))
    assert.ok(
      city.lat >= -90 && city.lat <= 90 && city.lon >= -180 && city.lon <= 180,
    );
});

test("partitioned worldwide catalog covers many countries", () => {
  const index = JSON.parse(
    readFileSync(
      new URL("../assets/js/sizing/city-data/index.json", import.meta.url),
    ),
  );
  assert.ok(index.length >= 200);
  assert.ok(index.reduce((sum, item) => sum + item.count, 0) >= 40000);
  for (const code of [
    "US.json",
    "CA.json",
    "BR.json",
    "IN.json",
    "NG.json",
    "AU.json",
    "JP.json",
  ])
    assert.ok(
      index.some(
        (item) =>
          item.file === code ||
          item.file.startsWith(code.replace(".json", "-")),
      ),
      code,
    );
});

test("city labels include expanded US state and country", () => {
  assert.equal(
    formatCityLabel({ name: "New Orleans", r: "LA", country: "US" }),
    "New Orleans, Louisiana, USA",
  );
  assert.equal(
    formatCityLabel({ name: "New Orleans", r: "Louisiana", country: "US" }),
    "New Orleans, Louisiana, USA",
  );
  assert.equal(
    formatCityLabel({
      name: "Phoenix",
      r: "Arizona",
      country: "United States",
    }),
    "Phoenix, Arizona, USA",
  );
  assert.equal(
    formatCityLabel({ name: "Toronto", r: "Ontario", country: "Canada" }),
    "Toronto, Ontario, Canada",
  );
  // Numeric admin codes are hidden, not shown as junk.
  assert.equal(
    formatCityLabel({ name: "Berlin", r: "16", country: "DE" }),
    "Berlin, DE",
  );
});

test("seed CITY_CATALOG US cities carry exact state electricity tariffs", () => {
  const phx = CITY_CATALOG.find((c) => c.name === "Phoenix");
  assert.ok(phx, "Phoenix present in seed catalog");
  assert.equal(phx.r, "Arizona");
  const estPhx = estimateTariff(phx.lat, phx.lon, phx.r, phx.country);
  assert.equal(estPhx.rate, 0.136);

  const ny = CITY_CATALOG.find((c) => c.name === "New York");
  assert.ok(ny, "New York present in seed catalog");
  assert.equal(ny.r, "New York");
  const estNy = estimateTariff(ny.lat, ny.lon, ny.r, ny.country);
  assert.equal(estNy.rate, 0.23);

  const toronto = CITY_CATALOG.find((c) => c.name === "Toronto");
  assert.ok(toronto, "Toronto present in seed catalog");
  assert.equal(toronto.r, "Ontario");
  const estTor = estimateTariff(
    toronto.lat,
    toronto.lon,
    toronto.r,
    toronto.country,
  );
  assert.equal(estTor.rate, 0.13);
  assert.equal(estTor.currency, "CAD");
});

test("US state tariffs beat the coarse mainland lump", () => {
  const noState = estimateTariff(29.95, -90.08);
  assert.equal(noState.rate, 0.17); // US mainland box
  const la = estimateTariff(29.95, -90.08, "LA");
  assert.equal(la.rate, 0.119);
  assert.equal(la.label, "Louisiana, United States");
  const ny = estimateTariff(40.71, -74.01, "New York");
  assert.equal(ny.rate, 0.23);
  const hi = estimateTariff(21.31, -157.86, "HI");
  assert.equal(hi.rate, 0.44);
});

test("US locations actively carry the USD currency (GPS and state lookups)", () => {
  // Coordinate-only (GPS): the mainland box must set USD so a previously
  // auto-selected MXN/EUR resets when the user clicks "Use my current location".
  assert.equal(estimateTariff(29.95, -90.08).currency, "USD");
  assert.equal(estimateTariff(33.45, -112.07).currency, "USD");
  // State-level lookups (city search) must also reset to USD.
  assert.equal(estimateTariff(29.95, -90.08, "LA").currency, "USD");
  assert.equal(estimateTariff(40.71, -74.01, "New York").currency, "USD");
  assert.equal(estimateTariff(21.31, -157.86, "HI").currency, "USD");
  // Canada now carries CAD so GPS north of the border doesn't stay in USD.
  // (Toronto sits inside the US mainland box by coordinates, so the country
  // code is what prevents a US rate from winning.)
  assert.equal(estimateTariff(43.65, -79.38, undefined, "CA").currency, "CAD");
  assert.equal(estimateTariff(43.65, -79.38, undefined, "CA").rate, 0.13);
  assert.equal(
    estimateTariff(43.65, -79.38, "Ontario", "Canada").currency,
    "CAD",
  );
  assert.equal(estimateTariff(43.65, -79.38, "Ontario", "Canada").rate, 0.13);
});

test("nearestCity resolves GPS coordinates to a nearby catalog city region", () => {
  const us = JSON.parse(
    readFileSync(
      new URL("../assets/js/sizing/city-data/US.json", import.meta.url),
    ),
  );
  const near = nearestCity(29.95, -90.08, us, 80);
  assert.ok(near, "New Orleans GPS should snap to a catalog city");
  assert.equal(near.name, "New Orleans");
  assert.equal(near.r, "LA");
  // Far from any catalog city -> null (falls back to coordinate-only estimate).
  assert.equal(nearestCity(0, 0, us, 80), null);
});

test("online lookup converts a free geocoder result into coordinates", async () => {
  const result = await lookupCityOnline("Testville", async () => ({
    ok: true,
    json: async () => [
      {
        name: "Testville",
        lat: "1.25",
        lon: "2.5",
        address: { country: "Testland", state: "Test State" },
      },
    ],
  }));
  assert.deepEqual(result, {
    name: "Testville",
    country: "Testland",
    r: "Test State",
    lat: 1.25,
    lon: 2.5,
  });
});

test("remote catalog is parsed and cached without replacing the seed", async () => {
  const store = new Map();
  // Real contract: index.json lists { file: "XX.json", count }, and each
  // country file is fetched once (never "XX.json.json" — the double suffix
  // was a real regression that silently disabled the full catalog).
  const fetched = [];
  const expanded = await loadCityCatalog({
    fetchImpl: async (url) => {
      fetched.push(url);
      const path = String(url).split("?")[0];
      return path.endsWith("index.json")
        ? { ok: true, json: async () => [{ file: "XX.json", count: 1 }] }
        : {
            ok: true,
            json: async () => [
              {
                name: "Testville",
                country: "Testland",
                lat: "1.25",
                lng: "2.5",
              },
            ],
          };
    },
    storage: {
      getItem: (key) => store.get(key),
      setItem: (key, value) => store.set(key, value),
    },
  });
  assert.ok(expanded.length > CITY_CATALOG.length);
  assert.equal(searchCities("testville", expanded)[0].lon, 2.5);
  assert.ok(store.size > 0);
  assert.ok(
    fetched.some((u) => String(u).split("?")[0].endsWith("XX.json")),
    "country file fetched with a single .json suffix",
  );
  assert.ok(
    !fetched.some((u) => u.endsWith(".json.json")),
    "no double .json.json suffix",
  );
  assert.ok(
    fetched.some((u) => /\?v=\w+$/.test(String(u))),
    "catalog fetches carry a cache-busting ?v= stamp",
  );
});
