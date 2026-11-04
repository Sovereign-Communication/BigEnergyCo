import { installTranslationSuggestionLoader } from "./shared/translation-suggestion-loader.js?v=20261103f";

installTranslationSuggestionLoader(
  document.querySelector("[data-translation-suggestion]"),
  () => import("./translation-suggestion.js?v=20261103f"),
);
