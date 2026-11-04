import { installTranslationSuggestionLoader } from "./shared/translation-suggestion-loader.js?v=20261104e";

installTranslationSuggestionLoader(
  document.querySelector("[data-translation-suggestion]"),
  () => import("./translation-suggestion.js?v=20261104e"),
);
