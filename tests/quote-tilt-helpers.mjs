// Test-only bridge: extracts the quote-estimator functions from the
// browser-coupled ui.js (which cannot be imported under plain Node) by
// slicing the self-contained block between its known markers.
import { readFileSync } from "node:fs";

const src = readFileSync(
  new URL("../assets/js/sizing/ui.js", import.meta.url),
  "utf8",
);
const start = src.indexOf("export const TURNKEY_MULTIPLIER_LOW");
const end = src.indexOf("/** Plain-English ELI5 breakdown");
if (start < 0 || end < 0 || end <= start) {
  throw new Error(
    "turnkey estimator block not found in ui.js — markers moved?",
  );
}
let code = src
  .slice(start, end)
  .replaceAll("export const", "const")
  .replaceAll("export function", "function")
  .replace(
    "function turnkeyQuoteText(sys, moneyFn = money, rangeFn = moneyRange)",
    "function turnkeyQuoteText(sys, moneyFn, rangeFn)",
  );
const money = (u) => "$" + Math.round(u).toLocaleString();
const moneyRange = (lo, hi) => money(lo) + "–" + money(hi);
const bridge = new Function(
  "money",
  "moneyRange",
  code +
    "; return { TURNKEY_MULTIPLIER_LOW, TURNKEY_MULTIPLIER_HIGH, estimateTurnkeyQuotes, turnkeyQuoteText };",
);
export const {
  TURNKEY_MULTIPLIER_LOW,
  TURNKEY_MULTIPLIER_HIGH,
  estimateTurnkeyQuotes,
  turnkeyQuoteText,
} = bridge(money, moneyRange);
