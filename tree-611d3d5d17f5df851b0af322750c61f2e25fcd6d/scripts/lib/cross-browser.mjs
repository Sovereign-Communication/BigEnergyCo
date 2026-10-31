// Plan §8 P0.4 / Q-08: the cross-browser cluster — which engine, at which
// width, and what counts as a failure.
//
// WHAT Q-08 ASKS FOR, verbatim: "Chromium, Firefox and WebKit at 320 / 390 /
// 768 / 1440 px widths. 0 console errors, 0 CSP violations."
//
// That is an ABSOLUTE bar, not a ratchet. There is no "it was already this bad"
// reading available for a product shipping a strict `script-src` and asserting
// zero console errors in CI: a reading over the bar is a finding, full stop.
// The one nuance is the difference between an ERROR and a VIOLATION, and it is
// classified here rather than in the driver so the classification is testable
// without a browser.
//
// WHY THE ENGINES ARE DECLARED HERE. Every other gate in this repo declares its
// matrix in a lib beside the measurement and has a test assert that no axis is
// left unaccounted for. The reason is stated in the a11y matrix: a dimension
// the product does not have is still declared, with the evidence for its
// absence in the value itself, so the cell count cannot quietly shrink. The
// same applies to the engines: if one of these three stops launching, that is a
// finding to report, not a reason to quietly run the two that work and call
// the matrix complete.
import { templateMatrix } from "./quality-matrix.mjs";

/** The three engines Q-08 names. */
export const ENGINES = ["chromium", "firefox", "webkit"];

/** The four widths Q-08 names. 320 is the reflow floor plan §Q-07 also uses. */
export const WIDTHS = [320, 390, 768, 1440];

/**
 * The Q-08 bar, stated as the numbers the plan states them as. Kept as a
 * declared object rather than two literals scattered through the comparator so
 * that a test can assert the gate is holding exactly zero and not "a small
 * number that was thought to be fine".
 */
export const CROSS_BROWSER_BAR = { console_errors: 0, csp_violations: 0 };

/**
 * Classifies one captured error string.
 *
 * A CSP violation and a console error are different failures and worth
 * separating in the report, because they have different causes: a CSP
 * violation is a policy decision refusing something the page tried to do, and
 * a console error is usually the page failing on its own. The classification
 * mirrors the one the smoke suite already uses (scripts/smoke/runtime.mjs
 * exports the same `isCsp`), so a violation counted here is counted the same way
 * there rather than the two disagreeing about the same string.
 */
export function classifyError(text) {
  const s = String(text ?? "");
  return /Content Security Policy|Refused to (connect|load|execute|apply)|violates .* directive/i.test(
    s,
  )
    ? "csp_violations"
    : "console_errors";
}

/**
 * The full Q-08 cell list: one entry per engine x width x template.
 *
 * Templates come from the SAME enumeration the a11y matrix uses
 * (`templateMatrix`), read out of the staged tree rather than hand-listed, so
 * the two gates cannot disagree about what a "template" is and a new page
 * cannot be added to one and missed by the other.
 */
export function crossBrowserCells(tree) {
  const templates = templateMatrix(tree);
  const cells = [];
  for (const engine of ENGINES) {
    for (const width of WIDTHS) {
      for (const t of templates) {
        cells.push({
          id: `${engine}/${width}/${t.id}`,
          engine,
          width,
          template: t.id,
          path: t.path,
        });
      }
    }
  }
  return { engines: [...ENGINES], widths: [...WIDTHS], templates, cells };
}

/**
 * Turns one cell's captured errors into the two counts the bar is stated in.
 * Every error is classified, and anything that cannot be classified is counted
 * as a console error rather than dropped: an unclassifiable error is still an
 * error, and dropping it would be the one way this gate could pass while
 * something was broken.
 */
export function tallyCell(errors) {
  const out = { console_errors: 0, csp_violations: 0, detail: [] };
  for (const raw of errors ?? []) {
    const text = typeof raw === "string" ? raw : (raw?.text ?? "");
    // The classifier returns the BUCKET NAME, not a category, so the count and
    // the key it increments are the same string by construction. An earlier
    // version returned "console_error"/"csp_violation" and incremented
    // console_errors/csp_violations, which quietly created two new zero-valued
    // keys and left both real counts at 0 — a gate that passed while every
    // page it measured errored. The test "an unclassifiable error is still
    // counted" exists because that is exactly the bug.
    const bucket = classifyError(text);
    out[bucket] += 1;
    out.detail.push({ kind: bucket, text: text.slice(0, 300) });
  }
  return out;
}

/**
 * The verdict for the whole run, against Q-08's absolute bar.
 *
 * `failures` are cells over the bar. A cell that could not be run at all is a
 * failure too, and for the same reason the a11y matrix treats an unauditable
 * cell as an error rather than a pass: "we did not look" and "we looked and it
 * was fine" are not the same finding, and a gate that cannot tell them apart is
 * not a gate.
 */
export function verdict(cells, { bar = CROSS_BROWSER_BAR } = {}) {
  const failures = cells.filter(
    (c) =>
      c.error ||
      c.console_errors > bar.console_errors ||
      c.csp_violations > bar.csp_violations,
  );
  const totals = cells.reduce(
    (acc, c) => ({
      console_errors: acc.console_errors + (c.console_errors || 0),
      csp_violations: acc.csp_violations + (c.csp_violations || 0),
      errored: acc.errored + (c.error ? 1 : 0),
    }),
    { console_errors: 0, csp_violations: 0, errored: 0 },
  );
  return {
    ok: failures.length === 0,
    failures,
    totals,
    bar,
  };
}
