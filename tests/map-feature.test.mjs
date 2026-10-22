import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CARTO_TILE_URL,
  ESRI_ATTRIBUTION,
  ESRI_SATELLITE_TILE_URL,
  LEAFLET_SCRIPT_URL,
  createMapProviderRegistry,
  createLeafletProvider,
  manualRoofHint,
  optionalMapPolicy,
  panelCapFromArea,
  pvCapKwFromArea,
  rectangleAreaM2,
  rotatedRectangleAreaM2,
  rotatedRectangleCorners,
} from "../assets/js/sizing/map-provider.js";

test("roof area converts to a conservative panel and PV cap", () => {
  assert.equal(panelCapFromArea(30), 5);
  assert.equal(pvCapKwFromArea(30, 400), 2);
  assert.ok(rectangleAreaM2([0, 0], [0.001, 0.001]) > 0);
  assert.equal(rectangleAreaM2([0, 0], [0, 0]), 0);
  assert.match(manualRoofHint(30), /5 panels/);
});

test("three-tap rotated rectangle aligns with rotated roofs", () => {
  // Axis-aligned taps reproduce the old two-corner box area.
  const axis = rotatedRectangleCorners([0, 0], [0.001, 0], [0.001, 0.001]);
  assert.ok(axis, "axis-aligned taps form a rectangle");
  assert.equal(axis.length, 4);
  const axisArea = rotatedRectangleAreaM2([0, 0], [0.001, 0], [0.001, 0.001]);
  const boxArea = rectangleAreaM2([0, 0], [0.001, 0.001]);
  assert.ok(
    Math.abs(axisArea - boxArea) / boxArea < 0.01,
    `rotated area ${axisArea} ≈ axis box ${boxArea}`,
  );

  // 45°-rotated roof: three taps along the rotated edges give the true area,
  // which is smaller than the axis-aligned box that would over-measure.
  const s = 0.001 / Math.SQRT2; // ~111 m edge at 45°
  const a = [0, 0];
  const b = [s, s]; // adjacent corner along the rotated edge
  const p = [0, 2 * s]; // point on the opposite edge
  const corners = rotatedRectangleCorners(a, b, p);
  assert.ok(corners, "rotated taps form a rectangle");
  // All four interior angles are right angles: adjacent edges perpendicular.
  const dist = (q, r) => Math.hypot(r[0] - q[0], r[1] - q[1]);
  const ab = dist(corners[0], corners[1]);
  const bc = dist(corners[1], corners[2]);
  const cd = dist(corners[2], corners[3]);
  const da = dist(corners[3], corners[0]);
  assert.ok(Math.abs(ab - cd) / ab < 1e-9, "opposite edges equal");
  assert.ok(Math.abs(bc - da) / bc < 1e-9, "opposite edges equal");
  const area = rotatedRectangleAreaM2(a, b, p);
  assert.ok(area > 0, "positive area");
  // Tapping the other side of the edge gives the same area (signed width).
  const areaFlip = rotatedRectangleAreaM2(a, b, [2 * s, 0]);
  assert.ok(
    Math.abs(area - areaFlip) / area < 1e-9,
    "either side of the edge works",
  );

  // Degenerate taps return null / 0 instead of garbage.
  assert.equal(rotatedRectangleCorners([1, 1], [1, 1], [2, 2]), null);
  assert.equal(rotatedRectangleCorners([0, 0], [1, 1], [2, 2]), null);
  assert.equal(rotatedRectangleAreaM2([1, 1], [1, 1], [2, 2]), 0);
  assert.equal(rotatedRectangleCorners(null, [0, 0], [1, 1]), null);
});

