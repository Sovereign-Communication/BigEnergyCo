// The heatmap grid's wire format, as the ONE definition of its quantization.
//
// WHY THE GRID IS NOT AN ARRAY OF OBJECTS ANY MORE. The page shipped 39,707
// objects — `{"lat":13.13,"lon":45.38,"n":"…","p":[…],"pr":[…],…}` — and
// measured the consequences on the staged build with a real browser:
// JSON.parse of that 6.66 MiB cost 245ms on the mobile target and 600ms on the
// desktop one, and those two long tasks alone put TBT at 1772ms/1071ms against
// the plan's 100ms Q-03 ceiling. The bytes were not the problem (the file
// brotli-compresses to ~397 KB, inside the §3.1 limit): the parse was. Most of
// that parse is not data, it is thirteen key names repeated 39,707 times, plus
// year values carried as decimal floats when the page only ever buckets them.
//
// So the grid becomes COLUMNAR and QUANTIZED: one flat array per field, no key
// names inside the loop, and every number stored at the precision the page
// actually uses. Measured on the real grid: 6.66 MiB -> 1.73 MB raw, brotli
// ~397 KB -> 307 KB.
//
// AND THEN, STILL NOT JSON. The columnar file is better but it is still a 1.73
// MB JSON document, and `await res.json()` measured 39ms on the mobile target
// and 29ms on desktop — which is most of what is left of the heatmap's TBT,
// because Lighthouse runs the page under ~4x CPU throttling and a 39ms parse
// becomes ~156ms there. That 39ms is not really "parsing": it is brotli
// inflating 1.73 MB, UTF-8 decoding it into a 1.73 MB JS string, and then
// parsing that string. None of the three steps needs to happen for numbers the
// page reads as integers.
//
// So the hot half is PACKED BINARY — twelve fixed-width bytes per point, read
// as typed-array views over the response body. Decoding is then a view, not a
// copy and not a parse, and the measured decode is ~3ms. The two fields the
// first paint does not need, `names` and `lq`, go to the lazily-fetched detail
// file, where they were already headed: the map needs a position and a colour,
// and a city name is read only by a ranking row or a popup. Net effect on
// heatmap_initial: 317.9 KB -> 296.0 KB compressed, which is an IMPROVEMENT
// against the ratchet rather than a regression, and the raw hot file falls
// 1.73 MB -> 465 KB.
//
// Every value is still there and still exact. tests/heatmap-grid.test.mjs
// decodes the committed binary and compares all 39,707 points against the
// columns the previous file carried, field by field.
//
// WHY ONE MODULE, IMPORTED BY BOTH SIDES. The generator
// (scripts/generate-heatmap-data.mjs) already imports the sizing engine for
// exactly this reason — a threshold copied into the build script drifted from
// the page once already. These scales are the same class of thing: a build
// script that quantized to a different precision than the page dequantized
// would move every dot on the map, and nothing else in the tree would notice.
// `npm run generate-heatmap` writes; the page reads; both call the functions
// below.
//
// WHAT IS NOT ENCODED HERE, ON PURPOSE. The cost and year COLOR thresholds stay
// in assets/js/heatmap.js. Precomputing a color index here would have made the
// generator a second owner of the same seven-way scale, which is precisely the
// duplication this repository's one-owner contract exists to prevent. The page
// buckets 39,707 numbers per redraw; that loop is a few milliseconds and it
// keeps one owner of the thresholds.

// Degrees are stored as hundredths. The source data is already rounded to 2dp
// (scripts/generate-heatmap-data.mjs rounds on the way in), so this is lossless
// for every point the grid contains.
export const DEG_SCALE = 100;

// Tariffs are $/kWh. The page renders them to 2dp in popups and buckets them
// at 0.10/0.18/0.28/0.40/0.55, so thousandths is comfortably finer than either.
// -1 is the "no tariff" sentinel: it is a real value in the JSON today (absent
// fields read as null), and a negative integer is the one number no tariff can
// take.
const TARIFF_SCALE = 1000;
export const NO_TARIFF = -1;

// Yields are kWh/kWp/yr and run to ~2500; they are integral in the source.
const YIELD_MAX = 65535;

// Unserved share is a percentage, 0..100.
const UNSERVED_MAX = 255;

// Payback and break-even years are 0.1yr steps. The scale is not a guess: the
// generator's own output carries at most ONE decimal place on all 635,312 year
// values, so tenths is exact and the round trip is lossless. A fifth-of-a-year
// step was tried first and was not: it turned 5.1 into 5.2, which is a visible
// change to a number the popup prints. 0 is the "no data" sentinel — the
// smallest real answer in the grid is 0.6yr, so nothing rounds onto it.
export const YEAR_SCALE = 10;
const YEAR_MAX = 65535;
export const NO_YEAR = 0;

