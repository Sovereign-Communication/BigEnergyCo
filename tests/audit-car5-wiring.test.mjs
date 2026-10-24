// Car 5 (#200): the wiring lane, read at its seams.
//
// Fifteen production items sat at p_broken 0.30-0.70 — below the 0.95 gate, so
// each one is a suspect and the code decides. Fourteen are already guarded and
// are recorded with the guard that settles them; this file covers the one that
// was not.
//
// `createMapProviderRegistry` installed the chosen provider BEFORE awaiting its
// `init()`. A provider whose init rejects — the leaflet CDN being blocked is
// the concrete case, and it is why the map is optional — therefore stayed
// reachable: `drawRectangle` called into a map that was never created and
// returned its result as if the map existed. The one shipped caller happens to
// call `cleanup()` in its catch, so nothing is visibly broken today; the test
// below is about the module's own contract, which no caller should have to
// compensate for.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { createMapProviderRegistry } from "../assets/js/sizing/map-provider.js";
import { handleWorkerRequest } from "../scripts/lib/worker-bridge.mjs";

/** A provider that records every call, and either initialises or refuses. */
function provider({ initFails = false } = {}) {
  const calls = [];
  return {
    calls,
    available: () => true,
    init: async () => {
      calls.push("init");
      if (initFails) throw new Error("leaflet CDN blocked");
      return { map: true };
    },
    onClick: (handler) => {
      calls.push("onClick");
      return () => calls.push("unsubscribe");
    },
    drawRectangle: () => {
      calls.push("drawRectangle");
      return { drawn: true };
    },
    drawPolygon: () => {
      calls.push("drawPolygon");
      return { drawn: true };
    },
    cleanup: () => {
      calls.push("cleanup");
    },
  };
}

test("car5: a failed init installs no provider, and says so by refusing to work", async () => {
  const leaflet = provider({ initFails: true });
  const registry = createMapProviderRegistry([leaflet]);

  // init must still surface the failure — that is what lets ui.js show
  // "use the manual area box instead".
  await assert.rejects(() => registry.init({ element: {} }), /CDN blocked/);

  // The unfixed registry returned the provider's result here, for a map that
  // was never created.
  assert.equal(
    registry.drawRectangle([
      [0, 0],
      [1, 1],
    ]),
    null,
  );
  assert.equal(
    registry.drawPolygon([
      [0, 0],
      [1, 0],
      [1, 1],
    ]),
    null,
  );
  // An uninstall is a no-op that still hands back a callable unsubscribe.
  const off = registry.onClick(() => {});
  assert.equal(typeof off, "function");
  off();

  assert.deepEqual(
    leaflet.calls,
    ["init"],
    "after a rejected init the only call the provider may have seen is its own init",
  );
});

test("car5: a successful init still installs, and cleanup disarms", async () => {
  const leaflet = provider();
  const registry = createMapProviderRegistry([leaflet]);

  assert.deepEqual(await registry.init({ element: {} }), { map: true });
  assert.deepEqual(
    registry.drawRectangle([
      [0, 0],
      [1, 1],
    ]),
    { drawn: true },
  );
  registry.onClick(() => {});
  assert.deepEqual(leaflet.calls, ["init", "drawRectangle", "onClick"]);

  registry.cleanup();
  assert.deepEqual(leaflet.calls, [
    "init",
    "drawRectangle",
    "onClick",
    "cleanup",
  ]);
  // After cleanup the surface is disarmed: no drawing reaches the old provider.
  assert.equal(
    registry.drawRectangle([
      [0, 0],
      [1, 1],
    ]),
    null,
  );
  assert.equal(leaflet.calls.filter((c) => c === "drawRectangle").length, 1);
});

