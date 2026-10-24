import test from "node:test";
import assert from "node:assert/strict";
import { translationSuggestionUrl } from "../assets/js/shared/translation-suggestion-url.js";
import {
  installTranslationSuggestionLoader,
  openTranslationSuggestion,
} from "../assets/js/shared/translation-suggestion-loader.js";
import { addTranslationSuggestionToPage } from "../scripts/lib/translation-suggestion.mjs";

test("issue draft contains only locale, pathname, key, and quoted translation", () => {
  const url = new URL(
    translationSuggestionUrl({
      locale: "es",
      page: "/?utm_source=private#sizing",
      key: "heroIntro",
      quotedText: "Copia traducida",
    }),
  );

  assert.equal(
    url.origin + url.pathname,
    "https://github.com/Sovereign-Communication/BigEnergyCo/issues/new",
  );
  assert.equal(url.searchParams.get("title"), "Translation suggestion: es /");
  assert.equal(
    url.searchParams.get("body"),
    [
      "Locale: es",
      "Page: /",
      "Translation key: heroIntro",
      "Displayed text: Copia traducida",
      "Suggested correction:",
    ].join("\n"),
  );
  assert.equal(url.searchParams.has("utm_source"), false);
});

test("empty and long selections remain usable and bounded", () => {
  const empty = new URL(translationSuggestionUrl({ locale: "ar", page: "/" }));
  assert.match(
    empty.searchParams.get("body"),
    /Translation key: \(select the translated text\)/,
  );
  assert.doesNotMatch(empty.searchParams.get("body"), /Displayed text:/);

  const longQuote = "x".repeat(500);
  const longUrl = new URL(
    translationSuggestionUrl({
      locale: "en",
      page: "/",
      key: "k".repeat(200),
      quotedText: longQuote,
    }),
  );
  const body = longUrl.searchParams.get("body");
  assert.match(body, new RegExp("Translation key: " + "k".repeat(100) + "\\n"));
  assert.match(body, new RegExp("Displayed text: " + "x".repeat(300) + "\\n"));
});

test("lazy suggestion opening restores selection before forwarding the click", async () => {
  const calls = [];
  const range = { id: "selected-text" };
  const priorWindow = globalThis.window;
  globalThis.window = {
    getSelection: () => ({
      removeAllRanges: () => calls.push("clear"),
      addRange: (value) => calls.push(value),
    }),
    location: { assign: (href) => calls.push(href) },
  };
  try {
    await openTranslationSuggestion(
      { href: "/fallback", click: () => calls.push("click") },
      range,
      async () => calls.push("feature"),
    );
  } finally {
    if (priorWindow === undefined) delete globalThis.window;
    else globalThis.window = priorWindow;
  }
  assert.deepEqual(calls, ["feature", "clear", range, "click"]);
});

test("the lazy click handler exposes when it is installed without loading its feature", () => {
  const listeners = new Map();
  const link = {
    dataset: {},
    addEventListener: (name, listener) => listeners.set(name, listener),
  };

  installTranslationSuggestionLoader(link, async () => {});

  assert.equal(link.dataset.translationSuggestionLoaderReady, "true");
  assert.equal(link.dataset.translationSuggestionReady, undefined);
  assert.ok(listeners.has("pointerdown"));
  assert.ok(listeners.has("click"));
});

test("every staged page gets one localized footer link and a relative script", () => {
  const source =
    '<html lang="en"><body><footer><p>Contact</p></footer></body></html>';
  const output = addTranslationSuggestionToPage(
    "blog/guides/example/index.html",
    source,
    "20261024e",
  );

  assert.equal((output.match(/data-translation-suggestion/g) || []).length, 1);
  assert.equal(
    (output.match(/id="translation-suggestion-script"/g) || []).length,
    1,
  );
  assert.match(output, /data-i18n="suggestTranslationFix"/);
  assert.match(
    output,
    /src="\.\.\/\.\.\/\.\.\/assets\/js\/translation-suggestion\.js\?v=20261024e"/,
  );
  assert.match(output, /Page%3A\+%2Fblog%2Fguides%2Fexample%2Findex\.html/);
  assert.equal(
    addTranslationSuggestionToPage(
      "blog/guides/example/index.html",
      output,
      "20261024e",
    ),
    output,
  );
});

test("pages without a footer receive one and invalid HTML fails closed", () => {
  const output = addTranslationSuggestionToPage(
    "404.html",
    '<html lang="en"><body><main>Missing</main></body></html>',
    "20261024e",
  );
  assert.match(
    output,
    /<footer>[\s\S]*data-translation-suggestion[\s\S]*<\/footer>/,
  );
  assert.throws(
    () =>
      addTranslationSuggestionToPage(
        "broken.html",
        "<html><body>Missing close",
        "20261024e",
      ),
    /Cannot add translation suggestion/,
  );
});

test("hot entry pages defer the full suggestion module", () => {
  const home =
    '<html lang="en"><body><footer><a data-translation-suggestion href="/">Suggest</a></footer></body></html>';
  assert.equal(
    addTranslationSuggestionToPage("index.html", home, "20261024e"),
    home,
  );

  const homeWithInjectedLink = addTranslationSuggestionToPage(
    "index.html",
    '<html lang="en"><body><footer>Contact</footer></body></html>',
    "20261024e",
  );
  assert.match(
    homeWithInjectedLink,
    /href="https:\/\/github\.com\/Sovereign-Communication\/BigEnergyCo\/issues\/new"/,
  );
  assert.doesNotMatch(homeWithInjectedLink, /&amp;body=/);

  const heatmap = addTranslationSuggestionToPage(
    "solar-heatmap/index.html",
    '<html lang="en"><body><footer>Contact</footer></body></html>',
    "20261024e",
  );
  assert.match(
    heatmap,
    /translation-suggestion-heatmap-loader\.js\?v=20261024e/,
  );
  assert.doesNotMatch(
    heatmap,
    /src="\.\.\/\.\.\/assets\/js\/translation-suggestion\.js/,
  );
});

import { LOCALES } from "../assets/js/shared/locales.js";

test("translation suggestion CTA copy preserves its reviewed source meaning in every locale", () => {
  const reviewedLabels = {
    en: "Suggest a translation fix",
    es: "Sugerir una corrección de traducción",
    pt: "Sugerir uma correção de tradução",
    fr: "Suggérer une correction de traduction",
    de: "Übersetzungskorrektur vorschlagen",
    nl: "Een vertaalcorrectie voorstellen",
    ar: "اقتراح تحسين الترجمة",
  };

  for (const [locale, label] of Object.entries(reviewedLabels)) {
    assert.equal(LOCALES[locale]?.suggestTranslationFix, label, locale);
  }
});
