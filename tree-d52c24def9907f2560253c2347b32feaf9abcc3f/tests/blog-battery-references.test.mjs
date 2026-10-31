import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const article = readFileSync(
  "blog/battery-longevity-and-dod-reference/index.html",
  "utf8",
);
const heading = "<h2>9. References</h2>";
const headingIndex = article.indexOf(heading);
const referenceEnd = article.indexOf("</ul>", headingIndex);
const references = article.slice(headingIndex, referenceEnd);
const body = article.slice(0, headingIndex);

const expectedSources = [
  "https://www.osti.gov/biblio/1650174",
  "https://docs.nrel.gov/docs/fy19osti/73822.pdf",
  "https://assets.discoverbattery.com/documents/07_sla/885_product_literature/standard-agm-battery-performance.pdf",
  "https://www.catl.com/en/news/6861.html",
];

test("battery article references match its inline source links", () => {
  assert.notEqual(headingIndex, -1, "references heading exists");
  assert.notEqual(referenceEnd, -1, "references list is closed");

  const referenceLinks = [...references.matchAll(/href="([^"]+)"/g)]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(referenceLinks, [...expectedSources].sort());

  for (const source of expectedSources) {
    assert.ok(
      body.includes(`href="${source}"`),
      `${source} is cited in the article`,
    );
  }

  assert.match(references, /NREL\/TP-7A40-73822/);
  assert.doesNotMatch(
    article,
    /Standard AGM Performance|NREL\/TP-5400-67102|EVE Energy|HiNa Battery|Faradion Limited|Battery Council International|Berndt, D\./,
  );
});
