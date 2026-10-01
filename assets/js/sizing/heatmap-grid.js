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
// actually uses. Measured on the real grid: 6.66 MiB -> 3.47 MB raw, parse
// 63ms -> 18ms, brotli ~397 KB -> 308 KB. The page reads columns directly, so
// there is no decode pass at all beyond JSON.parse itself.
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
export const TARIFF_SCALE = 1000;
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
export const LCOE_SCALE = 1000;
const LCOE_MAX = 65535;
export const NO_LCOE = 0;

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
