import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildSimpleView } from "../assets/js/shared/simple-view.js";
import { LOCALES } from "../assets/js/shared/locales.js";

// One grid-tie auto entry, shaped exactly like run.js emits it.
const ENTRY = {
  solvable: true,
  pvKw: 6.6,
  battKwh: 13.4,
  battNameplateKwh: 15.9,
  costLo: 4200,
  costHi: 8100,
  cutPct: 80,
  paybackYearsLo: 4.2,
  paybackYearsHi: 6.1,
};

const FMT = {
  fmt: (n) => String(n),
  money: (n) => "$" + Math.round(n),
  moneyRange: (lo, hi) => "$" + lo + "-$" + hi,
  fmtPaybackRange: (lo) => lo + " years",
};

test("simple view: heroes carry the headline figures from the same entry", () => {
  const view = buildSimpleView({
    p: { mode: "gridtie" },
    entry: ENTRY,
    saved: 21000,
    fmt: FMT,
  });

  assert.ok(view.feasible);
  const byLabel = Object.fromEntries(view.heroes.map((h) => [h.label, h]));
  assert.equal(byLabel["Solar"].value, "6.6 kW");
  assert.equal(byLabel["Solar"].sub, "about 12 panels");
  assert.equal(byLabel["Battery"].value, "13.4 kWh usable");
  assert.equal(byLabel["Battery"].sub, "about 15.9 kWh installed");
  assert.equal(byLabel["First cost"].value, "~$4200-$8100");
  assert.equal(byLabel["What it does"].value, "cuts about 80% off your bill");
  assert.equal(byLabel["Saved over 20 years"].value, "~$21000");
  // Saved wins over payback — one honest 20-year number, not both.
  assert.equal(byLabel["Payback"], undefined);
});

// Battery-only: no panels, so nothing generates and nothing displaces imported
// energy. The entry still carries a number in cutPct, but it is the peak-hour
// offset fraction (run.js gridtieCutPct), NOT a bill cut — and the very same
// card reports "does not pay back in 20 years". Calling the number a bill cut
// put a savings claim next to its own contradiction.
const BATTERY_ONLY = {
  solvable: true,
  pvKw: 0,
  battKwh: 2,
  battNameplateKwh: 2.5,
  costLo: 161,
  costHi: 578,
  cutPct: 92,
  paybackYearsLo: null,
  paybackYearsHi: null,
  trueBreakEvenYear: null,
};

test("simple view: battery-only states the peak offset, never a bill cut", () => {
  const view = buildSimpleView({
    p: { mode: "gridtie" },
    entry: BATTERY_ONLY,
    saved: -1190,
    fmt: FMT,
  });

  assert.ok(view.feasible);
  const byLabel = Object.fromEntries(view.heroes.map((h) => [h.label, h]));
  assert.equal(
    byLabel["What it does"].value,
    "shifts about 92% of peak hours onto the battery — your bill is unchanged",
  );
  // The honest 20-year line must stay exactly as it is: the fix makes the
  // claim agree with this line rather than softening this line to match it.
  assert.equal(
    byLabel["Saved over 20 years"].value,
    "does not pay back in 20 years",
  );
  // Nothing on the card may promise a bill cut for a system with no generator.
  const flat = view.heroes
    .map((h) => h.value + " " + (h.sub || ""))
    .join(" | ");
  assert.ok(!/off your bill/.test(flat), flat);
  assert.ok(!/\bbill cut\b/.test(flat), flat);
});

test("simple view: the same entry WITH panels still reads as a bill cut", () => {
  const view = buildSimpleView({
    p: { mode: "gridtie" },
    entry: { ...BATTERY_ONLY, pvKw: 6.6 },
    saved: 21000,
    fmt: FMT,
  });
  const goal = view.heroes.find((h) => h.label === "What it does");
  assert.equal(goal.value, "cuts about 92% off your bill");
});

test("every real locale carries the battery-only goal and spend lines", () => {
  const ids = ["en", "es", "pt", "fr", "de", "ar"];
  assert.deepEqual(
    ids.filter((id) => LOCALES[id]),
    ids,
    "a real locale went missing",
  );
  for (const id of ids) {
    const L = LOCALES[id];
    assert.match(L.simpleGoalBattery, /\{pct\}/, `${id}: simpleGoalBattery`);
    assert.match(
      L.tariffSpendBattery,
      /\{tariff\}/,
      `${id}: tariffSpendBattery`,
    );
    assert.match(
      L.tariffSpendBattery,
      /\{annual\}/,
      `${id}: tariffSpendBattery`,
    );
    // The battery line must not promise a payback the panel denies.
    assert.ok(
      !/payback|repays|se paga|se rembourse|bezahlt/i.test(
        L.tariffSpendBattery,
      ),
      `${id}: tariffSpendBattery still promises a payback`,
    );
  }
});