// LCOE is $/kWh, NOT years, and the grid's values run 0.022-0.038 — three
// decimals. Quantizing it on the year scale multiplied 0.023 by 10 and stored
// it as 0, silently discarding the field; it has its own scale for that
// reason. 0 is the sentinel because no real LCOE here rounds to 0.
const LCOE_SCALE = 1000;
const LCOE_MAX = 65535;
const NO_LCOE = 0;

/** Degrees -> hundredths, for the generator. */
export const quantizeDeg = (d) => Math.round(d * DEG_SCALE);
/** Hundredths -> degrees, for the page. */
export const dequantizeDeg = (q) => q / DEG_SCALE;

/** $/kWh -> thousandths, for the generator. */
export const quantizeTariff = (t) =>
  typeof t === "number" && isFinite(t)
    ? Math.round(t * TARIFF_SCALE)
    : NO_TARIFF;
/** Thousandths -> $/kWh, for the page. `null` where the source had no tariff. */
export const dequantizeTariff = (q) =>
  q === NO_TARIFF ? null : q / TARIFF_SCALE;

/** Years -> tenths, for the generator. */
export const quantizeYear = (y) =>
  typeof y === "number" && isFinite(y) && y > 0
    ? Math.min(YEAR_MAX, Math.round(y * YEAR_SCALE))
    : NO_YEAR;
/** Tenths -> years, for the page. `null` where the source had no series. */
export const dequantizeYear = (q) => (q === NO_YEAR ? null : q / YEAR_SCALE);

/** $/kWh -> thousandths, for the generator. */
export const quantizeLcoe = (v) =>
  typeof v === "number" && isFinite(v) && v > 0
    ? Math.min(LCOE_MAX, Math.round(v * LCOE_SCALE))
    : NO_LCOE;
/** Thousandths -> $/kWh, for the page. `null` where the source had none. */
export const dequantizeLcoe = (q) => (q === NO_LCOE ? null : q / LCOE_SCALE);

/**
 * The four usage tiers, in the order every year series is stored. Declared here
 * because the flat year column is meaningless without it: entry `i` of a point's
 * run of four is the `USAGE_TIERS[i]` kWh/day answer, and the page reads
 * `usageIdx` straight out of it.
 */
export const YEAR_SERIES = ["p", "pr", "b", "br"];
export const YEAR_VALUES_PER_POINT = YEAR_SERIES.length * 4;

/**
 * Build the columnar grid from the generator's point objects.
 *
 * Returns `{ header, hot, years }` so the two files can be written separately:
 * `hot` is everything the first paint and the rankings need, `years` is the
 * payback/break-even matrix, which is 16 of the 20 numbers per point and is
 * read only when the reader switches metric or opens a popup.
 *
 * Pure: takes points, returns plain arrays, reads no file and touches no DOM.
 * tests/heatmap-grid.test.mjs round-trips real points through it and asserts
 * every dequantized value equals its source.
 */
export function encodeGrid(points, { usageTiersKwhDay } = {}) {
  const n = points.length;
  const countries = [];
  const ccIndex = new Map();
  const cc = new Array(n);
  const lat = new Array(n);
  const lon = new Array(n);
  const tq = new Array(n);
  const trq = new Array(n);
  const yq = new Array(n);
  const lq = new Array(n);
  const uns = new Array(n);
  const names = new Array(n);
  const yrs = new Array(n * YEAR_VALUES_PER_POINT);

  for (let i = 0; i < n; i++) {
    const p = points[i];
    // Country codes are interned to indices, so the payload carries "12,"
    // instead of `"NG",` for the 39,707 points. The page maps back through
    // `header.countries`, and an unknown code cannot collide with an index
    // because the two are read from different fields.
    let c = ccIndex.get(p.c);
    if (c === undefined) {
      c = countries.length;
      countries.push(p.c);
      ccIndex.set(p.c, c);
    }
    cc[i] = c;
    lat[i] = quantizeDeg(p.lat);
    lon[i] = quantizeDeg(p.lon);
    tq[i] = quantizeTariff(p.t);
    trq[i] = quantizeTariff(p.tr);
    yq[i] = Math.min(YIELD_MAX, Math.round(p.y || 0));
    // LCOE is not read by this page, but it is in the grid and dropping it
    // would delete data on the strength of a fact about one consumer.
    lq[i] = quantizeLcoe(p.l);
    uns[i] =
      typeof p.unserved === "number"
        ? Math.min(UNSERVED_MAX, Math.round(p.unserved))
        : -1;
    names[i] = p.n || "";
    for (let s = 0; s < YEAR_SERIES.length; s++) {
      const series = p[YEAR_SERIES[s]];
      for (let k = 0; k < 4; k++) {
        yrs[i * YEAR_VALUES_PER_POINT + s * 4 + k] = quantizeYear(
          series ? series[k] : null,
        );
      }
    }
  }

  return {
    header: {
      v: 1,
      count: n,
      usageTiersKwhDay: usageTiersKwhDay || [],
      countries,
      metric:
        "ESTIMATE (not a sizing): 80% bill-cut rule-of-thumb, LFP, landed-DIY costs, exactly one bank replacement assumed, generator/grid-deficit aware. Run the calculator for hourly-simulated sizing.",
    },
    hot: { lat, lon, cc, tq, trq, yq, lq, uns, names },
    years: { series: YEAR_SERIES, tiers: 4, yrs },
  };
}
// ── The packed binary hot file ──────────────────────────────────────────
//
// The layout lives HERE, not in the generator and not in the page, for the same
// reason the scales do: a column order written twice drifts, and a drifted
// column order does not fail — it moves every dot on the map.
//
//   bytes 0..4    magic "HBG1"
//   bytes 4..8    meta length, uint32 LE
//   bytes 8..8+L  the meta, UTF-8 JSON: { count, countries, usageTiersKwhDay }
//   then          the columns, each padded so its start is a multiple of its
//                 element width, because a typed-array view over a shared
//                 ArrayBuffer THROWS on a misaligned offset. That is not a
//                 theoretical concern: 39,707 is odd, so a 1-byte column
//                 leaves the next 2-byte column one byte out of alignment.

