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
//   7. RENDERED   every English key is named by shipped code or markup, so a
//                  translation cannot sit in the file costing every locale
//                  while no visitor can ever see it.
//   8. BANNED     specific VALUES known to be wrong. Rules 1-7 prove a string
//                  is PRESENT; none of them can see that it is BAD. Every one
//                  of these shipped and passed every other rule, so they are
//                  listed by value and the gate fails if any returns.
//   9. UNKEYED    visible PROSE on a translated page must carry a hook. Every
//                  other rule reads the dictionary; copy that was never put IN
//                  it is invisible to all of them, which is how the hero
//                  headline and the footer shipped in English on German and
//                  Arabic browsers while the gate was green.
//
// An earlier version of this gate compared the *union* of the locale
// dictionaries as a proxy for "what must be translated". That premise was
// false: locale key names collide with payload field names and DOM ids, so the
// proxy demanded translations for strings nothing renders. The rules below are
// checked against what shipped markup and code actually reference.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { LOCALES } from "../assets/js/shared/locales.js";
import { LANGS } from "../assets/js/shared/i18n.js";
import {
  claimsTranslation,
  deployedFiles,
  familyGaps,
  hookCoverage,
  placeholders,
  unkeyedProse,
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
// `frontierVerdict()` composes `base + a suffix` at runtime, so a variant
// translated in one locale but not another renders English — or the raw key —
// for that whole mode. Comparing suffix families catches it; counting
// dictionary sizes cannot. "Battery" is the battery-only frontier: a grid-tie
// sweep that found no PV at all, whose ceiling is a peak offset rather than a
// bill cut, so its verdict must not say "% of your bill".
const composedSuffixes = ["Grid", "Offgrid", "Battery"];
const families = familyGaps(LOCALES, composedSuffixes);
for (const [lang, gaps] of Object.entries(families)) {
  if (gaps.length)
    fail(
      `${lang}: ${gaps.length} composed string(s) missing for a runtime mode: ${gaps.slice(0, 6).join(", ")}`,
    );
  else ok(`${lang}: every runtime-composed verdict string present`);
}

// ── 7. rendered keys ────────────────────────────────────────────────────────
// The expensive failure is the invisible one: translations added ahead of the
// code that renders them — or left behind when the markup changed. They cost
// every locale, no visitor can ever see them, and the silent English fallback
// makes them undetectable by every rule above. A key counts as rendered when a
// shipped file mentions it (a t()/translate()/becoT() call, a data-i18n hook,
// or a plain literal). The plain-literal net is deliberately generous: a name
// that merely collides with a DOM id still counts, because a false "rendered"
// only softens the guard, while a false "unrendered" would fail a good build.
function renderedKeys() {
  const sources = new Set(deployedFiles());
  const collect = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name !== "city-data") collect(p);
      } else if (p.endsWith(".js") || p.endsWith(".mjs")) sources.add(p);
    }
  };
  collect("assets/js");
  // The whole worker directory, not a hardcoded worker/index.js. The worker
  // ships dictionary key names to the client (the degraded reply names the
  // keys it wants rendered in the visitor's language), so a module that owns
  // that copy IS a render site even though the markup lives in the client.
  // Naming one file here made this rule silently blind to every module the
  // router was split into — a false green on unrendered keys.
  collect("worker");
  let text = "";
  for (const file of sources) {
    if (file.endsWith("locales.js") || !existsSync(file)) continue;
    text += readFileSync(file, "utf8");
  }
  const seen = new Set();
  for (const m of text.matchAll(/["']([A-Za-z][A-Za-z0-9_]*)['"]/g))
    seen.add(m[1]);
  return seen;
}

