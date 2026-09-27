// The axe findings the P0.4(b) matrix measured, pinned to the markup that
// caused them.
//
// Why source assertions: the end-to-end proof is the matrix itself, which
// audits the real rendered page and is attached to the PR as a report. These
// tests are the fast local half — they fail in under a second, before a browser
// is involved, and they name WHICH contract broke. A gate that only proves a
// page is clean leaves you hunting; a test that only reads the source proves
// nothing on its own. Both, each doing its own job.
//
// Every assertion here corresponds to a measured finding with a real target:
//   aria-required-children [critical]  #cumCostLegend
//   nested-interactive   [serious]    the frontier chart's svg
//   region               [moderate]   the blog index hero
//   scrollable-region-focusable [serious] a post's table wrapper
//   landmark-one-main    [moderate]   404
//   region               [moderate]   404
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const CHARTS = "assets/js/sizing/charts.js";
const FRONTIER = "assets/js/sizing/frontier-chart.js";
const BLOG_INDEX = "blog/index.html";
const BLOG_POST = "blog/battery-longevity-and-dod-reference/index.html";
const NOT_FOUND = "404.html";

test("A11Y: the chart legend is a list, so its rows are list items", () => {
  // aria-required-children [critical] at #cumCostLegend. The container has had
  // role="list" and an accessible name since it was written, but the rows the
  // renderer appends were plain spans — so the list had no items, and a screen
  // reader announcing a "list" hears an empty one.
  const html = read("index.html");
  const legend = /id="cumCostLegend"[\s\S]*?>/.exec(html);
  assert.ok(legend, "the legend element exists in the home document");
  assert.match(
    legend[0],
    /role="list"/,
    "the container keeps role=list: it is a set of colour keys, and that is what it is",
  );
  assert.match(
    legend[0],
    /aria-label="/,
    "and it keeps its accessible name, which is what made the role worth having",
  );

  const charts = read(CHARTS);
  // The row each key is appended as. One property, in one place, and prettier
  // may put it on its own line — so the match spans newlines.
  const row = /el\("span",\s*\{[\s\S]{0,120}?role:\s*"listitem"/.exec(charts);
  assert.ok(
    row,
    `every legend row must be appended with role="listitem" or the list has no items. Found in ${CHARTS}:\n${charts
      .split("\n")
      .filter((l) => l.includes('el("span"'))
      .slice(0, 6)
      .join("\n")}`,
  );
});

test("A11Y: a chart with clickable points is a group, not an image", () => {
  // nested-interactive [serious] on the frontier chart's svg. The svg carried
  // role="img" while its points are role="button" tabindex="0" with click and
  // keydown handlers: the svg told assistive tech "I am a picture" and the
  // points told it "Tab to me and press Enter". Both cannot be true, and the
  // keyboard user gets the worse of the two contracts.
  const src = read(FRONTIER);
  assert.match(
    src,
    /data-pt="\$\{i\}" role="button" tabindex="0"/,
    "the points are buttons, and that is unchanged by this fix",
  );
  // The guard is the MARKUP, not a literal: the chart svg must interpolate its
  // role. An earlier version of this test asserted on a regex that matched its
  // own source, and a mutation that hardcoded the role back to "img" slipped
  // straight through it. A literal role="img" or role="group" in the svg tag is
  // the thing that must not come back.
  const svgTag = /<svg viewBox="0 0 \$\{VB_W\} \$\{VB_H\}"[^>]*>/.exec(src);
  assert.ok(svgTag, "the chart svg is built as one tag");
  assert.ok(
    /role="\$\{svgRole\}"/.test(svgTag[0]),
    `the chart svg's role must be interpolated, not literal: an svg that always claims role="img" cannot also hold focusable children, and one that always claims role="group" mis-describes the static chart. Found: ${svgTag[0].slice(0, 90)}`,
  );
  assert.match(
    src,
    /const svgRole = opts\.onSelect \? "group" : "img";/,
    "and the role follows the same switch that wires the click handlers, so the role and the behaviour cannot disagree",
  );
  assert.match(
    src,
    /aria-labelledby="\$\{titleId\} \$\{descId\}"/,
    "and the name and description stay wired, whichever role it takes",
  );
});

test("A11Y: the blog hero is a named region", () => {
  // region [moderate] on the blog index's hero section. A <section> with no
  // accessible name is not a landmark, so its heading and copy were page
  // content outside every landmark.
  const html = read(BLOG_INDEX);
  const hero = /<section\s+class="blog-hero"[\s\S]*?>/.exec(html);
  assert.ok(hero, "the hero section exists");
  assert.match(
    hero[0],
    /aria-labelledby="[^"]+"|<h1[^>]*id="[^"]+"/,
    `the hero must be nameable, so a landmark is exposed. Found: ${hero[0].slice(0, 120)}`,
  );
  assert.match(
    html,
    /<main id="main"/,
    "and the page still has its one main landmark",
  );
});

test("A11Y: a horizontally scrollable table is reachable by keyboard", () => {
  // scrollable-region-focusable [serious] on the post's table wrapper. The
  // wrapper scrolls on overflow-x, and a keyboard user had no way to scroll it:
  // no tab stop, no focusable region. The data is still in the DOM, still
  // readable by a screen reader, and still unreachable by anyone scrolling with
  // arrow keys.
  const html = read(BLOG_POST);
  // EVERY wrapper, not the first one. An earlier version of this test matched
  // a single div and passed while a second wrapper in the same post - the
  // 20-year financial example, at the bottom of the page - carried the same
  // defect. The matrix caught it, not the test: the guard is the count.
  const wrappers = html.match(/<div\s+class="table-wrapper"[\s\S]*?>/g) || [];
  assert.ok(
    wrappers.length > 0,
    "the scrollable table wrapper exists in the post",
  );
  for (const [i, wrapper] of wrappers.entries()) {
    const where = `wrapper ${i + 1} of ${wrappers.length} in ${BLOG_POST}`;
    assert.match(
      wrapper,
      /tabindex="0"/,
      `a scrollable region needs a tab stop, or the keyboard cannot reach the content: ${where} -> ${wrapper}`,
    );
    assert.match(
      wrapper,
      /role="(region|group)"/,
      `and a role, so the focus stop announces what it is: ${where}`,
    );
    assert.match(
      wrapper,
      /aria-label(?:ledby)?="[^"]+"/,
      `and a name - the table's own caption is the accurate one - so the announcement is useful rather than bare: ${where}`,
    );
  }
});

test("A11Y: 404 has one main landmark and keeps its content inside it", () => {
  // landmark-one-main [moderate] at <html>, and region [moderate] three times
  // including the h1. The page put its card straight into <body>: no main at
  // all, so the document had no main landmark and every element in it was
  // content outside one.
  const html = read(NOT_FOUND);
  const mains = html.match(/<main\b/g) || [];
  assert.equal(
    mains.length,
    1,
    `404 must have exactly one <main>, found ${mains.length}`,
  );
  const card = html.indexOf('class="card"');
  const mainAt = html.indexOf("<main");
  const mainEnd = html.indexOf("</main>");
  assert.ok(
    mainAt !== -1 && mainEnd !== -1,
    "the main landmark is opened and closed",
  );
  assert.ok(
    card > mainAt && card < mainEnd,
    "the card — its h1, its link and its nav — lives inside the main landmark, not beside it",
  );
  assert.match(
    html,
    /<nav aria-label="/,
    "and the nav keeps its own name, which is what distinguishes it from other navs",
  );
});
