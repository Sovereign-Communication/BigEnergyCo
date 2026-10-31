#!/usr/bin/env node
// Pre-render heatmap dots to static PNGs at build time.
//
// WHY: The heatmap page fetched a ~7MB JSON dataset on every load (issue #216).
// This script renders the dots once, at build time, to 18 static PNGs — one per
// metric × basis × usage combination. The page loads a single ~300KB PNG via
// Leaflet imageOverlay instead of the dataset (plan budget: heatmap initial
// payload ≤ 300 KB, MASTER_PLAN.md §3.1).
//
// The dark background is baked into the PNG, so the default view needs no tile
// layer — which also resolves the CARTO "API KEY REQUIRED" watermark (#218)
// for the default view.
//
// WHAT IT PRODUCES:
//   assets/img/heatmap/{name}.{hash}.png  — 18 dot images (content-hashed)
//   assets/img/heatmap/manifest.json      — combination → filename map
//   assets/data/heatmap-rankings.json     — pre-rendered top-10 lists (~10KB)
//
// Color functions come from assets/js/heatmap-palette.js (UMD) — the same
// module the live map uses, so PNG colors and canvas colors match by
// construction. tests/heatmap-palette.test.mjs verifies parity.
//
// PNG ENCODING: minimal writer using Node's built-in zlib (no new deps).
// 8-bit RGBA, one IDAT with filter-type-0 scanlines.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Load the UMD palette (repo is "type": "module", so require() would load it
// as ESM where `module` is undefined). Eval with a mock module instead.
const _paletteModule = { exports: {} };
{
  const src = readFileSync(
    join(ROOT, "assets", "js", "heatmap-palette.js"),
    "utf8",
  );
  const module = _paletteModule;
  eval(src);
}
const Palette = _paletteModule.exports;

// ── Render config ──────────────────────────────────────────────────────────
const W = 2048;
const H = 1024;
const BG = { r: 0x0d, g: 0x11, b: 0x17, a: 0xff }; // #0d1117, matches .leaflet-container
const DOT_R = 3; // px radius at 2048×1024

// Equirectangular: matches L.CRS.EPSG4326 imageOverlay bounds [[-90,-180],[90,180]]
function project(lat, lon) {
  const x = Math.round(((lon + 180) / 360) * (W - 1));
  const y = Math.round(((90 - lat) / 180) * (H - 1));
  return [x, y];
}

// ── Minimal PNG writer (8-bit RGBA) ────────────────────────────────────────
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++)
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(pixels, w, h) {
  // pixels: Buffer of w*h*4 RGBA bytes. Filter type 0 (none) per scanline.
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    pixels.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Dot rasterizer ─────────────────────────────────────────────────────────
function drawDot(pixels, cx, cy, r, rgb, alpha) {
  const a = Math.round(255 * alpha);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const i = (y * W + x) * 4;
      // Simple alpha-over-background (background is opaque dark).
      const srcA = a / 255;
      pixels[i] = Math.round(rgb.r * srcA + pixels[i] * (1 - srcA));
      pixels[i + 1] = Math.round(rgb.g * srcA + pixels[i + 1] * (1 - srcA));
      pixels[i + 2] = Math.round(rgb.b * srcA + pixels[i + 2] * (1 - srcA));
      pixels[i + 3] = 0xff;
    }
  }
}

function renderImage(points, metric, basis, usageIdx) {
  const pixels = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    pixels[i * 4] = BG.r;
    pixels[i * 4 + 1] = BG.g;
    pixels[i * 4 + 2] = BG.b;
    pixels[i * 4 + 3] = BG.a;
  }
  for (const pt of points) {
    const lat = Palette.pointLat(pt);
    const lon = Palette.pointLon(pt);
    if (lat === undefined || lon === undefined) continue;
    const [x, y] = project(lat, lon);
    const color = Palette.dotColor(pt, metric, basis, usageIdx);
    drawDot(pixels, x, y, DOT_R, Palette.hexToRgb(color), 0.75);
  }
  return encodePng(pixels, W, H);
}

// ── Combinations ───────────────────────────────────────────────────────────
// cost × {real,grid} = 2; p × {real,grid} × 4 usage = 8; b × {real,grid} × 4 = 8
function combinations() {
  const out = [];
  for (const basis of ["real", "grid"]) {
    out.push({ metric: "cost", basis, usageIdx: 1, name: `cost-${basis}` });
    for (let u = 0; u < 4; u++) {
      out.push({ metric: "p", basis, usageIdx: u, name: `p-${basis}-u${u}` });
      out.push({ metric: "b", basis, usageIdx: u, name: `b-${basis}-u${u}` });
    }
  }
  return out;
}

