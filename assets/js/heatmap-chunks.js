// Heatmap grid chunk geometry — UMD module.
//
// Used by BOTH:
//   - assets/js/heatmap.js (browser, via window.HeatmapChunks)
//   - scripts/build-heatmap-chunks.mjs (Node, via module.exports)
//
// Single source of truth for which chunk a point belongs to and which chunks a
// viewport needs. The generator cuts the grid with these functions and the map
// loads with them, so a chunk can never be written under one key and asked for
// under another. Verified by tests/heatmap-chunking.test.mjs.
//
// Why 20 degrees: measured on the shipped grid (39,707 points). At 20 degrees
// there are 83 populated chunks with a median of 208 points, and a zoom-5
// viewport needs one to four of them — a few hundred KB instead of the whole
// 4.9 MB grid. Finer bins (10 degrees) give 233 files for little extra saving
// at the zooms the canvas dots are actually visible; coarser bins (30 degrees)
// put 6,827 points in one chunk, which is a third of the old payload.
//
// Latitude and longitude are bucketed from the fixed world extents, never from
// the data, so a chunk key means the same square forever and a regenerated grid
// cannot silently reshuffle which file a point lands in.
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HeatmapChunks = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var CHUNK_DEG = 20;
  var LAT_COUNT = 180 / CHUNK_DEG; // 9 bands from -90 to 90
  var LON_COUNT = 360 / CHUNK_DEG; // 18 bands from -180 to 180

  function clampInt(value, min, max) {
    var n = Math.floor(value);
    if (!Number.isFinite(n) || n < min) return min;
    if (n > max) return max;
    return n;
  }

  function latIndex(lat) {
    return clampInt((Number(lat) + 90) / CHUNK_DEG, 0, LAT_COUNT - 1);
  }

  // Longitude wraps: 190 degrees is -170, and a point exactly on 180 belongs to
  // the same band as -180 so the two ends of the map cannot disagree.
  function wrapLon(lon) {
    var n = Number(lon);
    if (!Number.isFinite(n)) return 0;
    return ((((n + 180) % 360) + 360) % 360) - 180;
  }

  function lonIndex(lon) {
    return clampInt((wrapLon(lon) + 180) / CHUNK_DEG, 0, LON_COUNT - 1);
  }

  function chunkKey(lat, lon) {
    return latIndex(lat) + "_" + lonIndex(lon);
  }

  function chunkBounds(key) {
    var parts = String(key).split("_");
    var la = clampInt(parts[0], 0, LAT_COUNT - 1);
    var lo = clampInt(parts[1], 0, LON_COUNT - 1);
    return {
      lat0: -90 + la * CHUNK_DEG,
      lat1: -90 + (la + 1) * CHUNK_DEG,
      lon0: -180 + lo * CHUNK_DEG,
      lon1: -180 + (lo + 1) * CHUNK_DEG,
    };
  }

  function padBounds(bounds, deg) {
    var pad = Number(deg) || 0;
    return {
      south: Math.max(-90, bounds.south - pad),
      north: Math.min(90, bounds.north + pad),
      west: bounds.west - pad,
      east: bounds.east + pad,
    };
  }

  // Leaflet hands back west > east for a viewport straddling the antimeridian,
  // and a chunk that only partly overlaps the view still has to load. Both
  // cases are handled here rather than at the call site, because a loader that
  // forgets one of them shows an empty strip at the edge of the world.
  function lonSpans(west, east) {
    if (west <= east) return [[west, east]];
    return [
      [west, 180],
      [-180, east],
    ];
  }

  function chunksForBounds(bounds, chunks) {
    if (!bounds || !chunks) return [];
    var south = Number(bounds.south);
    var north = Number(bounds.north);
    if (!Number.isFinite(south) || !Number.isFinite(north)) return [];
    var spans = lonSpans(Number(bounds.west), Number(bounds.east));
    var out = [];
    for (var i = 0; i < chunks.length; i++) {
      var c = chunks[i];
      if (!c) continue;
      if (c.lat1 < south || c.lat0 > north) continue;
      for (var s = 0; s < spans.length; s++) {
        if (c.lon1 < spans[s][0] || c.lon0 > spans[s][1]) continue;
        out.push(c);
        break;
      }
    }
    return out;
  }

  return {
    CHUNK_DEG: CHUNK_DEG,
    LAT_COUNT: LAT_COUNT,
    LON_COUNT: LON_COUNT,
    chunkKey: chunkKey,
    chunkBounds: chunkBounds,
    wrapLon: wrapLon,
    chunksForBounds: chunksForBounds,
    padBounds: padBounds,
  };
});
