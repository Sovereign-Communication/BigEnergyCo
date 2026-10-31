// The sentence under the cumulative-cost canvas is the one place that explains
// what the two lines mean, so a wrong story there does the most damage. It told
// a battery-only run that the emerald line was "the solar system's own cost" and
// that the smaller bills were what is left "after solar" — a panel-free run
// described as a solar one, right beside a card reading "Solar array None". It
// also called a NEGATIVE 20-year gap "what the system puts back in your pocket"
// and then, one sentence later, said the system never pays for itself: the
// caption contradicting its own arithmetic, in every mode, not just battery-only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cumCostCaptionText, initCharts } from "../assets/js/sizing/charts.js";
import {
  cumulativeCostSeries,
  seriesBreakdown,
} from "../assets/js/sizing/money.js";
import { LOCALES } from "../assets/js/shared/locales.js";
import { interpolate, pickString } from "../assets/js/shared/interpolate.js";

// The caption reads the same injected boundary ui.js installs. English is the
// dictionary under test, so the assertions read the exact text a visitor gets
// rather than a key name. Money is deterministic here (no locale grouping) so a
// figure can be asserted literally.
const t = (key, params) =>
  interpolate(pickString(LOCALES.en, key), params || {});
const stubMoney = (usd) => {
  const n = Math.round(Math.abs(Number(usd) || 0));
  return `${Number(usd) < 0 ? "\u2212" : ""}$${n}`;
};
initCharts({
  $: () => null,
  el: () => ({ appendChild() {}, style: {} }),
  t,
  fmt: (n) => String(Math.round(Number(n) || 0)),
  money: stubMoney,
});

const HORIZON = 20;

/** A real series for a system that cuts nothing: a battery shifting peak hours. */
function noPanelSeries({ capexUsd = 2198, annualGridSpend = 3262 } = {}) {
  return cumulativeCostSeries({
    capexMidUsd: capexUsd,
    annualSavingsUsd: 0, // a battery alone displaces no imported energy
    residualAnnualUsd: annualGridSpend, // so the whole bill keeps coming
    swapsAndLaborTotalUsd: 0,
    replacements: 0,
    batteryLifeYears: HORIZON,
  });
}

/** A real series for a system that does cut the bill. */
function withPanelsSeries({
  capexUsd = 20000,
  annualSavingsUsd = 3000,
  residualAnnualUsd = 1000,
} = {}) {
  return cumulativeCostSeries({
    capexMidUsd: capexUsd,
    annualSavingsUsd,
    residualAnnualUsd,
    swapsAndLaborTotalUsd: 0,
    replacements: 0,
    batteryLifeYears: HORIZON,
  });
}

function caption(series, entry) {
  const bd = seriesBreakdown(series);
  const diff = series.grid.map((g, i) => g - series.solar[i]);
  let beIdx = -1;
  for (let i = 0; i < series.grid.length; i++) {
    if (series.grid[i] >= series.solar[i]) {
      beIdx = i;
      break;
    }
  }
  return {
    bd,
    diff,
    text: cumCostCaptionText({
      seriesEntry: entry,
      isBest: true,
      bd,
      beIdx,
      nY: HORIZON,
      grid: series.grid,
      solar: series.solar,
    }),
  };
}

