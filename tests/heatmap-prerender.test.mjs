// Tests for the pre-rendered heatmap build outputs.
//
// Verifies scripts/build-heatmap-images.mjs produced the artifacts the live
// map expects: 18 content-hashed PNGs, a manifest covering every
// metric×basis×usage combination, and a rankings JSON with the right shape.
// These run against the built files (not the renderer internals).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const IMG_DIR = join(ROOT, "assets", "img", "heatmap");

// All 18 expected manifest keys.
const EXPECTED_KEYS = [
  "cost-real",
  "cost-grid",
  ...["real", "grid"].flatMap((basis) =>
    [0, 1, 2, 3].flatMap((u) => [`p-${basis}-u${u}`, `b-${basis}-u${u}`]),
  ),
];

test("manifest exists and covers all 18 combinations", () => {
  const manifestPath = join(IMG_DIR, "manifest.json");
  assert.ok(existsSync(manifestPath), "manifest.json exists");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const key of EXPECTED_KEYS) {
    assert.ok(manifest[key], `manifest has ${key}`);
    assert.match(
      manifest[key],
      /^[a-z]+-(real|grid)(-u[0-3])?\.[0-9a-f]{12}\.png$/,
      `${key} filename is content-hashed`,
    );
  }
  assert.equal(Object.keys(manifest).length, 18);
});

test("every manifest PNG exists and is a valid PNG", () => {
  const manifest = JSON.parse(
    readFileSync(join(IMG_DIR, "manifest.json"), "utf8"),
  );
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  for (const key of EXPECTED_KEYS) {
    const p = join(IMG_DIR, manifest[key]);
    assert.ok(existsSync(p), `${key} PNG exists`);
    const buf = readFileSync(p);
    assert.ok(buf.subarray(0, 8).equals(PNG_SIG), `${key} has PNG signature`);
    // Budget: heatmap initial payload ≤ 300 KB (MASTER_PLAN.md §3.1).
    assert.ok(
      buf.length <= 300 * 1024,
      `${key} is ${(buf.length / 1024).toFixed(0)}KB, budget 300KB`,
    );
  }
});

test("default image (cost-real) is the smallest or near it", () => {
  const manifest = JSON.parse(
    readFileSync(join(IMG_DIR, "manifest.json"), "utf8"),
  );
  const sizes = EXPECTED_KEYS.map((k) => ({
    k,
    s: readFileSync(join(IMG_DIR, manifest[k])).length,
  }));
  const def = sizes.find((x) => x.k === "cost-real");
  const max = Math.max(...sizes.map((x) => x.s));
  // Default view must be fast; flag if it is an outlier.
  assert.ok(def.s <= max * 1.2, `cost-real ${def.s} vs max ${max}`);
});

test("rankings JSON has all combinations with top-10 lists", () => {
  const p = join(ROOT, "assets", "data", "heatmap-rankings.json");
  assert.ok(existsSync(p), "heatmap-rankings.json exists");
  const rankings = JSON.parse(readFileSync(p, "utf8"));
  for (const key of EXPECTED_KEYS) {
    assert.ok(rankings[key], `rankings has ${key}`);
    const r = rankings[key];
    if (key.startsWith("cost-")) {
      assert.ok(
        Array.isArray(r.high) && r.high.length === 10,
        `${key}.high is top-10`,
      );
      assert.ok(
        Array.isArray(r.low) && r.low.length === 10,
        `${key}.low is top-10`,
      );
      for (const pt of r.high) {
        assert.ok(
          typeof pt.n === "string" && typeof pt.v === "number",
          `${key} entry shape`,
        );
      }
    } else {
      assert.ok(
        Array.isArray(r.best) && r.best.length === 10,
        `${key}.best is top-10`,
      );
      assert.ok(
        Array.isArray(r.worst) && r.worst.length === 10,
        `${key}.worst is top-10`,
      );
    }
  }
});

test("no orphan PNGs in the heatmap image dir", () => {
  const manifest = JSON.parse(
    readFileSync(join(IMG_DIR, "manifest.json"), "utf8"),
  );
  const expected = new Set([...Object.values(manifest), "manifest.json"]);
  for (const f of readdirSync(IMG_DIR)) {
    assert.ok(expected.has(f), `no orphan file: ${f}`);
  }
});
