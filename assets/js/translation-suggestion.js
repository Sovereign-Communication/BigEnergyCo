import { translationSuggestionUrl } from "./shared/translation-suggestion-url.js?v=20261024m";

const link = document.querySelector("[data-translation-suggestion]");

function keyFor(node) {
  const element =
    node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  const keyed = element?.closest("[data-i18n], [data-i18n-html]");
  return (
    keyed?.getAttribute("data-i18n") ||
    keyed?.getAttribute("data-i18n-html") ||
    ""
  );
}

function selectionDetails() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return { key: "", quotedText: "" };
  const keys = [
    keyFor(selection.anchorNode),
    keyFor(selection.focusNode),
  ].filter(Boolean);
  const uniqueKeys = [...new Set(keys)];
  return {
    key: uniqueKeys.join(", "),
    quotedText: selection.toString(),
  };
}

if (link) {
  link.dataset.translationSuggestionReady = "true";
  let pointerSelection = null;
  const refreshHref = () => {
    const selected = pointerSelection || selectionDetails();
    pointerSelection = null;
    link.href = translationSuggestionUrl({
      locale: document.documentElement.lang,
      page: window.location.pathname,
      key: selected.key,
      quotedText: selected.quotedText,
    });
  };

  link.addEventListener(
    "pointerdown",
    () => {
      pointerSelection = selectionDetails();
    },
    true,
  );
  link.addEventListener("click", refreshHref, true);
  link.addEventListener("auxclick", refreshHref, true);
}
