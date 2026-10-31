// prefers-reduced-motion contract: CSS `animation: none` cannot stop a JS-driven
// smooth scroll, so every scrollIntoView site must route through a
// scrollBehavior() helper that checks the media query. A raw
// `behavior: "smooth"` literal anywhere is the defect this pins.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FILES = ["../assets/js/sizing/ui.js", "../assets/js/chat.js"];

for (const rel of FILES) {
  const src = readFileSync(new URL(rel, import.meta.url), "utf8");

  test(`${rel.slice(3)}: no raw smooth-scroll literal — every scroll site uses scrollBehavior()`, () => {
    assert.equal(
      /behavior:\s*"smooth"/.test(src),
      false,
      'raw behavior:"smooth" bypasses prefers-reduced-motion',
    );
    assert.match(
      src,
      /function scrollBehavior\(\)/,
      "helper must exist locally",
    );

    const sites = [...src.matchAll(/scrollIntoView\(/g)].length;
    const routed = [...src.matchAll(/behavior:\s*scrollBehavior\(\)/g)].length;
    assert.ok(sites > 0, "expected at least one scroll site");
    assert.equal(
      routed,
      sites,
      `only ${routed} of ${sites} scrollIntoView sites route through scrollBehavior()`,
    );
  });
}
