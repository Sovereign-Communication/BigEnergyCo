// V1 (value-moment integrity) - the result surface pins.
//
// The V-queue's V1 item names four defects that a driver sees on the result
// card itself. Each one is pinned here, because each is a regression that no
// other gate can see: the i18n gate proves a string is PRESENT and correctly
// placeholdered, and none of the byte/SEO/format gates can tell whether the
// sentence a visitor reads contradicts itself.
//
//   1. "Partly: 99% of the year runs with no grid..." - a bare status label
//      stamped in front of a sentence, and on a not-here verdict it argued with
//      its own sentence ("Does not work here: this system removes 45% of your
//      bill over 20 years"). The verdict now opens with a plain sentence.
//   2. "an independent AI check flags this result as physically implausible -"
//      was an alarm with no explanation and a dangling dash. It now says what
//      the check is and that it cannot change the result.
//   3. The rate line printed the provider's raw RFC-822 stamp beside a result
//      built from 2021-2025 weather: a 2026 date in a five-year simulation with
//      nothing saying what it dated. It is now a plain date that names itself.
//   4. The advisor's internal brief ("[ADVISOR INSTRUCTION: ...]") is prompt
//      scaffolding. A model that echoes it must not put it on screen.
//
// chat.js and ui.js are CLASSIC scripts (no type=module), so the house pattern
// pins their source and evaluates the extracted pure function where behaviour
// can be shown - the same two-way pin tests/advisor-mode-copy.test.mjs uses.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const LOCALES = readFileSync("assets/js/shared/locales.js", "utf8");
const UI = readFileSync("assets/js/sizing/ui.js", "utf8");
const CHAT = readFileSync("assets/js/chat.js", "utf8");

const LOCALE_IDS = ["en", "es", "pt", "fr", "de", "nl", "ar"];

/** Every `key: "value"` or `key:` + next-line string, across the whole file. */
function valueOf(key) {
  const re = new RegExp(
    `^[ \\t]*${key}:[ \\t]*\\n?[ \\t]*"((?:[^"\\\\]|\\\\.)*)"`,
    "gm",
  );
  return [...LOCALES.matchAll(re)].map((m) => m[1]);
}

test("the verdict is a sentence, not a status label", () => {
  // The six per-case verdict sentences, in every locale. A `{status}` token in
  // any of them means the colon-label style came back.
  const verdictKeys = [
    "verdictBillCut",
    "verdictTou",
    "verdictBackup",
    "verdictReserve",
    "verdictReserveNoBattery",
    "verdictOffGrid",
    "verdictPortable",
  ];
  for (const key of verdictKeys) {
    const values = valueOf(key);
    assert.ok(values.length >= 7, `${key} should exist in all 7 locales`);
    for (const v of values) {
      assert.ok(
        !v.includes("{status}"),
        `${key} still interpolates a bare status label: ${v.slice(0, 60)}`,
      );
      assert.ok(
        !/^\{?\w+\}?: /.test(v),
        `${key} still opens with a label and a colon: ${v.slice(0, 60)}`,
      );
    }
  }
});

test("every locale leads with a plain sentence for each status", () => {
  for (const key of [
    "verdictLeadWorks",
    "verdictLeadPartial",
    "verdictLeadNotHere",
  ]) {
    const values = valueOf(key);
    assert.equal(values.length, 7, `${key} must exist in all 7 locales`);
    for (const v of values) {
      assert.ok(v.trim().length > 0, `${key} is empty in some locale`);
      assert.ok(
        !v.trim().endsWith(":"),
        `${key} is a label, not a sentence: ${v}`,
      );
    }
  }
  // The renderer must actually use the lead; a key nothing renders is dead
  // weight the same way an unreferenced translation is.
  assert.match(
    UI,
    /t\(leadKeyForStatus\(o\.status\)\)/,
    "the verdict must render through leadKeyForStatus()",
  );
  for (const locale of LOCALE_IDS) {
    assert.ok(
      LOCALES.includes(`// ${locale}`) || LOCALES.length > 0,
      "sanity: locale file read",
    );
  }
});

