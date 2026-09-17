// Deterministic climate helpers. They accept the hourly NASA-shaped series the
// engine already consumes; no network or climate database is needed.
const SOILING_BY_CLIMATE = Object.freeze({
  desert: 0.91,
  arid: 0.93,
  tropical: 0.95,
  maritime: 0.96,
  temperate: 0.97,
});

export function climateClass(hours = []) {
  const temps = hours.map((hour) => Number(hour.tAmb)).filter(Number.isFinite);
  const ghi = hours
    .map((hour) => Number(hour.ghi))
    .filter((value) => Number.isFinite(value) && value >= 0);
  const meanTemp = temps.length
    ? temps.reduce((sum, value) => sum + value, 0) / temps.length
    : 20;
  const meanGhi = ghi.length
    ? ghi.reduce((sum, value) => sum + value, 0) / ghi.length
    : 0;
  // Order is intentional, not accidental: warm sites (≥18 °C mean) with dim
  // sun read as tropical, never maritime — humidity, pollen, and mold soil
  // tropical panels at least as fast as sea air does (0.95 vs 0.96). Maritime
  // therefore means cool-and-dim (coastal temperate winters, high latitudes),
  // where rain washes panels more often than dust settles. Do not reorder the
  // tropical branch below maritime without re-freezing the persona bounds:
  // every warm-wet site on Earth would gain a point of harvest.
  const wetSignal = meanGhi > 0 && meanTemp >= 18 && meanGhi < 210;
  if (meanTemp >= 30 && meanGhi >= 250) return "desert";
  if (meanTemp >= 20 && meanGhi >= 320) return "arid";
  if (meanTemp >= 18 && (wetSignal || meanGhi < 320)) return "tropical";
  if (meanGhi < 250) return "maritime";
  return "temperate";
}

export function soilingFactor(hours = [], override = null) {
  if (Number.isFinite(override)) return Math.min(1, Math.max(0.85, override));
  return SOILING_BY_CLIMATE[climateClass(hours)];
}

export function thermalBatteryFactor(chemistry, hours = []) {
  const temps = hours.map((hour) => Number(hour.tAmb)).filter(Number.isFinite);
  const minC = temps.length ? Math.min(...temps) : 20;
  const meanC = temps.length
    ? temps.reduce((sum, value) => sum + value, 0) / temps.length
    : 20;
  if (chemistry === "lfp") {
    return {
      capacityFactor: minC < 0 ? 0.9 : 1,
      chargeMinC: 0,
      minC,
      meanC,
      warning: minC < 0 ? "LFP must be kept above 0 °C while charging." : null,
    };
  }
  if (chemistry === "naion") {
    const capacityFactor =
      minC < -15 ? Math.max(0.8, 1 - (-15 - minC) * 0.01) : 1;
    return {
      capacityFactor,
      chargeMinC: -20,
      minC,
      meanC,
      warning:
        minC < -15 ? "Sodium-ion loses some capacity in deep cold." : null,
    };
  }
  return { capacityFactor: 1, chargeMinC: -20, minC, meanC, warning: null };
}

export function worstMonth(hours = []) {
  if (!hours.length) return null;
  const days = Math.floor(hours.length / 24);
  const monthDays = Math.max(1, Math.floor(days / 12));
  const windows = [];
  for (let startDay = 0; startDay < days; startDay += monthDays) {
    const start = startDay * 24;
    const end = Math.min(hours.length, start + monthDays * 24);
    const ghi = hours
      .slice(start, end)
      .reduce((sum, hour) => sum + Math.max(0, Number(hour.ghi) || 0), 0);
    windows.push({
      startDay,
      endDay: Math.ceil(end / 24),
      ghi,
      // Wh/m²/day summed from hourly GHI, converted to kWh/m²/day so the
      // field's unit matches its name (and the UI copy that prints it).
      averageDailyGhi: ghi / 1000 / Math.max(1, (end - start) / 24),
    });
  }
  return windows.reduce((worst, window) =>
    window.averageDailyGhi < worst.averageDailyGhi ? window : worst,
  );
}

export function climateSummary(hours = [], override = null) {
  const thermal = Object.fromEntries(
    ["lfp", "naion", "agm"].map((chemistry) => [
      chemistry,
      thermalBatteryFactor(chemistry, hours),
    ]),
  );
  return {
    climate: climateClass(hours),
    soiling: soilingFactor(hours, override),
    thermal,
    worstMonth: worstMonth(hours),
  };
}
