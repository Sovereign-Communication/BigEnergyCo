import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  fetchHourlyCached,
  cacheKey,
  isUsableWeather,
  IN_MEMORY_WEATHER_CACHE,
} from "../assets/js/sizing/nasa.js";

const LAT = 21.31,
  LON = -157.86,
  YEARS = 2;

function yearWindow() {
  const endYear = new Date().getUTCFullYear() - 1;
  return { startYear: endYear - YEARS + 1, endYear };
}

function fakeNetwork(stale = false) {
  let calls = 0;
  const { startYear, endYear } = yearWindow();
  return {
    get count() {
      return calls;
    },
    impl: async () => {
      calls += 1;
      const s = stale ? startYear - 1 : startYear;
      const e = stale ? endYear - 1 : endYear;
      return {
        ok: true,
        json: async () => ({
          properties: {
            parameter: {
              ALLSKY_SFC_SW_DWN: { [`${s}010100`]: 5 },
              T2M: { [`${s}010100`]: 25 },
            },
          },
        }),
      };
    },
  };
}

function makeIdbMock({ storelessUpgrade = false } = {}) {
  const store = new Map();
  const api = {
    open(_name, version = 1) {
      const req = { result: null, error: null };
      queueMicrotask(() => {
        // Build the db handle first (the upgrade handler reads req.result),
        // then run the opener's upgrade hook, then report success.
        // storelessUpgrade: the upgrade path RUNS but creates nothing — the
        // exact database state v1 shipped with.
        const db = {
          objectStoreNames: {
            contains: (n) =>
              version >= 2 && !storelessUpgrade ? store.has(n) : false,
          },
          createObjectStore: (n) => {
            if (storelessUpgrade) return;
            if (!store.has(n)) store.set(n, new Map());
          },
          transaction(name, _mode) {
            const tx = { complete: Promise.resolve() };
            tx.objectStore = () => ({
              get: (k) => {
                const r = { result: store.get(name)?.get(k) ?? undefined };
                queueMicrotask(() => r.onsuccess?.());
                return r;
              },
              put: (v, k) => {
                if (!store.has(name)) store.set(name, new Map());
                store.get(name).set(k, structuredClone(v));
                return {};
              },
              delete: (k) => {
                store.get(name)?.delete(k);
                return {};
              },
            });
            return tx;
          },
          close() {},
        };
        req.result = db;
        if (version >= 2) req.onupgradeneeded?.({ target: req });
        queueMicrotask(() => req.onsuccess?.());
      });
      return req;
    },
  };
  return { api, store };
}

function makeCachesMock({ withEntry = null } = {}) {
  const map = new Map();
  if (withEntry) map.set(cacheKey(LAT, LON, YEARS), withEntry);
  return {
    open: async () => ({
      match: async (req) => {
        // Same encoding the writer used (nasa.js encodes the key into the
        // URL): decode before lookup or every hit silently misses.
        const hit = map.get(
          decodeURIComponent(new URL(req.url).pathname.slice(1)),
        );
        return hit ? { json: async () => structuredClone(hit) } : undefined;
      },
      put: async (req, resp) => {
        map.set(
          decodeURIComponent(new URL(req.url).pathname.slice(1)),
          await resp.json(),
        );
      },
      delete: async (req) => map.delete(new URL(req.url).pathname.slice(1)),
    }),
  };
}

function weatherRecord(metaOverrides = {}) {
  const { startYear, endYear } = yearWindow();
  const hours = Array.from({ length: 24 }, (_, h) => ({ ghi: 0.5, tAmb: 25 }));
  return {
    hours,
    meta: {
      years: YEARS,
      startYear,
      endYear,
      ...metaOverrides,
    },
  };
}

async function runFetch({ idb, caches, network, store = null }) {
  IN_MEMORY_WEATHER_CACHE.clear();
  if (idb) globalThis.indexedDB = idb;
  else delete globalThis.indexedDB;
  if (caches) globalThis.caches = caches;
  else delete globalThis.caches;
  try {
    return await fetchHourlyCached(
      {
        latitude: LAT,
        longitude: LON,
        years: YEARS,
        fetchImpl: network.impl,
      },
      store,
    );
  } finally {
    delete globalThis.indexedDB;
    delete globalThis.caches;
  }
}

test("IDB layer persists a series and restores it on the next cold call", async () => {
  const idb = makeIdbMock();
  const net1 = fakeNetwork();
  await runFetch({ idb: idb.api, network: net1 });
  assert.equal(net1.count, 1, "first cold call hits the network");

  const net2 = fakeNetwork();
  const restored = await runFetch({ idb: idb.api, network: net2 });
  assert.equal(net2.count, 0, "second cold call must NOT hit the network");
  assert.equal(
    restored.meta.fromCache,
    true,
    "the restored record carries the compact layer's fromCache marker",
  );
  assert.ok(Array.isArray(restored.hours) && restored.hours.length > 0);
});

test("IDB upgrade path creates the store that v1 never created", async () => {
  const idb = makeIdbMock({ preexistingStorelessDb: true });
  const net = fakeNetwork();
  await runFetch({ idb: idb.api, network: net });
  assert.ok(
    idb.store.has("series"),
    "onupgradeneeded must create the object store (v1 shipped without it)",
  );
});

