// The English leak the static gate cannot see: runtime-rendered copy.
//
// Measured 2026-10-28 (visual audit, es home page): all four BOM spec
// paragraphs rendered in English under lang="es" while every other string on
// the page was Spanish. The markup carries the right hooks —
// `<p data-i18n="lfpCells">` — but ui.js re-builds the BOM grid from
// BOM_ITEMS after the markup pass, and each card was constructed as
// `el("p", {}, item.desc)`: raw English, no hook. The applier therefore could
// neither translate it at first paint nor re-apply it on a language switch,
// and rules 1-9 of check-i18n.mjs all stayed green because they read the
// dictionary and the static markup, never the render path.
//
// The keys already exist in all seven locales (HOME_COPY carries the four
// descriptions), so this asserts the property that was actually broken: the
// render must resolve the description through the dictionary and keep the hook
// so a language switch re-applies it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { BOM_ITEMS } from "../assets/js/shared/content.js";
import { LOCALES } from "../assets/js/shared/locales.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const UI = readFileSync(join(ROOT, "assets", "js", "sizing", "ui.js"), "utf8");
const LANGS = Object.keys(LOCALES);

test("BOM cards: every runtime-rendered description names a locale key", () => {
  assert.ok(BOM_ITEMS.length > 0, "the BOM grid ships items");
  for (const item of BOM_ITEMS) {
    assert.ok(
      typeof item.descKey === "string" && item.descKey.length > 0,
      `BOM_ITEMS "${item.name}" carries no descKey, so the runtime render ` +
        `cannot resolve it through the dictionary`,
    );
  }
});

test("BOM cards: the desc key resolves in all seven locales", () => {
  for (const item of BOM_ITEMS) {
    for (const lang of LANGS) {
      assert.equal(
        typeof LOCALES[lang][item.descKey],
        "string",
        `locale ${lang} has no string for BOM key ${item.descKey}`,
      );
    }
  }
});

test("BOM cards: the render asks the dictionary and keeps the i18n hook", () => {
  assert.doesNotMatch(
    UI,
    /el\("p",\s*\{\},\s*item\.desc\)/,
    "ui.js builds the BOM description from the raw English item.desc, " +
      "which overwrites the translated static markup the applier just fixed",
  );
  assert.match(
    UI,
    /"data-i18n":\s*item\.descKey/,
    "ui.js must carry a data-i18n hook on the rendered description so " +
      "applyI18n() re-applies it on every language switch",
  );
  assert.match(
    UI,
    /el\("p",\s*\{[^}]*item\.descKey/,
    "ui.js must resolve the rendered description through the dictionary " +
      "at build time, not paste English",
  );
});
