// Use-case playtest gate. Run: node scripts/check-usecases.mjs
//
// The usecases facet asks a question that a static scan cannot answer:
// "does ONE unified flow offer cutting the bill, time-of-use battery-only
// savings, essential-load backup in an outage, an emergency reserve held
// inside the battery, full off-grid independence and portable or mobile
// power, EACH WITH ITS OWN OUTCOME METRIC AND ITS OWN HONEST VERDICT when the
// numbers do not work?"
//
// The facet disqualifies a use case that is named only in copy, and one that
// shares another use case's metric. Those are exactly the two failures that
// shipped before this file existed — backup existed as a sentence about a
// generator, and time-of-use existed as a hardware dropdown reporting the same
// bill cut as bill-cut. So the gate has six clauses, and the last two are the
// ones that catch a regression nobody would notice by reading:
//
//   1. six cases, declared once, in one registry
//   2. six DISTINCT outcome metric ids  ("shares another's metric" fails)
//   3. every declared input control EXISTS in the shipped markup
//      ("named only in copy" fails)
//   4. every case can return "not-here" with a reason — a verdict that cannot
//      say no is not a verdict
//   5. every case, walked through the REAL engine on a committed offline
//      weather profile, returns a measured number and a verdict
//   6. the legacy mode/hardware pair is DERIVED from the case and never
//      exposed to the visitor
//   7. every verdict reason key the six cases can emit is TRANSLATED in all
//      six locales — a key with no dictionary entry renders the raw name
//      to a visitor, and no i18n rule sees it, because a key that exists in
//      shipped code counts as rendered there
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { deployedFiles } from "./lib/gates.mjs";
import { synthesizeFromProfile } from "../assets/js/sizing/nasa.js";
import {
  OFFLINE_PROFILES,
  PROFILE_YEAR,
} from "../assets/js/sizing/profiles.js";

const ROOT = resolve(
  new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
);
let failures = 0;
const ok = (m) => console.log(`OK   ${m}`);
const fail = (m) => {
  failures += 1;
  console.error(`FAIL ${m}`);
};

const import_ = (rel) => import(pathToFileURL(join(ROOT, rel)).href);
const { runSizing } = await import_("assets/js/sizing/run.js");
const UC = await import_("assets/js/sizing/usecases.js");

// D-16, verbatim. If the registry and this list ever disagree, the registry
// is wrong: the plan is hash-pinned and is the only authority on what the six
// are.
const D16 = [
  "cutting the bill",
  "time-of-use battery-only savings",
  "essential-load backup in an outage",
  "an emergency reserve held inside the battery",
  "full off-grid independence",
  "portable or mobile power",
];

// ── 1. the six, declared once ───────────────────────────────────────────────
if (UC.USE_CASE_IDS.length !== 6)
  fail(
    `the registry declares ${UC.USE_CASE_IDS.length} use cases, D-16 names 6`,
  );
else ok("the registry declares exactly D-16's six use cases, in one place");

// ── 2. distinct outcome metrics ─────────────────────────────────────────────
// This is the facet's "one that shares another use case's metric is not
// separately evidenced", turned into a build failure. Backup reporting a bill
// cut was the shipped state of the world; this clause is what stops it
// returning.
const ids = UC.metricIds();
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length)
  fail(`two use cases share an outcome metric: ${dupes.join(", ")}`);
else ok(`all six report their own metric: ${ids.join(", ")}`);

// ── 3. every declared control exists in the shipped markup ──────────────────
const shipped = deployedFiles();
const indexHtml = readFileSync(join(ROOT, "index.html"), "utf8");
const missingControls = [];
for (const id of UC.USE_CASE_IDS)
  for (const input of UC.inputsFor(id))
    if (!new RegExp(`id="${input.control}"`).test(indexHtml))
      missingControls.push(`${id}:${input.control}`);
if (missingControls.length)
  fail(
    `use cases declare controls the page does not render (named in copy only): ${missingControls.join(", ")}`,
  );
else
  ok(
    `all ${UC.declaredControls().length} declared input controls exist in the shipped page`,
  );

