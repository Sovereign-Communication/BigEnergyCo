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

import { createMapProviderRegistry } from "../assets/js/sizing/map-provider.js";

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