export const GRID_MAGIC = "HBG1";

/**
 * The columns the first paint needs, in order, with the narrowest type that
 * holds their real range. Every width here was measured against the real
 * output of this file's own `encodeGrid` — the observed ranges are asserted,
 * with headroom, in tests/heatmap-grid.test.mjs — so a value that ever
 * outgrew its column fails a test instead of silently wrapping.
 *
 * The committed heatmap-grid.bin is checked against the same assertions, so
 * the file the page fetches and the file the generator writes cannot disagree.
 *
 *   lat/lon  i16  hundredths of a degree: -18000..18000 fits
 *   cc       u8   0..218 countries
 *   tq/trq   i16  thousandths of a $/kWh, and -1 for "no tariff"
 *   yq       u16  kWh/kWp/yr, integral, up to ~1900
 *   uns      i8   unserved percent, 0..100, and -1 for "absent"
 */
export const HOT_COLUMNS = [
  { key: "lat", type: "Int16Array", bytes: 2 },
  { key: "lon", type: "Int16Array", bytes: 2 },
  { key: "cc", type: "Uint8Array", bytes: 1 },
  { key: "tq", type: "Int16Array", bytes: 2 },
  { key: "trq", type: "Int16Array", bytes: 2 },
  { key: "yq", type: "Uint16Array", bytes: 2 },
  { key: "uns", type: "Int8Array", bytes: 1 },
];

/** Bytes one point occupies in the hot file, padding excluded. */
export const HOT_BYTES_PER_POINT = HOT_COLUMNS.reduce((a, c) => a + c.bytes, 0);

const alignUp = (offset, bytes) =>
  bytes === 1 ? offset : Math.ceil(offset / bytes) * bytes;

/**
 * Where every part of the file lives, for a given point count. Pure, and the
 * single place the arithmetic exists.
 */
export function gridLayout(count, metaLength) {
  const metaStart = 8;
  let offset = metaStart + metaLength;
  const columns = {};
  for (const col of HOT_COLUMNS) {
    offset = alignUp(offset, col.bytes);
    columns[col.key] = offset;
    offset += count * col.bytes;
  }
  return { metaStart, columns, totalBytes: offset };
}

/**
 * Pack the hot columns into the file the page fetches first.
 *
 * Takes the SAME `encodeGrid` output the JSON path used, so there is one
 * quantization and one set of scales, and the two encodings cannot disagree.
 */
export function encodeGridBinary({ header, hot }) {
  const meta = JSON.stringify({
    count: header.count,
    countries: header.countries,
    usageTiersKwhDay: header.usageTiersKwhDay,
  });
  const encoder = new TextEncoder();
  const metaBytes = encoder.encode(meta);
  const layout = gridLayout(header.count, metaBytes.length);
  const buffer = new ArrayBuffer(layout.totalBytes);
  const bytes = new Uint8Array(buffer);
  bytes.set(encoder.encode(GRID_MAGIC), 0);
  new DataView(buffer).setUint32(4, metaBytes.length, true);
  bytes.set(metaBytes, 8);
  for (const col of HOT_COLUMNS) {
    const View = globalThis[col.type];
    const out = new View(buffer, layout.columns[col.key], header.count);
    const src = hot[col.key];
    for (let i = 0; i < header.count; i++) out[i] = src[i];
  }
  return buffer;
}

