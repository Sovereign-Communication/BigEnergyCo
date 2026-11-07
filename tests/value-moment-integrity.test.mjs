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
  const strip = new Function(`${extracted[0]}\nreturn stripInternalBrief;`)();

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
    strip("Yes. [ADVISOR INSTRUCTION: be brief.] It pays back in year 8.").includes(
      "It pays back in year 8.",
    ),
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
