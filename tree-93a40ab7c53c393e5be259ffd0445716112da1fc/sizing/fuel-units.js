// The generator fuel helper's rule set: which unit system a site buys fuel in,
// how much a small genset burns per kWh, and the typed price -> USD/kWh maths.
//
// All of it used to sit mid-file in the sizing controller, interleaved with the
// DOM writes, and the footnote figures were hand-copied numbers ("0.13",
// "0.09") that had drifted from the burn table they came from — the only way to
// check them was to open the page and read the paragraph. The policy is pure
// (coordinates, a fuel type and a price in; numbers and locale keys out), so it
// lives here, and the controller keeps the input plumbing: read the fields,
// write the labels. Same shape as parts-csv.js — policy in a module, DOM at the
// edge.

/**
 * Typical partial-load burn for small gensets, in litres per kWh. Fuel cost
 * only: oil, filters and engine wear push the real figure higher, which is why
 * the page says so next to the number.
 */
export const GEN_L_PER_KWH = { petrol: 0.5, diesel: 0.35 };

/** The US gallon the imperial boxes below buy fuel in. */
export const LITRES_PER_GALLON = 3.785411784;

/** The same burn table in the unit half the world actually pumps. */
export const GEN_GAL_PER_KWH = {
  petrol: GEN_L_PER_KWH.petrol / LITRES_PER_GALLON,
  diesel: GEN_L_PER_KWH.diesel / LITRES_PER_GALLON,
};

/**
 * The parts of the world that sell fuel by the gallon: the US mainland plus
 * its two outlying states, which are outside the mainland box. Everything else
 * is metric. Boxes are [latMin, latMax, lonMin, lonMax] and inclusive.
 */
export const IMPERIAL_BOXES = [
  [24, 50, -125, -66], // US mainland
  [18.5, 28.5, -179, -154], // Hawaii
  [50.5, 72, -168, -129], // Alaska
];

/**
 * Whether a site buys fuel by the gallon, from its coordinates alone. A
 * missing or unparsed coordinate is metric: the sane default for the majority
 * of the world, and the one the input starts in.
 */
export function isImperialLocation(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return IMPERIAL_BOXES.some(
    ([latMin, latMax, lonMin, lonMax]) =>
      lat >= latMin && lat <= latMax && lon >= lonMin && lon <= lonMax,
  );
}

/**
 * Litres (or US gallons) burned per kWh for a fuel type. An unrecognised type
 * falls back to petrol rather than to no answer, so a stale saved selection
 * still produces a usable estimate.
 */
export function fuelBurnPerKwh(type, imperial) {
  const table = imperial ? GEN_GAL_PER_KWH : GEN_L_PER_KWH;
  return table[type] ?? table.petrol;
}

/**
 * A local-currency fuel price -> effective USD per kWh, the number the tariff
 * field is filled from. Returns null rather than NaN when the price is blank
 * or not positive, which is what hides the readout until there is something to
 * say. The visitor types the price in the currency the results display, so the
 * division by the FX rate is the same local -> USD step every other amount
 * takes.
 */
export function fuelRateUsd(
  localPrice,
  { type = "petrol", imperial = false, fxRate = null } = {},
) {
  if (!(localPrice > 0)) return null;
  const priceUsd = fxRate ? localPrice / fxRate : localPrice;
  return priceUsd * fuelBurnPerKwh(type, imperial);
}

/** The fuel type word, interpolated into a localized sentence as a name. */
export function fuelTypeName(value) {
  return value === "diesel" ? "Diesel" : "Petrol";
}

// The footnote figures are the burn rates rounded to two decimals, derived
// rather than typed in: correcting GEN_L_PER_KWH can then never leave the
// paragraph disagreeing with the maths it describes. Number() drops the
// trailing zero toFixed(2) adds, so the metric line keeps reading "0.5", the
// way the markup was authored.
function burnFigure(type, imperial) {
  return String(Number(fuelBurnPerKwh(type, imperial).toFixed(2)));
}

/**
 * Everything the helper writes into the page for a unit system: the label's
 * locale key (the unit word lives inside the translated phrase), an example
 * price, the unit suffix, and the two footnote figures. The money symbol is
 * not here — that belongs to the display currency, not to the fuel.
 */
export function fuelDisplay(imperial) {
  return {
    labelKey: imperial ? "fuelGalLabel" : "fuelLitLabel",
    placeholder: imperial ? "e.g. 3.90" : "e.g. 1.20",
    unit: imperial ? "gal" : "L",
    petrolBurn: burnFigure("petrol", imperial),
    dieselBurn: burnFigure("diesel", imperial),
  };
}
