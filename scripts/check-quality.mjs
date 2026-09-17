// Static quality gate for every public page. Run: node scripts/check-quality.mjs
//
// Scope: the accessibility/SEO/HTML invariants that are cheap to check offline
// and catastrophic to regress silently (a page Google drops, a control a
// screen-reader user cannot reach, a link that 404s in production).
//
// Two kinds of rule:
//   1. INVARIANTS — must hold everywhere, every run. The tree passes these
//      today; a new violation fails the build.
//   2. RATCHETS — real debt that is measured and frozen at today's count. The
//      count may only go DOWN. Raising one requires editing RATCHET below with
//      a justification, which is exactly the review moment we want; the
//      follow-up PRs that remove the debt set these to 0.
//
// Pages come from the deploy allowlist (scripts/deploy-pages-local.mjs), which
// is the single source of truth for what actually ships — checking the
// working tree instead would happily validate files users never receive.
import { readFileSync, existsSync } from "node:fs";
import { posix } from "node:path";
import {
  attr,
  aimsOutsideSite,
  bodyText,
  deployedFiles,
  metaContent,
  resolvesToDeployed,
  tags,
  wrappedByLabel,
} from "./lib/gates.mjs";

/**
 * Frozen debt. Every number here is debt, not a target — PRs that pay it down
 * must lower the number in the same commit.
 *   titlesOverBudget           69 (67 city pages + 2 posts) — long SERP titles
 *                              truncate; fixed by the title rewrite.
 *   descriptionsOutOfBounds     1 (215 chars) — trimmed by the same rewrite.
 *   inlineScriptBlocks          1 — solar-heatmap/index.html carries its whole
 *                              app (~590 lines) inline. This is what forces
 *                              CSP script-src 'unsafe-inline'; extracting it to
 *                              a versioned module removes the debt AND the CSP
 *                              exception in one move.
 *   inlineHandlers              8 (index.html) — same CSP blocker; removed by
 *                              delegating the listeners.
 *   inlineStyleAttributes     610 — tracked so the count cannot grow while the
 *                              utility-class migration is deferred.
 */
const RATCHET = {
  titlesOverBudget: 69,
  descriptionsOutOfBounds: 1,
  inlineScriptBlocks: 1,
  inlineHandlers: 8,
  inlineStyleAttributes: 610,
};

export const TITLE_MAX = 62; // ~580 px in the SERP; Google truncates past this
export const DESC_MIN = 70;
export const DESC_MAX = 160;

let failures = 0;
const fail = (msg) => {
  console.error(`FAIL ${msg}`);
  failures++;
};
const ok = (msg) => console.log(`OK   ${msg}`);

// ── page discovery (deploy allowlist = what users actually get) ─────────────
const files = deployedFiles();
if (!files.length) fail("could not discover the deploy allowlist");
const deployed = new Set(files);
const pages = files.filter((f) => f.endsWith(".html"));
if (!pages.length) fail("no public pages discovered");

const sitemap = readFileSync("sitemap.xml", "utf8");
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (m) => m[1],
);
const sitemapPaths = new Map(
  sitemapUrls.map((u) => [
    u.replace("https://freeoffgridcalculator.com/", "").replace(/\/$/, "") ||
      "index.html",
    u,
  ]),
);

// ── per-page invariants ─────────────────────────────────────────────────────
const stats = {
  headingSkips: [],
  dupIds: [],
  missingAlt: [],
  unlabeled: [],
  unnamedButtons: [],
  noViewport: [],
  noLang: [],
  unsafeBlank: [],
  inlineScriptBlocks: [],
  brokenLinks: [],
  titleTooLong: [],
  titleDuplicates: [],
  descProblems: [],
  emptyMain: [],
  inlineHandlers: 0,
  inlineStyles: 0,
  sitemapCanonicalMismatch: [],
  badOgImage: [],
};
const titleSeen = new Map();

