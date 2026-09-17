// Localization completeness gate. Run: node scripts/check-i18n.mjs
//
// The i18n layer falls back to English silently, which is the right product
// behavior — a missing string shows English, never a raw key. That safety net
// is exactly why the failure mode is invisible, so it is gated here instead:
//
//   1. PARITY      every `en` key exists in every locale (no half-migrations).
//   2. HOOKS       every `data-i18n="key"` a shipped page declares resolves in
//                  every locale. English legitimately has no entry — the
//                  English string IS the markup — so `en` is exempt by design.
//   3. PLACEHOLDERS translated strings carry exactly the English placeholders;
//                  a typo'd {count} renders literally to the user.
//   4. NO LEAKS    no value equals its own key name (the tell-tale of a
//                  half-finished translation shipped by accident).
//   5. RTL FLAGS   only `ar` flips direction.
//
// Coverage debt (German is behind the other locales) is frozen as a ratchet:
// the number may only go down, and the PR that translates the remaining
// strings must lower it in the same commit.
import { readFileSync } from "node:fs";
import { LOCALES } from "../assets/js/shared/locales.js";
import { LANGS } from "../assets/js/shared/i18n.js";
import {
  deployedFiles,
  placeholders,
  translatedVocabulary,
} from "./lib/gates.mjs";

/**
 * Frozen debt, not a target. German is the lagging locale: one HTML hook and
 * eighteen JS-rendered strings still fall back to English. The PR that
 * translates them lowers these numbers in the same commit; every other locale
 * must stay at zero, so a newly added string with no translation fails outright.
 */
const RATCHET = {
  germanMissingHooks: 1,
  germanMissingKeys: 18,
};

let failures = 0;
const fail = (msg) => {
  console.error(`FAIL ${msg}`);
  failures++;
};
const ok = (msg) => console.log(`OK   ${msg}`);

const langs = Object.keys(LOCALES);
const en = LOCALES.en;
if (!en) fail("locales.js has no `en` dictionary");
if (!langs.length) fail("locales.js exports no locales");

// ── 1. parity with English ──────────────────────────────────────────────────
const missing = [];
for (const lang of langs) {
  if (lang === "en") continue;
  for (const key of Object.keys(en)) {
    if (LOCALES[lang][key] === undefined) missing.push(`${lang}.${key}`);
  }
}
if (missing.length)
  fail(
    `${missing.length} key(s) missing from a locale: ${missing.slice(0, 8).join(", ")}`,
  );
else ok(`every en key exists in all ${langs.length - 1} locales`);

// ── 2. HTML hooks resolve everywhere ────────────────────────────────────────
function shippedPages() {
  return deployedFiles().filter((l) => l.endsWith(".html"));
}

const hooks = new Set();
for (const page of shippedPages()) {
  const html = readFileSync(page, "utf8");
  for (const m of html.matchAll(/data-i18n="([^"]+)"/g)) hooks.add(m[1]);
}
if (!hooks.size) fail("no data-i18n hooks found in shipped pages");

const hookGaps = {};
for (const lang of langs) {
  if (lang === "en") continue;
  hookGaps[lang] = [...hooks].filter((h) => LOCALES[lang][h] === undefined);
}
for (const [lang, gaps] of Object.entries(hookGaps)) {
  if (gaps.length === 0) ok(`${lang}: all ${hooks.size} HTML hooks translated`);
}

// The ratchet specifically tracks the German backlog (the largest one), so a
// new un-translated hook in ANY locale still fails outright.
for (const [lang, gaps] of Object.entries(hookGaps)) {
  if (lang === "de") continue;
  if (gaps.length)
    fail(
      `${lang}: ${gaps.length} HTML hook(s) untranslated: ${gaps.slice(0, 6).join(", ")}`,
    );
}

const germanGaps = hookGaps.de || [];
if (germanGaps.length <= RATCHET.germanMissingHooks)
  ok(
    `de: ${hooks.size - germanGaps.length}/${hooks.size} hooks translated (${germanGaps.length} frozen)`,
  );