// ── Rankings (pre-rendered top-10, compact) ─────────────────────────────────
function buildRankings(points, tiers) {
  const rankings = {};
  for (const { metric, basis, usageIdx, name } of combinations()) {
    const usage = tiers[usageIdx];
    if (metric === "cost") {
      const byCountryHigh = new Map();
      const byCountryLow = new Map();
      for (const pt of points) {
        const cost = Palette.getPointCost(pt, basis);
        if (cost === null || cost === undefined || cost <= 0) continue;
        const c = pt.c;
        if (
          !byCountryHigh.has(c) ||
          cost > Palette.getPointCost(byCountryHigh.get(c), basis)
        )
          byCountryHigh.set(c, pt);
        if (
          !byCountryLow.has(c) ||
          cost < Palette.getPointCost(byCountryLow.get(c), basis)
        )
          byCountryLow.set(c, pt);
      }
      const top = (map, cmp) =>
        [...map.values()]
          .sort((a, b) =>
            cmp(Palette.getPointCost(a, basis), Palette.getPointCost(b, basis)),
          )
          .slice(0, 10)
          .map((pt) => slimCost(pt, basis));
      rankings[name] = {
        high: top(byCountryHigh, (a, b) => b - a),
        low: top(byCountryLow, (a, b) => a - b),
      };
    } else {
      const mKey = metric;
      const seriesOf = (pt) => {
        const yrs = Palette.getPointYears(pt, mKey, basis, usageIdx);
        return yrs;
      };
      const byCountryBest = new Map();
      const byCountryWorst = new Map();
      for (const pt of points) {
        const yrs = seriesOf(pt);
        if (yrs === null || yrs === undefined || yrs <= 0) continue;
        const c = pt.c;
        if (!byCountryBest.has(c) || yrs < seriesOf(byCountryBest.get(c)))
          byCountryBest.set(c, pt);
        if (!byCountryWorst.has(c) || yrs > seriesOf(byCountryWorst.get(c)))
          byCountryWorst.set(c, pt);
      }
      const top = (map, cmp) =>
        [...map.values()]
          .sort((a, b) => cmp(seriesOf(a), seriesOf(b)))
          .slice(0, 10)
          .map((pt) => slimYears(pt, mKey, basis, usageIdx));
      rankings[name] = {
        best: top(byCountryBest, (a, b) => a - b),
        worst: top(byCountryWorst, (a, b) => b - a),
        usage,
      };
    }
  }
  return rankings;
}

function slimCost(pt, basis) {
  const lat = Palette.pointLat(pt);
  const lon = Palette.pointLon(pt);
  return {
    n: pt.n,
    c: pt.c,
    v: Math.round(Palette.getPointCost(pt, basis) * 100) / 100,
    t: pt.t,
    y: pt.y,
    u: pt.u || 0,
    la: Math.round(lat * 100) / 100,
    lo: Math.round(lon * 100) / 100,
  };
}

function slimYears(pt, metric, basis, usageIdx) {
  const lat = Palette.pointLat(pt);
  const lon = Palette.pointLon(pt);
  const yrs = Palette.getPointYears(pt, metric, basis, usageIdx);
  return {
    n: pt.n,
    c: pt.c,
    v: yrs === null ? null : Math.round(yrs * 10) / 10,
    t: pt.t,
    y: pt.y,
    la: Math.round(lat * 100) / 100,
    lo: Math.round(lon * 100) / 100,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────
const dataPath = join(ROOT, "assets", "data", "heatmap-grid.json");
const outDir = join(ROOT, "assets", "img", "heatmap");
mkdirSync(outDir, { recursive: true });

const data = JSON.parse(readFileSync(dataPath, "utf8"));
const points = data.points;
const tiers = data.usageTiersKwhDay;
console.log(`Loaded ${points.length} points`);

const manifest = {};
let totalBytes = 0;
for (const { metric, basis, usageIdx, name } of combinations()) {
  const png = renderImage(points, metric, basis, usageIdx);
  const hash = createHash("sha256").update(png).digest("hex").slice(0, 12);
  const filename = `${name}.${hash}.png`;
  writeFileSync(join(outDir, filename), png);
  manifest[name] = filename;
  totalBytes += png.length;
  console.log(`  ${filename} — ${(png.length / 1024).toFixed(0)} KB`);
}
writeFileSync(
  join(outDir, "manifest.json"),
  JSON.stringify(manifest, null, 1) + "\n",
);

const rankings = buildRankings(points, tiers);
const rankingsJson = JSON.stringify(rankings);
writeFileSync(
  join(ROOT, "assets", "data", "heatmap-rankings.json"),
  rankingsJson,
);
console.log(
  `Rankings: ${(Buffer.byteLength(rankingsJson) / 1024).toFixed(1)} KB`,
);
console.log(
  `Done: 18 images, ${(totalBytes / 1024 / 1024).toFixed(2)} MB total, ` +
    `default (cost-real) ${(Buffer.byteLength(readFileSync(join(outDir, manifest["cost-real"]))) / 1024).toFixed(0)} KB`,
);
