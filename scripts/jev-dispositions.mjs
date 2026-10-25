#!/usr/bin/env node
// Disposition layer over the owner-authorized battery re-run (#197 fail-closed,
// #201 test gaps).
//
// WHY: the tracker guardrail forbids inventing ranks or queues; the re-run
// supplies them (scripts/jev-battery-rerun.mjs). This script turns those
// queues into a PER-FUNCTION disposition record, the artifact the CARs'
// acceptance asks for: every function lands in exactly one of
// "hardened-with-test" (added by hand, then re-listed here), "fail-open-by-design"
// (with a specific, evidence-cited reason), "hard-to-test" (with reason), or
// "needs-human-look" (with a specific product-intent question). Nothing is
// softened: anything the evidence does not cover stays visibly open.
//
//   node scripts/jev-dispositions.mjs [--root DIR] [--data DIR] [--out DIR]
//
// Deterministic and offline. Reasons cite code facts (matched line + number),
// never vibes: a reason is only as good as the evidence behind it.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SILENT = new Set([
  "silent-wrong-output",
  "stale-data-shown",
  "security-bypass",
  "lost-user-action",
]);
const TOOLING = /^(tests|scripts)\//;
const PROD = /^(assets\/js|worker)\//;
// Data-carrying scripts: their OUTPUT ships as product data (heatmap sets,
// city pages), so a silent arithmetic bug here becomes a wrong number shown to
// a visitor. They do NOT get the tooling exemption.
const DATA_CARRYING = /^scripts\/(build|generate)-/;

// ── CSV (de)serialization ─────────────────────────────────────────────────

export function parseCsv(text) {
  const [head, ...lines] = text.trim().split("\n");
  const H = splitCsvLine(head);
  return lines.map((l) => {
    const cells = splitCsvLine(l);
    const o = {};
    H.forEach((k, i) => (o[k] = cells[i] ?? ""));
    return o;
  });
}
export function splitCsvLine(line) {
  const cells = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      cells.push(cur);
      cur = "";
    } else cur += c;
  }
  cells.push(cur);
  return cells;
}
export function toCsv(header, rows) {
  const cell = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return (
    header.join(",") +
    "\n" +
    rows.map((r) => r.map(cell).join(",")).join("\n") +
    "\n"
  );
}

// ── code facts (the evidence behind each reason) ───────────────────────────

