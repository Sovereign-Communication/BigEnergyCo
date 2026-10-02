// The deferred dictionary must not leak a half-translated page.
//
// The dictionary is a dynamic import now, so there is a window where it has
// not resolved. The bar is not "the bytes went down" — it is that a visitor on
// a German or Arabic browser sees NATIVE copy on first paint, and that nothing
// renders as an English default or a raw key while the import is in flight.
import { test } from "node:test";
import assert from "node:assert/strict";

const I18N =
  "file:///C:/Users/SCM/Documents/GitHub/BigEnergyCo/BigEnergyCo-showcase/assets/js/shared/i18n.js";

test("LAZY: translate echoes the key before the dictionary lands, never English", async () => {
  // Fresh module registry so the import is genuinely in flight.
  const mod = await import(`${I18N}?fresh=${Date.now()}`);
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
  assert.ok(late.length > 10, `expected real copy, got ${JSON.stringify(late)}`);
});

test("LAZY: every locale renders native copy once loaded — including RTL", async () => {
  const mod = await import(I18N);
  const { LOCALES } = await import(
    "file:///C:/Users/SCM/Documents/GitHub/BigEnergyCo/BigEnergyCo-showcase/assets/js/shared/locales.js"
  );
  await mod.localesReady;
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
  assert.match(seen.get("de"), /Berechnung|nicht|falsch/, "German must be German");
});

test("LAZY: the boot path awaits the dictionary, so first paint is never English", async () => {
  // The property is enforced in ui.js by awaiting applyI18n() before the first
  // paint. Pinned at the source, because the failure it prevents — a flash of
  // the wrong language — is invisible to every other gate and to CI screenshots.
  const { readFileSync } = await import("node:fs");
  const ui = readFileSync(
    "C:/Users/SCM/Documents/GitHub/BigEnergyCo/BigEnergyCo-showcase/assets/js/sizing/ui.js",
    "utf8",
  );
  assert.match(
    ui,
    /await applyI18n\(\)/,
    "the boot path must await applyI18n, or a deferred dictionary paints English first",
  );
  // A dynamic import, not a static one: a static `import` at the top of
  // i18n.js would put locales.js straight back into the eager graph and undo
  // the whole point.
  const i18n = readFileSync(
    "C:/Users/SCM/Documents/GitHub/BigEnergyCo/BigEnergyCo-showcase/assets/js/shared/i18n.js",
    "utf8",
  );
  assert.doesNotMatch(
    i18n,
    /^import \{ LOCALES \}/m,
    "a static import of the dictionary puts it back in the first-paint graph",
  );
  assert.match(
    i18n,
    /import\("\.\/locales\.js/,
    "the dictionary must be fetched with a dynamic import",
  );
});
