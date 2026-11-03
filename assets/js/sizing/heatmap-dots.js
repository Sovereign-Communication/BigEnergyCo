// Drawing 39,707 dots on a Leaflet canvas, as pure math.
//
// WHY THE MARKERS ARE NOT Leaflet LAYERS ANY MORE. The page built one
// `L.circleMarker` per grid point and handed them all to an `L.canvas()`
// renderer, which did fix the accessibility defect that test names: with the
// canvas renderer the page holds 237 DOM nodes instead of 39,946. But a Leaflet
// layer is a JavaScript object with its own projection, options, event registry
// and redraw bookkeeping, and 39,707 of them cost more than the pixels they
// draw — measured on the staged build, `L.layerGroup(markers).addTo(map)` took
// 140ms (mobile) and 143ms (desktop) on its own, the construction loop 46/42ms,
// and attaching 39,707 individual click handlers another 26/29ms. A CPU profile
// put only 20ms of actual fill work in `_fillStroke`: the pixels were never the
// cost, the object graph was.
//
// So the dots are drawn straight onto one canvas in seven passes — one path per
// color bucket, built with a single `arc()` per point and one `fill()` per
// bucket — and the page keeps exactly one click handler. What that preserves is
// the property the earlier fix was protecting, and strengthens it: still zero
// DOM nodes per data point, and the numbers still readable as text in
// #best-list / #worst-list.
//
// WHY THE PROJECTION IS HERE AND NOT IN THE PAGE. Aligning a dot with the
// basemap means reproducing Leaflet's exact EPSG:3857 transform, and "close
// enough" is a bug you can only see by eye. Keeping the transform here makes it
// testable: tests/heatmap-dots.test.mjs asserts these functions agree with
// Leaflet's own `latLngToContainerPoint` to the pixel on reference points
// captured from a real browser, so a change to either side is caught by a test
// instead of by a reader noticing the dots had drifted.

// The grid's coordinates arrive in hundredths of a degree. This module divides
// BOTH of them, and the first version divided only latitude — which put every
// dot 100x east of where it belonged, off the canvas, and culled the lot. The
// page still rendered "successfully": zero dots.
const DEG_SCALE = 100;

// Leaflet's SphericalMercator clamps here, so the poles do not run away to
// infinity and the tiles stop before the edge of the world.
const MAX_LAT = 85.0511287798;

/**
 * Leaflet's `Crs.scale(zoom)`: the pixel size of one projected unit at `zoom`.
 */
export const mercatorScale = (zoom) => 256 * Math.pow(2, zoom);

/**
 * Raw projection, matching Leaflet's default CRS.
 *
 * `L.CRS.EPSG3857` is spherical Mercator. Two wrong implementations got this
 * wrong before, and both looked plausible:
 *
 *   · EQUIRECTANGULAR — `y = (0.5 - lat/180) * scale` is linear in latitude
 *     and is what `L.Projection.LonLat` does. It is 5.69 px/deg at zoom 2;
 *     Leaflet measures 3.58 px/deg near the equator, so every dot was up to
 *     68px from the tile it belongs on.
 *   · MERCATOR WITH A 2*PI NORMALIZER — `y = (1 - L/PI) * scale/2` where
 *     `L = ln(tan(PI/4 + lat/2))` doubles the latitude term.
 *
 * The constant is 2*PI, not 4*PI — that factor is easy to get wrong by hand and
 * the error is invisible until you measure it against Leaflet:
 *
 *     layerX = (lon / 360 + 0.5) * scale
 *     layerY = (1 - ln(tan(PI/4 + lat*PI/360)) / PI) * scale / 2
 *
 * Verified against Leaflet's own `map.project()` in a real Chrome at zoom 2
 * (scale 1024): lat 0 -> 512.000, 10 -> 483.410, 20 -> 453.919, 30 -> 422.477,
 * 40 -> 387.665, 50 -> 347.284, 60 -> 297.369. tests/heatmap-dots.test.mjs pins
 * exactly those, because a 4*PI version looks reasonable and still lands the
 * dots tens of pixels from their tiles.
 */
export function projectPoint(lat, lon, scale) {
  const clamped = lat < -MAX_LAT ? -MAX_LAT : lat > MAX_LAT ? MAX_LAT : lat;
  return {
    x: (lon / 360 + 0.5) * scale,
    y:
      (1 -
        Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360)) / Math.PI) *
      (scale / 2),
  };
}

