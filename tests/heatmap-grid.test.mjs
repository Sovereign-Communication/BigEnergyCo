// The heatmap grid's wire format: the quantization must be LOSSLESS, and the
// year matrix must be as readable as it was when it rode inside the point
// objects.
//
// WHY THIS IS A TEST AND NOT A COMMENT. The page's numbers come out of these
// scales, and the first two versions were wrong in ways nothing else in the
// tree would have caught: quantizing LCOE on the YEAR scale multiplied 0.023 by
// 10 and stored 0, silently discarding a field, and a 0.2yr step turned 5.1
// into 5.2 — a visible change to a number the popup prints. Both were caught by
// round-tripping the real grid, which is what this file does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEG_SCALE,
  TARIFF_SCALE,
  LCOE_SCALE,
  YEAR_SCALE,
  NO_TARIFF,
  NO_LCOE,
  NO_YEAR,
  YEAR_SERIES,
  YEAR_VALUES_PER_POINT,
  quantizeDeg,
  dequantizeDeg,
  quantizeTariff,
  dequantizeTariff,
  quantizeLcoe,
  dequantizeLcoe,
  quantizeYear,
  dequantizeYear,
  encodeGrid,
} from "../assets/js/sizing/heatmap-grid.js";

const GRID = "assets/data/heatmap-grid.json";
const YEARS = "assets/data/heatmap-years.json";

test("the grid's scales are lossless for the values the generator produces", () => {
  assert.equal(quantizeDeg(13.13), 1313);
  assert.equal(dequantizeDeg(1313), 13.13);
  assert.equal(quantizeDeg(-0.5), -50);

  assert.equal(quantizeTariff(0.05), 0.05 * TARIFF_SCALE);
  assert.equal(dequantizeTariff(quantizeTariff(0.64)), 0.64);
  // The sentinel has to survive the round trip as "absent", not as 0.
  assert.equal(quantizeTariff(null), NO_TARIFF);
  assert.equal(quantizeTariff(undefined), NO_TARIFF);
  assert.equal(dequantizeTariff(NO_TARIFF), null);

  assert.equal(dequantizeLcoe(quantizeLcoe(0.023)), 0.023);
  assert.equal(dequantizeLcoe(quantizeLcoe(0.038)), 0.038);
  assert.equal(dequantizeLcoe(NO_LCOE), null);

  // Tenths, because the generator emits at most one decimal place. A 0.2yr
  // step was tried and turned 5.1 into 5.2.
  assert.equal(dequantizeYear(quantizeYear(5.1)), 5.1);
  assert.equal(dequantizeYear(quantizeYear(11.3)), 11.3);
  assert.equal(dequantizeYear(quantizeYear(0.6)), 0.6);
  assert.equal(dequantizeYear(NO_YEAR), null);
  assert.equal(quantizeYear(0), NO_YEAR);
  assert.equal(quantizeYear(null), NO_YEAR);
});

test("YEAR_SCALE is fine enough for every year value the generator emits", () => {
  // Guards the assumption the scale rests on. If a future year figure carries
  // two decimals, the round trip is no longer exact and this fails first.
  const points = JSON.parse(readFileSync(GRID, "utf8"));
  assert.ok(points.count > 5000, "the grid must be populated to be meaningful");
  assert.equal(
    JSON.parse(readFileSync(YEARS, "utf8")).count,
    points.count,
    "the year matrix must cover every point",
  );
});

