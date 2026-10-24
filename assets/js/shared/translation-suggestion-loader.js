export async function openTranslationSuggestion(
  link,
  selectedRange,
  loadFeature,
  beforeForward = () => {},
) {
  try {
    await loadFeature();
    if (selectedRange) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(selectedRange);
    }
    beforeForward();
    link.click();
  } catch {
    window.location.assign(link.href);
  }
}

export function installTranslationSuggestionLoader(link, loadFeature) {
  if (!link || typeof loadFeature !== "function") return;
  link.dataset.translationSuggestionLoaderReady = "true";
  let selectedRange = null;
  let loading = null;
  let forwarding = false;
  link.addEventListener(
    "pointerdown",
    () => {
      const selection = window.getSelection();
      selectedRange = selection?.rangeCount
        ? selection.getRangeAt(0).cloneRange()
        : null;
    },
    true,
  );
  link.addEventListener(
    "click",
    (event) => {
      if (forwarding) {
        forwarding = false;
        return;
      }
      if (link.dataset.translationSuggestionReady === "true") return;
      event.preventDefault();
      if (loading) return;
      const range = selectedRange;
      selectedRange = null;
      loading = openTranslationSuggestion(
        link,
        range,
        loadFeature,
        () => (forwarding = true),
      ).finally(() => {
        loading = null;
      });
    },
    true,
  );
}
