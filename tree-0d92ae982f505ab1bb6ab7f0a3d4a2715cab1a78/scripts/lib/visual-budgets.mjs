// Plan §8 P0.4 / Q-09: the visual-regression cluster — the snapshot matrix,
// the threshold, and what counts as an approved diff.
//
// WHAT Q-09 ASKS FOR, verbatim: "0 unapproved visual diffs (> 0.1 % pixels)
// across the snapshot matrix (template x width x theme x direction). 0 raw
// colour, spacing or font values outside the token file."
//
// SCOPE, STATED PLAINLY, because the word "scaffolding" in the P0.4 row and the
// word "0 unapproved diffs" in Q-09 are not the same commitment. P0.4 asks for
// SCAFFOLDING: the matrix, the capture, the comparator and a committed baseline
// to compare against. Q-09's zero is the bar the scaffolding measures against,
// and the first run cannot meet it by construction — there is nothing to differ
// from yet. So the first run RECORDS every snapshot and reports every cell as
// new, and the bar binds from the second run on. Saying that here rather than
// letting a first run report "0 diffs" would make an unmeasured gate look like a
// passing one, which is the exact failure this repo's gates are built to avoid.
//
// WHY THE MATRIX CARRIES A THEME DIMENSION WITH ONE VALUE. Exactly as the a11y
// matrix does, and for the same stated reason: a dimension the product does not
// have is still declared, with the evidence for its absence in the value itself.
// Dropping the dimension would shrink the cell count and make the matrix look
// smaller than the plan's matrix is. Inventing a dark theme to fill it would be
// worse: it would be measuring a rendering the product does not ship.
import { templateMatrix, themeDimension } from "./quality-matrix.mjs";

/** The widths Q-07 reflows at and Q-08 already uses. Visual diffs at four
 *  widths catch the reflow failures a single desktop shot cannot. */
export const WIDTHS = [320, 390, 768, 1440];

/** The directions the snapshot matrix varies over. */
export const DIRECTIONS = ["ltr", "rtl"];

/**
 * Q-09's threshold: a snapshot may differ by at most this share of its pixels
 * before the diff is a finding. The plan writes it as "> 0.1 % pixels"; the
 * comparison below is `>`, so a diff of exactly 0.1 % passes and anything
 * above it does not.
 */
export const PIXEL_THRESHOLD = 0.001;

/** The engine snapshots are captured and diffed in.
 *
 *  Declared, and load-bearing. Visual diffing across three engines compares
 *  three different font rasterisers, which produces diffs that say nothing
 *  about the product. So the Q-08 gate is what covers the engines, and the
 *  Q-09 gate covers pixel stability on ONE of them — Chromium, which is also
 *  what the a11y matrix drives. A cross-engine visual diff is a different gate
 *  and would need per-engine baselines.
 */
export const SNAPSHOT_ENGINE = "chromium";

/**
 * Templates whose snapshots are MEASURED not to be reproducible, and are
 * therefore reported rather than gated.
 *
 * This is the same shape of decision as the Lighthouse `performance` split in
 * scripts/lib/lighthouse-budgets.mjs, and it is made for the same reason: a
 * floor set under a measurement that cannot reproduce is not a gate, it is a
 * coin flip that fails CI on Tuesdays. The numbers below are not an estimate.
 * They are three consecutive runs of this gate against an UNCHANGED tree
 * (`git status` clean over every template and `assets/`), each comparing the
 * heatmap snapshot at 320 px against the same committed baseline:
 *
 *     run 1   75250 / 1443200 px = 5.2141 %
 *     run 2   75250 / 1443200 px = 5.2141 %
 *     run 3   70062 / 1443200 px = 4.8546 %
 *
 * Meanwhile all 27 other cells read 0.0000 % on every one of those runs. So the
 * variance is not the capture, the comparator, or the engine — it is this one
 * page.
 *
 * THE CAUSE, and it is the same cause as the open Q-07 hole. The heatmap pulls
 * Leaflet from `https://unpkg.com/leaflet` — an EXTERNAL CDN — and then holds a
 * grid fetch open. How much of the map has painted when the screenshot is taken
 * depends on when a third party answered. The same unreliability is why the
 * a11y matrix cannot audit `heatmap/arrival/none/ltr`: the arrival state is
 * measured while that load is still in flight. One root cause, two open items.
 *
 * WHAT THIS DOES NOT DO. It does not lower the bar, and it does not mean the
 * page is exempt forever: the remaining 27 cells are gated at Q-09's full
 * threshold right now. It records that one template's pixels are not a
 * function of the product, and names what would make them one (a
 * self-hosted Leaflet — which is already a separate plan item, P1.5) so the
 * exclusion can be removed on evidence rather than on a feeling.
 *
 * The list is asserted by tests/visual-budgets.test.mjs against this
 * measurement, so widening it is a deliberate act that has to be edited in
 * here, with the numbers, rather than a quiet flag.
 */
