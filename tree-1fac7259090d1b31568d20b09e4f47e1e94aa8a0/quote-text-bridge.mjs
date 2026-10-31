// Test-only bridge: extracts the installer-vs-direct sentence from the
// browser-coupled ui.js (which cannot be imported under plain Node) by slicing
// the self-contained function, and hands it a REAL priced comparison built by
// paths.js.
//
// This replaced a bridge that extracted a quote ESTIMATOR built from two
// multipliers (10x the cheapest build, 5x the dearest) plus a flat $1,500-$3,000
// hookup. That code is gone. The point of the new bridge is that a test can no
// longer assert a quote band without going through the price registry: to
// exercise the sentence you now have to price the four paths for a system
// first, so a fabricated band is not expressible.
import { readFileSync } from "node:fs";

import {
  priceAllPaths,
  systemForPaths,
  HORIZON_YEARS,
} from "../assets/js/sizing/paths.js";

const src = readFileSync(
  new URL("../assets/js/sizing/ui.js", import.meta.url),
  "utf8",
);
const start = src.indexOf("export function turnkeyQuoteText(");
const end = src.indexOf("/** Plain-English ELI5 breakdown");
if (start < 0 || end < 0 || end <= start) {
  throw new Error("turnkeyQuoteText not found in ui.js — markers moved?");
}
const code = src
  .slice(start, end)
  .replace("export function turnkeyQuoteText(", "function turnkeyQuoteText(");
const bridge = new Function(
  "PATHS_HORIZON_YEARS",
  `${code}; return turnkeyQuoteText;`,
);
export const turnkeyQuoteText = bridge(HORIZON_YEARS);

export const money = (u) => "$" + Math.round(u).toLocaleString();
export const moneyRange = (lo, hi) => money(lo) + "–" + money(hi);

/**
 * Price the four paths for a REAL result entry, exactly the way ui.js does.
 * `over` supplies the payload-level context (the visitor's current bill and
 * tariff); everything else comes from the engine's own entry fields.
 */
export function pricedFor(entry, over = {}) {
  return priceAllPaths(
    systemForPaths(entry, {
      annualBaselineBillsUsd: over.annualBaselineBillsUsd ?? null,
      tariff: over.tariff ?? null,
    }),
    { country: over.country ?? "US", instrument: over.instrument ?? "ppa" },
  );
}

// The entry shape ui.js hands the adapter. Kept here so a payload field rename
// fails these tests loudly instead of silently pricing against zeros.
export function entryFor({
  pvKw = 6,
  battKwh = 13.5,
  servedKwhPerYear = 9200,
  replacementsHorizon = 1,
  batteryLifeYears = 12,
  cutPct = 80,
} = {}) {
  return {
    pvKw,
    battKwh,
    servedKwhPerYear,
    replacementsHorizon,
    batteryLifeYears,
    cutPct,
    billAfterMonthlyUsd: 18,
    exportValueAnnualUsd: 0,
  };
}