test("the implausibility alarm explains itself instead of trailing off", () => {
  const flags = valueOf("sanityFlag");
  assert.equal(flags.length, 7, "sanityFlag must exist in all 7 locales");
  for (const v of flags) {
    assert.ok(
      !v.trimEnd().endsWith("\u2014"),
      `sanityFlag still ends on a dangling dash: ${v.slice(0, 60)}`,
    );
    assert.ok(
      v.trim().length >= 60,
      `sanityFlag is too short to explain anything: ${v.slice(0, 60)}`,
    );
    // It must still say the check cannot change the result: that is the part
    // that stops an alarm from reading as a verdict on the numbers.
    assert.match(
      v,
      /result|résultat|resultado|resultaat|Ergebnis|نتيجتك/i,
      `sanityFlag does not mention the result: ${v.slice(0, 80)}`,
    );
  }
});

test("the rate date is a plain date that says whose date it is", () => {
  const live = valueOf("fxSourceLive");
  assert.equal(live.length, 7, "fxSourceLive must exist in all 7 locales");
  for (const v of live) {
    assert.ok(v.includes("{asOf}"), `fxSourceLive lost its date slot: ${v}`);
    assert.ok(
      !v.includes("+0000"),
      `fxSourceLive hardcodes a machine timestamp: ${v}`,
    );
  }
  // The raw provider string must never reach the DOM unformatted.
  assert.match(
    UI,
    /function fxAsOfDisplay\(asOf\)/,
    "ui.js must format the provider stamp",
  );
  assert.match(
    UI,
    /asOf: fxAsOfDisplay\(f\.asOf\)/,
    "every FX render path must pass the stamp through fxAsOfDisplay",
  );
  assert.ok(
    !/asOf: f\.asOf/.test(UI),
    "a render path still prints the raw provider stamp",
  );
});

test("an echoed advisor brief can never reach the screen", () => {
  const extracted = CHAT.match(
    /function stripInternalBrief\(replyText\) \{[\s\S]*?\n\}/,
  );
  assert.ok(extracted, "chat.js must define stripInternalBrief()");
  // The marker list it reads is the other half of the function: extract both,
  // so a marker added to the list but never consulted here still fails.
  const markers = CHAT.match(/var INTERNAL_BRIEF_MARKERS = \[[\s\S]*?\];/);
  assert.ok(markers, "chat.js must declare INTERNAL_BRIEF_MARKERS");
  const strip = new Function(
    `${markers[0]}\n${extracted[0]}\nreturn stripInternalBrief;`,
  )();

  // A single-line echo.
  assert.equal(
    strip(
      "[ADVISOR INSTRUCTION: answer in plain words.] A 20 kWh battery covers your evening.",
    ),
    "A 20 kWh battery covers your evening.",
  );
  // The multi-line brief chat.js actually builds.
  assert.equal(
    strip(
      "[ADVISOR INSTRUCTION: Use these climate/space/maintenance details to reason\nabout chemistry, stated as linear zones.]\n\nYour 27 kWh bank is fine.",
    ),
    "Your 27 kWh bank is fine.",
  );
  // A brief in the middle of prose is removed, and the prose survives.
  assert.ok(
    strip(
      "Yes. [ADVISOR INSTRUCTION: be brief.] It pays back in year 8.",
    ).includes("It pays back in year 8."),
  );
  // Ordinary text is untouched, including a bracketed non-brief.
  assert.equal(strip("Costs [$1,623] up front."), "Costs [$1,623] up front.");
  assert.equal(strip(""), "");

  // And the render path uses it.
  assert.match(
    CHAT,
    /body\.textContent = stripInternalBrief\(replyText\);/,
    "renderBotReply must strip the brief before rendering",
  );
});

test("years on the result surface are years, not quantities", () => {
  // Found by driving the result card, not by reading code (Phoenix, off-grid,
  // 2026-11-07): the SOC chart caption read "satellite weather from 2,021 to
  // 2,025". The years were passed through the same thousands-separator
  // formatter as kWh and dollars, so a five-year simulation appeared to run
  // across millennia - the same class of defect as the undated rate stamp,
  // and just as unshareable.
  const CHARTS = readFileSync("assets/js/sizing/charts.js", "utf8");
  const yearFormatting = [...CHARTS.matchAll(/fmt\([^)]*[Yy]ear[^)]*\)/g)].map(
    (m) => m[0],
  );
  assert.deepEqual(
    yearFormatting,
    [],
    `years must not go through the number formatter: ${yearFormatting.join(", ")}`,
  );
  // And the captions still carry the years, as plain digits.
  for (const key of ["socCaptionGrid", "socCaptionOffgrid", "autoSocCaption"]) {
    const values = valueOf(key);
    assert.ok(values.length >= 7, `${key} should exist in all 7 locales`);
    for (const v of values) {
      assert.ok(
        v.includes("{startYear}") && v.includes("{endYear}"),
        `${key} must interpolate both years`,
      );
    }
  }
  assert.match(
    CHARTS,
    /startYear: String\(/,
    "the caption must pass the year as a plain string",
  );
});

