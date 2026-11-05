// Cut the shipped heatmap grid into viewport-sized chunks (R-PERF-04, P1.5).
//
// The grid is 39,707 points and 4.9 MB in one file, and the map fetched all of
// it for a click on one city. This script writes a manifest plus one file per
// 20-degree square using assets/js/heatmap-chunks.js - the same module the
// browser loads with - so the write side and the read side cannot disagree
// about which square a point belongs to.
//
// The source file stays exactly as it is. It is both the input to this script
// and the loader's fallback, so a chunk or manifest that fails to fetch leaves
// the map working rather than blank; nothing here invents data, it only
// re-buckets what the grid already contains.
//
//   node scripts/build-heatmap-chunks.mjs           # write
//   node scripts/build-heatmap-chunks.mjs --check   # verify only
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";

import { ROOT } from "./lib/deploy-manifest.mjs";

const SOURCE = join(ROOT, "assets", "data", "heatmap-grid.min.json");
const OUT_DIR = join(ROOT, "assets", "data", "heatmap-grid");
const MANIFEST = "index.min.json";
const CHECK = process.argv.includes("--check");

// Load the UMD chunk module the way build-heatmap-images.mjs loads the palette
// and tests/heatmap-palette.test.mjs loads it: the repo is "type": "module", so
// require() would not run this file as CommonJS.
function loadChunkMath() {
  const src = readFileSync(
    join(ROOT, "assets", "js", "heatmap-chunks.js"),
    "utf8",
  );
  const holder = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function("module", "exports", src)(holder, holder.exports);
  if (!holder.exports || !holder.exports.chunkKey)
    throw new Error("heatmap-chunks.js did not export chunkKey");
  return holder.exports;
}

const C = loadChunkMath();
const source = JSON.parse(readFileSync(SOURCE, "utf8"));
const points = source.points || [];
if (!points.length) throw new Error("source grid has no points");

const buckets = new Map();
for (const pt of points) {
  const key = C.chunkKey(pt.a, pt.o);
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { key, points: [] };
    buckets.set(key, bucket);
  }
  bucket.points.push(pt);
}

const keys = [...buckets.keys()].sort();
const chunks = keys.map((key) => {
  const b = buckets.get(key);
  const bounds = C.chunkBounds(key);
  return {
    k: key,
    f: "chunk-" + key + ".min.json",
    lat0: bounds.lat0,
    lat1: bounds.lat1,
    lon0: bounds.lon0,
    lon1: bounds.lon1,
    n: b.points.length,
    points: b.points,
  };
});

// The manifest carries the totals so a client can state the coverage without
// every chunk, and the tiers so a popup needs no extra fetch.
const manifest = {
  v: 1,
  source: "heatmap-grid.min.json",
  chunkDeg: C.CHUNK_DEG,
  generated: source.generated || null,
  tiers: source.tiers || null,
  count: points.length,
  chunks: chunks.map(({ points: _omit, ...meta }) => meta),
};

const files = new Map();
files.set(MANIFEST, JSON.stringify(manifest));
for (const c of chunks)
  files.set(c.f, JSON.stringify({ v: 1, points: c.points }));

const total = [...files.values()].reduce((n, s) => n + Buffer.byteLength(s), 0);
const largest = Math.max(
  ...[...files.entries()].map(([, s]) => Buffer.byteLength(s)),
);

if (CHECK) {
  let stale = [];
  const seen = new Set();
  for (const [name, body] of files) {
    seen.add(name);
    let onDisk;
    try {
      onDisk = readFileSync(join(OUT_DIR, name), "utf8");
    } catch {
      stale.push(`${name} is missing`);
      continue;
    }
    if (onDisk !== body)
      stale.push(`${name} differs from what the source grid cuts to`);
  }
  let extra = [];
  try {
    extra = readdirSync(OUT_DIR).filter((f) => !seen.has(f));
  } catch {
    extra = [];
  }
  for (const name of extra)
    stale.push(`${name} is not produced by the current source grid`);
  if (stale.length) {
    console.error("heatmap chunks are stale:");
    for (const line of stale.slice(0, 8)) console.error("  " + line);
    if (stale.length > 8) console.error(`  ... and ${stale.length - 8} more`);
    console.error("Run: node scripts/build-heatmap-chunks.mjs");
    process.exit(1);
  }
  console.log(
    `heatmap chunks: OK - ${files.size} file(s), ${points.length} points, ${chunks.length} chunk(s), ${(total / 1048576).toFixed(2)} MB total, largest ${(largest / 1024).toFixed(0)} KB`,
  );
  process.exit(0);
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });
for (const [name, body] of files) writeFileSync(join(OUT_DIR, name), body);
console.log(
  `heatmap chunks: wrote ${files.size} file(s) - ${chunks.length} chunk(s) covering ${points.length} points (${(total / 1048576).toFixed(2)} MB, largest ${(largest / 1024).toFixed(0)} KB)`,
);
