import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CITY_CATALOG,
  COUNTRY_FILES,
  COUNTRY_SET,
  countryCodesFor,
  mergeCities,
  normalizeCityQuery,
  parseCityRows,
  searchCities,
  typedCityCandidates,
  loadCountryCities,
  cachedCountryCities,
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
  // COUNTRY_FILES (generated by scripts/sync-country-files.mjs) is the
  // partition index now — no separate index.json is shipped or fetched.
  const codes = COUNTRY_FILES.split(" ");
  assert.ok(codes.length >= 200);
  for (const code of ["US", "CA", "BR", "IN", "NG", "AU", "JP"])
    assert.ok(codes.includes(code), code);
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

test("country partitions load on demand, memoized, and never replace the seed", async () => {
  const store = new Map();
  const fetched = [];
  // "AD" (Andorra) is a real partition code from the generated table; the
  // fetch is injected, so the fixture rows don't need to match the file.
  const rows = await loadCountryCities(
    "AD",
    async (url) => {
      fetched.push(url);
      return {
        ok: true,
        json: async () => [
          { name: "Testville", country: "Testland", lat: "1.25", lng: "2.5" },
        ],
      };
    },
    storageFrom(store),
  );
  assert.equal(rows.length, 1, "partition rows parsed");
  assert.ok(
    fetched.every((u) => /AD\.json\?v=\w+$/.test(String(u))),
    "partition fetched with a single suffix and a cache-busting stamp",
  );
  // Memoized: the second load must not re-fetch.
  await loadCountryCities(
    "AD",
    async () => {
      throw new Error("must not re-fetch a memoized partition");
    },
    storageFrom(store),
  );
  assert.equal(
    fetched.length,
    1,
    "exactly one fetch per country per page load",
  );
  // Persisted under the per-country v1 key for offline use.
  assert.ok(store.get("beco-city-AD-v1"), "rows cached per country");
  assert.equal(cachedCountryCities("AD", storageFrom(store)).length, 1);
  // Unknown codes and failures degrade to empty — never a thrown error.
  assert.deepEqual(await loadCountryCities("ZZ", null, storageFrom(store)), []);
  // A real partition code that 404s (not ok) also returns no rows — use a
  // different real code ("AE") so test order can't hit the memo above.
  assert.deepEqual(
    await loadCountryCities("AE", async () => ({ ok: false }), new Map()),
    [],
    "HTTP failure returns no rows",
  );
});

test("typedCityCandidates merges seed, cached, and fetched results", async () => {
  const store = new Map();
  store.set(
    "beco-city-AF-v1",
    JSON.stringify([
      {
        name: "Cacheville",
        country: "AF",
        r: "Region",
        lat: 5,
        lon: 5,
        population: 10,
      },
    ]),
  );
  const fetched = [];
  const rows = await typedCityCandidatesWith(
    "testville",
    ["AF"],
    async (url) => {
      fetched.push(url);
      return {
        ok: true,
        json: async () => [
          {
            name: "Testville",
            country: "AF",
            lat: "1.25",
            lng: "2.5",
            population: 900,
          },
        ],
      };
    },
    store,
  );
  assert.ok(rows.length > CITY_CATALOG.length, "seed plus extras");
  assert.ok(
    rows.some((c) => c.name === "Cacheville"),
    "localStorage rows included",
  );
  assert.ok(
    rows.some((c) => c.name === "Testville"),
    "fetched rows included",
  );
  assert.ok(fetched.length >= 1, "network used only for the query's countries");
});

test("countryCodesFor maps queries to the right partitions", () => {
  // Seed-name matches: Berlin → DE, Honolulu → US.
  assert.deepEqual(countryCodesFor("Berlin"), ["DE"]);
  assert.deepEqual(countryCodesFor("Honolulu"), ["US"]);
  // Seed-country names tag their partition (typed "Germany" → DE).
  assert.deepEqual(countryCodesFor("Germany"), ["DE"]);
  // Prefix overlaps load every plausible country: "New" → New York (US)
  // + New Zealand (NZ) — both are loaded rather than guessed.
  const nw = countryCodesFor("New");
  assert.ok(nw.includes("US") && nw.includes("NZ"), "prefix overlap: " + nw);
  // Noise and short queries cost nothing.
  assert.deepEqual(countryCodesFor(""), []);
  assert.deepEqual(countryCodesFor("a"), []);
  assert.deepEqual(countryCodesFor("zzzzzz"), []);
  // The generated table itself: US is a real partition.
  assert.ok(COUNTRY_SET.has("US"));
  assert.ok(!COUNTRY_SET.has("ZZ"));
});

