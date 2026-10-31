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
//   AUDIT ERROR (the whole cell)       solar-heatmap — see the canvas gate below
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
const HEATMAP = "assets/js/heatmap.js";
const HEATMAP_PAGE = "solar-heatmap/index.html";
const HEATMAP_GRID = "assets/data/heatmap-grid.json";

test("A11Y: the heatmap draws its dots on a canvas, not one DOM node per grid point", () => {
  // AUDIT ERROR on the `heatmap/arrival/none/ltr` cell since P0.4(b): the cell
  // could not be audited at all, and a hole is never a pass. Measured on the
  // staged build with one fresh browser per rule, this is the whole diagnosis:
  //
  //   · the page's DOM is 39,946 elements once its grid renders, and 39,707 of
  //     them are one SVG <path> per data point in Leaflet's overlay pane — the
  //     page's own content is 237 elements;
  //   · of axe's 30 best-practice rules only two are slow there, and both are
  //     slow BY NODE: hidden-content and region cost ~1-3 ms each (they do
  //     layout/style work per node), so they exceed 120 s and the 180 s cell
  //     budget goes. The other 28 finish in 0.7-2.2 s on that same DOM;
  //   · with the marker layer emptied those two rules finish in 35-46 ms on
  //     the page's own 237 elements, with 0 violations either way.
  //
  // So the cost is the node count, not the tool. Those paths carry no role, no
  // accessible name and no focusability, and they are not even what a
  // screen-reader user reads the data from — the same numbers are in
  // #best-list / #worst-list as text, which is why drawing them on a canvas
  // removes nothing anyone could reach.
  const grid = JSON.parse(read(HEATMAP_GRID));
  const points = grid.points.length;
  assert.ok(
    points > 5000,
    `the grid must be big enough for a per-point DOM node to bite (${points} points)`,
  );

  const src = read(HEATMAP);
  // The renderer the page builds, by the assignment that builds it — so the
  // contract is "the markers are handed THAT renderer", not a variable name.
  const canvas = /(\w+)\s*=\s*L\.canvas\(/.exec(src);
  assert.ok(
    canvas,
    "the dot layer must be drawn on a Leaflet canvas renderer: one <path> per " +
      "point is what put 39,707 nodes on the page and the cell out of reach",
  );
  const renderer = canvas[1];
  // Every marker, not just the first: a call site without the renderer would put
  // the node count straight back.
  const sites = [...src.matchAll(/L\.circleMarker\(/g)];
  assert.equal(
    sites.length,
    1,
    `one marker constructor, found ${sites.length}`,
  );
  for (const site of sites) {
    const call = src.slice(site.index, site.index + 400);
    const end = call.indexOf("});");
    assert.notEqual(end, -1, "the marker call is complete in the source");
    assert.match(
      call.slice(0, end + 3),
      new RegExp(`renderer:\\s*${renderer}\\b`),
      `every marker must be handed ${renderer}, the canvas renderer, or each ` +
        "point is a DOM node again",
    );
  }

  // The premise that makes the node count droppable: the data is still in text.
  const page = read(HEATMAP_PAGE);
  for (const id of ["best-list", "worst-list"]) {
    assert.match(
      page,
      new RegExp(`id="${id}"`),
      `#${id} must remain, so removing 39,707 unnameable paths removes no data`,
    );
  }
  assert.match(
    src,
    /getElementById\("best-list"\)/,
    "and the per-country lists must still be filled from the same grid",
  );
});

test("A11Y: the ranking lists colour their numbers for reading, not for the map", () => {
  // color-contrast [serious] on `#best-list > li:nth-child(1) > .years`, 10
  // nodes: the first finding the heatmap cell ever produced, and it could only
  // produce it once the canvas gate above made the cell auditable.
  //
  // The cause is a reuse, not a typo. `costColor()` is the MAP's scale — read
  // against Carto's dark basemap tiles — and the cost-mode ranking lists used
  // it as a TEXT colour on the page's own card. Measured on the staged build,
  // with the card's rgba white over --bg composited the way a browser does:
  //
  //     #991b1b (worst cost)  2.12:1     #555 (no data)  1.03:1
  //     #e64545               4.45:1     4.5:1 is the bar for text this size
  //
  // So the numbers a visitor reads in the best/worst lists were dark red on
  // near-black. The map keeps its own scale — the dots are read against tiles,
  // and repainting them would be a different change.
  const page = read(HEATMAP_PAGE);
  const src = read(HEATMAP);

  // The palette is read from the page, so the test follows a palette change
  // instead of carrying a copy of it.
  const bg = /--bg:\s*(#[0-9a-f]{6})/i.exec(page);
  const card =
    /--card:\s*rgba\(([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)/i.exec(
      page,
    );
  assert.ok(bg && card, "the page declares --bg and --card");
  const bgHex = bg[1];
  const alpha = Number(card[4]);
  const composite =
    "#" +
    [1, 3, 5]
      .map((i) => {
        const base = parseInt(
          bgHex.slice(1 + 2 * (i - 1), 3 + 2 * (i - 1)),
          16,
        );
        const over = Number(card[i]);
        return Math.round(alpha * over + (1 - alpha) * base)
          .toString(16)
          .padStart(2, "0");
      })
      .join("");

  const luminance = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  const textScale = /function costTextColor\([\s\S]*?\n {2}\}/.exec(src);
  assert.ok(
    textScale,
    "the lists need a TEXT scale: the map's tile palette cannot be reused as a " +
      "text colour, and axe measured its dark end at 2.12:1 on this card",
  );
  const literals = [...textScale[0].matchAll(/return "(#[0-9a-f]{6})";/gi)].map(
    (m) => m[1],
  );
  assert.equal(
    literals.length,
    7,
    `one text colour per cost bucket, as the map scale has (found ${literals.length})`,
  );
  for (const hex of literals) {
    for (const [name, background] of [
      ["the card", composite],
      ["the page", bgHex],
    ]) {
      const ratio = contrast(hex, background);
      assert.ok(
        ratio >= 4.5,
        `${hex} is ${ratio.toFixed(2)}:1 on ${name} (${background}); a number a ` +
          "visitor reads is 4.5:1 text, not a tile colour",
      );
    }
  }

  // The dots keep the tile palette, and the lists stop using it.
  const mapScale = /function costColor\([\s\S]*?\n {2}\}/.exec(src);
  assert.ok(mapScale, "the map's own scale still exists for the dots");
  assert.match(
    src,
    /fillColor:\s*color/,
    "the markers are still painted from the map scale",
  );
  const listSites = [
    ...src.matchAll(/class="years" style="color:\$\{([^}]+)\}"/g),
  ];
  assert.equal(
    listSites.length,
    2,
    "two cost-mode lists colour a number inline",
  );
  for (const site of listSites) {
    assert.equal(
      site[1],
      "costTextColor(cost)",
      `a list number must use the text scale, not ${site[1]}`,
    );
  }
  // …and the payback / break-even lists, which carry no inline colour, stay
  // that way: they are #fff on the same card and already clear the bar.
  assert.doesNotMatch(
    src,
    /class="years" style="color:[^"]*yearColor/,
    "a year figure must not be painted with the map scale either",
  );
});

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
