import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deployedFiles, sitemapGaps } from "../scripts/lib/gates.mjs";
import { isFreeUsdOffer, metadataIssues } from "../scripts/lib/seo.mjs";

const text = (length) => `Solar ${"x".repeat(length - 6)}`;
const markup = (
  title = text(20),
  h1 = "Solar sizing",
  description = text(70),
) =>
  `<title>${title}</title><h1>${h1}</h1><meta name="description" content="${description}">`;
const valid = (...pages) =>
  metadataIssues(pages.map((html, page) => ({ page: String(page), html })))
    .length === 0;

test("deployed pages have valid unique metadata and an exact sitemap match", () => {
  const pages = deployedFiles()
    .filter((file) => file.endsWith(".html") && file !== "404.html")
    .map((page) => ({ page, html: readFileSync(page, "utf8") }));
  const urls = [
    ...readFileSync("sitemap.xml", "utf8").matchAll(/<loc>([^<]+)<\/loc>/g),
  ].map(([, url]) => url);

  assert.ok(pages.length);
  assert.deepEqual(metadataIssues(pages), []);
  assert.deepEqual(
    sitemapGaps(
      pages.map(({ page }) => page),
      urls,
      "https://freeoffgridcalculator.com/",
    ),
    { missing: [], extra: [] },
  );
});

test("metadata limits and required structure", () => {
  const cases = [
    // Inclusive bounds: 60/70/155 must pass, so the comparison is <= and >=.
    [
      "inclusive limits",
      [
        markup(text(60), "Solar sizing", text(70)),
        markup(text(59), "Battery sizing", text(155)),
      ],
      true,
    ],
    // Length is measured on rendered text. Both fixtures are over their limit
    // raw and under it collapsed, so they fail without normalization:
    // 63 title characters collapse to 59, and 74 to 70.
    [
      "whitespace collapses before measuring",
      [
        markup(
          text(20) + "  \n  " + "x".repeat(38),
          "Solar sizing",
          "x".repeat(34) + "  \n  " + "y".repeat(35),
        ),
      ],
      true,
    ],
    ["title over 60", [markup(text(61))], false],
    [
      "description under 70",
      [markup(text(20), "Solar sizing", text(69))],
      false,
    ],
    [
      "description over 155",
      [markup(text(20), "Solar sizing", text(156))],
      false,
    ],
    ["title missing", ["<h1>Solar sizing</h1>"], false],
    [
      "h1 missing",
      [
        `<title>${text(20)}</title><meta name="description" content="${text(70)}">`,
      ],
      false,
    ],
    [
      "description missing",
      [`<title>${text(20)}</title><h1>Solar sizing</h1>`],
      false,
    ],
    ["empty h1", [markup(text(20), "", text(70))], false],
    ["multiple h1s", [markup() + "<h1>Another</h1>"], false],
    // Two declarations of one field are the same uniqueness failure as two
    // pages sharing a value: the value is ambiguous, and only the first would
    // be read.
    ["two titles", [markup() + "<title>Second</title>"], false],
    [
      "two description metas",
      [markup() + `<meta name="description" content="${text(71)}">`],
      false,
    ],
    // A browser reads neither element inside <noscript> nor <template>, so a
    // wrapped copy on the same page is not a declaration and must not read
    // as a second one.
    [
      "a title wrapped in noscript is not a second declaration",
      [`<noscript><title>${text(20)}</title></noscript>${markup()}`],
      true,
    ],
    [
      "a title wrapped in template is not a second declaration",
      [`<template><title>${text(20)}</title></template>${markup()}`],
      true,
    ],
    [
      "a description meta wrapped in noscript is not a second declaration",
      [
        `<noscript><meta name="description" content="${text(71)}"></noscript>${markup()}`,
      ],
      true,
    ],
    [
      "a description meta wrapped in template is not a second declaration",
      [
        `<template><meta name="description" content="${text(71)}"></template>${markup()}`,
      ],
      true,
    ],
    // Ignoring the wrapper must not hide a real duplicate alongside it.
    [
      "a wrapped title does not mask a genuine second one",
      [
        `<noscript><title>${text(20)}</title></noscript>${markup()}<title>Second</title>`,
      ],
      false,
    ],
    // The h1 count reads the same view the title and description counts do.
    [
      "a wrapped h1 is not the page h1",
      [
        `<title>${text(20)}</title><template><h1>Solar sizing</h1></template><meta name="description" content="${text(70)}">`,
      ],
      false,
    ],
    [
      "a wrapped h1 does not collide with a real one",
      [`${markup()}<template><h1>Solar sizing</h1></template>`],
      true,
    ],
    ["blank title is missing", [markup("   ")], false],
    ["empty document", [""], false],
    ["empty page list", [], true],
    // Uniqueness is per field across pages, case- and whitespace-insensitive,
    // and a repeated value in one field does not collide with another.
    [
      "duplicate title ignores case and whitespace",
      [markup("Solar A"), markup("SOLAR   a", "Battery sizing", text(71))],
      false,
    ],
    [
      "duplicate h1",
      [
        markup("Solar A", "Battery sizing", text(70)),
        markup("Solar B", "Battery sizing", text(71)),
      ],
      false,
    ],
    [
      "duplicate description",
      [
        markup("Solar A", "Solar sizing", text(70)),
        markup("Solar B", "Battery sizing", text(70)),
      ],
      false,
    ],
    [
      "the same text in two different fields is not a duplicate",
      [markup("Solar A", "Solar A")],
      true,
    ],
  ];
  for (const [name, pages, expected] of cases)
    assert.equal(valid(...pages), expected, name);
});

test("a duplicate names both pages, whichever order they arrive in", () => {
  const pages = [
    { page: "about/index.html", html: markup("Shared Title") },
    {
      page: "blog/index.html",
      html: markup("Shared Title", "Battery sizing", text(71)),
    },
  ];
  const named = (entries) =>
    metadataIssues(entries).filter((issue) => issue.startsWith("duplicate "));

  // An 81-page site cannot be searched by value alone: the pair must be
  // reported, and both files must appear whichever page was read first.
  for (const issues of [named(pages), named([...pages].reverse())]) {
    assert.equal(issues.length, 1);
    assert.match(issues[0], /about\/index\.html/);
    assert.match(issues[0], /blog\/index\.html/);
  }

  // A third page must still be reported against the first, not the second:
  // last-wins would point at a middle page and lose the original.
  const third = {
    page: "solar-heatmap/index.html",
    html: markup("Shared Title", "Heatmap sizing", text(72)),
  };
  const all = named([...pages, third]);
  assert.equal(all.length, 2);
  for (const issue of all) assert.match(issue, /about\/index\.html/);
  assert.match(all[1], /solar-heatmap\/index\.html/);
});

test("a free offer must be a zero-price USD Offer", () => {
  const free = { "@type": "Offer", price: 0, priceCurrency: "USD" };
  // index.html ships the price as the string "0", so both forms must pass.
  assert.equal(isFreeUsdOffer(free), true);
  assert.equal(isFreeUsdOffer({ ...free, price: "0" }), true);
  // Rejections: wrong shape, wrong price, wrong currency, nothing at all.
  assert.equal(isFreeUsdOffer(null), false);
  assert.equal(isFreeUsdOffer({ ...free, "@type": "Product" }), false);
  assert.equal(isFreeUsdOffer({ ...free, price: 1 }), false);
  assert.equal(isFreeUsdOffer({ ...free, price: "0.01" }), false);
  assert.equal(isFreeUsdOffer({ ...free, priceCurrency: "EUR" }), false);
});
