// Gate reports must say which rule judges each number they print.
//
// The defect class this file exists for: a gate that is right and reports itself
// misleadingly. `--scope P0.4`'s report shipped for two review passes claiming
// five P2/P4/P5/P8 facets were blocking a P0.4 PR; the fix is in
// tests/jev-report-print.test.mjs. Two more reports had the same shape, both
// P0.4's own: each carries an `enforcement` string naming the phase at which
// its absolute bar starts to block, and each printed that phase NOWHERE on the
// terminal — so a reader saw `breach` in a verdict column next to a green run,
// with no way to learn that the §3.1 limits are not bars until P6/P8.
//
// check-lighthouse.mjs already did the honest version ("N Q-02 breaches
// (non-blocking until P5/P8)"), so this file is the same rule, written down for
// the two that were not. It pins the REPORTING only. What a gate measures, what
// it compares, what it exits with, and the plan's bar are all untouched.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  breachSection as budgetBreachSection,
  enforcementLine as budgetEnforcementLine,
  limitOf,
  overLimitMetrics,
} from "../scripts/check-byte-budgets.mjs";
import {
  breachSection as a11yBreachSection,
  enforcementLine as a11yEnforcementLine,
  summaryLines as a11ySummaryLines,
} from "../scripts/check-a11y-matrix.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const bytes = (value, limit) => ({ value, limit, unit: "bytes" });
const count = (value, limit) => ({ value, limit, unit: "count" });

// ── byte budgets ────────────────────────────────────────────────────────────

test("BUDGETS: the terminal states the rule the report JSON carries", () => {
  const line = budgetEnforcementLine();
  assert.match(line, /^enforcement: /);
  // Both phases the plan sets: regression-blocking now, absolute later. A
  // terminal that omits either half is what let `breach` read as a failure.
  assert.match(line, /regression-blocking from P0/);
  assert.match(line, /absolute from P6 \(\/next\/\) and P8 \(all\)/);
  // One owner: the string the report writes must be the string the terminal
  // prints, or the two drift and one of them starts lying.
  const src = readFileSync(
    join(ROOT, "scripts/check-byte-budgets.mjs"),
    "utf8",
  );
  assert.match(
    src,
    /enforcement: ENFORCEMENT/,
    "the report must use the constant, not a second copy of the sentence",
  );
  assert.equal(
    (src.match(/regression-blocking from P0 \(plan §3\.2\)/g) || []).length,
    1,
    "the enforcement sentence is written once, not once per consumer",
  );
  // And the run must actually PRINT it. Asserting only that the helper returns
  // the right text would pass while the terminal went back to saying nothing —
  // which is the defect these tests exist for, and the first version of this
  // test proved it: a mutation that deleted the write was not caught.
  assert.match(
    src,
    /out\.write\(`\$\{enforcementLine\(\)\}\\n`\)/,
    "main() must write the enforcement line, or the terminal states no rule again",
  );
  assert.match(
    src,
    /out\.write\(breachSection\(metrics\)\)/,
    "main() must print the breach section",
  );
});

test("BUDGETS: an over-limit budget is named, with the phase it binds at", () => {
  const metrics = {
    home_document: bytes(18 * 1024, 30 * 1024),
    registry_country: bytes(80 * 1024, 6 * 1024), // 13.3x over
    requests_before_interaction: count(8, 10),
  };
  const text = budgetBreachSection(metrics);
  assert.match(
    text,
    /over the plan's limit \(plan §3\.1; reported, not blocking until P6 \(\/next\/\) and P8 \(all\)\):/,
  );
  assert.match(text, / {2}registry_country: 80\.0 KB > 6\.0 KB/);
  // And the ones inside their limits are not dragged in.
  assert.doesNotMatch(text, /home_document/);
  assert.doesNotMatch(text, /requests_before_interaction/);
});

test("BUDGETS: a clean run says nothing about breaches", () => {
  assert.equal(
    budgetBreachSection({ home_document: bytes(18 * 1024, 30 * 1024) }),
    "",
    "a section that always prints would train the reader to skip it",
  );
  assert.deepEqual(overLimitMetrics({ a: bytes(1, 2) }), []);
  // At the limit is not over it.
  assert.deepEqual(overLimitMetrics({ a: bytes(2, 2) }), []);
});