else
  fail(
    `de: ${germanGaps.length} untranslated hooks exceeds the frozen budget ${RATCHET.germanMissingHooks} — translate the new string rather than raising the budget (${germanGaps.slice(0, 6).join(", ")})`,
  );

// ── 3. placeholder parity ───────────────────────────────────────────────────
const badPlaceholders = [];
for (const lang of langs) {
  if (lang === "en") continue;
  for (const key of Object.keys(en)) {
    const v = LOCALES[lang][key];
    if (v === undefined) continue;
    if (placeholders(v) !== placeholders(en[key]))
      badPlaceholders.push(`${lang}.${key}`);
  }
}
if (badPlaceholders.length)
  fail(
    `${badPlaceholders.length} placeholder mismatch(es): ${badPlaceholders.slice(0, 8).join(", ")}`,
  );
else ok("every translation carries the same placeholders as English");

// ── 4. leaked key names ─────────────────────────────────────────────────────
const leaks = [];
for (const lang of langs) {
  for (const [key, value] of Object.entries(LOCALES[lang])) {
    if (typeof value === "string" && value === key)
      leaks.push(`${lang}.${key}`);
  }
}
if (leaks.length)
  fail(
    `value equals key name (untranslated leak): ${leaks.slice(0, 8).join(", ")}`,
  );
else ok("no locale ships a key name as its own text");

// ── 5. RTL + picker wiring ──────────────────────────────────────────────────
const rtl = langs.filter((l) => LOCALES[l].rtl);
if (rtl.length === 1 && rtl[0] === "ar") ok("only `ar` flips direction");
else fail(`expected exactly [ar] to be RTL, found [${rtl.join(", ")}]`);

const pickerIds = LANGS.map((l) => l.id).filter(
  (id) => id !== "auto" && id !== "en",
);
const unwired = pickerIds.filter((id) => !LOCALES[id]);
if (unwired.length)
  fail(
    `language picker offers locales with no dictionary: ${unwired.join(", ")}`,
  );
else
  ok(
    `language picker exposes ${pickerIds.length} locales, all with dictionaries`,
  );

// ── 6. translated-vocabulary gaps ───────────────────────────────────────────
// The translated locales between them define the vocabulary the app is able to
// render in a non-English language. A key in that set which a locale lacks is
// not a crash — it is a German (or Spanish…) user being shown English, which is
// the silent failure this gate exists to make visible.
const translatedVocab = translatedVocabulary(LOCALES);
const vocabGaps = {};
for (const lang of langs) {
  if (lang === "en") continue;
  vocabGaps[lang] = [...translatedVocab].filter(
    (k) => LOCALES[lang][k] === undefined,
  );
}
for (const [lang, gaps] of Object.entries(vocabGaps)) {
  if (lang === "de") continue; // ratcheted below
  if (gaps.length)
    fail(
      `${lang}: ${gaps.length} string(s) the other locales translate are missing: ${gaps.slice(0, 6).join(", ")}`,
    );
  else ok(`${lang}: full translated vocabulary`);
}
if (vocabGaps.de.length <= RATCHET.germanMissingKeys)
  ok(
    `de: ${translatedVocab.size - vocabGaps.de.length}/${translatedVocab.size} translated strings (${vocabGaps.de.length} frozen)`,
  );
else
  fail(
    `de: ${vocabGaps.de.length} untranslated strings exceeds the frozen budget ${RATCHET.germanMissingKeys} — translate the new string rather than raising the budget (${vocabGaps.de.slice(0, 6).join(", ")})`,
  );

// ── coverage summary (informational, keeps the trend visible) ───────────────
const rows = langs
  .filter((l) => l !== "en")
  .map((l) => {
    const keys = Object.keys(LOCALES[l]).length;
    const hookCov = hooks.size
      ? Math.round(
          ((hooks.size - (hookGaps[l] || []).length) / hooks.size) * 100,
        )
      : 100;
    return `${l}: ${keys} keys, ${hookCov}% of HTML hooks`;
  });
console.log(`     coverage — ${rows.join(" · ")}`);

console.log(failures ? `\n${failures} I18N FAILURE(S)` : "\nI18N OK");
process.exit(failures ? 1 : 0);
