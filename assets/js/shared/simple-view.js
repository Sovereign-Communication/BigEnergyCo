// Simple-mode view model. Reads the SAME selected entry the technical cards
// render (passed in by ui.js, which owns selection and savings policy) and
// reduces it to the few numbers a first-time visitor needs. Pure data: no DOM,
// no formatting — ui.js injects its formatters so currency/locale handling
// stays single-owner. Anything missing or non-finite is dropped, never
// rendered as "NaN".
import { seriesBreakdown } from "../sizing/money.js?v=20260925a";

export function buildSimpleView({ p, entry, saved, fmt }) {
  if (!p || !entry || !entry.solvable) return { feasible: false };

  const heroes = [];
  const push = (term, label, value, sub) => {
    if (value === null || value === undefined) return;
    heroes.push({ term, label, value, sub: sub || null });
  };

  // Panels: array size plus the 550 W-panel equivalent a buyer actually counts.
  if (entry.pvKw > 0) {
    const panels = Math.round((entry.pvKw * 1000) / 550);
    push(
      "kW",
      "Solar",
      fmt.fmt(entry.pvKw) + " kW",
      "about " + panels + " panels",
    );
  }

  // Battery: usable is what sizing promised; nameplate is what you buy.
  if (entry.battKwh > 0) {
    push(
      "usableCapacity",
      "Battery",
      fmt.fmt(entry.battKwh) + " kWh usable",
      entry.battNameplateKwh
        ? "about " + fmt.fmt(entry.battNameplateKwh) + " kWh installed"
        : null,
    );
  }

  if (Number.isFinite(entry.costLo) && Number.isFinite(entry.costHi)) {
    push(null, "First cost", "~" + fmt.moneyRange(entry.costLo, entry.costHi));
  }

  // Same rule the technical panel follows: no panels means no bill cut. A
  // battery-only system moves when power is drawn; it does not lower the bill,
  // and "does not pay back in 20 years" below already says so.
  const goal =
    p.mode !== "gridtie"
      ? Math.round(100 - (entry.unmetHoursPerYear || 0) / 87.6) +
        "% of the year covered"
      : entry.pvKw > 0
        ? "cuts about " + (entry.cutPct ?? 0) + "% off your bill"
        : "shifts about " +
          (entry.cutPct ?? 0) +
          "% of peak hours onto the battery — your bill is unchanged";
  push(null, "What it does", goal);

  if (Number.isFinite(saved) && saved > 0) {
    push(null, "Saved over 20 years", "~" + fmt.money(saved));
  } else if (Number.isFinite(saved) && saved <= 0) {
    push(null, "Saved over 20 years", "does not pay back in 20 years");
  } else if (Number.isFinite(entry.paybackYearsLo)) {
    push(
      null,
      "Payback",
      fmt.fmtPaybackRange(entry.paybackYearsLo, entry.paybackYearsHi),
    );
  }

  return { feasible: true, heroes };
}
