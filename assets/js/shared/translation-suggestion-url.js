const ISSUE_URL =
  "https://github.com/Sovereign-Communication/BigEnergyCo/issues/new";
const MAX_KEY_LENGTH = 100;
const MAX_QUOTE_LENGTH = 300;

function compact(value, limit) {
  return Array.from(
    String(value || "")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  )
    .slice(0, limit)
    .join("");
}

export function translationSuggestionUrl({
  locale = "en",
  page = "/",
  key = "",
  quotedText = "",
} = {}) {
  const candidateLocale = compact(locale, 12).toLowerCase();
  const safeLocale = /^[a-z]{2}(?:-[a-z]{2})?$/.test(candidateLocale)
    ? candidateLocale
    : "en";
  const pagePath = new URL(
    String(page || "/"),
    "https://freeoffgridcalculator.com",
  ).pathname;
  const keyText =
    compact(key, MAX_KEY_LENGTH) ||
    "(not identified; select the translated text)";
  const quote = compact(quotedText, MAX_QUOTE_LENGTH) || "(no text selected)";
  const issue = new URL(ISSUE_URL);
  issue.searchParams.set(
    "title",
    "Translation suggestion: " + safeLocale + " " + pagePath,
  );
  issue.searchParams.set(
    "body",
    [
      "Locale: " + safeLocale,
      "Page: " + pagePath,
      "Translation key: " + keyText,
      "Displayed text: " + quote,
      "Suggested correction:",
    ].join("\n"),
  );
  return issue.toString();
}