export const MEASURED_UNSTABLE_TEMPLATES = [
  {
    template: "heatmap",
    measured_runs: 3,
    measured_ratios: [0.052141, 0.052141, 0.048546],
    stable_cells_for_comparison: 27,
    cause:
      "loads Leaflet from the external CDN https://unpkg.com/leaflet and holds a grid fetch open, so the painted map depends on third-party response timing",
    same_root_cause_as: "Q-07 heatmap/arrival/none/ltr",
    removable_when:
      "Leaflet is self-hosted (plan item P1.5), after which the snapshot is a function of the product and this exclusion is deleted",
  },
];

/** True when a template's snapshots are declared unreproducible. */
export function isMeasuredUnstable(template) {
  return MEASURED_UNSTABLE_TEMPLATES.some((u) => u.template === template);
}

/**
 * The snapshot matrix: template x width x theme x direction.
 *
 * Templates and the theme dimension are read out of the STAGED tree by the same
 * functions the a11y matrix uses, so the two gates cannot disagree about what a
 * template is and a new page cannot appear in one and not the other.
 *
 * Direction follows the same evidence-based rule: a template that never loads
 * shared/i18n.js never sets `dir` and has one text direction, so it gets one
 * cell rather than a cell that would render identically in both and imply a
 * coverage that does not exist.
 */
export function visualCells(tree) {
  const templates = templateMatrix(tree);
  const themes = themeDimension(tree);
  const cells = [];
  const not_applicable = [];
  for (const t of templates) {
    for (const width of WIDTHS) {
      for (const theme of themes) {
        const directions = t.has_i18n ? DIRECTIONS : ["ltr"];
        if (!t.has_i18n) {
          not_applicable.push({
            template: t.id,
            width,
            direction: "rtl",
            reason: `${t.path} never loads shared/i18n.js, so it never sets dir and has one text direction`,
          });
        }
        for (const dir of directions) {
          cells.push({
            id: `${t.id}/${width}/${theme.id}/${dir}`,
            template: t.id,
            path: t.path,
            width,
            theme: theme.id,
            direction: dir,
            has_i18n: t.has_i18n,
          });
        }
      }
    }
  }
  return {
    widths: [...WIDTHS],
    directions: [...DIRECTIONS],
    templates,
    themes,
    cells,
    not_applicable,
  };
}

/**
 * Decides one cell's verdict from a pixel diff.
 *
 * `total` is the snapshot's pixel count and `diff` the number of pixels that
 * differ. A missing baseline is not a zero diff: it is `new`, and it is the
 * only state in which the bar does not yet apply, which the caller must record
 * explicitly rather than let a zero slip through.
 */
export function classifySnapshot({
  diff,
  total,
  baseline_exists,
  threshold = PIXEL_THRESHOLD,
  unstable = false,
}) {
  if (unstable) {
    return {
      status: "unstable",
      ratio: total > 0 ? diff / total : null,
      finding: false,
    };
  }
  if (!baseline_exists) return { status: "new", ratio: null, finding: false };
  // A negative diff is the comparator reporting a SIZE MISMATCH, not a count.
  // It must be a finding: a page whose own dimensions moved is the largest
  // possible visual change, and counting it as 0 differences would invert the
  // meaning of the number.
  if (diff < 0) return { status: "diff", ratio: 1, finding: true };
  const ratio = total > 0 ? diff / total : 1;
  return {
    status: ratio > threshold ? "diff" : "ok",
    ratio,
    finding: ratio > threshold,
  };
}

/** The run verdict against Q-09's zero. A `new` cell is never counted as a
 *  finding, for the first-run reason stated at the top of this file; an
 *  `unstable` cell never is, for the measured reason in
 *  MEASURED_UNSTABLE_TEMPLATES. Neither is ever hidden: both are counted and
 *  named in the report. */
export function visualVerdict(cells) {
  const unapproved = cells.filter((c) => c.status === "diff");
  const unstable = cells.filter((c) => c.status === "unstable");
  const fresh = cells.filter((c) => c.status === "new");
  return {
    ok: unapproved.length === 0,
    unapproved_diffs: unapproved.length,
    new_snapshots: fresh.length,
    unstable_snapshots: unstable.length,
    worst: cells
      .filter((c) => typeof c.ratio === "number")
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 5)
      .map((c) => ({ id: c.id, ratio: c.ratio })),
  };
}
