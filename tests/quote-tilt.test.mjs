import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  TURNKEY_MULTIPLIER_LOW,
  TURNKEY_MULTIPLIER_HIGH,
  estimateTurnkeyQuotes,
  turnkeyQuoteText,
} from "./quote-tilt-helpers.mjs";
import {
  annualYieldIndex,
  optimalTilt,
  tiltValueSummary,
} from "../assets/js/sizing/tilt-harvest.js";

test("turnkey quote multipliers scale quotes with system size, not fixed", () => {
  assert.equal(TURNKEY_MULTIPLIER_LOW, 5);
  assert.equal(TURNKEY_MULTIPLIER_HIGH, 10);
  const small = estimateTurnkeyQuotes(917, 3241);
  const big = estimateTurnkeyQuotes(2600, 9100);
  // Bigger system → strictly higher quote band.
  assert.ok(small.quoteLo < big.quoteLo);
  assert.ok(small.quoteHi < big.quoteHi);
  assert.ok(small.quoteLo <= small.quoteHi);
  // Cheapest hardware × 10 → cheapest-market quote; premium hardware × 5 →
  // boutique end. (Rounded to $100.)
  assert.equal(small.quoteLo, 4600);
  assert.equal(small.quoteHi, 32400);
  // Quotes never fall below the honest hardware floor.
  assert.ok(small.quoteLo >= 917);
  assert.ok(big.quoteHi >= 9100);
  // Invalid inputs are rejected rather than producing nonsense.
  assert.equal(estimateTurnkeyQuotes(0, -5), null);
  assert.equal(estimateTurnkeyQuotes(NaN, 100), null);
  assert.equal(estimateTurnkeyQuotes(500, 100), null);
});

test("turnkey quote text mentions the computed band and savings, not a fixed number", () => {
  const money = (u) => "$" + Math.round(u).toLocaleString();
  const moneyRange = (lo, hi) => money(lo) + "–" + money(hi);
  const text = turnkeyQuoteText(
    { costLo: 917, costHi: 3241 },
    money,
    moneyRange,
  );
  assert.doesNotMatch(text, /\$20,000 to \$40,000/);
  assert.match(text, /\$4,600–\$32,400/);
  assert.match(text, /final hookup/);
  assert.match(text, /below a typical quote/);
  // Invalid inputs fall back to qualitative copy rather than crashing.
  const fallback = turnkeyQuoteText({}, money, moneyRange);
  assert.match(fallback, /several times the hardware price/);
});

test("tilt physics: flat-vs-optimal loss grows with latitude and stays sane", () => {
  // Near-equator: flat is nearly as good as tilted.
  const equator = tiltValueSummary(2);
  assert.ok(
    equator.flatLossPct <= 3,
    `equator flat loss ${equator.flatLossPct}%`,
  );
  // Mid-latitude (NYC-like): flat forfeits a substantial but moderate slice,
  // and the grid-search optimal tilt matches classic references (~40°).
  const nyc = tiltValueSummary(40.7);
  assert.ok(nyc.flatLossPct >= 12 && nyc.flatLossPct <= 25);
  assert.equal(nyc.optimalTilt, 40);
  const high = tiltValueSummary(60);
  assert.ok(high.flatLossPct >= 30);
  // Optimal tilt roughly tracks the classic rule of thumb at mid-latitudes.
  assert.ok(Math.abs(optimalTilt(35) - 35) <= 5);
  assert.ok(Math.abs(optimalTilt(50) - 45) <= 10);
});

test("tilt physics: monotonicity, determinism, and panel-equivalence", () => {
  // Yield at the optimal tilt beats flat and any over-steep mount.
  const lat = 45;
  const yOpt = annualYieldIndex(lat, optimalTilt(lat));
  assert.ok(yOpt > annualYieldIndex(lat, 0));
  assert.ok(yOpt > annualYieldIndex(lat, 90));
  // Deterministic — same input, same numbers, every run.
  assert.equal(
    JSON.stringify(tiltValueSummary(40.7)),
    JSON.stringify(tiltValueSummary(40.7)),
  );
  // Panel equivalence: a flat roof needs strictly more panels per 10 tilted.
  const s = tiltValueSummary(51.5);
  assert.ok(s.panelsFlatPerTenTilted >= 10);
  assert.ok(s.panelsFlatPerTenTilted <= 20);
  // ui.js wires the quantified tilt value into the orientation guide.
  const ui = fs.readFileSync(
    new URL("../assets/js/sizing/ui.js", import.meta.url),
    "utf8",
  );
  assert.match(ui, /tiltValueSummary\(/);
  assert.match(ui, /Value of the Right Angle/);
});
