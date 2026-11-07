// Simple-mode view model. Reads the SAME selected entry the technical cards
// render (passed in by ui.js, which owns selection and savings policy) and
// reduces it to the few numbers a first-time visitor needs. Pure data: no DOM,
// no formatting — ui.js injects its formatters so currency/locale handling
// stays single-owner, and its translator so no label or sentence in this file
// can ship in English on another locale. Anything missing or non-finite is
// dropped, never rendered as "NaN".
import { seriesBreakdown } from "../sizing/money.js?v=20261107a";

export function buildSimpleView({ p, entry, saved, fmt, t }) {
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
      t("simpleSolar"),
      fmt.fmt(entry.pvKw) + " kW",
      t("simplePanels", { panels }),
    );
  }

  // Battery: usable is what sizing promised; nameplate is what you buy.
  if (entry.battKwh > 0) {
    push(
      "usableCapacity",
      t("simpleBattery"),
      t("simpleKwhUsable", { kwh: fmt.fmt(entry.battKwh) }),
      entry.battNameplateKwh
        ? t("simpleKwhInstalled", { kwh: fmt.fmt(entry.battNameplateKwh) })
        : null,
    );
  }

  if (Number.isFinite(entry.costLo) && Number.isFinite(entry.costHi)) {
    push(
      null,
      t("simpleFirstCost"),
      "~" + fmt.moneyRange(entry.costLo, entry.costHi),
    );
  }

  // Same rule the technical panel follows: no panels means no bill cut. A
  // battery-only system moves when power is drawn; it does not lower the bill,
  // and "does not pay back in 20 years" below already says so.
  const goal =
    p.mode !== "gridtie"
      ? t("simpleYearCovered", {
          pct: Math.round(100 - (entry.unmetHoursPerYear || 0) / 87.6),
        })
      : entry.pvKw > 0
        ? t("simpleBillCut", { pct: entry.cutPct ?? 0 })
        : t("simplePeakShift", { pct: entry.cutPct ?? 0 });
  push(null, t("simpleWhatItDoes"), goal);

  if (Number.isFinite(saved) && saved > 0) {
    push(null, t("simpleSaved"), "~" + fmt.money(saved));
  } else if (Number.isFinite(saved) && saved <= 0) {
    push(null, t("simpleSaved"), t("simpleNoPayback"));
  } else if (Number.isFinite(entry.paybackYearsLo)) {
    push(
      null,
      t("simplePayback"),
      fmt.fmtPaybackRange(entry.paybackYearsLo, entry.paybackYearsHi),
    );
  }

  return { feasible: true, heroes };
}
