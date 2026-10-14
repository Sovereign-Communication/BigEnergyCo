// Regression tests for the Q-09 visual-regression scaffolding.
//
// Three things here are decisions rather than mechanics, and each is pinned so
// it has to be changed deliberately:
//
//   1. The threshold boundary. Q-09 says "more than 0.1% of pixels", so exactly
//      0.1% passes and anything above it does not. An off-by-one here would
//      either fail passing builds or pass failing ones.
//   2. The FIRST run cannot meet the bar and must not pretend to. With no
//      baseline there is nothing to differ from, so every cell reads `new` —
//      never `ok` and never a zero diff. A first run that reported "0 diffs"
//      would make an unmeasured gate look like a passing one.
//   3. The measured-unstable exclusion is exactly the templates that were
//      measured unreproducible, and nothing wider.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  WIDTHS,
  DIRECTIONS,
  PIXEL_THRESHOLD,
  SNAPSHOT_ENGINE,
  MEASURED_UNSTABLE_TEMPLATES,
  isMeasuredUnstable,
  visualCells,
  classifySnapshot,
  visualVerdict,
} from "../scripts/lib/visual-budgets.mjs";

const TREE = {
  files: ["index.html", "solar-heatmap/index.html", "shared/i18n.js"],
  read: (rel) =>
    Buffer.from(
      rel === "index.html"
        ? '<script src="shared/i18n.js"></script>'
        : "<html></html>",
    ),
};

test("Q-09's threshold is 0.1% of pixels, and the comparison is strictly greater", () => {
  assert.equal(PIXEL_THRESHOLD, 0.001);
  // Exactly at the threshold passes; one pixel over it does not.
  const total = 100000;
  const atThreshold = { diff: 100, total, baseline_exists: true };
  assert.equal(classifySnapshot(atThreshold).finding, false);
  assert.equal(classifySnapshot(atThreshold).status, "ok");
  const overThreshold = { diff: 101, total, baseline_exists: true };
  assert.equal(classifySnapshot(overThreshold).finding, true);
  assert.equal(classifySnapshot(overThreshold).status, "diff");
});

test("no baseline reads `new`, never `ok` and never a zero diff", () => {
  const r = classifySnapshot({ diff: 0, total: 1000, baseline_exists: false });
  assert.equal(r.status, "new");
  assert.equal(r.ratio, null);
  assert.equal(r.finding, false);
});

test("a size change is a diff, not a zero-diff", () => {
  // A layout that changed the page height has no pixel count; the driver
  // reports mismatch and forces ratio 1 rather than counting 0 differences.
  const r = classifySnapshot({ diff: -1, total: 1000, baseline_exists: true });
  assert.equal(
    r.finding,
    true,
    "the comparator must surface a size mismatch as a finding",
  );
});

test("a first run passes, and every cell is counted as new rather than ok", () => {
  const cells = [
    { id: "a", status: "new" },
    { id: "b", status: "new" },
  ];
  const v = visualVerdict(cells);
  assert.equal(v.ok, true);
  assert.equal(v.new_snapshots, 2);
  assert.equal(v.unapproved_diffs, 0);
});

test("one over-threshold diff fails the run and is named", () => {
  const v = visualVerdict([
    { id: "home/320/none/ltr", status: "ok", ratio: 0 },
    { id: "home/1440/none/ltr", status: "diff", ratio: 0.05 },
  ]);
  assert.equal(v.ok, false);
  assert.equal(v.unapproved_diffs, 1);
  // The worst offenders are reported, so a red run says WHERE.
  assert.equal(v.worst[0].id, "home/1440/none/ltr");
});

test("the matrix varies width and direction, and declares a theme with one value", () => {
  const m = visualCells(TREE);
  assert.deepEqual(m.widths, WIDTHS);
  assert.deepEqual(m.directions, DIRECTIONS);
  // The product ships no theme, so the theme dimension carries one value whose
  // evidence is its own absence — the same rule the a11y matrix follows.
  assert.equal(m.themes.length, 1);
  assert.equal(m.themes[0].id, "none");
  assert.ok(/prefers-color-scheme|data-theme/.test(m.themes[0].evidence ?? ""));
});

test("RTL cells exist only for templates that can actually render RTL", () => {
  const m = visualCells(TREE);
  const rtl = m.cells.filter((c) => c.direction === "rtl");
  // index.html loads shared/i18n.js, so it gets both directions at every width.
  const home = rtl.filter((c) => c.template === "home");
  assert.equal(home.length, WIDTHS.length);
  // solar-heatmap/index.html does not, so it gets one direction — and the
  // combination that does not apply is RECORDED, not silently dropped.
  const heatmap = m.cells.filter((c) => c.template === "heatmap");
  assert.equal(
    heatmap.every((c) => c.direction === "ltr"),
    true,
  );
  assert.ok(
    m.not_applicable.some(
      (n) => n.template === "heatmap" && n.direction === "rtl",
    ),
    "the non-applicable RTL combination must be recorded with a reason",
  );
  assert.match(m.not_applicable[0].reason, /i18n/);
});

