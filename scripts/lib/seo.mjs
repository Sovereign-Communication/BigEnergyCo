import { attr, bodyText, decodeEntities, metaContent, tags } from "./gates.mjs";

const TITLE_MAX = 60;
const DESCRIPTION_MIN = 70;
const DESCRIPTION_MAX = 155;

/** @param {{"@type"?: string, price?: string | number, priceCurrency?: string} | null | undefined} offer */
export const isFreeUsdOffer = (offer) =>
  offer?.["@type"] === "Offer" &&
  (offer.price === 0 || offer.price === "0") &&
  offer.priceCurrency === "USD";

const collapse = (text) =>
  String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();

// A browser reads neither <title> nor <meta> inside <noscript> or <template>,
// so those are not declarations at all. Nothing else is stripped: comments and
// scripts are left alone, because no shipped page may carry a title in one and
// counting it would reject input for a reason the plan does not give.
const readable = (html) =>
  html.replace(/<(noscript|template)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, "");

/** @param {{page: string, html: string}[]} pages @returns {string[]} */
export function metadataIssues(pages) {
  const issues = [];
  const seen = new Map();

  for (const { page, html } of pages) {
    // R-SEO-01 asks for metadata unique per page. Two titles or two
    // descriptions on one page are the same failure as two pages sharing one:
    // the value is ambiguous, and only the first would be read. Counted on
    // what a browser reads, so a wrapped copy is not a second declaration.
    const source = readable(html);
    const titles = [...source.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)];
    if (titles.length > 1)
      issues.push(`${page}: ${titles.length} <title> elements, expected 1`);

    const descriptionTags = tags(source, "meta").filter(
      (tag) => (attr(tag, "name") || "").toLowerCase() === "description",
    );
    if (descriptionTags.length > 1)
      issues.push(
        `${page}: ${descriptionTags.length} description metas, expected 1`,
      );

    const headings = [...source.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
    if (headings.length !== 1)
      issues.push(`${page}: expected exactly 1 <h1>, found ${headings.length}`);

    // Lengths and uniqueness are measured on what a reader actually sees, so
    // metaContent's entity decoding is not re-decoded here.
    const title = collapse(decodeEntities(titles[0]?.[1]));
    const description = collapse(metaContent(source, "name", "description"));
    if (description && description.length < DESCRIPTION_MIN)
      issues.push(
        `${page}: description length ${description.length} below ${DESCRIPTION_MIN}`,
      );

    /** @type {[string, string, number][]} */
    const fields = [
      ["title", title, TITLE_MAX],
      ["h1", headings.length === 1 ? bodyText(headings[0][1]) : "", Infinity],
      ["description", description, DESCRIPTION_MAX],
    ];
    for (const [name, value, max] of fields) {
      if (!value) {
        issues.push(`${page}: ${name} is missing`);
        continue;
      }
      if (value.length > max)
        issues.push(`${page}: ${name} length ${value.length} over ${max}`);
      // Name both pages: on an 81-page site a shared value alone is not
      // locatable, and every other issue in this function names its page.
      const key = `${name}\0${value.toLowerCase()}`;
      const first = seen.get(key);
      if (first === undefined) seen.set(key, page);
      else
        issues.push(
          `duplicate ${name}: ${first} and ${page} both use "${value}"`,
        );
    }
  }
  return issues;
}