test("a no-panel run's caption never says solar", () => {
  const { text } = caption(noPanelSeries(), { pvKw: 0, chemLabel: "LFP" });
  assert.doesNotMatch(
    text,
    /solar/i,
    `a panel-free caption must not name the sun: ${text}`,
  );
  assert.match(text, /The emerald line is the system's own cost/);
  // The locale strings carry no leading whitespace, so the sentences have to be
  // joined — appending them ran them together ("(~$65,237.00).The emerald…").
  assert.doesNotMatch(text, /\.\S/, `sentences ran together: ${text}`);
});

test("a negative 20-year gap is stated as a cost, never as pocket money", () => {
  const { bd, text } = caption(noPanelSeries(), {
    pvKw: 0,
    chemLabel: "LFP",
  });
  assert.ok(bd.saved < 0, `fixture really has a negative gap (${bd.saved})`);
  // The magnitude, with NO minus sign: it is the amount the system costs more.
  assert.match(
    text,
    new RegExp(`costs about \\$\\d+ MORE than staying on the grid`, "i"),
    text,
  );
  assert.equal(
    text.includes(stubMoney(bd.saved)),
    false,
    "the signed gap must not be printed as a saving figure",
  );
  assert.doesNotMatch(text, /puts [^.]*back in your pocket/i);
  // ...and it must not fight the sentence that follows it either.
  assert.match(text, /it does not pay for itself here/i);
});

test("the same series WITH panels keeps the solar wording and the saving", () => {
  const { bd, text } = caption(withPanelsSeries(), {
    pvKw: 8,
    chemLabel: "LFP",
  });
  assert.ok(bd.saved > 0, `fixture really has a positive gap (${bd.saved})`);
  assert.match(text, /The emerald line is the solar system's own cost/);
  assert.match(text, /smaller bills that remain after solar/);
  assert.match(text, new RegExp(`puts \\$${Math.round(bd.saved)} back`), text);
  assert.doesNotMatch(text, /MORE than staying on the grid/);
});

test("a no-panel run that did save describes the stack without the sun", () => {
  const series = noPanelSeries();
  // Force the positive-gap branch with a genuinely positive series so the
  // no-panel stack wording is exercised on its own.
  const bd = { ...seriesBreakdown(series), saved: 1200, residualBills: 400 };
  const text = cumCostCaptionText({
    seriesEntry: { pvKw: 0, chemLabel: "LFP" },
    bd,
    beIdx: 4,
    nY: HORIZON,
    grid: series.grid,
    solar: series.solar,
  });
  assert.match(text, /the smaller bills that remain \(~\$400\)/);
  assert.doesNotMatch(text, /after solar/i);
  assert.doesNotMatch(text, /solar/i, text);
});

test("a curve that crosses and falls back claims neither repayment nor impossibility", () => {
  const series = noPanelSeries();
  // beIdx >= 0 while the 20-year gap is still negative: a late bank swap pushed
  // the solar line back above the grid line after the curve had crossed it.
  // "repaid its cost by year N" would deny the loss and "never repays its cost"
  // would deny the crossing, so neither may appear.
  const bd = { ...seriesBreakdown(series), saved: -750 };
  const text = cumCostCaptionText({
    seriesEntry: { pvKw: 8, chemLabel: "LFP" },
    bd,
    beIdx: 4,
    nY: HORIZON,
    grid: series.grid,
    solar: series.solar,
  });
  assert.match(text, /MORE than staying on the grid/i);
  assert.doesNotMatch(text, /has repaid its cost/i, text);
  assert.doesNotMatch(text, /never repays its cost/i, text);
});

test("every locale carries the caption, and the no-panel variants name no sun", () => {
  const ids = ["en", "es", "pt", "fr", "de", "ar"];
  const keys = [
    "cumCostRecommended",
    "cumCostSelected",
    "cumCostCaptionHead",
    "cumCostCaptionOwnCost",
    "cumCostCaptionOwnCostNoPanels",
    "cumCostCaptionStack",
    "cumCostCaptionStackNoPanels",
    "cumCostCaptionNetNegative",
    "cumCostCaptionRepaid",
    "cumCostCaptionNeverRepays",
    "cumCostCaptionResidual",
    "cumCostCaptionResidualCreditDraw",
    "cumCostCaptionResidualCreditBill",
    "cumCostCaptionSurplusCredit",
  ];
  const sun = {
    en: /solar/i,
    es: /solar/i,
    pt: /solar/i,
    fr: /solaire/i,
    de: /solar/i,
    ar: /الشمس/,
  };
  for (const id of ids) {
    const L = LOCALES[id];
    assert.ok(L, `${id}: dictionary missing`);
    for (const k of keys) {
      assert.equal(typeof L[k], "string", `${id}: ${k}`);
      // The two adjective keys are single words; the sentences are not.
      const floor = /^cumCost(Recommended|Selected)$/.test(k) ? 5 : 15;
      assert.ok(L[k].trim().length > floor, `${id}: ${k} looks empty`);
    }
    for (const k of [
      "cumCostCaptionOwnCostNoPanels",
      "cumCostCaptionStackNoPanels",
    ]) {
      assert.ok(!sun[id].test(L[k]), `${id}: ${k} still names the sun`);
    }
    // The honest branch must always show the magnitude it is talking about.
    assert.match(
      L.cumCostCaptionNetNegative,
      /\{loss\}/,
      `${id}: net-negative lost its figure`,
    );
  }
});
