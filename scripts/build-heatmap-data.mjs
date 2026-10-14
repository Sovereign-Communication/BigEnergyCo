#!/usr/bin/env node
// Compress heatmap-grid.json for faster page loads.
//
// WHY: The heatmap page fetched a 7MB JSON file on every load — 39,707 points
// with verbose keys ("latitude" style) and 4-element arrays where 99.7% of
// points had 4 identical values. On slow connections this was the single
// biggest load-time bottleneck (user report 2026-10-13).
//
// WHAT IT DOES:
//   - Shortens keys: lat->a, lon->o, n->n, c->c, t->t, tr->r, y->y,
//     p->p, pr->q, b->b, br->s, l->l, unserved->u
//   - Collapses 4-element arrays to a single value when all 4 are identical
//     (99.7% of points); keeps the array when they differ
//   - Rounds floats to 3 decimals (lat/lon) and 2 decimals (costs)
//   - Output: assets/data/heatmap-grid.min.json
//
// The heatmap.js reader handles both scalar and array forms.

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "assets", "data", "heatmap-grid.json");
const DST = join(__dirname, "..", "assets", "data", "heatmap-grid.min.json");

const round = (v, d) => {
  const m = Math.pow(10, d);
  return Math.round(v * m) / m;
};

// Collapse [x,x,x,x] -> x, keep [a,b,c,d] as-is
const collapse = (arr) => {
  if (!Array.isArray(arr)) return arr;
  const first = arr[0];
  if (arr.every((v) => v === first)) return first;
  return arr.map((v) => (typeof v === "number" ? round(v, 2) : v));
};

function compressPoint(p) {
  return {
    a: round(p.lat, 3),
    o: round(p.lon, 3),
    n: p.n,
    c: p.c,
    t: round(p.t, 3),
    r: round(p.tr, 3),
    y: Math.round(p.y),
    p: collapse(p.p),
    q: collapse(p.pr),
    b: collapse(p.b),
    s: collapse(p.br),
    l: round(p.l, 4),
    u: Math.round(p.unserved),
  };
}

const src = JSON.parse(readFileSync(SRC, "utf8"));
const compressed = {
  v: 1,
  generated: src.generated,
  tiers: src.usageTiersKwhDay,
  count: src.count,
  points: src.points.map(compressPoint),
};

const out = JSON.stringify(compressed);
writeFileSync(DST, out);

const srcSize = readFileSync(SRC).length;
const dstSize = Buffer.byteLength(out);
console.log(
  `heatmap-grid.json: ${(srcSize / 1024 / 1024).toFixed(2)}MB -> ` +
    `${(dstSize / 1024 / 1024).toFixed(2)}MB ` +
    `(${((1 - dstSize / srcSize) * 100).toFixed(1)}% smaller)`
);