test("simple view: off-grid goal line reads coverage, not bill-cut", () => {
  const view = buildSimpleView({
    p: { mode: "offgrid" },
    entry: { ...ENTRY, unmetHoursPerYear: 876 },
    saved: NaN,
    fmt: FMT,
  });
  const goal = view.heroes.find((h) => h.label === "What it does");
  assert.equal(goal.value, "90% of the year covered");
  // No tariff-comparable series in this fixture -> payback instead of saved.
  const payback = view.heroes.find((h) => h.label === "Payback");
  assert.equal(payback.value, "4.2 years");
});

test("simple view: infeasible or unsized entries produce nothing to render", () => {
  assert.deepEqual(
    buildSimpleView({ p: { mode: "gridtie" }, entry: null, fmt: FMT }),
    { feasible: false },
  );
  assert.deepEqual(
    buildSimpleView({
      p: { mode: "gridtie" },
      entry: { ...ENTRY, solvable: false },
      fmt: FMT,
    }),
    { feasible: false },
  );
});

test("simple view: never renders NaN or missing figures", () => {
  const view = buildSimpleView({
    p: { mode: "gridtie" },
    entry: {
      ...ENTRY,
      costLo: NaN,
      costHi: undefined,
      battKwh: 0,
      paybackYearsLo: null,
      paybackYearsHi: null,
    },
    saved: NaN,
    fmt: FMT,
  });
  const labels = view.heroes.map((h) => h.label);
  assert.ok(!labels.includes("First cost"));
  assert.ok(!labels.includes("Battery"));
  assert.ok(!labels.includes("Saved over 20 years"));
  assert.ok(!labels.includes("Payback"));
  for (const h of view.heroes) {
    assert.ok(!/NaN|undefined/.test(String(h.value)));
  }
});

// ── Completeness gate with teeth ─────────────────────────────────────────
// Every selector the Simple mode hides must (a) exist in index.html and
// (b) be covered by the scoped CSS rule. A selector that matches nothing is
// dead weight; a hidden block missing from the rule leaks technical detail.

// Charts (#frontierWrap, #socChartWrap, #cumCostChartWrap, #sunPathWrap) and
// the comparison matrix (#tierResults) deliberately stay VISIBLE in simple
// mode — visual understanding is the easy part, and the mode must not strip
// functionality. Only dense text/tables and duplicated figures hide.
const SIMPLE_HIDE_SELECTORS = [
  "#resultLadder",
  "#moneyBar",
  "#focusPanel",
  "#bomPanel",
  "#eli5CardWrap",
  "#eli5Summary",
  ".result-actions-row",
  "#modeToggleRow",
  "#fullControls",
  "#coordDetails",
];

function simpleCssText() {
  const css = fs.readFileSync("assets/site.css", "utf8");
  const start = css.indexOf('[data-display-mode="simple"]');
  assert.ok(start > 0, "simple-mode CSS block missing from site.css");
  const end = css.indexOf("}", css.indexOf("#coordDetails", start));
  return css.slice(start, end);
}

test("GATE: simple mode hides only real surfaces, and hides all of them", () => {
  const html = fs.readFileSync("index.html", "utf8");
  const css = simpleCssText();
  const declared = [];
  for (const sel of SIMPLE_HIDE_SELECTORS) {
    const idOrClass = sel.startsWith("#")
      ? `id="${sel.slice(1)}"`
      : `class="${sel.slice(1)}"`;
    assert.ok(
      html.includes(idOrClass),
      `${sel} is in the hide-list but nothing in index.html carries it — dead selector`,
    );
    assert.ok(
      css.includes(sel),
      `${sel} exists in the page but simple mode does not hide it — technical detail leak`,
    );
    declared.push(sel);
  }
  // The gate itself must have teeth: every selector in the CSS rule is one
  // we declared. A rule hiding something NOT in this list would silently
  // grow the hide surface without review (e.g. a chart, which must stay).
  const ruleSelectors = [...css.matchAll(/(?:^|,)\s*([^,{]+)\s*(?=,|{)/g)]
    .map((m) => m[1].trim())
    .map((s) => s.replace(/^\[data-display-mode="simple"\]\s*/, ""))
    .filter((s) => s.startsWith("#") || s.startsWith("."));
  for (const rs of ruleSelectors) {
    assert.ok(
      declared.includes(rs),
      `site.css hides "${rs}" in simple mode but it is not in the reviewed hide-list`,
    );
  }
});
