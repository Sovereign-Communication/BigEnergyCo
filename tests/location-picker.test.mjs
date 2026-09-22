// Executable contract for the location-picker mechanics extracted from
// ui.js: every location decision must funnel through the injected onPick
// callback with the full (lat, lon, label, region, country) contract, and
// status feedback must go through the injected setStatus. The geocoder's
// HTTP layer is routed through the setGeocodeFetchImpl seam, so the fallback
// chain runs fully offline-deterministically — no real network, no dangling
// timers.
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  locateMe,
  purgeLegacyCityCache,
  setupCitySearch,
} from "../assets/js/sizing/location-picker.js";

// Bind the SAME cities.js instance the picker imports (stamped specifier):
// Node treats a query-string specifier as a distinct module, so a bare
// import would leave setGeocodeFetchImpl patching the wrong instance.
const pickerSrc = readFileSync(
  new URL("../assets/js/sizing/location-picker.js", import.meta.url),
  "utf8",
);
const stampedCities = pickerSrc.match(/from "\.\/(cities\.js\?v=[^"]+)"/)?.[1];
assert.ok(
  stampedCities,
  "location-picker must import the stamped cities module",
);
const {
  CITY_CATALOG,
  CITY_LOOKUP_TIMEOUT_MS,
  formatCityLabel,
  nearestCity,
  searchCities,
  setGeocodeFetchImpl,
} = await import(
  new URL(`../assets/js/sizing/${stampedCities}`, import.meta.url).href
);

// ── DOM stub: just what the picker touches ─────────────────────────────────

function makeEl(tag) {
  return {
    tag,
    children: [],
    attrs: {},
    listeners: {},
    dataset: {},
    hidden: false,
    value: "",
    textContent: "",
    className: "",
    style: {},
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    setAttribute(k, v) {
      this.attrs[k] = String(v);
    },
    addEventListener(type, fn) {
      (this.listeners[type] ??= []).push(fn);
    },
    dispatch(type, ev = {}) {
      for (const fn of this.listeners[type] ?? []) fn(ev);
    },
    focus() {},
    querySelectorAll() {
      return [];
    },
  };
}

function withDom(registry, fn) {
  const realDocument = globalThis.document;
  // Route the geocoder's HTTP through the module's injection seam with a
  // throwing stub: the fallback chain then behaves exactly like offline,
  // deterministically, with no real network calls and no dangling timers.
  setGeocodeFetchImpl(async () => {
    throw new Error("network disabled in tests");
  });
  globalThis.document = {
    getElementById: (id) => registry[id] ?? null,
    createElement: makeEl,
  };
  try {
    return fn();
  } finally {
    globalThis.document = realDocument ?? FALLBACK_DOC;
    setGeocodeFetchImpl(null);
  }
}

const status = () => {
  const seen = [];
  return { seen, setStatus: (t) => seen.push(t) };
};