test("BUDGETS: a budget over its limit is exactly what the section lists", () => {
  // The invariant, not the numbers: whatever the verdict column tags `breach`
  // must appear in the section, and nothing else may. This is the pair that
  // used to disagree.
  const metrics = {
    a: bytes(100, 200),
    b: bytes(300, 200),
    c: bytes(200, 200),
    d: count(11, 10),
  };
  const over = overLimitMetrics(metrics).map(([name]) => name);
  assert.deepEqual(over, ["b", "d"]);
  const text = budgetBreachSection(metrics);
  for (const name of over) {
    assert.match(
      text,
      new RegExp(` {2}${name}:`),
      `${name} is over but not listed`,
    );
  }
  for (const name of ["a", "c"]) {
    assert.doesNotMatch(
      text,
      new RegExp(` {2}${name}:`),
      `${name} is listed but not over`,
    );
  }
});

test("BUDGETS: a request budget's limit is read as a count, not as bytes", () => {
  // The section formatted every limit as KB. No request budget is over its
  // limit today, so the wrong rendering was invisible until one is.
  assert.equal(limitOf(count(8, 10)), "10 req");
  assert.equal(limitOf(bytes(1, 6144)), "6.0 KB");
});

// ── a11y matrix ─────────────────────────────────────────────────────────────

test("A11Y: the terminal states the rule the report JSON carries", () => {
  const line = a11yEnforcementLine();
  assert.match(line, /^enforcement: /);
  assert.match(line, /regression-blocking from P0/);
  assert.match(
    line,
    /absolute \(0 violations\) from P5 for templates in the new shell and P8 for everything/,
  );
  const src = readFileSync(join(ROOT, "scripts/check-a11y-matrix.mjs"), "utf8");
  assert.match(src, /enforcement: ENFORCEMENT/);
  assert.equal(
    (src.match(/regression-blocking from P0 \(plan §3\.2\)/g) || []).length,
    1,
  );
  // The run must print it and the cap breaches, not merely compute them.
  assert.match(
    src,
    /out\.write\(`\$\{enforcementLine\(\)\}\\n`\)/,
    "main() must write the enforcement line, or the terminal states no rule again",
  );
  assert.match(
    src,
    /out\.write\(breachSection\(breaches\)\)/,
    "main() must print the cap breaches compareCells computed for it",
  );
});

test("A11Y: what blocks and what is only reported are on separate lines", () => {
  const text = a11ySummaryLines({
    cells: 11,
    violationTypes: 4,
    errors: 0,
    regressions: 0,
    improvements: 2,
    unmeasured: 1,
    breaches: 3,
  });
  const lines = text.trimEnd().split("\n");
  assert.equal(lines.length, 2, "one line per question");
  // The line that decides the run says so, and carries only what decides it.
  assert.match(
    lines[0],
    /^matrix: 11 cells, 0 audit errors, 0 regressions \(these block\)$/,
  );
  // The other carries the reported facts, each with the phase that makes it bind.
  assert.match(
    lines[1],
    /^ {2}reported: 4 violation types, 2 improvements, 1 unmeasured, /,
  );
  assert.match(
    lines[1],
    /3 over the declared cap \(reported, not blocking until P5 \(new shell\) and P8 \(everything\)\)$/,
  );
  // A count that blocks must never appear only on the reported line.
  assert.doesNotMatch(lines[1], /audit errors|regressions/);
});

test("A11Y: cells over the declared cap are named, with the phase", () => {
  // compareCells has always computed these, and its own comment says it
  // reports them "so the number [is not] a surprise later" — which it did, in
  // the JSON, and never on the terminal.
  const text = a11yBreachSection([
    { id: "home/result/none/rtl", violations: 3, cap: 0 },
    { id: "about/arrival/none/ltr", violations: 1, cap: 0 },
  ]);
  assert.match(
    text,
    /over the declared cap \(reported, not blocking until P5 \(new shell\) and P8 \(everything\)\):/,
  );
  assert.match(text, / {2}home\/result\/none\/rtl: 3 > 0 violations/);
  assert.match(text, / {2}about\/arrival\/none\/ltr: 1 > 0 violations/);
  assert.equal(a11yBreachSection([]), "");
});

test("A11Y: a cap breach is reported even when nothing regressed", () => {
  // The case the summary used to hide: a run that passes with violations. The
  // bar is the declared cap, and the count must be on the terminal whatever the
  // run's verdict is.
  const text = a11ySummaryLines({
    cells: 11,
    violationTypes: 3,
    errors: 0,
    regressions: 0,
    improvements: 0,
    unmeasured: 0,
    breaches: 1,
  });
  assert.match(text, /0 regressions \(these block\)/);
  assert.match(text, /1 over the declared cap/);
});