/**
 * The transform from container pixels to projected coordinates, for one view.
 *
 * Leaflet composes three steps — project, scale, then subtract the pixel origin
 * (the map centre, moved to the top-left of the viewport). Deriving the origin
 * here means the page adds `origin` to a projected point and gets the same
 * pixel Leaflet would have returned for `latLngToContainerPoint`.
 */
export function dotTransform({ centerLat, centerLng, zoom, width, height }) {
  const scale = mercatorScale(zoom);
  const center = projectPoint(centerLat, centerLng, scale);
  return {
    scale,
    originX: center.x - width / 2,
    originY: center.y - height / 2,
  };
}

/**
 * Project every dot into container pixels, in one pass and without allocating
 * a point per call — 39,707 of those allocations was part of what this module
 * replaces.
 *
 * Fills `xs`/`ys` and returns them. `latQ`/`lonQ` are the grid's hundredths, so
 * they are divided here rather than at load time: dividing 39,707 numbers once
 * per redraw is cheaper than keeping a second copy in memory for the life of
 * the page.
 */
export function projectDots(latQ, lonQ, count, t, xs, ys) {
  const { scale, originX, originY } = t;
  // Hoisted out of the loop: the longitude term is a single multiply per
  // point, and the latitude term needs one log() and one tan() regardless.
  const kx = scale / (360 * DEG_SCALE);
  const halfScale = 0.5 * scale;
  // The DEG_SCALE division for latitude lives INSIDE the tan() argument below,
  // so this factor must not divide by it a second time — doing so shrank the
  // latitude term 100x and flattened the whole map onto one row of pixels.
  const kLat = scale / (2 * Math.PI);
  for (let i = 0; i < count; i++) {
    xs[i] = lonQ[i] * kx + halfScale - originX;
    const lat = latQ[i];
    ys[i] =
      halfScale -
      Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / (360 * DEG_SCALE))) *
        kLat -
      originY;
  }
  return { xs, ys };
}

/**
 * A uniform index over the projected points, for hit-testing a click.
 *
 * The page no longer registers 39,707 handlers, so a click has to be resolved
 * to a point. Doing that by scanning all 39,707 on every click is fine for one
 * click and terrible for a drag, and the map's own click handler fires often
 * enough that the scan would show up as its own long task. Bucketing into a
 * coarse grid makes it a handful of candidates.
 *
 * Cells are in pixels, sized so a bucket holds a few dozen points at world zoom
 * without being so small that the index costs more memory than the scan.
 */
export const HIT_CELL_PX = 64;

/** Build the pixel-space bucket index. Pure; returns a plain object. */
export function buildHitIndex(xs, ys, count, cellPx = HIT_CELL_PX) {
  const cells = new Map();
  for (let i = 0; i < count; i++) {
    const key = `${Math.floor(xs[i] / cellPx)},${Math.floor(ys[i] / cellPx)}`;
    let bucket = cells.get(key);
    if (bucket === undefined) {
      bucket = [];
      cells.set(key, bucket);
    }
    bucket.push(i);
  }
  return { cells, cellPx };
}

/**
 * The dot nearest `(x, y)` within `radiusPx`, or -1.
 *
 * Searches the 3x3 cell neighbourhood, so it only ever looks at points that
 * could plausibly be within the radius, and returns the closest of them rather
 * than the first hit — otherwise a click near a cell edge would resolve to a
 * neighbouring point.
 */
export function hitTest(index, xs, ys, x, y, radiusPx) {
  const c = index.cellPx;
  const cx = Math.floor(x / c);
  const cy = Math.floor(y / c);
  const maxSq = radiusPx * radiusPx;
  let best = -1;
  let bestSq = Infinity;
  for (let gy = cy - 1; gy <= cy + 1; gy++) {
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      const bucket = index.cells.get(`${gx},${gy}`);
      if (bucket === undefined) continue;
      for (const i of bucket) {
        const dx = xs[i] - x;
        const dy = ys[i] - y;
        const sq = dx * dx + dy * dy;
        if (sq <= maxSq && sq < bestSq) {
          bestSq = sq;
          best = i;
        }
      }
    }
  }
  return best;
}