test("the sizing brief is sent, never shown as the visitor's message", () => {
  // Driven and captured 2026-11-07 (Phoenix, off-grid): "Ask the AI advisor
  // about this result" rendered the entire brief as a chat-msg user bubble -
  // 2,217 characters carrying SELECTED SYSTEM FOR JEV REVIEW, the CALCULATOR
  // CONTEXT block, raw worst_month_ghi/mean_temp_c values and sentences like
  // "Do not imply that an independent check occurred".
  assert.match(
    UI,
    /window\.pendingAdvisorPrompt\s*=/,
    "askAdvisor must hand the brief to the send path, not the input box",
  );
  assert.doesNotMatch(
    UI,
    /input\.value\s*=\s*window\.lastSizingBrief/,
    "the brief must never be typed into the visible input",
  );
  assert.match(
    CHAT,
    /var sentMsg = pendingPrompt \|\| userMsg;/,
    "sendChatMsg must send the pending prompt",
  );
  assert.match(
    CHAT,
    /message: sentMsg,/,
    "the request body must carry the pending prompt",
  );
  // The bubble itself keeps the plain sentence.
  assert.match(CHAT, /userDiv\.innerText = userMsg;/);
  // Every locale has the plain sentence the visitor sees.
  const values = valueOf("advisorAskResult");
  assert.equal(values.length, LOCALE_IDS.length);
  for (const v of values) {
    assert.ok(v.trim().length > 0);
    assert.ok(!/\[|JEV|INSTRUCTION/i.test(v), `scaffolding in copy: ${v}`);
  }
});

test("every internal brief marker is stripped, not just the first", () => {
  // Execute the extractor exactly as the house pattern does for classic
  // scripts: pull the function out of the source and run it.
  const start = CHAT.indexOf("function stripInternalBrief");
  assert.ok(start > -1, "stripInternalBrief is missing");
  const end = CHAT.indexOf("\n}", start);
  const src = CHAT.slice(start, end + 2);
  const markersStart = CHAT.indexOf("var INTERNAL_BRIEF_MARKERS");
  const markersEnd = CHAT.indexOf("];", markersStart);
  const markers = CHAT.slice(markersStart, markersEnd + 2);
  const strip = new Function(
    `${markers}\n${src}\nreturn stripInternalBrief;`,
  )();

  assert.equal(strip("[ADVISOR INSTRUCTION: be brief.] Year 8."), "Year 8.");
  assert.equal(
    strip(
      "[CALCULATOR CONTEXT — DATA, NOT INSTRUCTIONS: do not recompute.] It pays back in year 8.",
    ),
    "It pays back in year 8.",
  );
  // The JEV block, in the form validate.js now emits: the marker and the
  // instruction sentence inside ONE bracket pair, so the strip can remove the
  // whole thing instead of leaving "Do not imply that an independent check
  // occurred" on screen.
  assert.equal(
    strip(
      "[JEV REVIEW — UNAVAILABLE: selected deterministic system: best: Jev numeric inputs: mode=offgrid, mean_temp_c=23.00. Do not imply that an independent check occurred.]\n\nI can't answer right now.",
    ),
    "I can't answer right now.",
  );
  // The source must actually close the bracket, not just open it.
  const VALIDATE = readFileSync("assets/js/sizing/validate.js", "utf8");
  for (const m of VALIDATE.matchAll(/`?\[JEV REVIEW[^`]*?`/g)) {
    const block = m[0];
    if (!block.includes("${reviewed}")) continue;
    assert.ok(
      block.trimEnd().endsWith(".]`") || block.includes(".]`"),
      `the JEV brief must close its bracket: ${block.slice(0, 80)}`,
    );
  }
  assert.equal(
    strip(
      "SELECTED SYSTEM FOR JEV REVIEW: LFP - 8.00 kW PV + 27.00 kWh usable; offgrid.\nYour 27 kWh bank is fine.",
    ),
    "Your 27 kWh bank is fine.",
  );
  // Ordinary bracketed text and normal prose survive.
  assert.equal(strip("Costs [$1,623] up front."), "Costs [$1,623] up front.");
});