/**
 * Read the hot file. Every column is a VIEW over the response body, so this
 * copies nothing and parses nothing: it is the whole decode cost.
 *
 * Throws on a wrong magic or a truncated body rather than returning a short
 * array, because a grid that silently lost its tail would draw a map with a
 * hole in it and no error anywhere.
 */
export function decodeGrid(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 12) throw new Error("heatmap grid: file is too short");
  const magic = String.fromCharCode(...bytes.subarray(0, 4));
  if (magic !== GRID_MAGIC) {
    throw new Error(`heatmap grid: bad magic ${JSON.stringify(magic)}`);
  }
  const view = new DataView(buffer);
  const metaLength = view.getUint32(4, true);
  const meta = JSON.parse(
    new TextDecoder().decode(bytes.subarray(8, 8 + metaLength)),
  );
  const layout = gridLayout(meta.count, metaLength);
  if (bytes.length < layout.totalBytes) {
    throw new Error(
      `heatmap grid: body is ${bytes.length} bytes, layout needs ${layout.totalBytes}`,
    );
  }
  const out = {
    count: meta.count,
    countries: meta.countries,
    usageTiersKwhDay: meta.usageTiersKwhDay,
  };
  for (const col of HOT_COLUMNS) {
    out[col.key] = new globalThis[col.type](
      buffer,
      layout.columns[col.key],
      meta.count,
    );
  }
  return out;
}

// ── The packed year matrix ──────────────────────────────────────────────
//
// The third file, and the one that decided whether this page could prefetch
// its own detail data without costing TBT. The matrix is 635,312 quantized
// values in 16 columns per point. As JSON it was 1.86 MB of text, which the
// browser had to inflate and JSON.parse — one long task of ~30ms unthrottled,
// which is ~120ms under the gate's CPU throttling, and it landed INSIDE the
// load window because the page fetched it on idle.
//
// Packed, it is 1.24 MB of u16 that the page reads as a view and parses never.
// And it compresses at least as well as the text did, because it is almost all
// constant runs: brotli q11 measures 2.5 KB packed against 2.8 KB as JSON.
// So this is not a size-for-speed trade — it is smaller on the wire AND free
// to decode.
//
//   bytes 0..4    magic "HBY1"
//   bytes 4..8    value count, uint32 LE
//   bytes 8..12   series count, uint32 LE
//   bytes 12..16  usage tiers, uint32 LE
//   then          the values, u16 LE, in the same order as before
const YEARS_MAGIC = "HBY1";
const YEARS_HEADER_BYTES = 16;

export function encodeYearsBinary({ header, years }) {
  const values = years.yrs;
  if (values.length !== header.count * YEAR_VALUES_PER_POINT) {
    throw new Error(
      `heatmap years: ${values.length} values for ${header.count} points`,
    );
  }
  const buffer = new ArrayBuffer(YEARS_HEADER_BYTES + values.length * 2);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  for (let i = 0; i < YEARS_MAGIC.length; i++) {
    bytes[i] = YEARS_MAGIC.charCodeAt(i);
  }
  view.setUint32(4, values.length, true);
  view.setUint32(8, years.series.length, true);
  view.setUint32(12, years.tiers, true);
  const out = new Uint16Array(buffer, YEARS_HEADER_BYTES, values.length);
  for (let i = 0; i < values.length; i++) out[i] = values[i];
  return buffer;
}

export function decodeYears(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < YEARS_HEADER_BYTES) {
    throw new Error("heatmap years: file is too short");
  }
  const magic = String.fromCharCode(...bytes.subarray(0, 4));
  if (magic !== YEARS_MAGIC) {
    throw new Error(`heatmap years: bad magic ${JSON.stringify(magic)}`);
  }
  const view = new DataView(buffer);
  const count = view.getUint32(4, true);
  const series = view.getUint32(8, true);
  const tiers = view.getUint32(12, true);
  const needed = YEARS_HEADER_BYTES + count * 2;
  if (bytes.length < needed) {
    throw new Error(
      `heatmap years: body is ${bytes.length} bytes, layout needs ${needed}`,
    );
  }
  return {
    count: count / YEAR_VALUES_PER_POINT,
    values: count,
    series,
    tiers,
    // The page reads `years.yrs[i * 16 + s * 4 + k]`, so the decoded shape is
    // the same one it had when the matrix was a JSON property.
    yrs: new Uint16Array(buffer, YEARS_HEADER_BYTES, count),
  };
}