const SIGNAL_PATTERNS = [
  [/\bthrow\b/, "throws"],
  [/return\s+null\b/, "returns null sentinel"],
  [/return\s+undefined\b/, "returns undefined sentinel"],
  [/return\s+\{\s*error\b/, "returns explicit error object"],
  [/return\s+false\b/, "returns false sentinel"],
];
const MARKER_WORDS =
  /fallback|degrad|estimate|estimated|assum|approx|rough|placeholder|stale|cached|by design|best[- ]effort|≈|~/i;
const ASSUMPTION_WORDS = /assum|by design|fallback|estimate|approx|placeholder|best[- ]effort/i;

export function codeFacts(body) {
  const facts = [];
  for (const [re, label] of SIGNAL_PATTERNS) {
    const m = re.exec(body);
    if (m) facts.push({ kind: "signals", label, at: lineOf(body, m.index) });
  }
  const hasFallback =
    /\|\|\s*(?:[0-9"'`{[]|[A-Za-z_$][\w$]*\s*[;,)})\]])|\?\?\s*(?:[0-9"'`{[]|[A-Za-z_$])|= \[\]|= \{\}/.test(
      body,
    ) || /function\s*\w*\s*\([^)]*=\s*[^,)]+/.test(body);
  if (hasFallback) {
    facts.push({
      kind: "fallback",
      label: "default/||/?? fallback present",
      at: lineOf(body, body.search(/\|\||\?\?|=\s*\[\]|=\s*\{\}/)),
    });
    if (MARKER_WORDS.test(body))
      facts.push({
        kind: "marked",
        label: "degradation labeled in code (fallback/estimate/assumption wording)",
        at: lineOf(body, body.search(MARKER_WORDS)),
      });
    if (ASSUMPTION_WORDS.test(body))
      facts.push({
        kind: "documents-assumption",
        label: "comment names the assumption or fallback",
        at: lineOf(body, body.search(ASSUMPTION_WORDS)),
      });
  }
  return facts;
}
function lineOf(text, index) {
  if (index < 0) return 0;
  return text.slice(0, index).split("\n").length;
}

// ── the disposition rule ───────────────────────────────────────────────────

const QUESTIONS = {
  "silent-wrong-output": (r) =>
    `Should ${r.name} (${r.file}:${r.line}) show an explicit unknown/degraded state instead of returning a plausible value when its input is missing — would the product rather render nothing than an estimate here?`,
  "stale-data-shown": (r) =>
    `When ${r.name} (${r.file}:${r.line}) falls back to stale data, must the UI label the result as stale — and is any such label already the product's design?`,
  "security-bypass": (r) =>
    `Is ${r.name} (${r.file}:${r.line}) on a trust boundary where skipping the check can leak or accept something — or is it test/tooling glue that never sees real tokens?`,
  "lost-user-action": (r) =>
    `Is silently dropping the action in ${r.name} (${r.file}:${r.line}) acceptable product behavior, or must the user be told their input was not saved?`,
  "ui-crash-freeze": (r) =>
    `If ${r.name} (${r.file}:${r.line}) fails open mid-flow, is a frozen surface acceptable here, or must the flow degrade to a marked state?`,
};

/**
 * @returns {{bucket:string, reason:string, evidence:string, question:string}}
 */
export function dispositionFailOpen(row, facts, alreadyHardened) {
  const r = row;
  const bl = Number(r.blast_radius);
  const fc = Number(r.fail_closed);
  const evidence = facts
    .map((f) => `${f.label} (line ${f.at})`)
    .join("; ");
  if (alreadyHardened) {
    return {
      bucket: "hardened-with-test",
      reason: "harden + regression test added in this pass; see the linked test",
      evidence: evidence || "hardened in this pass",
      question: "",
    };
  }
  if (TOOLING.test(r.file) && !DATA_CARRYING.test(r.file)) {
    return {
      bucket: "fail-open-by-design",
      reason: `tooling surface (${r.file.split("/")[0]}): a fail-open here cannot reach a user-facing number; worst case is a mislabeled CI/smoke result, which the gates' own fail-closed checks re-verify`,
      evidence: evidence || "file is tooling",
      question: "",
    };
  }
  const signals = facts.find((f) => f.kind === "signals");
  if (signals) {
    return {
      bucket: "fail-open-by-design",
      reason: `signals failure explicitly in fact (${signals.label}); the fail-open reading is not supported by the code path the battery sampled`,
      evidence,
      question: "",
    };
  }
  const marked = facts.find((f) => f.kind === "marked");
  if (marked && !SILENT.has(r.failure_mode)) {
    return {
      bucket: "fail-open-by-design",
      reason: `degradation is marked at the source (${marked.label}); the product's convention is to label assumptions where they are made`,
      evidence,
      question: "",
    };
  }
  if (!SILENT.has(r.failure_mode) && Number.isFinite(bl) && bl < 2.8) {
    return {
      bucket: "fail-open-by-design",
      reason: `failure is loud or bounded: mode ${r.failure_mode}, blast ${bl} (< 2.8) reaches at most one surface and never presents a wrong number as fact`,
      evidence: evidence || `blast ${bl}`,
      question: "",
    };
  }
  if (marked && SILENT.has(r.failure_mode) && Number.isFinite(bl) && bl < 2.6) {
    return {
      bucket: "fail-open-by-design",
      reason: `degradation is marked at the source (${marked.label}) and blast ${bl} is below the fact-presentation band; the fallback is an estimate the code labels as one`,
      evidence,
      question: "",
    };
  }
  return {
    bucket: "needs-human-look",
    reason: `fail-open can present result as fact (mode ${r.failure_mode}, blast ${bl}, fail-closed ${fc}); no code evidence of marking or signaling`,
    evidence: evidence || "no mitigating code fact found",
    question: (QUESTIONS[r.failure_mode] || QUESTIONS["silent-wrong-output"])(r),
  };
}

export function dispositionTestGap(row, ctx = {}) {
  const r = row;
  const prio = Number(r.test_priority);
  const mod = r.file;
  const transitive =
    (ctx.testedModules || new Set()).has(mod) ||
    (ctx.slicedModules || new Set()).has(mod);  if (r.test_coverage !== "none") {
    return {
      bucket: "dispositioned",
      reason: `already exercised: coverage judged ${r.test_coverage} (strategy ${r.strategy})`,
    };
  }
  if (r.strategy === "none-needed") {
    return {
      bucket: "dispositioned",
      reason: "judge returns none-needed: the function does not warrant its own tests",
    };
  }
  if (transitive && !ctx.exported) {
    // Project precedent (tests/audit-car6-integration.test.mjs): a private
    // helper that a directly-tested public entry point exercises on every call
    // is not unverified; re-entering it through another name adds a count, not
    // a signal. Exported functions do NOT get this: if it is part of a
    // module's public surface and no test names it, that is a real gap.
    return {
      bucket: "covered-transitively",
      reason: `private helper in ${mod}, inside the call tree of the exported entry points that ${ctx.moduleTests ? ctx.moduleTests.join(", ") : "the tests"} exercise directly; a second test re-entering the same call tree adds a count, not a signal`,
    };
  }
  if (Number.isFinite(prio) && prio >= 2.0) {
    // NOT "tested": no test exists until tested.json (the manifest this script
    // reads) records one. A bucket that claims tests it never wrote is exactly
    // the kind of soft lie this program is closing.
    return {
      bucket: "needs-test",
      reason: `priority ${prio} >= 2.0: test owed in this pass (flipped to tested only by tested.json)`,
    };
  }
  if (TOOLING.test(r.file) && !DATA_CARRYING.test(r.file)) {
    return {
      bucket: "dispositioned",
      reason: `tooling (${r.file.split("/")[0]}): exercised by the gates that run it; priority ${prio} below the add-tests band`,
    };
  }
  return {
    bucket: "needs-human-look",
    reason: `untested at priority ${prio} (strategy ${r.strategy}); needs a call on whether this warrants its own suite or coverage via its flow`,
  };
}

// ── lane review (2026-10-25) ──────────────────────────────────────────────
//
// Per the CARs' own calibration, judge verdicts below 0.95 are "ranked
// suspects, not work orders" and need lane review against the code before any
// disposition is final. These entries ARE that review: each was decided by
// reading the site in context (body plus the comment that documents its
// intent), against the CARs' single question — can this fallback present a
// wrong result as fact? Keys are `file name` as the battery recorded them.
// A decision here overrides the mechanical rule; the reason travels with the
// row so the record shows what was checked, not just what was concluded.
//
// `question` survives on the watch items: verdicts whose fallback is safe but
// whose product intent the owner may still want to confirm.
function evidenceFor(facts) {
  return facts.map((f) => `${f.label} (line ${f.at})`).join("; ");
}

const LANE = {
  failOpen: {
    "assets/js/sizing/ui.js refreshFxRates": {
      bucket: "fail-open-by-design",
      reason: "lane review: bounded fetch with a documented 10s timeout (comment at site); on failure the applied FX rate stays the one shown in the fxRate input, so the displayed rate and the conversion agree — there is no hidden stale value",
      question: "watch item: FX rates age silently until the next refresh — should a stale-rate badge appear after some age?",
    },
    "assets/js/sizing/ui.js fixedDisplay": {
      bucket: "fail-open-by-design",
      reason: "lane review: getFixedCharge returns null for blank because the fixed charge is 'a number only the visitor knows — never auto-estimated' (comment at site); blank renders 0 = 'no fixed charge', pinned by tests/audit-car6-integration.test.mjs (fixedCharge ?? 0)",
    },
    "assets/js/sizing/ui.js readInputs": {
      bucket: "fail-open-by-design",
      reason: "lane review: the boundary is executed directly by tests/audit-car6-integration.test.mjs, which asserts the display-currency conversions; the fail-open reading is the same call tree those tests drive",
    },
    "assets/js/sizing/paths.js systemForPaths": {
      bucket: "fail-open-by-design",
      reason: "lane review: num() propagates null for non-finite input (honest unknown, no fabricated figure); covered through priceAllPaths — tests/audit-car6-integration.test.mjs records this exact decision for the paths call tree",
    },
    "assets/js/sizing/paths.js normaliseSystem": {
      bucket: "fail-open-by-design",
      reason: "lane review: input normalisation with explicit neutral defaults (0 = component absent) clamped to >= 0; reached only from purchasePaths, which refuses to price unsolvable systems (guard pinned in tests/audit-rerun-dispositions.test.mjs)",
    },
    "assets/js/sizing/paths.js priceOne": {
      bucket: "fail-open-by-design",
      reason: "lane review: covered through priceAllPaths (tests/audit-car6-integration.test.mjs records the decision); its inputs are static registry bands (bandMid of the REGIONS tables), not user data",
    },
    "assets/js/sizing/paths.js addOwnerRecurring": {
      bucket: "fail-open-by-design",
      reason: "lane review: every term is a static registry band (bandMid of REGIONS); there is no user-data fallback path that could fabricate a figure",
    },
    "assets/js/sizing/frontier.js battLadder": {
      bucket: "fail-open-by-design",
      reason: "lane review: degenerate bounds clamp to a minimal ladder; a NaN bound yields an unsolvable ladder and the frontier renders its honest empty state — no number is fabricated",
    },
    "assets/js/sizing/paths.js addTo": {
      bucket: "fail-open-by-design",
      reason: "lane review: bounded index guard — out-of-range or zero amounts are deliberately ignored after the bounds check, not coerced",
    },
    "assets/js/sizing/ui.js setCurrency": {
      bucket: "fail-open-by-design",
      reason: "lane review: an unknown currency code is refused before any partial application (if (!cur) return), leaving the previous valid currency intact",
    },
    "assets/js/sizing/ui.js resolveRegionCountry": {
      bucket: "fail-open-by-design",
      reason: "lane review: nearest-city estimate within 80 km only; it feeds applyEstimatedTariff, which is gated on tariffTouched and never overwrites the visitor's own rate",
    },
    "assets/js/chat.js buildIntakeBrief": {
      bucket: "fail-open-by-design",
      reason: "lane review: advisory surface (D-21 showcase chat, which disclaims engineering advice); the brief is rebuilt from the live DOM on every send — missing fields shorten it, they never fabricate values",
    },
    "assets/js/sizing/ui.js usesImperialUnits": {
      bucket: "fail-open-by-design",
      reason: "lane review: display-units probe; non-finite coordinates fall back to the metric default. Only the unit label changes, never the underlying number",
    },
    "assets/js/sizing/run.js measureUseCase": {
      bucket: "fail-open-by-design",
      reason: "lane review: the measurement context is optional by design (__useCaseContext, deliberately non-enumerable); missing context yields the documented 'not measured' state (useCaseNotMeasured copy), not a fabricated measurement",
    },
    "assets/js/sizing/tilt-harvest.js deg2rad": {
      bucket: "fail-open-by-design",
      reason: "lane review: pure arithmetic identity; the body contains no fallback to fail open through",
    },
    "assets/js/sizing/ui.js applyEstimatedTariff": {
      bucket: "fail-open-by-design",
      reason: "lane review: gated on tariffTouched — an estimate is only ever pre-filled into an untouched control, the product's documented 'never auto-estimated over user input' convention",
    },
    "assets/js/sizing/paths.js incentiveValue": {
      bucket: "fail-open-by-design",
      reason: "lane review: a missing entries list means no incentives (the empty sum, 0); entries are static registry data, not user input",
    },
    "assets/js/sizing/pricing.js fullRange": {
      bucket: "fail-open-by-design",
      reason: "lane review: the 'lfp' default is the product's own default chemistry (the select's default); inputs are engine-derived",
    },
    "assets/js/sizing/paths.js leaseSchedule": {
      bucket: "fail-open-by-design",
      reason: "lane review: instrument is a two-value control (ppa|lease) and both schedules are pinned by the paths/quote tests; the PPA fallback can only fire if the registry is extended without updating LEASE_TERMS",
      question: "watch item: a future third instrument would silently price as a PPA — worth an explicit throw when the map is extended?",
    },
    "assets/js/sizing/ui.js setupBudgetSlider": {
      bucket: "fail-open-by-design",
      reason: "lane review: wiring guard (if (!slider) return) — with no control there is no handler to lose an action in",
    },
    "assets/js/sizing/chem-model.js capacityScaleFor": {
      bucket: "fail-open-by-design",
      reason: "lane review: unknown chemistry maps to the neutral scale 1 (no capacity inflation); chemistry comes from the bounded select",
    },
    "assets/js/sizing/ui.js applianceState": {
      bucket: "fail-open-by-design",
      reason: "lane review: double-gated per row (row validity gate + accumulation finiteness gate) — invalid rows are skipped, never summed as 0-and-counted; the surge=running-watts fallback applies only to rows with no surge spec (the physical minimum). Pinned by tests/audit-car6-integration.test.mjs and tests/issue196-input-validation.test.mjs",
    },
    "assets/js/sizing/chem-model.js cycleLifeForDoD": {
      bucket: "fail-open-by-design",
      reason: "lane review: bounded chemistry enum; the 4000-cycle default is the same class of modeling constant the curve table itself holds",
      question: "watch item: an unknown chemistry silently degrades to the default 4000-cycle curve — acceptable, or should the engine refuse unknown chemistries?",
    },
    "assets/js/sizing/ui.js applyAppliancePreset": {
      bucket: "fail-open-by-design",
      reason: "lane review: preset application is guarded per control; a missing control is skipped whole, so no partial preset is ever applied",
    },
    "assets/js/sizing/engine.js runDischarge": {
      bucket: "fail-open-by-design",
      reason: "lane review: covered through simulate — tests/audit-car6-integration.test.mjs records the decision that this private loop is reached via the tested public entry points",
    },
    "assets/js/sizing/budget-span.js blendEntries": {
      bucket: "fail-open-by-design",
      reason: "lane review: the interpolation fallback is documented at the site ('carry the pair's interpolated size onto the nearer entry's numbers')",
    },
    "assets/js/sizing/engine.js clampReserveFloor": {
      bucket: "fail-open-by-design",
      reason: "lane review: explicit clamp to [0, 0.9] — invalid input maps to the neutral floor 0, never a fabricated reserve",
    },
    "assets/js/sizing/budget-span.js project": {
      bucket: "fail-open-by-design",
      reason: "lane review: lerp with documented reporting precision ('2 decimals = the precision the engine itself reports'); a missing side falls back to the other endpoint, not to a guess",
    },
    "assets/js/sizing/money.js swapSchedule": {
      bucket: "fail-open-by-design",
      reason: "lane review: no replacement data means no replacement cost — the neutral direction that cannot invent a phantom cost; destructuring defaults validate the rest",
    },
    "worker/jev-price.mjs jevCostUsd": {
      bucket: "fail-open-by-design",
      reason: "lane review: cost metering — an unmeasurable token count records $0 cost rather than a phantom charge; the meter can only under-count, never over-charge",
    },
    "assets/js/sizing/paths.js regionForCountry": {
      bucket: "fail-open-by-design",
      reason: "lane review: unknown countries map to the registry's documented 'row' (rest-of-world) bucket — the catch-all the registry exists to provide",
    },
    "assets/js/sizing/ui.js setupOffgridControls": {
      bucket: "fail-open-by-design",
      reason: "lane review: wiring guard — no control, no handler to lose an action in",
    },
    "assets/js/sizing/bom.js cableGauge": {
      bucket: "fail-open-by-design",
      reason: "lane review: derating and voltage-drop math with documented margins at the site; inputs are engine-derived amperages",
    },
    "assets/js/sizing/ui.js selectedUseCase": {
      bucket: "fail-open-by-design",
      reason: "lane review: bounded select; an unknown id falls back to 'billcut', the product's primary mode",
    },
    "assets/js/sizing/paths.js registryFor": {
      bucket: "fail-open-by-design",
      reason: "lane review: REGIONS[region] || REGIONS.row — the registry's documented catch-all",
    },
    "assets/js/sizing/wizard.js persistWizard": {
      bucket: "fail-open-by-design",
      reason: "lane review: storage writes are defensive by design (private mode and cleared storage can throw); losing the pref costs one re-entry in-session and no sizing result depends on it",
    },
    "assets/js/sizing/mode-chrome.js generatorRuntimeForTier": {
      bucket: "fail-open-by-design",
      reason: "lane review: share-link restore mapping with a documented default ('engine independence tier -> generator answer'); bounded enum",
    },
    "assets/js/sizing/ui.js setupGoalControls": {
      bucket: "fail-open-by-design",
      reason: "lane review: wiring guard — no control, no handler to lose an action in",
    },
    "worker/index.js jevQuestions": {
      bucket: "fail-open-by-design",
      reason: "lane review: the missing-worst-month fallback is labeled IN the prompt the judge reads ('No worst-month insolation was provided...') — degradation marked at the source",
    },
    "assets/js/sizing/ui.js updateShareHash": {
      bucket: "fail-open-by-design",
      reason: "lane review: hash regeneration is idempotent; on failure the URL lags the on-screen results but no displayed number changes",
    },
    "assets/js/sizing/paths.js legalityFor": {
      bucket: "fail-open-by-design",
      reason: "lane review: unknown country returns null rules — D-10's honest-unknown (the UI renders 'unknown', not a default legality)",
    },
    "assets/js/sizing/ui.js setupRoofAreaInput": {
      bucket: "fail-open-by-design",
      reason: "lane review: pure wiring; every handler calls markPrecalcDirty, whose whole documented job is retiring stale results",
    },
    "assets/js/shared/simple-mode.js initSimpleMode": {
      bucket: "fail-open-by-design",
      reason: "lane review: defensive storage read with a default (a display-mode pref, not data); readSimpleMode is try-guarded",
    },
    "assets/js/sizing/paths.js incentivesFor": {
      bucket: "fail-open-by-design",
      reason: "lane review: missing region falls back to the row list — the registry's documented catch-all",
    },
    "assets/js/sizing/ui.js renderUseCaseOutcome": {
      bucket: "fail-open-by-design",
      reason: "lane review: renders NOTHING when the outcome or use case is missing — the documented absence convention; the 'not measured' state has its own copy",
    },
    "assets/js/sizing/wizard.js restoreWizard": {
      bucket: "fail-open-by-design",
      reason: "lane review: same defensive-storage design as persistWizard; a missing pref restores defaults, never a stale guess",
    },
    "assets/js/sizing/mode-chrome.js tierForGeneratorRuntime": {
      bucket: "fail-open-by-design",
      reason: "lane review: bounded enum with documented default ('generator answer -> engine tier', share-link restore)",
    },
    "scripts/build-heatmap-data.mjs collapse": {
      bucket: "fail-open-by-design",
      reason: "lane review: tooling data compressor; its output is pinned byte-for-byte by the committed heatmap artifacts and the byte-budget gates",
    },
    "assets/js/sizing/ui.js updateCurrencyUnitLabel": {
      bucket: "fail-open-by-design",
      reason: "lane review: the label is re-rendered from live fxActive() state on every call; guarded querySelector",
    },
    "assets/js/sizing/frontier-chart.js niceMax": {
      bucket: "fail-open-by-design",
      reason: "lane review: axis-scaling default (nice step for v > 0, else 1) — it changes the axis, never a data value",
    },
    "scripts/generate-heatmap-data.mjs haversineKm": {
      bucket: "hardened-with-test",
      reason: "lane review confirmed a defect: antipodal floating-point overshoot made asin(sqrt(a)) NaN, silently emptying the nearest-profile search. Clamped this pass (Math.min(1, a)) and pinned by tests/audit-rerun-dispositions.test.mjs",
    },
    "assets/js/sizing/frontier-chart.js frontierVerdict": {
      bucket: "fail-open-by-design",
      reason: "lane review: the verdict copy enumerates its states as locale strings (frontierVerdict* family); the defaults are display formatters and reach fields are null-checked before use",
    },
    "assets/js/sizing/ui.js fmtH": {
      bucket: "fail-open-by-design",
      reason: "lane review: pure display formatter with enumerated states (all-day / hours / minutes); no fallback injection",
    },
    "assets/js/sizing/mode-chrome.js generatorAllowedForRuntime": {
      bucket: "fail-open-by-design",
      reason: "lane review: pure predicate over the bounded runtime enum",
    },
    "assets/js/chat.js runIntakeCalculation": {
      bucket: "fail-open-by-design",
      reason: "lane review: advisory intake math on the D-21 showcase surface; failure leaves the brief un-updated and it regenerates live on the next change",
    },
    "assets/js/sizing/charts.js setupZoomButtons": {
      bucket: "fail-open-by-design",
      reason: "lane review: wiring guard — no control, no handler to lose an action in",
    },
    "assets/js/sizing/ui.js syncBudgetLabel": {
      bucket: "fail-open-by-design",
      reason: "lane review: a non-finite slider value renders EMPTY text, not a number — absence, never a fabricated amount",
    },
    "assets/js/shared/translation-suggestion-url.js translationSuggestionUrl": {
      bucket: "fail-open-by-design",
      reason: "lane review: assistive extra — missing fields shorten the URL to the generic suggestion form, which still works",
    },
    "assets/js/sizing/charts.js setupChartInteractions": {
      bucket: "fail-open-by-design",
      reason: "lane review: wiring guard — no control, no handler to lose an action in",
    },
    "assets/js/sizing/ui.js showSpeedNote": {
      bucket: "fail-open-by-design",
      reason: "lane review: the note's states ARE the labeled degradation copy (speedNoteCached / speedNoteOffline strings); the meta coordinates are fixed-decimal formatted per the comment at the site",
    },
    "assets/js/sizing/infeasible-copy.js infeasibleCopyKeys": {
      bucket: "fail-open-by-design",
      reason: "lane review: hasOwnProperty guard documented at the site; unknown codes get the honest generic banner",
    },
    "assets/js/shared/i18n.js initLangPicker": {
      bucket: "fail-open-by-design",
      reason: "lane review: wiring guard — no control, no handler to lose an action in",
    },
    "assets/js/shared/escape.js escapeHtml": {
      bucket: "fail-open-by-design",
      reason: "lane review of the judge's lone must-fix (conf 0.23, probabilities 0.49/0.46): every return path passes through the full escape chain and missing input renders empty — the fail-CLOSED direction; pinned by tests/escape.test.mjs (escapeHtml(null) === '')",
    },
    "assets/js/sizing/ui.js updateAutoRows": {
      bucket: "fail-open-by-design",
      reason: "lane review: visibility sync from the current selects; guarded lookups",
    },
    "assets/js/shared/translation-suggestion-loader.js installTranslationSuggestionLoader": {
      bucket: "fail-open-by-design",
      reason: "lane review: wiring guard — no link, no loader to install",
    },
    "assets/js/chat.js makeClickableDivsKeyboardOperable": {
      bucket: "fail-open-by-design",
      reason: "lane review: wiring guard — missing divs mean no listeners to attach",
    },
    "assets/js/shared/escape.js escapeAttr": {
      bucket: "fail-open-by-design",
      reason: "lane review: the same fail-closed escape chain as escapeHtml; empty output for missing input",
    },
    "assets/js/sizing/ui.js hideSpeedNote": {
      bucket: "fail-open-by-design",
      reason: "lane review: hiding the note IS the staleness teardown — the opposite of stale-shown",
    },
    "assets/js/sizing/ui.js clearSanityBadges": {
      bucket: "fail-open-by-design",
      reason: "lane review: removes stale badges — the staleness teardown itself",
    },
    "assets/js/translation-suggestion.js selectionDetails": {
      bucket: "fail-open-by-design",
      reason: "lane review: browser Selection adapter — no selection or no range returns the empty selection { key: '', quotedText: '' }, which shortens the suggestion URL to the still-working generic form; nothing is saved or dropped because nothing was entered",
    },
    "assets/js/translation-suggestion.js keyFor": {
      bucket: "fail-open-by-design",
      reason: "lane review: walks up to the nearest data-i18n key and returns '' when there is none — the generic suggestion form covers that case by design",
    },
  },
  testGap: {
    "scripts/build-offline-profiles.mjs fetchYear": {
      bucket: "dispositioned",
      reason: "one-shot network generation script (runs against NASA at build time) — not unit-testable offline; its committed output (profiles.js) is exercised by every suite that runs the offline weather fallback",
    },
    "scripts/build-offline-profiles.mjs round1": {
      bucket: "dispositioned",
      reason: "build-time rounding helper inside the network-bound profile generator; its committed output is exercised by the offline-fallback suites",
    },
    "scripts/build-offline-profiles.mjs monthOfDay": {
      bucket: "dispositioned",
      reason: "build-time calendar helper inside the network-bound profile generator; its committed output is exercised by the offline-fallback suites",
    },
    "worker/index.js handleJevSanity": {
      bucket: "dispositioned",
      reason: "worker route handler; exercised end-to-end through the worker's HTTP tests (tests/jev-sanitize.test.mjs drives the same route surface)",
    },
    "scripts/build-city-pages.mjs extractCatalog": {
      bucket: "dispositioned",
      reason: "static-page generator internal; output pinned by the `build-city-pages.mjs --check` drift gate inside `npm run seo` — a regenerated page differing from the committed one fails CI",
    },
    "scripts/build-city-pages.mjs sunContext": {
      bucket: "dispositioned",
      reason: "static-page generator internal; output pinned by the `build-city-pages.mjs --check` drift gate inside `npm run seo`",
    },
    "scripts/build-city-pages.mjs slugify": {
      bucket: "dispositioned",
      reason: "static-page generator internal; output pinned by the `build-city-pages.mjs --check` drift gate inside `npm run seo`",
    },
    "scripts/build-city-pages.mjs hubPage": {
      bucket: "dispositioned",
      reason: "static-page generator internal; output pinned by the `build-city-pages.mjs --check` drift gate inside `npm run seo`",
    },
    "scripts/build-heatmap-images.mjs buildRankings": {
      bucket: "dispositioned",
      reason: "PNG generator internal; the committed artifacts are pinned by the heatmap-prerender and byte-budget gates — a unit test would re-implement the encoder, not verify the product",
    },
    "scripts/build-heatmap-images.mjs slimYears": {
      bucket: "dispositioned",
      reason: "PNG generator internal; committed artifacts pinned by the heatmap-prerender and byte-budget gates",
    },
    "scripts/build-heatmap-images.mjs renderImage": {
      bucket: "dispositioned",
      reason: "PNG generator internal; committed artifacts pinned by the heatmap-prerender and byte-budget gates",
    },
    "scripts/build-heatmap-images.mjs encodePng": {
      bucket: "dispositioned",
      reason: "PNG encoder; committed artifacts pinned byte-for-byte by the heatmap-prerender and byte-budget gates",
    },
    "scripts/build-heatmap-images.mjs crc32": {
      bucket: "dispositioned",
      reason: "PNG encoder checksum; committed artifacts pinned byte-for-byte by the heatmap-prerender and byte-budget gates",
    },
    "scripts/build-heatmap-images.mjs slimCost": {
      bucket: "dispositioned",
      reason: "PNG generator internal; committed artifacts pinned by the heatmap-prerender and byte-budget gates",
    },
    "scripts/build-heatmap-images.mjs drawDot": {
      bucket: "dispositioned",
      reason: "PNG generator internal; committed artifacts pinned by the heatmap-prerender and byte-budget gates",
    },
    "scripts/build-heatmap-data.mjs compressPoint": {
      bucket: "dispositioned",
      reason: "data compressor for the committed heatmap JSON; output pinned by the heatmap artifacts and byte-budget gates",
    },
    "assets/js/translation-suggestion.js selectionDetails": {
      bucket: "dispositioned",
      reason: "browser Selection API adapter (window.getSelection) — a Node unit test would stub the very API whose behavior it adapts, adding a count, not a signal; its fallback renders the empty selection { key: '', quotedText: '' }",
    },
  },
};

// ── driver ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const o = { root: ".", data: "docs/jev-completion/battery-rerun-2026-10-25", out: "" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--root") o.root = argv[++i];
    else if (argv[i] === "--data") o.data = argv[++i];
    else if (argv[i] === "--out") o.out = argv[++i];
    else {
      process.stderr.write(`jev-dispositions: unknown argument ${argv[i]}\n`);
      process.exit(2);
    }
  }
  if (!o.out) o.out = o.data;
  return o;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const root = resolve(opts.root);
  const dataDir = resolve(root, opts.data);
  const outDir = resolve(root, opts.out);
  const sec = parseCsv(readFileSync(join(dataDir, "battery-security.csv"), "utf8"));
  const tp = parseCsv(readFileSync(join(dataDir, "battery-testplan.csv"), "utf8"));

  const bodyCache = new Map();
  const bodyFor = (row) => {
    const key = row.file;
    if (!bodyCache.has(key)) {
      const p = join(root, key);
      bodyCache.set(key, existsSync(p) ? readFileSync(p, "utf8").split("\n") : []);
    }
    const lines = bodyCache.get(key);
    // Look BACK as well as forward: the doc comment naming an assumption lives
    // ABOVE the function, and a rule that only reads the body misses the single
    // place the product documents its own intent.
    const start = Math.max(0, Number(row.line) - 26);
    return {
      text: lines.slice(start, start + 86).join("\n"),
      baseLine: start + 1,
    };
  };

  // Which modules do the tests exercise? A private helper inside a module whose
  // exported entry points have direct tests is covered transitively — the
  // project's own precedent (tests/audit-car6-integration.test.mjs): "a second
  // test that only re-enters the same public function through a different name
  // adds a count, not a signal".
  const testedModules = new Map();
  const slicedModules = new Set();
  for (const f of readdirSync(join(root, "tests"))) {
    if (!f.endsWith(".test.mjs")) continue;
    const text = readFileSync(join(root, "tests", f), "utf8");
    for (const m of text.matchAll(/from\s+"\.\.\/([^"]+\.(?:js|mjs))"/g)) {
      const mod = m[1];
      if (!testedModules.has(mod)) testedModules.set(mod, []);
      testedModules.get(mod).push(f);
    }
    for (const m of text.matchAll(/readFileSync\((?:"|')([^"']+\.(?:js|mjs))/g))
      slicedModules.add(m[1].replace(/^\.\.\//, ""));
  }

  const exportCache = new Map();
  const isExported = (row) => {
    const key = row.file;
    if (!exportCache.has(key)) {
      const p = join(root, key);
      exportCache.set(key, existsSync(p) ? readFileSync(p, "utf8") : "");
    }
    const s = exportCache.get(key);
    const n = row.name;
    for (const d of [
      `export function ${n}`,
      `export async function ${n}`,
      `export const ${n}`,
      `export let ${n}`,
      `export class ${n}`,
    ])
      if (s.includes(d)) return true;
    const i = s.indexOf("export {");
    if (i >= 0) {
      const j = s.indexOf("}", i);
      if (new RegExp(`\\b${n}\\b`).test(s.slice(i, j < 0 ? undefined : j)))
        return true;
    }
    return false;
  };

  // Functions this pass hardened+tested (kept in a manifest beside the data so
  // the record never claims a harden that did not happen).
  const hardenedPath = join(dataDir, "hardened.json");
  const hardened = existsSync(hardenedPath)
    ? new Set(JSON.parse(readFileSync(hardenedPath, "utf8")))
    : new Set();
  const testedPath = join(dataDir, "tested.json");
  const tested = existsSync(testedPath)
    ? new Set(JSON.parse(readFileSync(testedPath, "utf8")))
    : new Set();

  const open = sec.filter((r) => r.fail_closed !== "" && Number(r.fail_closed) < 0.5);
  const dispRows = [];
  for (const r of open) {
    const key = `${r.file}:${r.line}`;
    const { text, baseLine } = bodyFor(r);
    const facts = codeFacts(text).map((f) => ({ ...f, at: f.at + baseLine - 1 }));
    const lane = LANE.failOpen[`${r.file} ${r.name}`];
    const d = lane
      ? {
          bucket: lane.bucket,
          reason: lane.reason,
          evidence: evidenceFor(facts),
          question: lane.question || "",
        }
      : dispositionFailOpen(r, facts, hardened.has(key));
    dispRows.push({
      file: r.file,
      line: r.line,
      name: r.name,
      fail_closed: r.fail_closed,
      blast_radius: r.blast_radius,
      failure_mode: r.failure_mode,
      prod: PROD.test(r.file) ? "production" : "tooling",
      bucket: d.bucket,
      reason: d.reason,
      evidence: d.evidence,
      question: d.question,
    });
  }
  const tpRows = [];
  for (const r of tp) {
    const key = `${r.file}:${r.line}`;
    const laneGap = LANE.testGap[`${r.file} ${r.name}`];
    const d = tested.has(key)
      ? { bucket: "tested", reason: "test added in this pass; see the linked suite" }
      : laneGap
        ? laneGap
        : dispositionTestGap(r, {
            testedModules,
            slicedModules,
            exported: isExported(r),
            moduleTests: testedModules.get(r.file),
          });
    tpRows.push({
      file: r.file,
      line: r.line,
      name: r.name,
      test_priority: r.test_priority,
      strategy: r.strategy,
      test_coverage: r.test_coverage,
      bucket: d.bucket,
      reason: d.reason,
    });
  }

  writeFileSync(
    join(outDir, "dispositions-failopen.csv"),
    toCsv(
      [
        "file",
        "line",
        "name",
        "fail_closed",
        "blast_radius",
        "failure_mode",
        "prod",
        "bucket",
        "reason",
        "evidence",
        "question",
      ],
      dispRows.map((r) =>
        ["file", "line", "name", "fail_closed", "blast_radius", "failure_mode", "prod", "bucket", "reason", "evidence", "question"].map((k) => r[k]),
      ),
    ),
  );
  writeFileSync(
    join(outDir, "dispositions-testplan.csv"),
    toCsv(
      ["file", "line", "name", "test_priority", "strategy", "test_coverage", "bucket", "reason"],
      tpRows.map((r) =>
        ["file", "line", "name", "test_priority", "strategy", "test_coverage", "bucket", "reason"].map((k) => r[k]),
      ),
    ),
  );

  const count = (rows, k) =>
    rows.reduce((m, r) => ((m[r[k]] = (m[r[k]] || 0) + 1), m), {});
  const summary = {
    failopen_total: dispRows.length,
    failopen_buckets: count(dispRows, "bucket"),
    failopen_needs_human: dispRows
      .filter((r) => r.bucket === "needs-human-look")
      .slice(0, 40)
      .map((r) => `${r.name}@${r.file}:${r.line}`),
    testplan_total: tpRows.length,
    testplan_buckets: count(tpRows, "bucket"),
  };
  writeFileSync(
    join(outDir, "dispositions-summary.json"),
    JSON.stringify(summary, null, 2) + "\n",
  );
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main();
}