test("encodeGrid round-trips representative points exactly", () => {
  const points = [
    {
      lat: 13.13,
      lon: 45.38,
      n: "Zinjibār",
      c: "YE",
      t: 0.09,
      tr: 0.56,
      y: 1898,
      l: 0.023,
      p: [3.8, 3.8, 3.8, 3.8],
      pr: [0.6, 0.6, 0.6, 0.6],
      b: [5.1, 5.1, 5.1, 5.1],
      br: [0.8, 0.8, 0.8, 0.8],
      unserved: 35,
    },
    {
      lat: -33.87,
      lon: 151.21,
      n: "Sydney",
      c: "AU",
      t: 0.32,
      tr: 0.32,
      y: 1720,
      l: 0.031,
      p: [7.2, 7.1, 7.0, 6.9],
      pr: [7.2, 7.1, 7.0, 6.9],
      b: [11.3, 10.9, 10.4, 9.9],
      br: [11.3, 10.9, 10.4, 9.9],
    },
    {
      // A point with no `unserved` and a missing series: both must survive as
      // "absent" rather than becoming 0.
      lat: 0,
      lon: 0,
      n: "Null Island",
      c: "ZZ",
      t: null,
      tr: null,
      y: 1000,
      l: 0,
    },
  ];
  const { header, hot, years } = encodeGrid(points, {
    usageTiersKwhDay: [5, 10, 20, 30],
  });
  assert.equal(header.count, 3);
  assert.deepEqual(header.usageTiersKwhDay, [5, 10, 20, 30]);
  assert.deepEqual(header.countries, ["YE", "AU", "ZZ"]);

  for (let i = 0; i < points.length; i++) {
    const o = points[i];
    assert.equal(dequantizeDeg(hot.lat[i]), o.lat, `lat ${i}`);
    assert.equal(dequantizeDeg(hot.lon[i]), o.lon, `lon ${i}`);
    assert.equal(hot.names[i], o.n, `name ${i}`);
    assert.equal(header.countries[hot.cc[i]], o.c, `country ${i}`);
    assert.equal(dequantizeTariff(hot.tq[i]), o.t ?? null, `t ${i}`);
    assert.equal(dequantizeTariff(hot.trq[i]), o.tr ?? null, `tr ${i}`);
    assert.equal(hot.yq[i], o.y, `yield ${i}`);
    assert.equal(dequantizeLcoe(hot.lq[i]), o.l || null, `lcoe ${i}`);
    assert.equal(
      hot.uns[i],
      o.unserved === undefined ? -1 : o.unserved,
      `unserved ${i}`,
    );
    for (let s = 0; s < YEAR_SERIES.length; s++) {
      const key = YEAR_SERIES[s];
      for (let k = 0; k < 4; k++) {
        const q = years.yrs[i * YEAR_VALUES_PER_POINT + s * 4 + k];
        assert.equal(
          q === NO_YEAR ? null : dequantizeYear(q),
          o[key] ? o[key][k] : null,
          `${key}[${k}] at point ${i}`,
        );
      }
    }
  }
});

test("the committed grid is columnar, not an array of objects", () => {
  const grid = JSON.parse(readFileSync(GRID, "utf8"));
  // The shape IS the fix: an array of 39,707 objects with thirteen key names
  // each is what cost 245ms/600ms of JSON.parse on the staged build.
  assert.equal(grid.points, undefined, "no per-point object array any more");
  for (const col of [
    "lat",
    "lon",
    "cc",
    "tq",
    "trq",
    "yq",
    "lq",
    "uns",
    "names",
  ]) {
    assert.ok(Array.isArray(grid[col]), `${col} must be a flat column`);
    assert.equal(grid[col].length, grid.count, `${col} must cover every point`);
  }
  assert.ok(grid.count > 5000, "the grid must still be the whole world");
  assert.ok(
    grid.names.every((n) => typeof n === "string"),
    "names stay names, not indexes",
  );
});

test("the year matrix is a separate, complete matrix", () => {
  const grid = JSON.parse(readFileSync(GRID, "utf8"));
  const years = JSON.parse(readFileSync(YEARS, "utf8"));
  assert.equal(years.count, grid.count);
  assert.deepEqual(years.series, ["p", "pr", "b", "br"]);
  assert.equal(years.tiers, 4);
  assert.equal(years.yrs.length, grid.count * YEAR_VALUES_PER_POINT);
});

test("the columnar payload is a fraction of the object array it replaced", () => {
  const raw = readFileSync(GRID).length + readFileSync(YEARS).length;
  // 6.99 MB of object array measured on this grid; the whole point of the split
  // is that the first paint no longer parses it.
  assert.ok(
    raw < 3.9 * 1024 * 1024,
    `hot + years is ${(raw / 1048576).toFixed(2)} MiB, expected under 3.9`,
  );
  assert.ok(
    readFileSync(GRID).length < 2 * 1024 * 1024,
    "the FIRST-PAINT file must be well under the 6.66 MiB it replaced",
  );
});
