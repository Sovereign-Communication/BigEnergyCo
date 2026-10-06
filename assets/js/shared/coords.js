// The one owner of the coordinate-precision policy.
//
// A browser geolocation fix is metre-accurate. Interpolating one straight into
// a request URL sends a visitor's house to a third party — NASA LARC and
// Nominatim both received the raw fix, because the rounding this site already
// documented lived in `cacheKey`, which only builds a cache key and never
// touched the wire.
//
// The rule is stated once, here: coordinates leave the device at 0.01°
// (~1.1 km), which is far coarser than any solar or pricing input needs and
// fine enough to pick the right weather grid and the right region.
//
// Every egress goes through this module. A bare `lat=${lat}` in a URL is the
// defect this file exists to make impossible to reintroduce quietly, and
// scripts/check-privacy.mjs fails the build if one appears without this.

export const COORD_DECIMALS = 2;

/**
 * One coordinate at the egress precision, as a URL-safe decimal string.
 *
 * `-0` is normalised to `0` so a coordinate just west of the meridian does
 * not go on the wire as "-0.00". Non-finite input returns null rather than the
 * string "NaN", so a caller that forgets to validate cannot quietly request
 * "latitude=NaN" from a third party.
 */
export function roundCoord(value) {
  if (!Number.isFinite(value)) return null;
  const rounded = Number(value.toFixed(COORD_DECIMALS));
  // Object.is catches -0, which === treats as equal to 0.
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

/** Both coordinates at the egress precision, ready for a URL. */
export function roundCoords(lat, lon) {
  return { lat: roundCoord(lat), lon: roundCoord(lon) };
}
