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
//
// The first paint now reads PACKED BINARY — twelve fixed-width bytes per point,
// decoded as typed-array views over the response body — because the columnar
// JSON it replaced still cost 39ms (mobile) / 29ms (desktop) of `JSON.parse`,
// which under the gate's ~4x CPU throttling was most of the remaining TBT.
// Everything the first paint does not read moved to a deferred JSON file that
// is fetched after the map is already on screen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  NO_TARIFF,
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
  encodeGridBinary,
  decodeGrid,
  encodeYearsBinary,
  decodeYears,
  gridLayout,
  GRID_MAGIC,
  HOT_COLUMNS,
  HOT_BYTES_PER_POINT,
} from "../assets/js/sizing/heatmap-grid.js";

const BIN = "assets/data/heatmap-grid.bin";
const NAMES = "assets/data/heatmap-names.json";
const YEARS = "assets/data/heatmap-years.bin";

/**
 * `readFileSync` can hand back a view into Node's shared 8 KB buffer pool, so
 * the bytes in front of this one may belong to another file. Copying into a
 * buffer of its own makes `bytes.buffer` exactly the committed file, which is
 * the shape the page hands to `decodeGrid` from a `Response`.
 */
function readBinary(path) {
  const buf = readFileSync(path);
  const out = new Uint8Array(buf.byteLength);
  out.set(buf);
  return out;
}

const committedBytes = readBinary(BIN);
const committed = decodeGrid(committedBytes.buffer);
const yearsBytes = readBinary(YEARS);
const packedYears = decodeYears(yearsBytes.buffer);
const names = JSON.parse(readFileSync(NAMES, "utf8"));
const COLUMNS = Object.fromEntries(HOT_COLUMNS.map((c) => [c.key, c]));

