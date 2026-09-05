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
 * Per-year cumulative cost series over the horizon — the data behind the
 * "running cost" chart. Three lines:
 *   grid[y]   = cumulative spend if you had stayed on the grid (the FULL bill,
 *               displaced plus whatever you would still have paid anyway)
 *   solar[y]  = cumulative TRUE cost of the solar path: capex + first labor +
 *               every swap AND the residual bill you keep paying every year
 *               (net of any feed-in credit on clipped surplus)
 *   system[y] = cumulative cost of the SYSTEM alone: capex + first labor +
 *               every swap, NO residual bills — this is the same number the
 *               recommendation card shows as "Total 20-year cost", so the
 *               chart's green line and the card can never disagree.
 * The crossing point of grid and solar IS the true break-even year, so the
 * chart and the "pays for itself: year N" row can never disagree.
 *
 * The wedge between the lines is therefore the HONEST answer to "what does
 * solar really save": each year's displacement (gridSpend − residual bill,
 * plus feed-in value) minus the system's true running cost. For a system
 * that only cuts 25% of the bill, 75% of the bill still accumulates on the
 * solar line — a small array can never look like it "saved" the whole
 * 20-year bill.
 *
 * Swap schedule matches trueBreakEvenYear exactly (round(k × batteryLifeYears),
 * capped at `replacements`), so both numbers always tell the same story.
 * Note every "customer" of the three arrays shares the same swap years, so the
 * wedge between solar and system is exactly the residual bills paid.
 *
 * residualAnnualUsd is allowed to go NEGATIVE: when a feed-in credit on
 * clipped surplus out-earns the bill the household still pays (net metering /
 * an oversized array), the with-solar line then accumulates less than the
 * system's own cost and the wedge becomes a credit the utility owes.
 *
 * Returns null when there is no bill to displace (no tariff entered, or a
 * system that displaces nothing) — the chart is then hidden rather than
 * shown with a fake grid line.
 */
export function cumulativeCostSeries({ capexMidUsd, annualSavingsUsd, residualAnnualUsd = 0, swapsAndLaborTotalUsd = 0, replacements = 0, batteryLifeYears, firstLaborUsd = 0, horizonYears = HORIZON_YEARS }) {
  if (!Number.isFinite(capexMidUsd) || !Number.isFinite(annualSavingsUsd) || annualSavingsUsd < 0 ||
      !Number.isFinite(residualAnnualUsd)) return null;
  const perSwap = replacements > 0 ? swapsAndLaborTotalUsd / replacements : 0;

  // Swap schedule: replacement k falls due at round(k × batteryLifeYears),
  // aggregated as per-year multiplicities. When a battery wears out in under
  // a year (heavy lead-acid cycling), several swaps CAN land in the same
  // year — a Set can't express that and would silently drop them, making the
  // series apply fewer swaps than the card counts (chart/card disagreement,
  // flattering break-even). `replacements` is the single source of truth.
  const swapCounts = new Array(horizonYears + 1).fill(0);
  if (replacements > 0 && Number.isFinite(batteryLifeYears) && batteryLifeYears > 0) {
    for (let k = 1; k <= replacements; k++) {
      const yr = Math.round(k * batteryLifeYears);
      if (yr > horizonYears) break;
      swapCounts[Math.max(1, yr)]++;
    }
  }

  const grid = new Array(horizonYears);
  const solar = new Array(horizonYears);
  const system = new Array(horizonYears);
  let cumGrid = 0;
  let cumSolar = capexMidUsd;    // solar starts with the full first cost
  let cumSystem = capexMidUsd + firstLaborUsd;  // the card's total counts first install labor
  for (let y = 1; y <= horizonYears; y++) {
    cumGrid += annualSavingsUsd + residualAnnualUsd;   // what staying on the grid costs that year
    cumSolar += residualAnnualUsd;                     // the bill you still pay with solar
    const nSwaps = swapCounts[y];
    if (nSwaps > 0) { cumSolar += nSwaps * perSwap; cumSystem += nSwaps * perSwap; }
    grid[y - 1] = Math.round(cumGrid);
    solar[y - 1] = Math.round(cumSolar);
    system[y - 1] = Math.round(cumSystem);
  }
  return { years: horizonYears, grid, solar, system };
}
/**
 * The headline figures the chart and the cards derive from ONE series so
 * they can never disagree:
 *   gridTotal      = 20-year utility spend if you stayed on the grid (amber)
 *   systemTotal    = cost of the SYSTEM alone — capex + install labor + every
 *                    swap (emerald) — this is the card's "Total 20-year cost"
 *   residualBills  = the smaller utility bills you keep paying with solar
 *   withSolar      = systemTotal + residualBills (slate): it CONTAINS
 *                    systemTotal — the system figure is a slice of it, the
 *                    two are never added together
 *   saved          = gridTotal − withSolar
 * That identity (system + residual = with solar; saved + withSolar = grid)
 * is what keeps the stack visually honest: 25K + 50K = 75K, never 25K + 75K.
 * Returns null for a missing/incomparable series.
 */
export function seriesBreakdown(series) {
  if (!series || !Array.isArray(series.grid) || !Array.isArray(series.solar) ||
      !series.grid.length || series.solar.length !== series.grid.length) return null;
  const n = series.grid.length - 1;
  const gridTotal = series.grid[n];
  const withSolar = series.solar[n];
  const hasSystem = Array.isArray(series.system) && series.system.length === series.grid.length;
  const systemTotal = hasSystem ? series.system[n] : null;
  return {
    gridTotal,
    withSolar,
    systemTotal,
    residualBills: hasSystem ? withSolar - systemTotal : null,
    saved: gridTotal - withSolar,
  };
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

  // Same per-year multiplicity schedule as the series above — the two must
  // count replacements identically or break-even and the chart will disagree.
  const swapCounts = new Array(horizonYears + 1).fill(0);
  if (replacements > 0 && Number.isFinite(batteryLifeYears) && batteryLifeYears > 0) {
    for (let k = 1; k <= replacements; k++) {
      const yr = Math.round(k * batteryLifeYears);
      if (yr > horizonYears) break;
      swapCounts[Math.max(1, yr)]++;
    }
  }

  let cumCost = capexMidUsd;
  let cumSavings = 0;
  for (let y = 1; y <= horizonYears; y++) {
    const nSwaps = swapCounts[y];
    if (nSwaps > 0) cumCost += nSwaps * perSwap;
    cumSavings += annualSavingsUsd;
    if (cumSavings >= cumCost) return y;
  }
  return null;
}

/**
 * What the cumulative 20-year chart panel should show for a selected result.
 * A complete grid + solar series means the chart; anything less means the
 * panel must say why the money story is absent. The message depends on
 * whether a tariff was entered: no tariff = nothing to compare; tariff
 * present = this result carried no comparable series. Kept pure so the
 * renderer and tests share one source of truth for the two states.
 */
export function savingsPanelState(series, tariffPerKwh) {
  if (series && Array.isArray(series.grid) && Array.isArray(series.solar) &&
      series.grid.length && series.solar.length) {
    return { kind: "chart" };
  }
  return tariffPerKwh
    ? { kind: "unavailable", title: "Savings data unavailable for this result", sub: "The sizing completed, but this result did not include a comparable 20-year cost series." }
    : { kind: "unavailable", title: "Enter your grid price to see estimated savings", sub: "The calculator can size the system without a tariff, but needs your electricity price to compare 20-year grid cost with solar cost." };
}
