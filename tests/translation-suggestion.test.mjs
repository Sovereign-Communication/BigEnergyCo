import test from "node:test";
import assert from "node:assert/strict";
import {
  translationSuggestionUrl,
} from "../assets/js/shared/translation-suggestion-url.js";
import {
  addTranslationSuggestionToPage,
} from "../scripts/lib/translation-suggestion.mjs";

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
  assert.equal(
    url.searchParams.get("title"),
    "Translation suggestion: es /",
  );
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
    /Translation key: \(not identified; select the translated text\)/,
  );
  assert.match(empty.searchParams.get("body"), /Displayed text: \(no text selected\)/);

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

test("every staged page gets one localized footer link and a relative script", () => {
  const source =
    '<html lang="en"><body><footer><p>Contact</p></footer></body></html>';
  const output = addTranslationSuggestionToPage(
    "blog/guides/example/index.html",
    source,
    "20261024e",
  );

  assert.equal((output.match(/data-translation-suggestion/g) || []).length, 1);
  assert.equal((output.match(/id="translation-suggestion-script"/g) || []).length, 1);
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
  assert.match(output, /<footer>[\s\S]*data-translation-suggestion[\s\S]*<\/footer>/);
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
