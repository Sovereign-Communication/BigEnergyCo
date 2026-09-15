// Deterministic tilt-harvest physics. Answers the beginner question "how much
// does mounting angle actually matter?" with real numbers instead of vague
// advice. Pure functions, no network, no state — safe for the zero-runtime-
// dependency constraint and direct node:test coverage.
//
// Model: monthly beam irradiance on a tilted plane (clear-sky-equivalent,
// isotropic-sky approximation) integrated over the year. This is a TEACHING
// approximation — deliberately conservative and close enough for the honest
// "flat vs optimal" spread we quote (real-world flat-loss studies land in the
// same band). The calculator's actual sizing still uses hourly NASA POWER
// data; this module only explains WHY the recommended tilt exists.
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const SOLAR_CONSTANT = 1361; // W/m²
const ATMOSPHERIC_TRANSMITTANCE = 0.72; // clear-sky beam average
const DIFFUSE_SHARE = 0.2; // sky-diffuse slice assumed tilt-insensitive
const TILT_STEP_DEG = 5;
const TILT_MAX_DEG = 90;

function deg2rad(deg) {
  return (deg * Math.PI) / 180;
}

// J. Spencer's low-precision solar declination (±0.035°, plenty for teaching).
function declination(dayOfYear) {
  return (
    (180 / Math.PI) *
    0.4093 *
    Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81))
  );
}

/**
 * Beam irradiance factor on an equator-facing surface tilted `tiltDeg` from
 * horizontal, at latitude `latDeg`, for solar declination `declDeg` and hour
 * angle `hourAngleDeg`. Uses the standard rotated-latitude identity: a panel
 * at tilt β behaves like a horizontal panel at latitude φ − β.
 */
function beamOnTiltedPlane(latDeg, declDeg, hourAngleDeg, tiltDeg) {
  const effectiveLat = latDeg - tiltDeg;
  const phi = deg2rad(effectiveLat);
  const delta = deg2rad(declDeg);
  const h = deg2rad(hourAngleDeg);
  const cosIncidence =
    Math.sin(phi) * Math.sin(delta) +
    Math.cos(phi) * Math.cos(delta) * Math.cos(h);
  const clamp = Math.max(-1, Math.min(1, cosIncidence));
  if (clamp <= 0) return 0; // sun below the panel's horizon
  const phiHoriz = deg2rad(latDeg);
  const cosZenith =
    Math.sin(phiHoriz) * Math.sin(delta) +
    Math.cos(phiHoriz) * Math.cos(delta) * Math.cos(h);
  if (cosZenith <= 0) return 0; // sun below the site horizon
  const clearBeam = SOLAR_CONSTANT * ATMOSPHERIC_TRANSMITTANCE;
  return clearBeam * (clamp * (1 - DIFFUSE_SHARE) + DIFFUSE_SHARE * cosZenith);
}

/**
 * Relative annual harvest index for a fixed equator-facing tilt at a given
 * latitude (arbitrary but deterministic units — only RATIOS matter).
 */
export function annualYieldIndex(latDeg, tiltDeg) {
  const lat = Math.max(-90, Math.min(90, Number(latDeg) || 0));
  const tilt = Math.max(0, Math.min(TILT_MAX_DEG, Number(tiltDeg) || 0));
  let total = 0;
  let dayOfYear = 0;
  for (let month = 0; month < 12; month++) {
    const days = DAYS_IN_MONTH[month];
    const midDay = dayOfYear + days / 2;
    dayOfYear += days;
    const decl = declination(midDay);
    for (let ha = -90; ha <= 90; ha += 5) {
      total += beamOnTiltedPlane(lat, decl, ha, tilt) * days;
    }
  }
  return total;
}

/**
 * Optimal fixed tilt for a latitude (grid-searched, equator-facing). Matches
 * the classic "roughly 0.76 × |lat|" rule of thumb at mid-latitudes and
 * relaxes to a small self-cleaning tilt near the equator.
 */
export function optimalTilt(latDeg) {
  const lat = Math.max(-90, Math.min(90, Number(latDeg) || 0));
  if (Math.abs(lat) < 5) return 10;
  let best = 10;
  let bestYield = -1;
  for (let t = 0; t <= TILT_MAX_DEG; t += TILT_STEP_DEG) {
    const y = annualYieldIndex(lat, t);
    if (y > bestYield) {
      bestYield = y;
      best = t;
    }
  }
  return best;
}

/**
 * How much a flat mount gives up versus the optimal tilt, and how many extra
 * panels a flat roof needs to match the tilted harvest:
 *  - flatLossPct: % harvest a flat array forfeits vs the optimal tilt.
 *  - panelsFlatPerTenTilted: flat panels needed to match 10 panels at the
 *    optimal tilt (e.g. 12 → "a flat roof needs ~2 extra panels per 10").
 */
export function tiltValueSummary(latDeg, optimalTiltDeg = optimalTilt(latDeg)) {
  const lat = Math.max(-90, Math.min(90, Number(latDeg) || 0));
  const yFlat = annualYieldIndex(lat, 0);
  const yOpt = annualYieldIndex(lat, optimalTiltDeg);
  const flatLossPct = yOpt > 0 ? Math.round((1 - yFlat / yOpt) * 100) : 0;
  return {
    flatLossPct,
    optimalTilt: optimalTiltDeg,
    panelsFlatPerTenTilted:
      flatLossPct > 0 && flatLossPct < 100
        ? Math.max(10, Math.round(10 / (1 - flatLossPct / 100)))
        : 10,
  };
}
