// The dot layer's geometry: it has to agree with Leaflet to the pixel, and the
// hit test has to return the NEAREST dot.
//
// WHY THE PROJECTION IS PINNED TO LEAFLET'S OWN NUMBERS. The dots are drawn on
// a canvas of our own, positioned to sit on Leaflet's basemap tiles, so the
// transform has to be Leaflet's. Two plausible-looking implementations were
// wrong — a linear/equirectangular y, and a Mercator y normalised by 4*PI
// instead of 2*PI — and both put dots up to 68px from the tile they belong on.
// A wrong transform is invisible in review and obvious on screen, so the
// reference values below were captured from `map.project()` in real Chrome at
// zoom 2 and are pinned here.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mercatorScale,
  projectPoint,
  dotTransform,
  projectDots,
  buildHitIndex,
  hitTest,
  HIT_CELL_PX,
} from "../assets/js/sizing/heatmap-dots.js";

test("projectPoint reproduces Leaflet's own projection at zoom 2", () => {
  const scale = mercatorScale(2);
  assert.equal(scale, 1024, "Leaflet's Crs.scale(2)");
  // Captured from L.map(...).project([lat, 0], 2) in Chrome, Leaflet 1.9.4.
  const leaflet = [
    [0, 512.0],
    [10, 483.41],
    [20, 453.919],
    [30, 422.477],
    [40, 387.665],
    [50, 347.284],
    [60, 297.369],
  ];
  for (const [lat, y] of leaflet) {
    const got = projectPoint(lat, 0, scale).y;
    assert.ok(
      Math.abs(got - y) < 0.01,
      `lat ${lat}: ours ${got.toFixed(3)} vs Leaflet ${y}`,
    );
  }
  // Longitude is linear about the antimeridian's midpoint.
  assert.ok(Math.abs(projectPoint(0, 0, scale).x - 512) < 1e-9);
  assert.ok(Math.abs(projectPoint(0, -180, scale).x - 0) < 1e-9);
  assert.ok(Math.abs(projectPoint(0, 180, scale).x - 1024) < 1e-9);
  // Leaflet clamps latitude at the Mercator limit rather than letting it run
  // to infinity at the poles.
  const polar = projectPoint(89.9, 0, scale).y;
  assert.ok(Number.isFinite(polar), "the pole must not blow up");
  assert.equal(polar, projectPoint(85.0511287798, 0, scale).y);
});

test("the transform puts the map centre at the middle of the viewport", () => {
  const t = dotTransform({
    centerLat: 20,
    centerLng: 0,
    zoom: 2,
    width: 358,
    height: 464,
  });
  const centre = projectPoint(20, 0, t.scale);
  const xs = new Float32Array(1);
  const ys = new Float32Array(1);
  // The centre, in the grid's hundredths.
  projectDots([2000], [0], 1, t, xs, ys);
  assert.ok(Math.abs(xs[0] - 358 / 2) < 0.01, `x ${xs[0]}`);
  assert.ok(Math.abs(ys[0] - 464 / 2) < 0.01, `y ${ys[0]}`);
  assert.ok(
    Math.abs(centre.x - t.originX - 179) < 0.01,
    "origin is centre - size/2",
  );
});

test("projectDots dequantizes BOTH coordinates", () => {
  // Dividing only latitude put every dot 100x east of its tile; the page still
  // rendered "successfully", with zero dots drawn. A point's own position must
  // not move when the rest of the grid does.
  const t = dotTransform({
    centerLat: 20,
    centerLng: 0,
    zoom: 2,
    width: 358,
    height: 464,
  });
  const alone = new Float32Array(1);
  const aY = new Float32Array(1);
  projectDots([1313], [4538], 1, t, alone, aY);
  const withOthersX = new Float32Array(3);
  const withOthersY = new Float32Array(3);
  projectDots(
    [1313, -3387, 2178],
    [4538, 15121, 3127],
    3,
    t,
    withOthersX,
    withOthersY,
  );
  assert.equal(
    withOthersX[0],
    alone[0],
    "longitude must not depend on neighbours",
  );
  assert.equal(withOthersY[0], aY[0], "latitude must not depend on neighbours");
  // And the result must be on the map, not a hundred times off it.
  assert.ok(
    alone[0] > 0 && alone[0] < 358,
    `x ${alone[0]} inside the viewport`,
  );
  assert.ok(aY[0] > 0 && aY[0] < 464, `y ${aY[0]} inside the viewport`);
});

test("hitTest returns the NEAREST dot within the radius", () => {
  const xs = new Float32Array([100, 108, 300]);
  const ys = new Float32Array([100, 100, 300]);
  const idx = buildHitIndex(xs, ys, 3, HIT_CELL_PX);
  // 105 is 3px from the dot at 108 and 5px from the one at 100; 104 is the
  // exact midpoint, where "nearest" is a coin toss and a test would be a lie.
  assert.equal(hitTest(idx, xs, ys, 105, 100, 10), 1, "the closer of two");
  assert.equal(
    hitTest(idx, xs, ys, 95, 100, 10),
    0,
    "the other side of the pair",
  );
  assert.equal(hitTest(idx, xs, ys, 99, 100, 10), 0, "not just the first");
  assert.equal(hitTest(idx, xs, ys, 100, 100, 1), 0, "exact hit");
  assert.equal(hitTest(idx, xs, ys, 200, 100, 10), -1, "nothing in range");
  assert.equal(
    hitTest(idx, xs, ys, 300, 300, 1),
    2,
    "a far dot still resolves",
  );
});

test("hitTest searches the cells around the click, not the whole grid", () => {
  // Two dots 1px apart are visually one dot; the caller's job is not to pick
  // an ambiguous target, and the index's job is to return the nearer of them.
  const xs = new Float32Array([200, 201]);
  const ys = new Float32Array([200, 200]);
  const idx = buildHitIndex(xs, ys, 2, 1);
  assert.equal(hitTest(idx, xs, ys, 200, 200, 8), 0);
  assert.equal(hitTest(idx, xs, ys, 201, 200, 8), 1);
});

test("a click outside every bucket finds nothing", () => {
  const xs = new Float32Array([10, 20]);
  const ys = new Float32Array([10, 20]);
  const idx = buildHitIndex(xs, ys, 2, 8);
  assert.equal(hitTest(idx, xs, ys, 5000, 5000, 4), -1);
});