// The geocoder fallback chain spans several event-loop turns, including a
// setTimeout-based last-resort partition, which setImmediate cannot advance.
// Drain with real clock advancement on the module's own debounce cadence so
// every continuation resolves while the document stub is still installed.
async function drainUntil(condition, tries = 60) {
  for (let i = 0; i < tries && !condition(); i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  return condition();
}

// In Node, globalThis.document starts undefined; teardown restores this
// benign fallback so the module's own late timers (the 2s hands-free
// auto-resolve, the GPS background refinement — both guarded no-ops in a
// real browser) cannot crash after a test ends.
function benignEl() {
  return makeEl("div");
}
const FALLBACK_DOC = {
  getElementById: () => null,
  createElement: benignEl,
};

// ── City combobox ───────────────────────────────────────────────────────────

test("city combobox: picking a suggestion funnels the full contract through onPick", () => {
  withDom(
    { citySearch: makeEl("input"), citySuggestions: makeEl("div") },
    () => {
      const picks = [];
      const { setStatus } = status();
      setupCitySearch({ onPick: (...a) => picks.push(a), setStatus });
      const search = globalThis.document.getElementById("citySearch");
      const list = globalThis.document.getElementById("citySuggestions");

      search.value = "Honolulu";
      search.dispatch("input");
      assert.ok(list.children.length, "suggestions rendered");
      assert.equal(list.hidden, false);
      assert.equal(list.children[0].attrs.role, "option");

      list.children[0].dispatch("click");
      const want = searchCities("Honolulu", CITY_CATALOG, 1)[0];
      assert.deepEqual(picks, [
        [
          want.lat,
          want.lon,
          `Sunshine data from ${formatCityLabel(want)}`,
          want.r,
          want.country,
        ],
      ]);
      // Combobox closes and mirrors the picked label.
      assert.equal(list.hidden, true);
      assert.equal(search.attrs["aria-expanded"], "false");
      assert.equal(search.value, formatCityLabel(want));
    },
  );
});

test("city combobox: Enter on an exact seed query resolves offline with zero network", () => {
  withDom(
    { citySearch: makeEl("input"), citySuggestions: makeEl("div") },
    () => {
      const picks = [];
      setupCitySearch({ onPick: (...a) => picks.push(a), setStatus: () => {} });
      const search = globalThis.document.getElementById("citySearch");
      const list = globalThis.document.getElementById("citySuggestions");

      search.value = "Honolulu";
      let prevented = false;
      search.dispatch("keydown", {
        key: "Enter",
        preventDefault: () => {
          prevented = true;
        },
      });
      const want = searchCities("Honolulu", CITY_CATALOG, 1)[0];
      assert.deepEqual(picks, [
        [
          want.lat,
          want.lon,
          `Sunshine data from ${formatCityLabel(want)}`,
          want.r,
          want.country,
        ],
      ]);
      assert.equal(prevented, true, "Enter is consumed");
      assert.equal(list.hidden, true);
    },
  );
});

test("city combobox: an unmatchable query reports the no-match status after the real fallback chain", async () => {
  await withDom(
    { citySearch: makeEl("input"), citySuggestions: makeEl("div") },
    async () => {
      const { seen, setStatus } = status();
      setupCitySearch({ onPick: () => {}, setStatus });
      const search = globalThis.document.getElementById("citySearch");

      search.value = "Xqzwvt";
      search.dispatch("keydown", { key: "Enter", preventDefault() {} });
      // Offline partitions, then the online geocoder (network stub → null).
      const settled = await drainUntil(
        () =>
          seen.at(-1) ===
          "No match found — check the spelling or pick a suggestion.",
      );
      assert.equal(settled, true, "fallback chain completed in-test");
      assert.ok(seen.includes("Searching city data…"));
      assert.equal(
        seen.at(-1),
        "No match found — check the spelling or pick a suggestion.",
      );
    },
  );
});

// ── Legacy cache purge ─────────────────────────────────────────────────────

test("purgeLegacyCityCache removes the legacy blob key and tolerates absent storage", () => {
  const realStorage = globalThis.localStorage;
  const removed = [];
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { removeItem: (k) => removed.push(k) },
  });
  try {
    purgeLegacyCityCache();
    assert.deepEqual(removed, ["beco-city-catalog-v6-pop10k-us"]);
  } finally {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: realStorage,
    });
  }
  // No localStorage at all must not throw.
  assert.doesNotThrow(() => purgeLegacyCityCache());
});

// ── Locate me ──────────────────────────────────────────────────────────────

function withNavigator(value, fn) {
  const had = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value,
  });
  try {
    return fn();
  } finally {
    if (had) Object.defineProperty(globalThis, "navigator", had);
  }
}

test("locateMe: no geolocation API warns and never picks", () => {
  withNavigator({}, () => {
    const { seen, setStatus } = status();
    locateMe({ onPick: () => {}, setStatus });
    assert.equal(
      seen[0],
      "Warning: Your browser can't share a location. Search for a city instead.",
    );
  });
});

test("locateMe: a denied fix warns and never picks", () => {
  withNavigator(
    {
      geolocation: {
        getCurrentPosition(_ok, err) {
          err(new Error("x"));
        },
      },
    },
    () => {
      const { seen, setStatus } = status();
      const picks = [];
      locateMe({ onPick: (...a) => picks.push(a), setStatus });
      assert.equal(
        seen.at(-1),
        "Warning: Couldn't get your location. Search for a city instead.",
      );
      assert.deepEqual(picks, []);
    },
  );
});

test("locateMe: a GPS fix funnels through onPick twice — raw, then seed-refined with price context", async () => {
  await withNavigator(
    {
      geolocation: {
        getCurrentPosition(ok) {
          ok({ coords: { latitude: 21.31, longitude: -157.86 } });
        },
      },
    },
    async () => {
      const { seen, setStatus } = status();
      const picks = [];
      locateMe({ onPick: (...a) => picks.push(a), setStatus });
      assert.ok(seen.includes(" Asking your browser for your location…"));
      // Both synchronous picks (raw, then seed-refined) land in this tick;
      // the async reverse-geocode refine adds a third only when the country
      // context differs. Drain, then assert the full final contract.
      // The refinement (reverse geocode, then possible country-catalog load)
      // is async; drain until the price-context re-pin lands.
      const refined = await drainUntil(
        () =>
          picks.length === 2 &&
          typeof picks[1]?.[2] === "string" &&
          picks[1][2].includes("prices based on"),
      );
      assert.equal(refined, true, "seed refinement completed in-test");
      const want = nearestCity(21.31, -157.86, CITY_CATALOG, Infinity);
      assert.deepEqual(picks, [
        [21.31, -157.86, "Using your precise location"],
        [
          21.31,
          -157.86,
          `Using your precise location — prices based on ${formatCityLabel(want)}`,
          want.r,
          want.country,
        ],
      ]);
    },
  );
});