// Every use case must also be selectable: a case with no <option> is a case
// the visitor cannot choose, which is the same failure wearing a different hat.
const unselectable = UC.USE_CASE_IDS.filter(
  (id) => !new RegExp(`<option value="${id}"`).test(indexHtml),
);
if (unselectable.length)
  fail(`use cases with no option in the chooser: ${unselectable.join(", ")}`);
else ok("all six are options in the one chooser (index.html)");

// ── 4. every case can say no ───────────────────────────────────────────────
// A verdict function that always returns "works" is a caption. Each case is
// probed with an empty measurement and with one that fails, and must answer
// "not-here" for the former.
const silentCases = UC.USE_CASE_IDS.filter((id) => {
  const c = UC.USE_CASES[id];
  return c.verdict({}).status !== "not-here";
});
if (silentCases.length)
  fail(
    `use cases that cannot report "not-here" on an unmeasured run: ${silentCases.join(", ")}`,
  );
else ok("all six can report an honest 'not-here' with no measurement at all");

// The reserve is the case that most easily reports a free lunch: if the sized
// system carries no battery there is nothing to reserve, and saying so is the
// only honest answer.
{
  const v = UC.USE_CASES.reserve.verdict({
    battKwh: 0,
    reserveSavingsLostPct: 0,
  });
  if (v.status !== "not-here" || v.reasonKey !== "verdictReserveNoBattery")
    fail(
      `the reserve case does not refuse a system with no battery (got ${JSON.stringify(v)})`,
    );
  else ok("the reserve case refuses a system with no battery to reserve in");
}

// ── 5. walk all six through the REAL engine ─────────────────────────────────
// Nothing here is a fixture of the registry's own making: every number comes
// from runSizing() over a committed offline weather profile, through the same
// engine the page runs.
const site = OFFLINE_PROFILES.find((p) => p.name.includes("Honolulu"));
const fakeWeather = async () => ({
  hours: synthesizeFromProfile(site),
  meta: {
    latitude: site.lat,
    longitude: site.lon,
    startYear: PROFILE_YEAR,
    endYear: PROFILE_YEAR,
    years: 1,
    source: "offline profile (gate)",
    offline: false,
  },
});

// Answers the visitor could plausibly give. Deliberately unremarkable: the
// point is not to make any case pass, it is to see which ones cannot.
const INPUTS = {
  latitude: site.lat,
  longitude: site.lon,
  dailyKwh: 20,
  tariff: 0.42,
  exportRate: 0.1,
  years: 1,
  chemistry: "lfp",
  reservePct: 0.2,
  outageTargetHours: 8,
  essentialKwh: 1.2,
  backupSolarRecharge: true,
  touPeakRate: 0.42 * 1.6,
  touOffPeakRate: 0.42 * 0.55,
  portableDeviceKwh: 2.4,
  portableBankKwh: 3,
  portablePvW: 200,
  portableShorePower: false,
};

const STATUSES = new Set(["works", "partial", "not-here"]);
const walk = [];
for (const id of UC.USE_CASE_IDS) {
  let p;
  try {
    p = await runSizing(
      { ...INPUTS, useCase: id },
      { fetchWeather: fakeWeather },
    );
  } catch (err) {
    fail(`use case ${id} threw through the real engine: ${err.message}`);
    continue;
  }
  const o = p.useCaseOutcome;
  if (!o) {
    fail(`use case ${id} produced no outcome`);
    continue;
  }
  if (o.metricId !== UC.USE_CASES[id].metric.id)
    fail(
      `use case ${id} reported ${o.metricId}, not its declared metric ${UC.USE_CASES[id].metric.id}`,
    );
  if (!STATUSES.has(o.status))
    fail(`use case ${id} returned an unknown status ${o.status}`);
  if (!o.reasonKey) fail(`use case ${id} returned no verdict reason`);
  if (o.measured === false)
    fail(
      `use case ${id} could not be measured at all on a solvable site — the registry promises an offer`,
    );
  // The hourly context must never ride out with the payload.
  if (JSON.stringify(Object.keys(p)).includes("__useCaseContext"))
    fail(`use case ${id} left its hourly context on the payload`);

  const asked = UC.inputsFor(id).map((i) => i.control);
  walk.push({
    id,
    legacy: UC.deriveLegacy(id),
    loads: UC.loadsFor(id),
    asked,
    metric: o.metricId,
    value: o.value,
    status: o.status,
    verdict: o.reasonKey,
  });
  ok(
    `${id}: asked ${asked.join(", ")} → ${o.metricId} = ${JSON.stringify(o.value)} → ${o.status} (${o.reasonKey})`,
  );
}