const rendered = renderedKeys();
// PARITY IN BOTH DIRECTIONS, and this used to be one-way. Keying the check off
// `Object.keys(en)` meant a key that survived ONLY in a non-English dictionary
// was invisible here — and that is the same dead string this rule exists to
// catch, just filed in a locale nobody audits. Measured: four keys
// (offlineCity, tariffSpend, noTariff, fxNote) sat in four locales each and
// were asked for by no shipped code at all. The near-misses are the reason
// they survived: `offlineCity` is a property on `meta`, `tariffSpend` is the
// prefix of a real key family (tariffSpendLine/Battery/Fixed/Offgrid),
// `noTariff` is a local variable, and `fxNote` is a local function — each name
// appears in code, just never as a lookup.
//
// The union is the honest set: a key nobody renders is dead wherever it lives,
// and the case that matters most is the one English cannot see, because
// `translate()` falls back through English and would hand a visitor the raw key
// name.
const everyLocaleKey = [
  ...new Set(langs.flatMap((l) => Object.keys(LOCALES[l]))),
];
// `frontierVerdict()` composes base + a suffix at runtime, so those member names
// never appear literally — rule 6 already proves each family is complete in
// every locale. The list is shared with rule 6 so the two can never disagree
// about which suffixes exist.
const unrendered = everyLocaleKey.filter(
  (k) => !rendered.has(k) && !composedSuffixes.some((s) => k.endsWith(s)),
);
if (unrendered.length)
  fail(
    `${unrendered.length} key(s) no shipped code or markup renders, in any locale: ${unrendered.slice(0, 8).join(", ")}`,
  );
else
  ok(
    `all ${everyLocaleKey.length} keys across ${langs.length} locales are rendered by shipped code or markup`,
  );

// ── 8. banned values ────────────────────────────────────────────────────────
// Every entry here is a string that WAS shipped and passed rules 1-7. They are
// listed by value rather than by key because the key was never the problem:
// the key existed in all six locales, carried the right placeholders, and was
// named by shipped code. It was the TEXT that was wrong — a garbled Arabic word
// and a sentence left hanging on a dangling case ending. A presence gate is
// blind to that by construction, so these are pinned as literals.
//
// Each entry names the defect, because "this string is banned" tells a future
// editor nothing about what to write instead.
const BANNED_VALUES = [
  {
    value: "دون اتصال · ليس الذكاء الطناعيا مباشرة",
    why: "ar.advisorDegradedLabel shipped a non-word (الطناعيا)",
  },
  {
    value: "لا مفتاح مدية، فالمشير منطقً عند الاتصال",
    why: "ar.advisorDegradedWhyNoKey ended on a dangling tanwin, leaving the clause unfinished; it now says 'offline by design', which is what the English says",
  },
  {
    // A mistranslation, not a garbled string: this one is well-formed Arabic
    // that says "not the NATURAL one". All five siblings say "not the LIVE AI"
    // (en directo / em directo / en direct / Live-KI), which is what tells a
    // visitor this reply is canned rather than generated. It shipped because
    // the first fix for the non-word above chose a replacement that was valid
    // Arabic but meant something else — a reminder that "renders as Arabic" and
    // "means what the siblings mean" are different properties, and only the
    // second one is what a visitor needs.
    value: "دون اتصال · ليس الذكاء الطبيعي مباشرة",
    why: "ar.advisorDegradedLabel said 'not the natural AI'; it must say 'not the LIVE AI' (الحيّ), matching en/es/pt/fr/de",
  },
  {
    // An untranslated fragment: the English word "plausible" was left sitting in
    // the middle of an Arabic sentence. en/es/pt/fr/de all translate it. A
    // visitor reading Arabic met a Latin word mid-clause.
    value: "تم التحقق بشكل مستقل ✓ — plausible من الناحية الفيزيائية",
    why: "ar.sanityOk carried the English word 'plausible' untranslated; the Arabic is now 'معقول فيزيائيًا', the same word sanityFlag already uses for this pair",
  },
  {
    // A wrong CLAIM, which is worse than a wrong word. "التقليدي" is
    // "traditional"; all five siblings say "typical-YEAR" (typical / típico /
    // típico / typique / typisches Offline-Jahr). The badge tells a visitor the
    // tool substituted a typical year of weather, and "traditional" misstates
    // what the numbers actually represent.
    value: " · 🌐 وضع عدم الاتصال التقليدي",
    why: "ar.offlineNote said 'the traditional offline mode'; it must say 'typical-year', which is what all five siblings mean and what the badge asserts",
  },
];
const bannedHits = [];
for (const lang of langs) {
  for (const [key, value] of Object.entries(LOCALES[lang])) {
    for (const b of BANNED_VALUES) {
      if (typeof value === "string" && value.includes(b.value))
        bannedHits.push(`${lang}.${key}: ${b.why}`);
    }
  }
}
if (bannedHits.length)
  fail(
    `${bannedHits.length} known-bad value(s) shipped again: ${bannedHits
      .slice(0, 4)
      .join(" | ")}`,
  );
