// Plan §8 P0.4 / Q-09-adjacent: "The `/next/` noindex tag is removed in the
// lab build only, so SEO can be audited."
//
// WHY THIS IS A TRANSFORM AND NOT A FLAG ON THE PAGE. `/next/` is a temporary
// preview of the new app and stays noindex, and not in the sitemap, until the
// P8 swap. That is correct for the deployed site and wrong for the lab: the
// quality pass measures SEO (Lighthouse's `seo` category is ratcheted, and the
// audit wants to know what the page scores) and a noindexed page is excluded
// from SEO evaluation by definition, so a lab build that kept the tag measures
// nothing. Removing the tag in the SOURCE would ship an indexable preview of an
// unreleased app. So it is removed in the STAGED tree the gates audit, and in
// nothing else.
//
// THE SAFETY PROPERTY THIS FILE EXISTS TO KEEP. Exactly one thing must be true
// at all times: a deploy can never carry the strip. A build that strips noindex
// outside a lab stage would put an unreleased app into search results, which is
// the one failure here with a consequence outside the repository. So the
// transform is a pure function over (path, html) that REFUSES a path outside
// `/next/`, and the staging script applies it only under `--lab`; the deploy
// path never calls it. Both halves are asserted in tests/lab-build.test.mjs.

/** The prefix the preview app ships under. */
export const NEXT_PREFIX = "next/";

/**
 * True only for HTML pages under `/next/`.
 *
 * Normalises a repo-relative path and requires a real `.html` under the
 * prefix. A path like `next.js` or `next.html` at the root, or a directory
 * merely named `nextsomething`, must all be false — otherwise a future page
 * with a similar name would have its robots policy rewritten by a name prefix
 * that was never meant to match it.
 */
export function isNextPath(rel) {
  const p = String(rel ?? "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "");
  return p.startsWith(NEXT_PREFIX) && /\.html?$/i.test(p);
}

/**
 * Removes `noindex` from a robots meta tag in one HTML document.
 *
 * Behaviour, and each choice stated because the alternative is worse:
 *
 *   - Only the `content` value is touched. The tag's `name="robots"` is left
 *     alone, because the lab page still wants `nofollow` if it was declared:
 *     the point is to let the SEO audit see the page, not to declare it
 *     authoritative.
 *   - If removing `noindex` leaves nothing meaningful, the whole tag is
 *     dropped rather than left as `<meta name="robots" content="" />`, which
 *     is valid-but-meaningless markup that a checker would have to special-case.
 *   - If the document has no robots meta at all, this is a NO-OP. A page that
 *     never declared noindex has nothing to remove, and inventing a tag for it
 *     would be the transform changing something it was not asked to change.
 *   - It never adds a tag, and never touches any other meta, link, or script.
 */
export function stripNoindex(html) {
  const src = String(html ?? "");
  // Only robots meta. The attribute order is matched loosely so a page that
  // writes name after content is still handled, which is the form a hand-edited
  // page is most likely to use.
  const re =
    /<meta\b[^>]*\bname\s*=\s*["']robots["'][^>]*>|<meta\b[^>]*\bcontent\s*=\s*["'][^"']*noindex[^"']*["'][^>]*>/gi;
  let touched = false;
  const out = src.replace(re, (tag) => {
    const contentMatch = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i);
    if (!contentMatch) return tag;
    const before = contentMatch[1];
    const after = before
      .split(",")
      .map((d) => d.trim())
      .filter((d) => d && d.toLowerCase() !== "noindex")
      .join(", ");
    if (after === before) return tag;
    touched = true;
    if (!after) return "";
    return tag.replace(contentMatch[0], `content="${after}"`);
  });
  return { html: out, changed: touched };
}

/**
 * Applies the lab transform to one staged file.
 *
 * Returns the file UNCHANGED for anything that is not a `/next/` HTML page —
 * this is the single place the safety property is enforced, and it is enforced
 * here rather than trusted to the caller's loop being correct.
 */
export function labTransform(rel, html) {
  if (!isNextPath(rel)) return { html, changed: false };
  return stripNoindex(html);
}
