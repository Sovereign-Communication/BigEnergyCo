// prefers-reduced-motion contract: both runtime modules route scrolls through
// one shared policy, which returns instant scrolling when reduced motion is on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FILES = ["../assets/js/sizing/ui.js", "../assets/js/chat.js"];
const helperSource = readFileSync(
  new URL("../assets/js/chat.js", import.meta.url),
  "utf8",
);
const helper = helperSource.match(
  /window\.scrollBehavior\s*=\s*function scrollBehavior\(\)\s*\{([\s\S]*?)\n\};/,
)?.[1];

test("shared scroll policy returns instant motion for reduced-motion users", () => {
  assert.ok(helper, "shared helper must be exported by chat.js");
  assert.match(helper, /window\.matchMedia/);
  assert.match(helper, /prefers-reduced-motion:\s*reduce/);
  assert.match(helper, /\?\s*"auto"\s*:\s*"smooth"/);
});

for (const rel of FILES) {
  const src = readFileSync(new URL(rel, import.meta.url), "utf8");

  test(`${rel.slice(3)}: every scroll site uses the shared policy`, () => {
    assert.equal(
      /behavior:\s*"smooth"/.test(src),
      false,
      'raw behavior:"smooth" bypasses prefers-reduced-motion',
    );
    const sites = [...src.matchAll(/scrollIntoView\(/g)].length;
    const routed = [
      ...src.matchAll(/behavior:\s*window\.scrollBehavior\(\)/g),
    ].length;
    assert.ok(sites > 0, "expected at least one scroll site");
    assert.equal(
      routed,
      sites,
      `only ${routed} of ${sites} scrollIntoView sites route through the shared policy`,
    );
  });
}
