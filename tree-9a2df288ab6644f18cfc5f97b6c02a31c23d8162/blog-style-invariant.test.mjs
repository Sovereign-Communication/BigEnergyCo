import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const blogDir = new URL("../blog/", import.meta.url);
const slugs = readdirSync(blogDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== "assets")
  .map((entry) => entry.name)
  .sort();
const canonicalSlug = "is-a-home-battery-worth-it";

function styleBlocks(slug) {
  const html = readFileSync(
    new URL(`../blog/${slug}/index.html`, import.meta.url),
    "utf8",
  );
  return [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(
    (match) => match[1],
  );
}

test("each blog article has the canonical shared inline style block", () => {
  const canonical = styleBlocks(canonicalSlug);
  assert.equal(canonical.length, 1, "canonical article has one style block");

  for (const slug of slugs) {
    const blocks = styleBlocks(slug);
    assert.equal(blocks.length, 1, `${slug} has one style block`);
    assert.equal(
      blocks[0],
      canonical[0],
      `${slug} matches the canonical style`,
    );
  }
});
