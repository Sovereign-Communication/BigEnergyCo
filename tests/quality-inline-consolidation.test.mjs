import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FACET_EVIDENCE } from "../scripts/lib/jev-facet-evidence.mjs";
import { BYTE_BUDGET_FACET_AXES } from "../scripts/lib/byte-budgets.mjs";

const home = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const siteCss = readFileSync(
  new URL("../assets/site.css", import.meta.url),
  "utf8",
);
const tags = [...home.matchAll(/<[a-z][^>]*>/gi)].map((match) => match[0]);
const normalize = (value) =>
  value.replace(/\s+/g, " ").trim().replace(/;$/, "");
const inlineStyles = tags
  .map((tag) => tag.match(/\sstyle="([^"]*)"/i)?.[1])
  .filter(Boolean)
  .map(normalize);
const countClass = (name) =>
  tags.filter((tag) => {
    const classes = tag.match(/\bclass="([^"]*)"/i)?.[1] || "";
    return classes.split(/\s+/).includes(name);
  }).length;

const consolidated = [
  ["text-accent", "color: var(--primary-accent)", 10],
  ["paragraph-spacing", "margin-bottom: 1rem", 9],
  ["legal-section-heading", "color: #fff; margin-bottom: 0.5rem", 9],
  ["no-bottom-spacing", "margin-bottom: 0", 7],
  ["preset-button", "padding: 0.3rem 0.65rem; font-size: 0.78rem", 5],
  ["offgrid-preset-button", "padding: 0.25rem 0.55rem; font-size: 0.75rem", 4],
  ["soc-zoom-button", "padding: 0.22rem 0.55rem; font-size: 0.75rem", 4],
  [
    "muted-small",
    "font-weight: 400; font-size: 0.8em; color: var(--text-muted)",
    4,
  ],
  [
    "legal-trigger",
    "font-size: 0.85rem; padding: 0.4rem 0.8rem; display: inline-block",
    3,
  ],
  ["range-control", "width: 100%; margin-top: 0.4rem; cursor: pointer", 3],
  [
    "result-caption",
    "font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem; line-height: 1.55",
    2,
  ],
];

test("home page repeat styles live in named rules rather than style attributes", () => {
  const styleBlock = home.match(/<style\b[^>]*>([\s\S]*?)<\/style>/i)?.[1];
  assert.ok(styleBlock, "the home page utility rules are present");
  const normalizedRules = styleBlock.replace(/\s+/g, " ");
  for (const [name, declaration, count] of consolidated) {
    assert.equal(countClass(name), count, `${name} class count`);
    assert.ok(
      normalizedRules.includes(`.${name} { ${declaration}; }`),
      `${name} keeps ${declaration}`,
    );
    assert.ok(
      !inlineStyles.includes(declaration),
      `${declaration} remains as an inline style`,
    );
  }
});

test("close buttons reuse the existing cursor rule", () => {
  const closeButtons = tags.filter((tag) =>
    /\bclass="[^"]*\bclose-btn\b/.test(tag),
  );
  assert.equal(closeButtons.length, 3);
  assert.ok(closeButtons.every((tag) => !/\sstyle=/i.test(tag)));
  assert.match(siteCss, /\.close-btn\s*\{[^}]*cursor:\s*pointer\s*;/s);
});

test("quality facet evidence is derived from the byte-budget run", () => {
  assert.deepEqual(BYTE_BUDGET_FACET_AXES, ["quality"]);
  assert.equal(
    Object.hasOwn(FACET_EVIDENCE, "quality"),
    false,
    "quality is a run-derived facet, not a hand-authored line",
  );
});
