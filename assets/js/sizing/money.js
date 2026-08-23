// Pure money math for sizing results: payback vs. grid spend, battery
// replacement cadence, and levelized cost of solar-served energy.
// No DOM, no network — fully unit-tested. The worker and UI both import this.

// Design-life assumption for panels and electronics when levelizing.
export const HORIZON_YEARS = 25;

/** Annual grid spend for a given use and tariff. */
export function annualGridSpendUsd(dailyKwh, tariffPerKwh) {
  if (!(dailyKwh > 0) || !(tariffPerKwh > 0)) return null;
  return dailyKwh * 365 * tariffPerKwh;
}

/**
 * Years for a system to repay its capex out of avoided grid spend.
 * Returns null when there is no bill to displace (tariff unknown/zero).
 */
export function paybackYears(capexUsd, annualSpendUsd) {
  if (!Number.isFinite(capexUsd) || !(annualSpendUsd > 0)) return null;
  return capexUsd / annualSpendUsd;
}

/**
 * How many full battery-bank replacements a system needs over the horizon.
 * Bank life = rated cycles-to-80% / equivalent-full cycles per year.
 * A bank lasting exactly the horizon needs zero replacements; one lasting
 * half the horizon needs exactly one; floor() captures that honestly.
 */
export function batteryReplacements(cyclesPerYear, cyclesTo80, horizonYears = HORIZON_YEARS) {
  if (!(cyclesPerYear > 0) || !(cyclesTo80 > 0)) return 0;
  const lifeYears = cyclesTo80 / cyclesPerYear;
  if (lifeYears >= horizonYears) return 0;
  return Math.min(8, Math.floor(horizonYears / lifeYears));
}

/**
 * Levelized cost of the AC energy the system serves, USD/kWh:
 * (initial mid-scenario capex + replacement banks) / (served kWh × horizon).
 * Panels/inverter are assumed to last the horizon — stated in the UI.
 */
export function lcoeUsdPerKwh({ capexMidUsd, battReplaceCostUsd = 0, replacements = 0, annualServedKwh, horizonYears = HORIZON_YEARS }) {
  const totalKwh = (annualServedKwh || 0) * horizonYears;
  if (!(totalKwh > 0) || !Number.isFinite(capexMidUsd)) return null;
  return (capexMidUsd + replacements * battReplaceCostUsd) / totalKwh;
}
