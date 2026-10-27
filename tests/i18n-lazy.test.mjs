// The deferred dictionary must not leak a half-translated page.
//
// The dictionary is a dynamic import now, so there is a window where it has
// not resolved. The bar is not "the bytes went down" — it is that a visitor on
// a German or Arabic browser sees NATIVE copy on first paint, and that nothing
// renders as an English default or a raw key while the import is in flight.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LOCALES } from "../scripts/lib/locale-data.mjs";

// Repo-relative, never absolute: these tests run on the Linux CI runner too,
// where a Windows checkout path does not exist. That failure mode cost a CI
// cycle on this file.
const I18N_URL = new URL("../assets/js/shared/i18n.js", import.meta.url);
const UI_PATH = fileURLToPath(
  new URL("../assets/js/sizing/ui.js", import.meta.url),
);
const I18N_PATH = fileURLToPath(I18N_URL);

test("LAZY: translate echoes the key before the dictionary lands, never English", async () => {
  // Fresh module registry so the import is genuinely in flight.
  const mod = await import(`${I18N_URL.href}?fresh=${Date.now()}`);
  // Before `localesReady` resolves there is no honest translation. Echoing the
  // KEY is the contract every caller already understands: chat.js treats
  // `value === key` as "fall back to the worker's English", and check-i18n
  // proves no rendered surface shows a key.
  const early = mod.translate("advisorDegradedReassure");
  assert.equal(
    early,
    "advisorDegradedReassure",
    "pre-load translate must echo the key, not guess or show English",
  );
  await mod.localesReady;
  const late = mod.translate("advisorDegradedReassure");
  assert.notEqual(
    late,
    "advisorDegradedReassure",
    "after the dictionary lands the same call must return copy",
  );
  assert.ok(
    late.length > 10,
    `expected real copy, got ${JSON.stringify(late)}`,
  );
});

test("LAZY: locale JSON uses the current immutable asset version", () => {
  const source = readFileSync(I18N_PATH, "utf8");
  const localeVersion = /const LOCALE_VERSION = "([\w-]+)"/.exec(source)?.[1];
  const moduleVersion = /from "\.\/direction\.js\?v=([\w-]+)"/.exec(
    source,
  )?.[1];
  assert.ok(localeVersion, "the lazy locale URL must carry a cache version");
  assert.equal(
    localeVersion,
    moduleVersion,
    "the immutable JSON URL must roll with its referencing module graph",
  );
  assert.match(
    source,
    /`\.\.\/\.\.\/i18n\/\$\{locale\}\.json\?v=\$\{LOCALE_VERSION\}\$\{retryQuery\}`/,
    "every lazy locale import uses the shared cache version and adds a retry token only after failure",
  );
});

test("LAZY: every locale renders native copy once loaded — including RTL", async () => {
  const mod = await import(I18N_URL.href);
  await mod.localesReady;
  await Promise.all(["en", "es", "pt", "fr", "de", "ar"].map(mod.loadLocale));
  const probe = "advisorDegradedReassure";
  const seen = new Map();
  for (const lang of ["en", "es", "pt", "fr", "de", "ar"]) {
    const text = mod.translate(probe, {}, lang);
    assert.equal(typeof text, "string");
    assert.notEqual(text, probe, `${lang} must not echo the key`);
    if (lang !== "en")
      assert.notEqual(
        text,
        LOCALES.en[probe],
        `${lang} must not be the English string`,
      );
    seen.set(lang, text);
  }
  assert.equal(
    new Set(seen.values()).size,
    seen.size,
    `every locale must be distinct: ${JSON.stringify([...seen])}`,
  );
  // The Arabic surface is the one where a broken boot is easiest to miss: RTL
  // text renders fine even when it is the wrong language.
  assert.match(seen.get("ar"), /[؀-ۿ]/, "Arabic must be Arabic script");
  // Word-based, not character-based: a German sentence is not required to
  // contain an umlaut, and asserting one made this test fail the moment the
  // copy was tightened — a test that breaks on good copy teaches nothing.
  assert.match(
    seen.get("de"),
    /Berechnung|nicht|falsch/,
    "German must be German",
  );
});

test("LAZY: applying Arabic installs RTL direction on the document", async () => {
  const mod = await import(I18N_URL.href);
  const previous = {
    localStorage: globalThis.localStorage,
    document: globalThis.document,
    window: globalThis.window,
  };
  const root = { lang: "en", dir: "ltr" };
  globalThis.localStorage = { getItem: () => "ar", setItem: () => {} };
  globalThis.document = { documentElement: root, querySelectorAll: () => [] };
  globalThis.window = {};
  try {
    await mod.applyI18n();
    assert.equal(root.lang, "ar");
    assert.equal(root.dir, "rtl");
    assert.equal(typeof globalThis.window.becoFormatNumber, "function");
    assert.equal(
      mod.formatNumber(1234.5),
      new Intl.NumberFormat("ar").format(1234.5),
      "default number formatting follows the selected locale",
    );
  } finally {
    for (const key of Object.keys(previous)) {
      if (previous[key] === undefined) delete globalThis[key];
      else globalThis[key] = previous[key];
    }
  }
});

test("LAZY: the boot path awaits the dictionary, so first paint is never English", async () => {
  // The property is enforced in ui.js by awaiting applyI18n() before the first
  // paint. Pinned at the source, because the failure it prevents — a flash of
  // the wrong language — is invisible to every other gate and to CI screenshots.
  const ui = readFileSync(UI_PATH, "utf8");
  assert.match(
    ui,
    /await applyI18n\(\)/,
    "the boot path must await applyI18n, or a deferred dictionary paints English first",
  );
  // A dynamic import, not a static one: a static `import` at the top of
  // A static import of all locale data would put every dictionary back in the
  // eager graph and undo the per-locale transfer boundary.
  const i18n = readFileSync(I18N_PATH, "utf8");
  assert.doesNotMatch(
    i18n,
    /^import .*locales\.js/m,
    "the runtime must not statically import the retired all-locale module",
  );
  assert.match(
    i18n,
    /import\(url, \{ with: \{ type: "json" \} \}\)/,
    "the selected locale must be loaded as a JSON module",
  );
  assert.match(i18n, /\.\.\/\.\.\/i18n\/\$\{locale\}\.json/);
});