if (walk.length === 6) {
  // At least one case must be able to answer "no" on an unremarkable site.
  // If every case says yes, the verdicts are decoration.
  const honest = walk.filter((w) => w.status !== "works");
  if (!honest.length)
    fail(
      "every use case answered 'works' on the probe site — no verdict is discriminating",
    );
  else
    ok(
      `${honest.length} of 6 use cases declined on the probe site: ${honest.map((w) => w.id).join(", ")}`,
    );
}

// ── 6. the legacy pair is derived, never shown ──────────────────────────────
// F-17: three overlapping vocabularies for one choice. The pair may still exist
// in the DOM (every downstream listener hangs off it) but the visitor must
// never see it.
{
  // "Hidden" means either mechanism: the `hidden` attribute or an inline
  // display:none. Accepting only one of them would make this clause a test
  // of my own markup style rather than of the visitor's experience.
  const isHidden = (id) => {
    const m = indexHtml.match(new RegExp(`id="${id}"[\\s\\S]{0,300}`));
    if (!m) return true; // absent from the page entirely: also not visible
    return /\bhidden\b/.test(m[0]) || /display:\s*none/.test(m[0]);
  };
  const leaks = ["systemGoalRow", "hardwareConfigRow"].filter(
    (id) => !isHidden(id),
  );
  if (leaks.length)
    fail(
      `the legacy goal/hardware controls are still visible: ${leaks.join(", ")}`,
    );
  else
    ok(
      "the legacy goal/hardware selects are derived and hidden from the visitor",
    );

  const ui = readFileSync(join(ROOT, "assets/js/sizing/ui.js"), "utf8");
  if (!/deriveLegacy\(/.test(ui))
    fail("ui.js never calls deriveLegacy — the chooser is not the owner");
  else ok("ui.js derives the legacy pair from the use case, in one place");

  // Every one of the six must reach a distinct pair or at least a declared
  // one; a case with no declaration would silently fall back to bill-cut.
  const undeclared = UC.USE_CASE_IDS.filter((id) => !UC.USE_CASES[id].legacy);
  if (undeclared.length)
    fail(
      `use cases with no declared legacy derivation: ${undeclared.join(", ")}`,
    );
  else ok("all six declare how they reach the engine's enum pair");
}

// ── 7. every verdict reason key is translated ───────────────────────────────
// usecases.js owns the keys its verdicts emit; a visitor sees one of them the
// moment a case declines. A key added there without a dictionary entry falls
// back to English silently (the right product behavior, and the reason the
// gap is invisible), so the list owner and the six dictionaries are compared
// here rather than trusted to stay in step.
{
  const { LOCALES } = await import_("assets/js/shared/locales.js");
  const keys = UC.verdictKeys();
  const missing = [];
  for (const [lang, dict] of Object.entries(LOCALES))
    for (const key of keys)
      if (typeof dict[key] !== "string" || !dict[key].trim())
        missing.push(`${lang}.${key}`);
  if (missing.length)
    fail(`verdict reason key(s) with no translation: ${missing.join(", ")}`);
  else
    ok(
      `${keys.length} verdict reason keys are translated in all ` +
        `${Object.keys(LOCALES).length} locales`,
    );
}

// ── the record the facet is judged on ───────────────────────────────────────
// Printed so a human can paste the real walk into the evidence line instead
// of describing it.
console.log("\nuse-case walk (probe site: Honolulu, 1 committed weather year)");
for (const w of walk) {
  console.log(
    `  ${w.id.padEnd(9)} legacy=${w.legacy.mode}/${w.legacy.hardwareConfig ?? "none"} loads=${w.loads.padEnd(10)} metric=${w.metric}=${JSON.stringify(w.value)} verdict=${w.status}:${w.verdict}`,
  );
}

void shipped;
if (failures) {
  console.error(`\nUSECASES FAIL (${failures})`);
  process.exit(1);
}
console.log("\nUSECASES OK");