test("car5: an unavailable first provider is skipped, not installed", async () => {
  const unavailable = { ...provider(), available: () => false };
  const usable = provider();
  const registry = createMapProviderRegistry([unavailable, usable]);

  assert.deepEqual(await registry.init({}), { map: true });
  assert.deepEqual(
    unavailable.calls,
    [],
    "an unavailable provider is never inited",
  );
  assert.deepEqual(usable.calls, ["init"]);
  // A registry with nothing available reports that plainly instead of throwing.
  assert.equal(createMapProviderRegistry([]).available(), false);
  assert.equal(await createMapProviderRegistry([]).init({}), null);
});

// ── The 20 return-promise / delegate-up prescriptions ────────────────────
//
// The original car-5 queue (driving comment 2026-10-23): 20 functions
// prescribed `return-promise` or `delegate-up` where the granularity pass
// supported the choice — 51 more were excluded as `no-change` and were not
// touched. Confidence runs 0.17–0.83, all below the 0.95 gate, so each is a
// suspect and the code decides: applied with a test, or dispositioned with a
// reason. `triggerInstall` (ui.js:8110) is skipped per the issue — it dies in
// car 0. Verdicts:
//
// APPLIED (1):
//   worker-bridge.mjs::waitUntil — the ctx stub was `() => {}`: it dropped the
//   promise it was given and returned nothing, so a future route's background
//   task could reject into an unhandled rejection a harness can neither await
//   nor attribute. It now returns an awaitable and swallows the rejection the
//   way the runtime does (a failed waitUntil task is logged; it never fails
//   the request that scheduled it). Nothing calls it today, so shipped
//   behaviour is unchanged. Pinned by the test below.
//
// DISPOSITIONED (18):
//   returns its promise already (8): hangingFetch (nasa-timeout), doFetch
//   (cold-start-preflight), json (worker.test), globalThis.fetch (offline),
//   fetchWeather (verify-cumulative-flow), fetch (advisor-fallbacks), json
//   (polish-pass1), judge (jev-scope — an arrow expression that returns
//   scopedVerdict's result).
//   contract is synchronous by construction (2): mkdir/write doubles
//   (formatting) — exportTrackedTree's defaults are mkdirSync/writeFileSync
//   and it never reads a return value, so a promise from the double would be
//   ignored by design.
//   platform returns undefined, double matches (6): the addEventListener
//   no-ops (jev-sanitize, advisor-i18n, advisor-fallbacks ×2) and the
//   setStatus doubles in location-picker (the helper already returns its
//   inner push; the no-ops match void).
//   return value is never read (1): appendChild (map-feature) — map-provider
//   waits on script.onload, never on appendChild's result, and appendChild is
//   a synchronous DOM API, so there is no promise to return.
//   no result is swallowed (1): setupEventListeners (chat.js) — every binding
//   delegates directly to its handler (sendChatMsg is a plain function, not
//   async) and the DOM event system discards handler return values on every
//   path, so there is nothing to pass up.

test("car5: the bridge's waitUntil returns an awaitable and fails the way the runtime fails it", async () => {
  let seenCtx = null;
  const worker = {
    fetch: async (_req, _env, ctx) => {
      seenCtx = ctx;
      return new Response("ok");
    },
  };
  const req = new EventEmitter();
  Object.assign(req, { method: "GET", url: "/api/health", headers: {} });
  const res = { writeHead() {}, end() {} };

  await handleWorkerRequest(worker, req, res, {});
  assert.ok(seenCtx, "the worker is handed a context");

  // The old stub was `waitUntil: () => {}`: the promise was dropped and the
  // call returned nothing, so a harness could neither await the background
  // work nor see it fail.
  const background = seenCtx.waitUntil(
    Promise.reject(new Error("bg task died")),
  );
  assert.equal(
    typeof background?.then,
    "function",
    "waitUntil returns an awaitable promise",
  );
  await assert.doesNotReject(
    () => background,
    "a rejected background task must not reject its caller — the runtime logs it",
  );

  // A fulfilled task passes through: awaiting the returned promise yields the
  // work's own value, which is what lets a harness wait on it.
  assert.equal(await seenCtx.waitUntil(Promise.resolve("done")), "done");
  // passThroughOnException stays the platform's void.
  assert.equal(seenCtx.passThroughOnException(), undefined);
});