test("every cell id is unique across the whole matrix", () => {
  const m = visualCells(TREE);
  const ids = m.cells.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("the measured-unstable exclusion is exactly heatmap, with its numbers", () => {
  // Pinned to the measured scope. Widening this list to silence a new failure is
  // the obvious wrong move, and it now has to be edited here, with the
  // measurement, rather than done with a flag.
  assert.deepEqual(
    MEASURED_UNSTABLE_TEMPLATES.map((u) => u.template),
    ["heatmap"],
  );
  assert.equal(isMeasuredUnstable("heatmap"), true);
  assert.equal(isMeasuredUnstable("home"), false);
});

test("an excluded cell is measured but never a finding", () => {
  // The whole point: the heatmap's pixels are not a function of the product, so
  // a 5% reading there is data, not a verdict. It is still reported.
  const r = classifySnapshot({
    diff: 75250,
    total: 1443200,
    baseline_exists: true,
    unstable: true,
  });
  assert.equal(r.status, "unstable");
  assert.equal(r.finding, false);
  assert.ok(
    r.ratio > 0.05,
    "the measured ratio is still reported, not discarded",
  );
});

test("an unstable cell is counted in its own bucket, not hidden in a pass", () => {
  const v = visualVerdict([
    { id: "a", status: "ok", ratio: 0 },
    { id: "heatmap/320/none/ltr", status: "unstable", ratio: 0.052 },
  ]);
  assert.equal(v.ok, true, "an unstable cell is not a failure");
  assert.equal(v.unstable_snapshots, 1, "but it is counted and reported");
});

test("the exclusion states what would remove it", () => {
  // An exclusion with no exit condition is a permanent exemption wearing a
  // temporary label. This one names the plan item that closes it.
  const h = MEASURED_UNSTABLE_TEMPLATES[0];
  assert.match(h.removable_when, /P1\.5/);
  assert.match(h.same_root_cause_as, /Q-07/);
  assert.ok(
    h.measured_ratios.length >= 3,
    "the measurement is at least three runs",
  );
  assert.ok(h.measured_ratios.every((r) => r > PIXEL_THRESHOLD));
});

test("snapshots are captured in one declared engine", () => {
  // A cross-engine visual diff compares rasterisers and reports their
  // differences as the product's. Q-08 covers the engines; this covers pixels.
  assert.equal(SNAPSHOT_ENGINE, "chromium");
});

test("the declared gated-cell count describes the committed measurement it came from", () => {
  // `stable_cells_for_comparison` is the one number in this file that is a
  // READING rather than a rule, and nothing read it: the matrix could gain a
  // template or a width, the committed evidence would grow, and the sentence
  // about the cells outside the exclusion would quietly stop being true while
  // every gate stayed green. It is a claim about the committed run, so it is
  // checked against the committed run — the evidence file the gate itself
  // writes.
  //
  // It counts the GATED cells, which is the part of the matrix whose pixels are
  // a function of the product. Counting every zero-reading cell instead would
  // fold in whichever heatmap widths happened to paint a zero that afternoon —
  // measured here at three of four on the calibration runs and four of four on
  // the 2026-10-14T09:00Z re-measurement — so the pin would flake with the CDN
  // rather
  // than move with the product. Bump the number without a new measurement, or
  // land a measurement whose gated set differs, and this goes red until the
  // declaration is re-derived.
  const evidence = JSON.parse(
    readFileSync(
      new URL("../.quality-evidence/visual.json", import.meta.url),
      "utf8",
    ),
  );
  const declared = MEASURED_UNSTABLE_TEMPLATES.reduce(
    (n, u) => n + Number(u.stable_cells_for_comparison || 0),
    0,
  );
  const gated = evidence.cells.filter((c) => c.gated);
  assert.equal(
    declared,
    gated.filter((c) => c.ratio === 0).length,
    "the declared gated-cell count must equal the gated cells that read 0.0000% in the committed run",
  );
  // THE EVIDENCE IS A MEASUREMENT, NOT A FIRST RUN. The driver records every
  // cell as `new` when no baseline exists, which is honest on the machine that
  // recorded it and worthless as committed evidence: it measures a snapshot
  // against nothing. So the committed run must carry a real reading on every
  // cell — this is the assertion that keeps a first run from being committed as
  // coverage, city template included.
  const unread = evidence.cells.filter(
    (c) => c.status === "new" || c.status === "error" || c.ratio === null,
  );
  assert.deepEqual(
    unread.map((c) => `${c.id}: ${c.status}`),
    [],
    "every committed cell must carry a real reading — a `new` or errored cell is a baseline that was recorded, not a product that was measured",
  );
  // The exclusion and the count must describe the same measurement: every
  // excluded template was measured, and only excluded templates read unstable.
  for (const u of MEASURED_UNSTABLE_TEMPLATES)
    assert.ok(
      evidence.cells.some((c) => c.template === u.template),
      `${u.template} is declared unreproducible but the committed run never measured it`,
    );
  assert.ok(
    evidence.cells
      .filter((c) => c.status === "unstable")
      .every((c) =>
        MEASURED_UNSTABLE_TEMPLATES.some((u) => u.template === c.template),
      ),
    "only a declared-unstable template may read unstable",
  );
});
