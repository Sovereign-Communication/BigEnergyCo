// P1.5 / F-33 / R-PERF-04: the heatmap grid loads per viewport, not in one piece.
//
// The old page fetched all 39,707 points (4.9 MB) the first time a visitor
// clicked the map or zoomed in, whether they were looking at one city or the
// whole world. The fix cuts the grid into 20-degree squares and loads only the
// squares the viewport needs. The risk that introduces is not slowness, it is
// correctness: a point that lands in no chunk disappears from the map and from
// the nearest-point search, and a point in two chunks is drawn twice. So the
// tests below check partition - every point exactly once, in a chunk whose
// bounds actually contain it - against the real shipped grid, plus the viewport
// selection and the wiring that makes the browser use it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "assets", "data");
const CHUNK_DIR = join(DATA, "heatmap-grid");

// Load the UMD chunk module the way the browser and the generator do.
const _m = { exports: {} };
{
  const src = readFileSync(
    join(ROOT, "assets", "js", "heatmap-chunks.js"),
    "utf8",
  );
  const module = _m;
  // eslint-disable-next-line no-new-func
  new Function("module", "exports", src)(module, module.exports);
}
const C = _m.exports;

const source = JSON.parse(
  readFileSync(join(DATA, "heatmap-grid.min.json"), "utf8"),
);
const manifest = JSON.parse(
  readFileSync(join(CHUNK_DIR, "index.min.json"), "utf8"),
);
const chunkFiles = readdirSync(CHUNK_DIR).filter(
  (f) => f.startsWith("chunk-") && f.endsWith(".json"),
);

test("longitude wraps, so the two ends of the map are one place", () => {
  assert.equal(C.chunkKey(0, 190), C.chunkKey(0, -170));
  assert.equal(C.chunkKey(0, -190), C.chunkKey(0, 170));
  assert.equal(C.chunkKey(0, 180), C.chunkKey(0, -180));
  assert.equal(C.chunkKey(0, 540), C.chunkKey(0, 180));
  // Poles clamp instead of producing an index off the grid.
  assert.equal(C.chunkKey(90, 0), C.chunkKey(89.99, 0));
  assert.equal(C.chunkKey(-90, 0), C.chunkKey(-89.99, 0));
  assert.equal(C.chunkKey(NaN, 0), C.chunkKey(-90, 0));
});

test("chunkBounds is the exact square the key names", () => {
  const b = C.chunkBounds(C.chunkKey(51.5, -0.1));
  assert.ok(b.lat0 <= 51.5 && 51.5 <= b.lat1, "latitude is outside its chunk");
  assert.ok(b.lon0 <= -0.1 && -0.1 <= b.lon1, "longitude is outside its chunk");
  assert.equal(b.lat1 - b.lat0, C.CHUNK_DEG);
  assert.equal(b.lon1 - b.lon0, C.CHUNK_DEG);
  // The extremes are the world, no more and no less.
  assert.equal(C.chunkBounds("0_0").lat0, -90);
  assert.equal(C.chunkBounds("0_0").lon0, -180);
  assert.equal(C.chunkBounds(`${C.LAT_COUNT - 1}_${C.LON_COUNT - 1}`).lat1, 90);
  assert.equal(
    C.chunkBounds(`${C.LAT_COUNT - 1}_${C.LON_COUNT - 1}`).lon1,
    180,
  );
});

test("the manifest describes exactly the chunks on disk", () => {
  assert.equal(manifest.chunkDeg, C.CHUNK_DEG);
  assert.equal(manifest.count, source.points.length);
  assert.deepEqual(manifest.tiers, source.tiers);
  assert.equal(
    manifest.chunks.length,
    chunkFiles.length,
    "manifest chunk count differs from the files on disk",
  );
  const keys = new Set();
  for (const c of manifest.chunks) {
    assert.ok(!keys.has(c.k), `chunk ${c.k} listed twice`);
    keys.add(c.k);
    assert.equal(c.f, `chunk-${c.k}.min.json`);
    const b = C.chunkBounds(c.k);
    assert.deepEqual(
      { lat0: c.lat0, lat1: c.lat1, lon0: c.lon0, lon1: c.lon1 },
      b,
      `chunk ${c.k} bounds disagree with its key`,
    );
    assert.ok(c.n > 0, `chunk ${c.k} claims no points`);
  }
});

test("every point lands in exactly one chunk, inside that chunk's bounds", () => {
  const seen = new Map(); // point identity -> chunk key
  let total = 0;
  for (const c of manifest.chunks) {
    const body = JSON.parse(readFileSync(join(CHUNK_DIR, c.f), "utf8"));
    assert.equal(
      body.points.length,
      c.n,
      `chunk ${c.k} holds ${body.points.length} points but the manifest says ${c.n}`,
    );
    total += body.points.length;
    for (const pt of body.points) {
      assert.equal(
        C.chunkKey(pt.a, pt.o),
        c.k,
        `point ${pt.n} (${pt.a},${pt.o}) is filed under ${c.k} but belongs to ${C.chunkKey(pt.a, pt.o)}`,
      );
      const id = `${pt.n}|${pt.a}|${pt.o}|${pt.c}`;
      assert.ok(
        !seen.has(id),
        `point ${pt.n} appears in ${seen.get(id)} and ${c.k}`,
      );
      seen.set(id, c.k);
    }
  }
  assert.equal(
    total,
    source.points.length,
    "chunks do not cover the whole grid",
  );
  assert.equal(
    seen.size,
    source.points.length,
    "chunk files hold duplicate points",
  );
});

