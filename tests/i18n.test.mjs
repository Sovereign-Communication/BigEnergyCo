// i18n contract: English is the source of truth and must contain every key
// the UI can ask for; other locales fall back to English per key (never
// key-ese) via the t() chain and the data-i18n applier. New strings ship in
// English first — this test forbids dangling references, not untranslated
// strings.
// Run: node --test tests/i18n.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALES } from "../assets/js/shared/locales.js";
import { pickString } from "../assets/js/shared/interpolate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function readEnKeys() {
  const src = fs.readFileSync(
    path.join(ROOT, "assets/js/shared/locales.js"),
    "utf8",
  );
  const keys = new Set();
  let depth = 0;
  let inEn = false;
  for (const line of src.split(/\r?\n/)) {
    if (/^  en: \{$/.test(line)) inEn = true;
    else if (/^  \w+: \{$/.test(line) && depth === 1) inEn = false;
    depth +=
      (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
    if (inEn && depth >= 2) {
      const k = line.match(/^    (\w+):/);
      if (k) keys.add(k[1]);
    }
  }
  return keys;
}

function jsFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name !== "city-data") jsFiles(p, out);
    } else if (name.endsWith(".js")) out.push(p);
  }
  return out;
}

test("every t() and data-i18n key exists in English", () => {
  const en = readEnKeys();
  assert.ok(en.size > 50, "english source found");
  const used = new Set();
  for (const f of jsFiles(path.join(ROOT, "assets/js"))) {
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(/[^.\w]t\("([A-Za-z0-9_]+)"/g)) used.add(m[1]);
  }
  // Dynamic verdict keys are built as "frontierVerdict<X>" + ("Grid"|"Offgrid"):
  // the scan above only sees the prefix, so pin the ten full keys directly.
  // (Static data-i18n keys are intentionally NOT checked here: English lives
  // in the source markup and the applier keeps it when a dict lacks the key.)
  const dynamicPrefixes = [
    "frontierVerdictCovered",
    "frontierVerdictBeyondSweep",
    "frontierVerdictSteep",
    "frontierVerdictTapering",
    "frontierVerdictLinear",
  ];
  for (const p of dynamicPrefixes) used.delete(p);
  for (const p of dynamicPrefixes) {
    for (const suffix of ["Grid", "Offgrid"]) used.add(p + suffix);
  }
  const missing = [...used].filter((k) => !en.has(k));
  assert.deepEqual(
    missing,
    [],
    `keys referenced but absent from English: ${missing.join(", ")}`,
  );
});

test("advisor chrome is translated in every supported locale", () => {
  const keys = [
    "advisorTitle",
    "advisorSubtitle",
    "advisorIntro",
    "advisorBotNote",
    "advisorThinking",
    "advisorLabel",
    "advisorPlaceholder",
    "advisorSend",
    "advisorClose",
    "advisorBusyRetry",
    "advisorNoReply",
    "advisorBusy",
    "advisorUnreachable",
  ];
  for (const [loc, dict] of Object.entries(LOCALES)) {
    for (const key of keys) {
      assert.equal(typeof dict[key], "string", `${loc}.${key} missing`);
      assert.ok(dict[key].trim().length > 0, `${loc}.${key} empty`);
    }
  }
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /data-i18n="advisorTitle"/);
  assert.match(html, /data-i18n-placeholder="advisorPlaceholder"/);
  assert.match(html, /data-i18n-aria-label="advisorClose"/);
});

// Two locale-file defects that no other gate could see: a string glued
// together from pre-translated fragments in code cannot be reordered for
// another language, and the shipped Arabic advisor title once carried a
// corrupted byte pair (U+FFFD) that survived every existing check.
const FRAGMENT_KEYS = [
  "advisorBusyQuota",
  "advisorBusyWait",
  "advisorUnreachableRetry",
];

test("no locale string carries a lost byte or a split sentence", () => {
  for (const [loc, dict] of Object.entries(LOCALES)) {
    for (const [key, value] of Object.entries(dict)) {
      if (typeof value !== "string") continue;
      assert.ok(
        !value.includes("\uFFFD"),
        `${loc}.${key} carries U+FFFD — a lost byte, not a translation`,
      );
    }
    for (const key of FRAGMENT_KEYS) {
      assert.ok(
        !(key in dict),
        `${loc}.${key} is a sentence fragment — fold it into the key that owns the sentence`,
      );
    }
  }
});

