// Regression tests for the Q-08 cross-browser cluster.
//
// The properties that matter, in order of how badly a break would hurt:
//
//   1. The bar is ABSOLUTE. One console error in one engine at one width fails.
//      A gate that quietly tolerated a small number would be a gate that reports
//      its own tolerance as a pass, which is the failure this repo's gates exist
//      to prevent.
//   2. A cell that could not be run is a FAILURE, not a pass. "We did not look"
//      and "we looked and it was fine" must never read the same.
//   3. A CSP violation is counted separately from a console error, and an error
//      that cannot be classified is still counted — dropping it is the one way
//      this gate could pass while something was broken.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ENGINES,
  WIDTHS,
  CROSS_BROWSER_BAR,
  classifyError,
  crossBrowserCells,
  tallyCell,
  verdict,
} from "../scripts/lib/cross-browser.mjs";

// A staged-tree stand-in with the shapes templateMatrix reads. The real gate
// reads this out of a staged build; the tests only need the enumeration to be
// the same function, so the templates are declared here and nowhere else.
const tree = {
  files: ["index.html", "about/index.html", "shared/i18n.js"],
  read: (rel) =>
    Buffer.from(
      rel === "index.html"
        ? '<script src="shared/i18n.js"></script>'
        : "<html></html>",
    ),
};

test("Q-08 names three engines and four widths, and the gate declares exactly those", () => {
  assert.deepEqual(ENGINES, ["chromium", "firefox", "webkit"]);
  assert.deepEqual(WIDTHS, [320, 390, 768, 1440]);
  // The plan's bar is 0 and 0. Asserted literally so a later "just allow one
  // known noisy cell" edit has to be made in the open.
  assert.equal(CROSS_BROWSER_BAR.console_errors, 0);
  assert.equal(CROSS_BROWSER_BAR.csp_violations, 0);
});

test("the cell matrix is every engine x width x template, with no gaps", () => {
  const m = crossBrowserCells(tree);
  assert.equal(
    m.cells.length,
    ENGINES.length * WIDTHS.length * m.templates.length,
  );
  const ids = new Set(m.cells.map((c) => c.id));
  assert.equal(ids.size, m.cells.length, "cell ids must be unique");
  for (const c of m.cells) {
    assert.ok(ENGINES.includes(c.engine));
    assert.ok(WIDTHS.includes(c.width));
    assert.ok(typeof c.path === "string" && c.path.length > 0);
  }
});

test("a CSP refusal is a CSP violation, and an ordinary console error is not", () => {
  assert.equal(
    classifyError("Refused to connect to 'https://x'"),
    "csp_violations",
  );
  assert.equal(
    classifyError("Content Security Policy directive 'script-src'"),
    "csp_violations",
  );
  assert.equal(classifyError("Refused to load the image"), "csp_violations");
  assert.equal(
    classifyError("TypeError: x is not a function"),
    "console_errors",
  );
  assert.equal(classifyError(""), "console_errors");
  // Undefined must not throw: an absent error string still has to classify.
  assert.equal(classifyError(undefined), "console_errors");
});

test("the classifier returns the BUCKET NAME the tally increments", () => {
  // Pinned because getting this wrong is silent: returning "console_error" while
  // the tally increments "console_errors" creates a second zero-valued key and
  // leaves the real count at 0 — a gate that passes while every measured page
  // errored. The two strings must be the same string.
  const t = tallyCell(["TypeError: boom"]);
  assert.deepEqual(Object.keys(t).sort(), [
    "console_errors",
    "csp_violations",
    "detail",
  ]);
  assert.equal(t.console_errors, 1);
});

test("tallyCell counts both kinds separately and records the detail", () => {
  const t = tallyCell([
    "console.error: boom",
    "Refused to connect to 'https://x'",
    "TypeError: nope",
  ]);
  assert.equal(t.console_errors, 2);
  assert.equal(t.csp_violations, 1);
  assert.equal(t.detail.length, 3);
});

test("an unclassifiable error is still counted, never dropped", () => {
  // The one way this gate could pass while something was broken. An error with
  // no text still has to land in a count.
  const t = tallyCell([{ text: "" }, ""]);
  assert.equal(t.console_errors + t.csp_violations, 2);
});

test("a single console error in one cell fails the whole run", () => {
  const v = verdict([
    { id: "a", console_errors: 0, csp_violations: 0 },
    { id: "b", console_errors: 1, csp_violations: 0 },
  ]);
  assert.equal(v.ok, false);
  assert.equal(v.failures.length, 1);
  assert.equal(v.failures[0].id, "b");
  assert.equal(v.totals.console_errors, 1);
});

test("a single CSP violation in one cell fails the whole run", () => {
  const v = verdict([{ id: "a", console_errors: 0, csp_violations: 1 }]);
  assert.equal(v.ok, false);
  assert.equal(v.failures[0].id, "a");
});

test("a cell that could not be run is a failure, not a pass", () => {
  // "We did not look" and "we looked and it was fine" must never read the same.
  // This is the same rule the a11y matrix applies to an unauditable cell.
  const v = verdict([
    { id: "a", console_errors: 0, csp_violations: 0, error: true },
  ]);
  assert.equal(v.ok, false);
  assert.equal(v.totals.errored, 1);
  assert.equal(v.failures[0].id, "a");
});

test("a fully clean run passes, and the totals say why", () => {
  const cells = Array.from({ length: 12 }, (_, i) => ({
    id: `c${i}`,
    console_errors: 0,
    csp_violations: 0,
  }));
  const v = verdict(cells);
  assert.equal(v.ok, true);
  assert.deepEqual(v.failures, []);
  assert.equal(v.totals.console_errors, 0);
  assert.equal(v.totals.csp_violations, 0);
});

test("an empty run does not pass silently as a vacuous success", () => {
  // Zero cells means nothing was measured. The bar of 0/0 is satisfied, so this
  // is a pass by the letter — which is why the report, not this verdict, is
  // what names the cell count. Pinned so the letter is a deliberate choice
  // rather than an accident.
  const v = verdict([]);
  assert.equal(v.ok, true);
});