test("a viewport loads a fraction of the world, and the antimeridian is one view", () => {
  const europe = C.chunksForBounds(
    { south: 35, west: -10, north: 60, east: 30 },
    manifest.chunks,
  );
  assert.ok(europe.length > 0, "a European viewport selected no chunk");
  assert.ok(
    europe.length <= manifest.chunks.length / 3,
    `a 50x40-degree viewport selected ${europe.length} of ${manifest.chunks.length} chunks`,
  );
  // London's point must be inside one of the selected chunks.
  const londonKey = C.chunkKey(51.5, -0.1);
  assert.ok(
    europe.some((c) => c.k === londonKey),
    "the viewport missed its own square",
  );

  // A view straddling 180 degrees must load squares on both sides of it, which
  // Leaflet reports as west > east.
  const pacific = C.chunksForBounds(
    { south: -10, west: 170, north: 10, east: -170 },
    manifest.chunks,
  );
  // Squares are 20 degrees wide, so the ones touching the line are the band
  // ending at 180 and the band starting at -180 - not a band starting at 170.
  const westSide = pacific.filter((c) => c.lon1 === 180);
  const eastSide = pacific.filter((c) => c.lon0 === -180);
  assert.ok(westSide.length > 0, "no chunk east of 170 was selected");
  assert.ok(eastSide.length > 0, "no chunk west of -170 was selected");

  // Padding never peeks past the poles.
  const padded = C.padBounds(
    { south: -88, west: 0, north: 88, east: 10 },
    C.CHUNK_DEG,
  );
  assert.equal(padded.south, -90);
  assert.equal(padded.north, 90);
});

test("no single chunk is big enough to undo the point of chunking", () => {
  const sizes = manifest.chunks.map((c) => statSync(join(CHUNK_DIR, c.f)).size);
  const largest = Math.max(...sizes);
  const total = sizes.reduce((a, b) => a + b, 0);
  const sourceSize = statSync(join(DATA, "heatmap-grid.min.json")).size;
  assert.ok(
    largest < 512 * 1024,
    `the largest chunk is ${(largest / 1024).toFixed(0)} KB, close to the whole-grid payload`,
  );
  // Chunking must not duplicate the data it splits.
  assert.ok(
    total < sourceSize * 1.25,
    `chunks total ${(total / 1048576).toFixed(2)} MB against a ${(sourceSize / 1048576).toFixed(2)} MB source`,
  );
});

test("the generated chunks match the shipped grid byte for byte", () => {
  const r = spawnSync(
    process.execPath,
    ["scripts/build-heatmap-chunks.mjs", "--check"],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /heatmap chunks: OK/);
});

test("the map loads per viewport, with the single file only as a fallback", () => {
  const js = readFileSync(join(ROOT, "assets", "js", "heatmap.js"), "utf8");
  // The happy path is the manifest, and the monolith appears exactly once, in
  // the fallback loader - a second reference would mean the page still pulls
  // 4.9 MB on some ordinary path.
  const monolithRefs = js.match(/heatmap-grid\.min\.json/g) || [];
  assert.equal(
    monolithRefs.length,
    1,
    `the whole grid is referenced ${monolithRefs.length} times; it belongs only in the fallback loader`,
  );
  assert.match(
    js,
    /heatmap-grid\/index\.min\.json/,
    "the manifest is never fetched",
  );
  assert.match(
    js,
    /files?\.name|entry\.f/,
    "chunk files are addressed by the manifest name",
  );
  // The global is guarded, so a lost module degrades instead of throwing.
  assert.match(js, /typeof HeatmapChunks === "undefined"/);
  // Panning must fill in newly visible squares.
  assert.match(js, /map\.on\("moveend"[\s\S]{0,200}?ensureViewportChunks\(\)/);
  // Markers carry their own point: colour refresh must not depend on array order.
  assert.match(js, /m\._pt = pt;/);
  assert.match(js, /layer\._pt\) layer\.setStyle/);
  assert.doesNotMatch(
    js,
    /points\[i\+\+\]/,
    "colour refresh still walks a global index",
  );
});

test("the heatmap page ships the chunk module before the map that needs it", () => {
  const html = readFileSync(join(ROOT, "solar-heatmap", "index.html"), "utf8");
  // Match script tags rather than a bare substring: prose in a comment can
  // mention the file name long before the tag appears.
  const sources = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(
    (m) => m[1],
  );
  const chunksAt = sources.findIndex((s) => s.includes("heatmap-chunks.js"));
  const mapAt = sources.findIndex((s) => /\/heatmap\.js/.test(s));
  assert.ok(chunksAt >= 0, "the page never loads heatmap-chunks.js");
  assert.ok(mapAt >= 0, "the page never loads heatmap.js");
  assert.ok(
    chunksAt < mapAt,
    `heatmap.js loads (position ${mapAt}) before the chunk module it asks for viewport squares (position ${chunksAt})`,
  );
  // Self-hosted, not a CDN (R-OFF-02).
  assert.doesNotMatch(
    html.match(/<script[^>]*heatmap-chunks[^>]*>/)[0],
    /https?:\/\//,
    "the chunk module is not served from this origin",
  );
});

test("the data gate verifies the chunks, so they cannot drift unnoticed", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.match(
    pkg.scripts["data:check"],
    /build-heatmap-chunks\.mjs --check/,
    "data:check does not verify the chunk files",
  );
  assert.match(pkg.scripts["data:chunks"] || "", /build-heatmap-chunks\.mjs/);
});
