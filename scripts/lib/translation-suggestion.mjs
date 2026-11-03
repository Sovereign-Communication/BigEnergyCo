import { dirname, posix } from "node:path";
import { translationSuggestionUrl } from "../../assets/js/shared/translation-suggestion-url.js";

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function insertBeforeFirst(html, pattern, insertion) {
  const match = pattern.exec(html);
  if (!match) return null;
  return html.slice(0, match.index) + insertion + html.slice(match.index);
}

export function addTranslationSuggestionToPage(pagePath, html, assetVersion) {
  if (!/\.html$/i.test(pagePath)) return html;
  const scriptId = 'id="translation-suggestion-script"';
  const alreadyHasLink = html.includes("data-translation-suggestion");
  const alreadyHasScript = html.includes(scriptId);
  if (alreadyHasLink && alreadyHasScript) return html;

  const locale = /<html\b[^>]*\blang=["']([^"']+)["']/i.exec(html)?.[1] || "en";
  const fallbackHref = translationSuggestionUrl({
    locale,
    page: "/" + pagePath.replace(/\\/g, "/"),
  });
  const link =
    '<p class="translation-suggestion">' +
    '<a class="text-accent" data-i18n="suggestTranslationFix" ' +
    'data-translation-suggestion href="' +
    escapeAttribute(fallbackHref) +
    '">Suggest a translation fix</a></p>';

  let output = html;
  if (!alreadyHasLink) {
    const withFooterLink = insertBeforeFirst(
      output,
      /<\/footer\s*>/i,
      link,
    );
    if (withFooterLink) output = withFooterLink;
    else {
      const footer = "<footer>" + link + "</footer>\n";
      const withFooter = insertBeforeFirst(output, /<\/body\s*>/i, footer);
      if (!withFooter)
        throw new Error("Cannot add translation suggestion to " + pagePath);
      output = withFooter;
    }
  }

  if (!alreadyHasScript) {
    const relativeScript = posix.relative(
      dirname(pagePath.replace(/\\/g, "/")),
      "assets/js/translation-suggestion.js",
    );
    const safeVersion = /^[A-Za-z0-9_-]+$/.test(assetVersion || "")
      ? "?v=" + assetVersion
      : "";
    const script =
      '<script type="module" id="translation-suggestion-script" src="' +
      escapeAttribute(relativeScript + safeVersion) +
      '"></script>\n';
    const withScript = insertBeforeFirst(output, /<\/body\s*>/i, script);
    if (!withScript)
      throw new Error("Cannot load translation suggestion on " + pagePath);
    output = withScript;
  }
  return output;
}