else ok(`none of the ${BANNED_VALUES.length} known-bad values are present`);

// ── 9. unkeyed prose on a translated page ───────────────────────────────────
// The class of defect, not an instance of it.
//
// Measured before this rule was written: index.html carried 41 visible prose
// blocks with no hook, including the hero headline and the footer disclaimer —
// the two most prominent strings on the page, in English, for every visitor
// whose browser is not English. Rule 2 cannot see that, because rule 2 asks
// "does every hook resolve?", never "does every string have a hook?". The
// dictionary was complete; the markup simply never asked for it.
//
// SCOPE, and why it is drawn here. Only 1 of 82 shipped pages declares itself
// translated (it has at least one hook); the other 81 have none and are
// untranslated by decision, not by oversight. Demanding hooks on those would be
// 2,046 decisions nobody made, and a gate that fires on 2,046 known items is a
// gate that gets ignored — which is how this branch started. So the rule
// applies to pages that claim translation, which is the claim the product makes
// about itself.
//
// EXEMPT, deliberately:
//   - text that is not prose (units, bare numbers, symbols, punctuation);
//   - blocks shorter than six words, which are labels and captions;
//   - pages with no hook at all, which are not claimed to be translated.
// The floor and the ceiling are both reported, so the number is visible and can
// only fall.
const proseFindings = [];
for (const page of shippedPages()) {
  const html = readFileSync(page, "utf8");
  // The detector lives in scripts/lib/gates.mjs as a pure function, so a test
  // can prove it FIRES on the markup that caused this defect without mutating
  // the working tree — the race that cost three CI cycles on this branch.
  if (!claimsTranslation(html)) continue; // page does not claim translation
  for (const block of unkeyedProse(html))
    proseFindings.push(
      `${page}: <${block.tag}> ${JSON.stringify(block.text.slice(0, 60))}…`,
    );
}
// The remaining 51 are REAL and KNOWN: the FAQ answers, the bill-of-materials
// spec text, the legal copy, and the wizard/field help on the one translated
// page. Keying them is P5 work (R-I18N-07 waves), not this branch. This ceiling
// is a committed constant on purpose — it started as an env override, which is a
// gate anyone can loosen without touching the file, which is the failure mode
// this repo treats as worse than a red build. Lower it as blocks get keyed;
// never raise it without a measured reason in the commit that raises it.
//
// THIS NUMBER WENT UP, 39 -> 51, AND IT MUST BE READ AS A FIX, NOT A LOOSENING.
// The 39 was not a count of unkeyed prose; it was a count of what the detector
// was able to SEE. The old block regex required a literal `</tag>`, so a prose
// paragraph nested inside a `<label>` or a `<li>` was swallowed whole by its
// parent match and never examined. Measured in a real browser at Accept-Language
// de-DE against document.body.textContent: of the 51 blocks below, 48 are
// English in the rendered German DOM (the other 3 fragments straddle a `<br>`,
// where textContent inserts no whitespace, so the search misses them — they are
// English too). The 12 the fix added are the 12 the old gate was blind to.
// A ceiling of 39 would have been satisfiable while 12 real leaks shipped.
//
// The blind-region and case-insensitivity fixes in the detector did NOT move
// this number: index.html contains no <p> inside any of its four script blocks,
// so the JSON-LD FAQ text was never a false positive. Recorded here because I
// first believed it was, and the belief was wrong.
const PROSE_CEILING = 51;
if (proseFindings.length > PROSE_CEILING) {
  fail(
    `${proseFindings.length} visible prose block(s) on a translated page carry no i18n hook ` +
      `(ceiling ${PROSE_CEILING}): ${proseFindings.slice(0, 4).join(" | ")}`,
  );
} else {
  console.log(
    `     unkeyed prose on translated pages: ${proseFindings.length}/${PROSE_CEILING} ceiling ` +
      `(known, tracked, must fall)`,
  );
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