test("optional provider registry delegates and cleans up", async () => {
  let cleanupCount = 0;
  let clickHandler = null;
  const provider = {
    available: () => true,
    init: async () => "map-ready",
    onClick: (handler) => {
      clickHandler = handler;
      return () => {
        clickHandler = null;
      };
    },
    drawRectangle: (bounds) => ({ bounds }),
    drawPolygon: (corners) => ({ corners }),
    cleanup: () => {
      cleanupCount += 1;
    },
  };
  const registry = createMapProviderRegistry([provider]);
  assert.equal(await registry.init(), "map-ready");
  const unsubscribe = registry.onClick(() => {});
  assert.equal(typeof clickHandler, "function");
  assert.deepEqual(
    registry.drawRectangle([
      [0, 0],
      [1, 1],
    ]),
    {
      bounds: [
        [0, 0],
        [1, 1],
      ],
    },
  );
  assert.deepEqual(
    registry.drawPolygon([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]),
    {
      corners: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    },
  );
  unsubscribe();
  registry.cleanup();
  assert.equal(cleanupCount, 1);
  assert.equal(registry.drawRectangle(null), null);
  assert.equal(registry.drawPolygon(null), null);
  assert.equal(registry.drawPolygon([[0, 0]]), null);
});

test("map provider remains lazy and uses only approved hosts", () => {
  const leafletUrl = new URL(LEAFLET_SCRIPT_URL);
  assert.equal(leafletUrl.origin, new URL(import.meta.url).origin);
  assert.match(leafletUrl.pathname, /\/assets\/vendor\/leaflet\/leaflet\.js$/);
  assert.match(CARTO_TILE_URL, /basemaps\.cartocdn\.com/);
  const html = fs.readFileSync(
    new URL("../index.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /optional map/i);
});

test("satellite layer loads before the street fallback with Esri attribution", async () => {
  const added = [];
  const fakeMap = {
    on() {},
    off() {},
    remove() {},
    setView() {
      return fakeMap;
    },
  };
  const tileLayer = (url, opts) => {
    added.push({ url, opts });
    return { addTo: () => {} };
  };
  const provider = createLeafletProvider({
    windowRef: { L: { map: () => fakeMap, tileLayer } },
    documentRef: {
      querySelector: () => null,
      createElement: () => ({}),
      head: { appendChild() {} },
    },
  });
  const el = {};
  const map = await provider.init({
    element: el,
    latitude: 40.7,
    longitude: -74,
    zoom: 18,
  });
  assert.ok(map, "map object returned");
  assert.equal(added.length, 2, "two tile layers registered");
  assert.match(added[0].url, /arcgisonline\.com.*World_Imagery/);
  assert.match(added[0].opts.attribution, /Esri/);
  assert.match(added[1].url, /basemaps\.cartocdn\.com/);
});

test("keyless Esri satellite basemap is the primary layer (God's Eye View approach)", () => {
  // Same public, keyless service God's Eye View uses: ArcGIS World Imagery.
  assert.match(
    ESRI_SATELLITE_TILE_URL,
    /^https:\/\/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery/,
  );
  // Esri requires visible attribution — assert it is registered.
  assert.match(ESRI_ATTRIBUTION, /Esri/);
  assert.match(ESRI_ATTRIBUTION, /Maxar/);
  // Both tile hosts are exactly the hosts declared in the lazy-map policy
  // and the deployed CSP (URL-parsed host comparison, no substring checks).
  const policyHosts = optionalMapPolicy.allowedTileHosts;
  assert.deepEqual([...policyHosts].sort(), [
    "basemaps.cartocdn.com",
    "server.arcgisonline.com",
  ]);
  const headers = fs.readFileSync(
    new URL("../_headers", import.meta.url),
    "utf8",
  );
  const imgSrc = headers.match(/img-src ([^;\n]+);/)?.[1] ?? "";
  // Normalize each CSP token to a bare hostname (strip scheme and wildcard
  // label) so the comparison is exact rather than substring-based.
  const normalize = (token) =>
    token
      .replace(/^https:\/\//, "")
      .replace(/^\*\./, "")
      .replace(/\/$/, "");
  const cspImgHosts = new Set(
    imgSrc.split(/\s+/).filter(Boolean).map(normalize),
  );
  // Set.has is exact host equality (no substring semantics).
  assert.ok(
    cspImgHosts.has("server.arcgisonline.com"),
    `CSP img-src must allow the Esri tile host, got: ${imgSrc}`,
  );
  assert.ok(
    cspImgHosts.has("basemaps.cartocdn.com"),
    `CSP img-src must allow the CARTO fallback host, got: ${imgSrc}`,
  );
});
