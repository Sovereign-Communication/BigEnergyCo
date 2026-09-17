// Localization completeness gate. Run: node scripts/check-i18n.mjs
//
// The i18n layer falls back to English silently, which is the right product
// behavior — a missing string shows English, never a raw key. That safety net
// is exactly why the failure mode is invisible, so it is gated here instead:
//
//   1. PARITY      every `en` key exists in every locale (no half-migrations).
//   2. HOOKS       every `data-i18n="key"` a shipped page declares resolves in
//                  every non-English locale. English is exempt because the
//                  English string IS the markup. A hook that resolves in NO
//                  locale is a markup typo, and fails too.
//   3. PLACEHOLDERS translated strings carry exactly the English placeholders;
//                  a typo'd {count} renders literally to the user.
//   4. NO LEAKS    no value equals its own key name (the tell-tale of a
//                  half-finished translation shipped by accident).
//   5. RTL FLAGS   only `ar` flips direction.
//   6. FAMILIES    strings composed at runtime (base + "Grid"/"Offgrid") must
//                  exist in every locale, not only in the one that got them.
//
// An earlier version of this gate compared the *union* of the locale
// dictionaries as a proxy for "what must be translated". That premise was
// false: locale key names collide with payload field names and DOM ids, so the
// proxy demanded translations for strings nothing renders. The rules below are
// checked against what shipped markup and code actually reference.
import { readFileSync } from "node:fs";
import { LOCALES } from "../assets/js/shared/locales.js";
import { LANGS } from "../assets/js/shared/i18n.js";
import {
  deployedFiles,
  familyGaps,
  hookCoverage,
  placeholders,
} from "./lib/gates.mjs";

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

const { gaps: hookGaps, unresolved } = hookCoverage(LOCALES, hooks);

if (unresolved.length)
  fail(
    `${unresolved.length} data-i18n hook(s) resolve in no locale (markup typo): ${unresolved.slice(0, 6).join(", ")}`,
  );
else ok(`all ${hooks.size} markup hooks resolve in at least one locale`);

for (const [lang, gaps] of Object.entries(hookGaps)) {
  if (gaps.length)
    fail(
      `${lang}: ${gaps.length}/${hooks.size} HTML hook(s) untranslated: ${gaps.slice(0, 6).join(", ")}`,
    );
  else ok(`${lang}: all ${hooks.size} HTML hooks translated`);
}

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

// ── 6. runtime-composed families ────────────────────────────────────────────
// `frontierVerdict()` composes `base + ("Grid" | "Offgrid")` at runtime, so a
// variant translated in one locale but not another renders English — or the raw
// key — for that whole mode. Comparing suffix families catches it; counting
// dictionary sizes cannot.
const families = familyGaps(LOCALES);
for (const [lang, gaps] of Object.entries(families)) {
  if (gaps.length)
    fail(
      `${lang}: ${gaps.length} composed string(s) missing for a runtime mode: ${gaps.slice(0, 6).join(", ")}`,
    );
  else ok(`${lang}: every runtime-composed verdict string present`);
}

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