for (const page of pages) {
  if (!existsSync(page)) {
    fail(`${page}: file missing`);
    continue;
  }
  const html = readFileSync(page, "utf8");

  // Heading order: no skipped levels (h1 → h3 without an h2).
  const levels = [...html.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) {
      stats.headingSkips.push(`${page} (h${levels[i - 1]} → h${levels[i]})`);
      break;
    }
  }

  // Unique ids: duplicates break label/aria references and anchors.
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length)
    stats.dupIds.push(`${page} (${[...new Set(dup)].join(", ")})`);

  // Every image needs alt text (empty alt is a deliberate decorative choice).
  for (const tag of tags(html, "img")) {
    if (attr(tag, "alt") === null)
      stats.missingAlt.push(`${page}: ${tag.slice(0, 70)}`);
  }

  // Every form control needs an accessible name.
  const forIds = new Set(
    [...html.matchAll(/<label[^>]*\sfor="([^"]+)"/gi)].map((m) => m[1]),
  );
  const controls = [
    ...tags(html, "input"),
    ...tags(html, "select"),
    ...tags(html, "textarea"),
  ];
  for (const tag of controls) {
    if (attr(tag, "type") === "hidden") continue;
    const id = attr(tag, "id");
    if (attr(tag, "aria-label") || attr(tag, "aria-labelledby")) continue;
    if (id && forIds.has(id)) continue;
    if (wrappedByLabel(html, tag)) continue;
    stats.unlabeled.push(`${page}: ${tag.replace(/\s+/g, " ").slice(0, 80)}`);
  }

  // Every button needs a name (text, aria-label, or title).
  for (const tag of tags(html, "button")) {
    if (
      attr(tag, "aria-label") ||
      attr(tag, "aria-labelledby") ||
      attr(tag, "title")
    )
      continue;
    const idx = html.indexOf(tag);
    const inner = /^<button\b[^>]*>([\s\S]*?)<\/button>/i.exec(html.slice(idx));
    if (!inner || !bodyText(inner[1])) {
      stats.unnamedButtons.push(
        `${page}: ${tag.replace(/\s+/g, " ").slice(0, 80)}`,
      );
    }
  }

  if (!/name="viewport"/i.test(html)) stats.noViewport.push(page);
  if (!/<html[^>]*\slang=/i.test(html)) stats.noLang.push(page);

  // Reverse-tabnabbing: target=_blank must carry rel=noopener.
  for (const tag of tags(html, "a")) {
    if (attr(tag, "target") !== "_blank") continue;
    if (!/noopener/.test(attr(tag, "rel") || ""))
      stats.unsafeBlank.push(`${page}: ${attr(tag, "href")}`);
  }

  // Inline JS blocks are a CSP liability; JSON-LD data blocks are not code.
  for (const tag of tags(html, "script")) {
    if (attr(tag, "src")) continue;
    const type = (attr(tag, "type") || "").toLowerCase();
    if (type === "application/ld+json") continue;
    stats.inlineScriptBlocks.push(
      `${page}: ${tag.replace(/\s+/g, " ").slice(0, 80)}`,
    );
  }

  // Internal links must resolve to a file the deploy will actually ship —
  // checking the working tree here would validate files users never receive.
  const pageDir = posix.dirname(page);
  for (const tag of tags(html, "a")) {
    const href = attr(tag, "href");
    if (!href || /^(https?:|mailto:|tel:|#|javascript:|data:)/i.test(href))
      continue;
    if (aimsOutsideSite(href, pageDir)) continue;
    if (!resolvesToDeployed(href, pageDir, deployed))
      stats.brokenLinks.push(`${page} → ${href}`);
  }

  // Skip-link contract: a page that advertises #main must define it.
  if (/href="#main"/.test(html) && !/<main[^>]*\sid="main"/i.test(html))
    stats.emptyMain.push(page);

  // SERP shape: title length + uniqueness, description presence and bounds.
  const title = (/<title>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || "";
  if (title.length > TITLE_MAX)
    stats.titleTooLong.push(`${page} (${title.length})`);
  titleSeen.set(title, (titleSeen.get(title) || 0) + 1);
  const desc = metaContent(html, "name", "description");
  if (!desc) stats.descProblems.push(`${page}: missing`);
  else if (desc.length < DESC_MIN || desc.length > DESC_MAX)
    stats.descProblems.push(`${page}: ${desc.length} chars`);

  // og:image must exist in the build, or social cards break silently.
  const ogImage = metaContent(html, "property", "og:image");
  if (ogImage) {
    const p = ogImage.replace(/^https?:\/\/[^/]+\//, "").split("?")[0];
    if (!deployed.has(p)) stats.badOgImage.push(`${page}: ${ogImage}`);
  }

  // Canonical must match this page's own sitemap entry.
  const canonical = /<link\s+rel="canonical"\s+href="([^"]+)"/i.exec(
    html.replace(/\s+/g, " "),
  )?.[1];
  if (canonical && canonical.startsWith("https://freeoffgridcalculator.com/")) {
    if (!sitemapPaths.has(page.replace(/\/index\.html$/, "") || "index.html"))
      stats.sitemapCanonicalMismatch.push(`${page}: absent from sitemap`);
  }

  stats.inlineHandlers += (html.match(/\son[a-z]+\s*=/gi) || []).length;
  stats.inlineStyles += (html.match(/\sstyle="/gi) || []).length;
}

for (const [title, n] of titleSeen)
  if (n > 1) stats.titleDuplicates.push(title);

// ── report ──────────────────────────────────────────────────────────────────
const report = (list, label) => {
  const n = list.length;
  if (!n) {
    ok(`${pages.length} pages: ${label}`);
    return;
  }
  if (n <= 8) for (const item of list) fail(`${label} — ${item}`);
  else fail(`${label} — ${n} page(s): ${list.slice(0, 5).join("; ")} …`);
};
report(stats.headingSkips, "heading levels never skip");
report(stats.dupIds, "element ids are unique");
report(stats.missingAlt, "every img has alt");
report(stats.unlabeled, "every input/select/textarea is labelled");
report(stats.unnamedButtons, "every button has an accessible name");
report(stats.noViewport, "viewport meta present");
report(stats.noLang, "html lang present");
report(stats.unsafeBlank, "target=_blank links carry rel=noopener");
report(stats.brokenLinks, "internal links resolve to deployed files");
report(stats.emptyMain, "skip-link target #main exists");
report(stats.titleDuplicates, "page titles are unique");
report(stats.badOgImage, "og:image points at a deployed asset");
report(stats.sitemapCanonicalMismatch, "canonical pages appear in the sitemap");

// Ratchets: count-only, may never grow. Lowering a budget is the whole point;
// raising one is a deliberate, reviewable act — stale numbers are how gates
// quietly stop meaning anything.
const ratchet = (measured, budget, label, hint, detail = "") => {
  if (measured <= budget) ok(`${label}: ${measured} (budget ${budget})`);
  else
    fail(
      `${label}: ${measured} exceeds the frozen budget ${budget} — ${hint}` +
        (detail ? `\n     ${detail}` : ""),
    );
};
ratchet(
  stats.titleTooLong.length,
  RATCHET.titlesOverBudget,
  "titles longer than 62 characters",
  "shorten the title template instead of adding another long one",
  stats.titleTooLong.slice(0, 5).join("; "),
);
ratchet(
  stats.descProblems.length,
  RATCHET.descriptionsOutOfBounds,
  `descriptions outside ${DESC_MIN}-${DESC_MAX} characters`,
  "trim or extend the description",
  stats.descProblems.slice(0, 5).join("; "),
);
ratchet(
  stats.inlineScriptBlocks.length,
  RATCHET.inlineScriptBlocks,
  "executable inline script blocks",
  "extract the block to a versioned module — inline script is what forces CSP 'unsafe-inline'",
  stats.inlineScriptBlocks.slice(0, 5).join("; "),
);
ratchet(
  stats.inlineHandlers,
  RATCHET.inlineHandlers,
  "inline event handlers",
  "delegate to addEventListener; this blocks removing CSP 'unsafe-inline'",
);
ratchet(
  stats.inlineStyles,
  RATCHET.inlineStyleAttributes,
  "inline style attributes",
  "use an existing utility class instead of a style attribute",
);

console.log(
  failures
    ? `\n${failures} QUALITY FAILURE(S)`
    : `\nQUALITY OK (${pages.length} pages, ${Object.keys(RATCHET).length} frozen ratchets)`,
);
process.exit(failures ? 1 : 0);