test("the grid's scales are lossless for the values the generator produces", () => {
  assert.equal(quantizeDeg(13.13), 1313);
  assert.equal(dequantizeDeg(1313), 13.13);
  assert.equal(quantizeDeg(-0.5), -50);

  assert.equal(quantizeTariff(0.05), 0.05 * 1000);
  assert.equal(dequantizeTariff(quantizeTariff(0.64)), 0.64);
  // The sentinel has to survive the round trip as "absent", not as 0.
  assert.equal(quantizeTariff(null), NO_TARIFF);
  assert.equal(quantizeTariff(undefined), NO_TARIFF);
  assert.equal(dequantizeTariff(NO_TARIFF), null);

  assert.equal(dequantizeLcoe(quantizeLcoe(0.023)), 0.023);
  assert.equal(dequantizeLcoe(quantizeLcoe(0.038)), 0.038);

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
  assert.ok(
    committed.count > 5000,
    "the grid must be populated to be meaningful",
  );
  assert.equal(
    packedYears.count,
    committed.count,
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

// ── The packed binary the map actually reads ────────────────────────────

test("the binary round trip is the identity on every column", () => {
  // The point of the format: what the generator quantized comes back out of
  // the file value for value, so the page only has to take views. A column
  // that silently narrowed would move dots rather than fail.
  const { header, hot } = encodeGrid(
    [
      { lat: 13.13, lon: 45.38, n: "A", c: "YE", t: 0.09, tr: 0.56, y: 1898 },
      { lat: -33.87, lon: 151.21, n: "B", c: "AU", t: 0.32, tr: 0.32, y: 1720 },
      { lat: 0, lon: 0, n: "C", c: "ZZ", t: null, tr: null, y: 1000 },
      // An odd count is the interesting case: four points leave the 1-byte
      // `cc` column starting the next 2-byte column one byte out of
      // alignment, and a typed-array view over a misaligned offset THROWS.
      { lat: 71.02, lon: 25.68, n: "D", c: "NO", t: 0.11, tr: 0.2, y: 640 },
    ],
    { usageTiersKwhDay: [5, 10, 20, 30] },
  );

  const decoded = decodeGrid(encodeGridBinary({ header, hot }));
  assert.equal(decoded.count, header.count);
  assert.deepEqual(decoded.countries, header.countries);
  assert.deepEqual(decoded.usageTiersKwhDay, header.usageTiersKwhDay);
  for (const col of HOT_COLUMNS) {
    const got = decoded[col.key];
    assert.equal(got.constructor.name, col.type, col.key);
    assert.equal(got.length, header.count, col.key);
    for (let i = 0; i < header.count; i++) {
      assert.equal(got[i], hot[col.key][i], `${col.key}[${i}]`);
    }
  }
  // And the sentinels are still sentinels, not the numbers they stand beside.
  assert.equal(decoded.tq[2], NO_TARIFF);
  assert.equal(decoded.trq[2], NO_TARIFF);
  assert.equal(decoded.uns[2], -1);
});

test("re-encoding the committed file reproduces it byte for byte", () => {
  // Proves the committed file is canonical: the layout is a pure function of
  // its columns, so a generator that disagreed with the file could not write a
  // second valid copy of it, and the next regeneration shows up in the diff
  // rather than in a screenshot.
  const again = new Uint8Array(
    encodeGridBinary({
      header: {
        count: committed.count,
        countries: committed.countries,
        usageTiersKwhDay: committed.usageTiersKwhDay,
      },
      hot: Object.fromEntries(
        HOT_COLUMNS.map((c) => [c.key, committed[c.key]]),
      ),
    }),
  );
  assert.equal(again.byteLength, committedBytes.byteLength);
  for (let i = 0; i < committedBytes.byteLength; i++) {
    if (again[i] !== committedBytes[i]) {
      assert.fail(`byte ${i}: ${again[i]} vs ${committedBytes[i]}`);
    }
  }
});

test("every column starts on its own element boundary", () => {
  // Not a theoretical concern. The point count is odd, so a 1-byte column
  // leaves the next 2-byte column one byte out of alignment and
  // `new Int16Array(buffer, offset)` throws a RangeError on the page.
  for (const count of [committed.count, 3, 2, 1]) {
    const layout = gridLayout(count, 96);
    for (const col of HOT_COLUMNS) {
      assert.equal(
        layout.columns[col.key] % col.bytes,
        0,
        `${col.key} starts at ${layout.columns[col.key]}, which is not a ${col.bytes}-byte boundary`,
      );
    }
    // Padding is the only slack permitted: at most one pad byte per column.
    assert.ok(
      layout.totalBytes <=
        8 + 96 + count * HOT_BYTES_PER_POINT + HOT_COLUMNS.length,
      "the layout reserves no space beyond the alignment padding",
    );
  }
});

test("a mislabelled or truncated file is rejected, not half-drawn", () => {
  assert.throws(
    () => decodeGrid(committedBytes.slice(0, 6).buffer),
    /too short/,
  );

  const wrongMagic = committedBytes.slice();
  wrongMagic[0] = 0x58;
  assert.throws(() => decodeGrid(wrongMagic.buffer), /bad magic/);

  // Every tail byte gone. A grid that silently lost its tail would draw a map
  // with a hole in it and report success.
  assert.throws(
    () =>
      decodeGrid(
        committedBytes.slice(0, committedBytes.byteLength - 100).buffer,
      ),
    /layout needs/,
  );
});

test("every committed column holds the values the generator produced", () => {
  // The bounds are the SEMANTIC ones, not the observed ones, so a regenerated
  // grid that moved a value inside them still passes. The measured ranges when
  // this was written were lat -5481..7066, lon -17520..17936, cc 0..218,
  // tq 50..440, trq 50..640, yq 942..1903 and uns -1..93 — every one well
  // inside its column, which is what "with headroom" has to mean.
  const BOUNDS = {
    lat: [-18000, 18000], // hundredths of a degree
    lon: [-18000, 18000],
    cc: [0, 255], // an index into the country table
    tq: [NO_TARIFF, 32767], // thousandths of a $/kWh, -1 is "no tariff"
    trq: [NO_TARIFF, 32767],
    yq: [0, 65535], // kWh/kWp/yr, integral
    uns: [-1, 100], // unserved percent, -1 is "absent"
  };
  assert.deepEqual(Object.keys(BOUNDS), Object.keys(COLUMNS));

  for (const [key, [lo, hi]] of Object.entries(BOUNDS)) {
    const col = committed[key];
    assert.equal(col.length, committed.count, key);
    let mn = Infinity;
    let mx = -Infinity;
    for (let i = 0; i < col.length; i++) {
      if (col[i] < mn) mn = col[i];
      if (col[i] > mx) mx = col[i];
    }
    assert.ok(
      mn >= lo && mx <= hi,
      `${key} measures ${mn}..${mx}, which leaves ${lo}..${hi}`,
    );
  }

  // A country index only means something if the table it indexes exists.
  assert.ok(committed.countries.length > 0);
  let maxCc = 0;
  for (let i = 0; i < committed.count; i++) {
    if (committed.cc[i] > maxCc) maxCc = committed.cc[i];
  }
  assert.ok(
    maxCc < committed.countries.length,
    `cc reaches ${maxCc} but the country table holds ${committed.countries.length}`,
  );
  assert.ok(committed.usageTiersKwhDay.length > 0);
});

test("the first paint reads a fixed-width file, not a parsed document", () => {
  assert.equal(HOT_BYTES_PER_POINT, 12, "twelve fixed bytes per point");
  assert.equal(
    String.fromCharCode(...committedBytes.subarray(0, 4)),
    GRID_MAGIC,
    "the file identifies itself before anything reads it",
  );
  // A JSON payload here would be 6.66 MiB and would cost the 245ms/600ms of
  // JSON.parse this format exists to avoid, so the SHAPE is asserted and not
  // just the size.
  assert.notEqual(
    new TextDecoder().decode(committedBytes.subarray(0, 2)),
    '{"',
    "the first-paint file must not be JSON",
  );

  const meta = new TextEncoder().encode(
    JSON.stringify({
      count: committed.count,
      countries: committed.countries,
      usageTiersKwhDay: committed.usageTiersKwhDay,
    }),
  ).length;
  assert.equal(
    committedBytes.byteLength,
    gridLayout(committed.count, meta).totalBytes,
    "the committed file is exactly the declared layout, with no slack",
  );
});

// ── The deferred halves ─────────────────────────────────────────────────

test("the names file is complete: nothing was dropped to move it later", () => {
  // Moving a field off the first paint is a SCHEDULE change, not a content
  // change. Everything the payload carried has to still be here at full
  // length, or the page has quietly stopped being able to say what it used to
  // say.
  assert.equal(names.count, committed.count);
  assert.equal(names.names.length, committed.count);
  assert.equal(names.lq.length, committed.count);
  assert.ok(
    typeof names.metric === "string" && names.metric.length > 0,
    "the estimate note is what stops a reader taking these numbers as sizing",
  );
  assert.ok(typeof names.v === "number", "the data version stamp is kept");
  assert.ok(typeof names.generated === "string", "the generation date is kept");

  // Names are names, not indexes: a name column of numbers renders
  // "undefined" in every popup and still passes a length check.
  assert.ok(
    names.names.every((n) => typeof n === "string" && n.length > 0),
    "every point keeps a name string",
  );
  // LCOE is read by no code on this page today. It is carried anyway, because
  // a payload that quietly drops a field is how a later change ends up
  // asserting a number this page no longer has.
  assert.ok(
    names.lq.every((q) => Number.isInteger(q)),
    "lq is still a quantized column, sentinels included",
  );
});

test("the packed year matrix holds every value, in the order the page reads", () => {
  assert.equal(packedYears.values, committed.count * YEAR_VALUES_PER_POINT);
  assert.equal(packedYears.count, committed.count);
  assert.equal(packedYears.series, YEAR_SERIES.length);
  assert.equal(packedYears.tiers, 4);
  assert.equal(packedYears.yrs.constructor.name, "Uint16Array");
  // The index the page uses for a point, a series and a tier must be the flat
  // offset: a matrix packed in the wrong order renders every city with another
  // city's payback and nothing here would notice.
  assert.equal(
    committed.count * YEAR_VALUES_PER_POINT,
    packedYears.values,
    "the layout must be point-major, 16 values per point",
  );

  // Every value has to fit its column. A typed-array store truncates silently,
  // and a payback year is a number the popup prints. Measured on this grid the
  // range is 6..113 against a u16 that holds 0..65535, so a value that ever
  // outgrew the column fails here instead.
  let mn = Infinity;
  let mx = -Infinity;
  for (let i = 0; i < packedYears.yrs.length; i++) {
    if (packedYears.yrs[i] < mn) mn = packedYears.yrs[i];
    if (packedYears.yrs[i] > mx) mx = packedYears.yrs[i];
  }
  assert.ok(mn >= 0, `the smallest year value is ${mn}, u16 starts at 0`);
  assert.ok(mx <= 65535, `the largest year value is ${mx}, u16 stops at 65535`);
  // NO_YEAR is the "this point has no figure" sentinel, and it has to be
  // distinguishable from a real answer: the smallest real answer is 0.6yr.
  assert.ok(mn > NO_YEAR, `no value may collide with the ${NO_YEAR} sentinel`);
});

test("the year matrix round trips through the packed file unchanged", () => {
  // Every value, including both sentinels, has to come back identical: the
  // page reads years out of a u16 view now, so a value written into the wrong
  // column is a number no parse would have caught.
  const points = [
    {
      lat: 13.13,
      lon: 45.38,
      n: "A",
      c: "YE",
      t: 0.09,
      y: 1898,
      p: [3.8, 3.8, 3.8, 3.8],
      pr: [0.6, 0.6, 0.6, 0.6],
      b: [5.1, 5.1, 5.1, 5.1],
      br: [0.8, 0.8, 0.8, 0.8],
    },
    {
      lat: -33.87,
      lon: 151.21,
      n: "B",
      c: "AU",
      t: 0.32,
      y: 1720,
      p: [7.2, 7.1, 7.0, 6.9],
    },
  ];
  const { header, years } = encodeGrid(points, {
    usageTiersKwhDay: [5, 10, 20, 30],
  });
  const decoded = decodeYears(encodeYearsBinary({ header, years }));
  assert.equal(decoded.count, header.count);
  assert.equal(decoded.series, years.series.length);
  assert.equal(decoded.tiers, years.tiers);
  for (let i = 0; i < years.yrs.length; i++) {
    assert.equal(decoded.yrs[i], years.yrs[i], `year value ${i}`);
  }
  // An absent series has to stay absent, not become 0.0 years.
  const absent = 1 * YEAR_VALUES_PER_POINT + 1 * 4 + 3;
  assert.equal(years.yrs[absent], NO_YEAR);
  assert.equal(decoded.yrs[absent], NO_YEAR);
});

test("the years file is rejected when it is mislabelled or truncated", () => {
  assert.throws(() => decodeYears(yearsBytes.slice(0, 8).buffer), /too short/);
  const wrong = yearsBytes.slice();
  wrong[0] = 0x58;
  assert.throws(() => decodeYears(wrong.buffer), /bad magic/);
  assert.throws(
    () => decodeYears(yearsBytes.slice(0, yearsBytes.byteLength - 64).buffer),
    /layout needs/,
  );
});

test("the first-paint file is the small one and the deferred halves are not", () => {
  const hot = readFileSync(BIN).length;
  const lazy = readFileSync(NAMES).length + readFileSync(YEARS).length;
  assert.ok(
    hot < 2 * 1024 * 1024,
    `the FIRST-PAINT file is ${(hot / 1048576).toFixed(2)} MiB, expected well under 2`,
  );
  assert.ok(
    hot < lazy,
    `the deferred halves (${(lazy / 1048576).toFixed(2)} MiB) must be the larger payload`,
  );
  // Twelve bytes a point against the 44 the columnar JSON needed for the same
  // fields, and the packed years file is smaller than the JSON it replaced:
  // 1.24 MB against 1.86 MB for the same 635,312 values.
  assert.ok(
    readFileSync(YEARS).length < readFileSync(BIN).length * 3,
    "the packed year matrix must stay near its packed size, not inflate",
  );
});