test("MUTATION TOOTH: an upgrade that creates no store persists nothing", async () => {
  // storelessUpgrade = the shipped v1 behavior: DB opens, upgrade runs,
  // no object store is ever created. nasa.js must fail LOUDLY here in the
  // sense that matters: zero persistence, so the next cold call refetches.
  const idb = makeIdbMock({ storelessUpgrade: true });
  const net1 = fakeNetwork();
  await runFetch({ idb: idb.api, network: net1 });
  const net2 = fakeNetwork();
  await runFetch({ idb: idb.api, network: net2 });
  assert.equal(
    net2.count,
    1,
    "storeless DB = zero persistence = a refetch every cold load (the v1 defect)",
  );
});

test("IDB hit older than the current NASA year window refetches fresh data", async () => {
  const idb = makeIdbMock();
  const stale = weatherRecord({
    startYear: yearWindow().startYear - 1,
    endYear: yearWindow().endYear - 1,
  });
  // Seed the store directly, bypassing open()'s version gate.
  idb.store.set(
    "series",
    new Map([
      [
        `beco-power-v2:${LAT.toFixed(2)},${LON.toFixed(2)},${YEARS}y`,
        {
          ghi: new Float32Array(24).fill(1),
          tAmb: new Float32Array(24).fill(20),
          meta: { ...stale.meta, fromCache: true },
        },
      ],
    ]),
  );
  const net = fakeNetwork();
  const out = await runFetch({ idb: idb.api, network: net });
  assert.equal(net.count, 1, "stale window must fall through to the network");
  assert.equal(
    out.meta.endYear,
    yearWindow().endYear,
    "the restored series must carry the CURRENT year window",
  );
});

test("Cache Storage hit within the window is used; stale window is dropped", async () => {
  // Fresh: no network.
  const freshNet = fakeNetwork();
  await runFetch({
    caches: makeCachesMock({ withEntry: weatherRecord() }),
    network: freshNet,
  });
  assert.equal(freshNet.count, 0, "fresh Cache Storage hit avoids the network");

  // Stale: exactly one refetch, and the blob is deleted rather than shadowing.
  const staleNet = fakeNetwork();
  await runFetch({
    caches: makeCachesMock({
      withEntry: weatherRecord({
        startYear: yearWindow().startYear - 1,
        endYear: yearWindow().endYear - 1,
      }),
    }),
    network: staleNet,
  });
  assert.equal(staleNet.count, 1, "stale Cache Storage hit refetches once");
});

test("localStorage fallback respects the freshness gate too", async () => {
  const mem = new Map();
  const store = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => mem.set(k, v),
    removeItem: (k) => mem.delete(k),
  };
  const freshNet = fakeNetwork();
  await runFetch({ network: freshNet, store });
  assert.equal(freshNet.count, 1, "cold call with empty store");
  const warmNet = fakeNetwork();
  await runFetch({ network: warmNet, store });
  assert.equal(warmNet.count, 0, "fresh localStorage hit avoids the network");
});

test("corrupt persisted shapes still fall through to a refetch (isUsableWeather)", () => {
  assert.equal(isUsableWeather(null), false);
  assert.equal(isUsableWeather({ hours: [], meta: { years: 2 } }), false);
  assert.equal(
    isUsableWeather({ hours: [{ ghi: "5", tAmb: 25 }], meta: { years: 2 } }),
    false,
  );
  assert.equal(
    isUsableWeather({ hours: [{ ghi: 5, tAmb: 25 }], meta: null }),
    false,
  );
  const { startYear, endYear } = yearWindow();
  assert.equal(
    isUsableWeather({
      hours: [{ ghi: 5, tAmb: 25 }],
      meta: { years: 2, startYear, endYear },
    }),
    true,
  );
});

test("SW activate deletes only its own versioned shell caches — never the weather layer", () => {
  const sw = readFileSync("sw.js", "utf8");
  const activate = sw.slice(sw.indexOf('addEventListener("activate"'));
  assert.ok(
    activate.includes("beco-weather"),
    "activate must document that unversioned weather caches are preserved",
  );
  // The delete pattern must be anchored to the versioned shell prefix; the
  // old `k !== CACHE_VERSION` filter deleted EVERY other cache, including
  // the app-owned weather layer, on every SW update.
  assert.match(
    activate,
    /beco-v\\?d\+\\?\$?/,
    "activate's delete filter must match only ^beco-v<digits>$ shell caches",
  );
  assert.ok(
    !activate.includes("keys.filter((k) => k !== CACHE_VERSION)"),
    "the unfiltered != CACHE_VERSION wipe (the 17s-refetch bug) must not return",
  );
});

test("SW keeps cache I/O off the request critical path (stall-proof shape)", () => {
  const sw = readFileSync("sw.js", "utf8");
  const fetchHandler = sw.slice(sw.indexOf('addEventListener("fetch"'));
  assert.ok(fetchHandler.length, "fetch handler found");
  // Cache lookups race a bounded budget: a lookup queued behind the ~2 MB
  // weather write must degrade to a network fetch, never hang the request
  // (observed: a module load hanging 8s+ behind a weather cache write).
  assert.match(fetchHandler, /cacheOp\(caches\.match\(req\)\)/);
  assert.match(sw, /CACHE_OP_BUDGET_MS/);
  // The response clone destined for the cache is drained into memory before
  // the put: an un-drained `c.put(req, copy)` tee can backpressure the page's
  // own byte stream on a stalled cache write (the "reload 17s stall" class).
  assert.doesNotMatch(fetchHandler, /c\.put\(req, copy\)/);
  assert.match(
    fetchHandler,
    /copy\s*\.arrayBuffer\(\)[\s\S]{0,240}?c\.put\(req, body\)/,
  );
});
