// Pure money math for sizing results: payback vs. grid spend, battery
// replacement cadence, and levelized cost of solar-served energy.
// No DOM, no network — fully unit-tested. The worker and UI both import this.

// Design-life assumption for panels and electronics when levelizing.
// 20 years is a realistic planning horizon: battery warranties typically
// run 10–15 years, while panels/inverters outlast the horizon at 25–30.
export const HORIZON_YEARS = 20;

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

// Installation labor per usable kWh — paid on the first install and AGAIN
// on every bank swap. This is what makes "cheap" lead-acid expensive: the
// bank is replaced several times and each replacement is a work day.
export const INSTALL_LABOR_PER_KWH_USABLE = [12, 30];

export function laborMidPerKwh(laborPerKwh = INSTALL_LABOR_PER_KWH_USABLE) {
  return (laborPerKwh[0] + laborPerKwh[1]) / 2;
}

/**
 * True lifetime cost of a battery bank over the horizon, mid-scenario:
 * initial capex + first-install labor, then each swap buys a new bank plus
 * new labor. This is the number that shows lead-acid's real price.
 */
export function lifetimeCostUsd({ capexMidUsd, battKwhUsable = 0, battPriceMidPerKwh = 0, replacements = 0, laborPerKwh }) {
  if (!Number.isFinite(capexMidUsd)) return null;
  const laborKwh = laborMidPerKwh(laborPerKwh);
  const firstLabor = battKwhUsable * laborKwh;
  const swapCost = replacements * (battKwhUsable * (battPriceMidPerKwh + laborKwh));
  return {
    total: Math.round(capexMidUsd + firstLabor + swapCost),
    firstLabor: Math.round(firstLabor),
    swapsAndLabor: Math.round(swapCost),
  };
}

/** Annual value of surplus you can sell back (feed-in / net billing). */
export function exportValueUsd(clippedKwhPerYear, exportRatePerKwh) {
  if (!(clippedKwhPerYear > 0) || !(exportRatePerKwh > 0)) return 0;
  return clippedKwhPerYear * exportRatePerKwh;
}
/**
 * The year cumulative avoided bills exceed cumulative TRUE cost — counting
 * every bank swap as it falls due. This is the honest payback for chemistries
 * that wear out: lead-acid may never catch up, and saying so is the point.
 *
 * Swap schedule: replacement k lands at round(k × batteryLifeYears), capped
 * at `replacements` swaps (the same cap the lifetime-cost figure uses — the
 * two numbers must always tell the same story). Returns null when the system
 * never breaks even inside the horizon.
 */
export function trueBreakEvenYear({ capexMidUsd, annualSavingsUsd, swapsAndLaborTotalUsd = 0, replacements = 0, batteryLifeYears, horizonYears = HORIZON_YEARS }) {
  if (!(annualSavingsUsd > 0) || !Number.isFinite(capexMidUsd)) return null;
  const perSwap = replacements > 0 ? swapsAndLaborTotalUsd / replacements : 0;

  const swapYears = new Set();
  if (replacements > 0 && Number.isFinite(batteryLifeYears) && batteryLifeYears > 0) {
    for (let k = 1; k <= replacements; k++) {
      const yr = Math.round(k * batteryLifeYears);
      if (yr > horizonYears) break;
      swapYears.add(Math.max(1, yr));
    }
  }

  let cumCost = capexMidUsd;
  let cumSavings = 0;
  for (let y = 1; y <= horizonYears; y++) {
    if (swapYears.has(y)) cumCost += perSwap;
    cumSavings += annualSavingsUsd;
    if (cumSavings >= cumCost) return y;
  }
  return null;
}