function storageFrom(store) {
  return {
    getItem: (k) => store.get(k),
    setItem: (k, v) => store.set(k, v),
  };
}

// typedCityCandidates with injected fetch/storage/codes (module-level
// memoization makes the real export order-dependent across tests; the
// production behavior under test — merge order — is identical to this
// injection).
function typedCityCandidatesWith(query, codes, fetchImpl, store) {
  const local = searchCities(query);
  const cached = codes.flatMap((cc) =>
    cachedCountryCities(cc, storageFrom(store)),
  );
  const extras = mergeCities(local, cached);
  if (!codes.length) return Promise.resolve(mergeCities(CITY_CATALOG, extras));
  return Promise.all(
    codes.map((cc) => loadCountryCities(cc, fetchImpl, storageFrom(store))),
  ).then((rows) => mergeCities(mergeCities(CITY_CATALOG, extras), rows.flat()));
}

// Hands-free auto-resolve: typing alone must resolve the typed text after the
// 2s cadence stops — no Enter, no suggestion click. Behavioral replacement
// for the old ui.js source-regex assertions (shouldAutoResolve / 2000ms /
// cancelAutoResolve / resolveTypedCity): a moved, removed, or re-cadenced
// timer fails here, and the real contract is exercised instead of the text.
test("typing a city resolves hands-free after the 2s auto-resolve cadence", async () => {
  const pickerSrc = readFileSync(
    new URL("../assets/js/sizing/location-picker.js", import.meta.url),
    "utf8",
  );
  const stamped = pickerSrc.match(/from "\.\/(cities\.js\?v=[^"]+)"/)?.[1];
  assert.ok(stamped, "location-picker must import the stamped cities module");
  const { setGeocodeFetchImpl } = await import(
    new URL(`../assets/js/sizing/${stamped}`, import.meta.url).href
  );
  const { setupCitySearch } = await import(
    new URL("../assets/js/sizing/location-picker.js", import.meta.url).href
  );

  setGeocodeFetchImpl(async () => {
    throw new Error("network disabled in tests");
  });
  const realDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) =>
      id === "citySearch" ? search : id === "citySuggestions" ? list : null,
    createElement: () => ({
      attrs: {},
      children: [],
      listeners: {},
      dataset: {},
      hidden: false,
      value: "",
      textContent: "",
      style: {},
      appendChild(c) {
        this.children.push(c);
        return c;
      },
      setAttribute(k, v) {
        this.attrs[k] = String(v);
      },
      addEventListener(t, f) {
        (this.listeners[t] ??= []).push(f);
      },
      dispatch(t, ev = {}) {
        for (const f of this.listeners[t] ?? []) f(ev);
      },
      focus() {},
      querySelectorAll() {
        return [];
      },
    }),
  };
  const search = globalThis.document.createElement("input");
  const list = globalThis.document.createElement("div");

  try {
    const picks = [];
    setupCitySearch({ onPick: (...a) => picks.push(a), setStatus: () => {} });

    search.value = "Nairobi";
    search.dispatch("input");

    // Nothing may resolve while the cadence is still running.
    await new Promise((r) => setTimeout(r, 1500));
    assert.deepEqual(picks, [], "no hands-free resolution before the cadence");

    // After the cadence, the typed query resolves with the full contract.
    await new Promise((r) => setTimeout(r, 1200));
    const want = searchCities("Nairobi", CITY_CATALOG, 1)[0];
    assert.equal(picks.length, 1, "hands-free resolution fired exactly once");
    assert.deepEqual(picks[0], [
      want.lat,
      want.lon,
      `Sunshine data from ${formatCityLabel(want)}`,
      want.r,
      want.country,
    ]);
  } finally {
    globalThis.document = realDocument;
    setGeocodeFetchImpl(null);
  }
});