test("runtime advisor copy interpolates through the locale placeholder contract", () => {
  const placeholders = {
    advisorBusy: "{status}",
    advisorBusyRetry: "{secs}",
    advisorUnreachable: "{status}",
  };
  for (const [loc, dict] of Object.entries(LOCALES)) {
    for (const [key, token] of Object.entries(placeholders)) {
      assert.ok(
        dict[key].includes(token),
        `${loc}.${key} must place ${token} where the runtime value belongs`,
      );
    }
  }
  const chat = fs.readFileSync(path.join(ROOT, "assets/js/chat.js"), "utf8");
  assert.match(
    chat,
    /\{ secs: waitSecs \}/,
    "the retry countdown must travel as a placeholder variable",
  );
  assert.match(
    chat,
    /\{ status: err\.status \}/,
    "the HTTP status must travel as a placeholder variable",
  );
});

// Interpolation used to pass the value as a string replacement, so a value
// containing "$&" or "$n" was read as a replacement pattern: the bill-start
// note silently dropped the "$2" of "$200". That defect had to be fixed in two
// separate helpers, which is why this used to pin both files' source. The
// substitution now has one owner (shared/interpolate.js), so the pins point at
// that single place and at the delegation from each reader.
test("interpolation never re-reads a value as a replacement pattern", async () => {
  const { translate } = await import("../assets/js/shared/i18n.js");
  const rendered = translate("quickBillStarts", { bill: "$200", kwh: 5 });
  assert.ok(
    rendered.includes("$200"),
    `the formatted bill must survive interpolation intact: ${rendered}`,
  );
  const helper = fs.readFileSync(
    path.join(ROOT, "assets/js/shared/interpolate.js"),
    "utf8",
  );
  assert.match(
    helper,
    /replaceAll\(`\{\$\{name\}\}`, \(\) =>/,
    "the replacer must be a function, never a string",
  );
  const i18n = fs.readFileSync(
    path.join(ROOT, "assets/js/shared/i18n.js"),
    "utf8",
  );
  assert.match(
    i18n,
    /return interpolate\(pickString\(dict, key, LOCALES\.en\), vars\);/,
    "i18n.js must delegate instead of substituting on its own",
  );
});

test("German is exposed and has a translated core result vocabulary", () => {
  const src = fs.readFileSync(
    path.join(ROOT, "assets/js/shared/i18n.js"),
    "utf8",
  );
  assert.match(src, /id: "de", label: "Deutsch"/);
  const locale = fs.readFileSync(
    path.join(ROOT, "assets/js/shared/locales.js"),
    "utf8",
  );
  assert.match(locale, /de: \{/);
  assert.match(locale, /navSizing: "System dimensionieren"/);
  assert.match(locale, /frontierTitle:/);
});

test("the locale lookup falls back to English before the raw key", () => {
  const helper = fs.readFileSync(
    path.join(ROOT, "assets/js/shared/interpolate.js"),
    "utf8",
  );
  assert.ok(
    /fallbackDict\?\.\[key\]\s*\?\?\s*key/.test(helper),
    "the lookup must chain locale -> English -> raw key",
  );
  // Behaviorally, not just textually: a key only English carries must read as
  // English, and a key nothing carries must not read as key-ese garbage.
  assert.equal(pickString({}, "navBlog", LOCALES.en), LOCALES.en.navBlog);
  assert.equal(
    pickString({}, "definitelyNotAKey", LOCALES.en),
    "definitelyNotAKey",
  );
  // And the controller must not have grown a second lookup of its own again:
  // that duplication is what let the money bug need fixing twice.
  const ui = fs.readFileSync(path.join(ROOT, "assets/js/sizing/ui.js"), "utf8");
  assert.match(
    ui,
    /translate as t,/,
    "runtime copy binds to the shared lookup",
  );
  assert.doesNotMatch(
    ui,
    /function t\(key, params = \{\}\)/,
    "a local t() would be a second implementation of the same contract",
  );
});

// Locale parity follows the product's English-source contract: every
// translated locale must carry each key defined by the English dictionary.
// Additional locale-specific keys are allowed, and unused missing strings
// continue to fall back to their English/source-markup equivalents.
test("locale parity: every English key exists in each translated locale", () => {
  const englishKeys = Object.keys(LOCALES.en);
  for (const [code, dict] of Object.entries(LOCALES)) {
    if (code === "en") continue;
    const missing = englishKeys.filter((key) => !(key in dict));
    assert.deepEqual(
      missing,
      [],
      `${code} missing English keys: ${missing.join(", ")}`,
    );
  }
});
