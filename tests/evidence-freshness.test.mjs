import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  COMPOSABLE_FIELDS,
  composeMeasuredCounts,
} from "../scripts/build-jev-evidence.mjs";
import { parseCounts, measurementFrom } from "../scripts/run-tests.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROSE = join(ROOT, "evidence", "advisor-and-release.json");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const prose = JSON.parse(readFileSync(PROSE, "utf8"));

/** Run the gate against a mutated copy of the record, in a temp dir. */
function gateAgainst(mutate) {
  const dir = mkdtempSync(join(tmpdir(), "beco-evidence-freshness-"));
  try {
    const copy = JSON.parse(readFileSync(PROSE, "utf8"));
    mutate(copy);
    const file = join(dir, "prose.json");
    writeFileSync(file, JSON.stringify(copy, null, 2));
    try {
      const out = execFileSync(
        process.execPath,
        [join(ROOT, "scripts", "check-evidence-freshness.mjs")],
        {
          cwd: ROOT,
          env: { ...process.env, PROSE_OVERRIDE: file },
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      return { code: 0, out };
    } catch (e) {
      return { code: e.status ?? 1, out: `${e.stdout || ""}${e.stderr || ""}` };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// The gate reads the committed record by default. The mutation helper needs to
// point it elsewhere, so the override is part of the gate rather than something
// a test reaches around — a gate that cannot be pointed at a fixture cannot be
// mutation-checked, and an unmutation-checked gate is a comment.
test("the freshness gate reads the record it is asked to read", () => {
  const src = readFileSync(
    join(ROOT, "scripts", "check-evidence-freshness.mjs"),
    "utf8",
  );
  assert.match(
    src,
    /PROSE_OVERRIDE/,
    "the gate must accept a PROSE_OVERRIDE or it cannot be mutation-checked",
  );
});

// ── the wiring, which is the part that silently stops existing ─────────────
test("the freshness gate is wired into npm run seo and has its own script", () => {
  assert.match(
    pkg.scripts.seo,
    /check-evidence-freshness\.mjs/,
    "npm run seo must run the freshness gate, or the record drifts with nobody noticing",
  );
  assert.equal(
    pkg.scripts["gate:evidence-freshness"],
    "node scripts/check-evidence-freshness.mjs",
  );
});

// ── the committed record must pass its own gate ────────────────────────────
test("the committed record passes the freshness gate", () => {
  execFileSync(
    process.execPath,
    [join(ROOT, "scripts", "check-evidence-freshness.mjs")],
    { cwd: ROOT, stdio: "pipe" },
  );
});

// ── each rule, mutation-checked: the gate must bite ─────────────────────────
test("a typed test count fails the gate", () => {
  const r = gateAgainst((p) => {
    p.tests_summary = "1400/1400 npm test green (1400 tests, 1400 pass)";
  });
  assert.notEqual(r.code, 0, "a hand-typed count must not pass");
  assert.match(r.out, /types an N\/N count/);
});

test("a typed gate count fails the gate", () => {
  const r = gateAgainst((p) => {
    p.smoke_note = "the browser smoke runs 153 gates. Measured: 153 pass.";
  });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /smoke_note types/);
});

test("an asset stamp the tree contradicts fails the gate", () => {
  const r = gateAgainst((p) => {
    p.seo_summary = p.seo_summary.replace(/2026\d{4}[a-z]/, "20260925c");
  });
  assert.notEqual(r.code, 0, "a stamp that is not the shipped one must fail");
  assert.match(r.out, /asset stamp .* but the shipped pages reference/);
});

test("an SW cache version the tree contradicts fails the gate", () => {
  const r = gateAgainst((p) => {
    p.seo_summary = p.seo_summary.replace(/beco-v\d+/, "beco-v1");
  });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /SW cache beco-v1, but sw\.js ships/);
});

test("a placeholder no runner writes fails the gate", () => {
  const r = gateAgainst((p) => {
    p.smoke_note = "the browser smoke runs {{smoke_gate_count}} gates.";
  });
  assert.notEqual(r.code, 0, "a channel that does not exist is not freshness");
  assert.match(r.out, /which no runner writes/);
});

test("an empty summary fails the gate", () => {
  const r = gateAgainst((p) => {
    p.ci_summary = "   ";
  });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /ci_summary is empty/);
});

// ── the counts really are composed from the run ────────────────────────────
test("every quoted count resolves from a measurement the runners write", () => {
  const { prose: filled, problems } = composeMeasuredCounts(prose, {
    test: {
      measurements: {
        tests_total: 1362,
        tests_passed: 1362,
        tests_failed: 0,
        tests_skipped: 0,
      },
    },
    "web-smoke": {
      measurements: {
        smoke_gates_total: 166,
        smoke_gates_passed: 166,
        smoke_gates_failed: 0,
      },
    },
  });
  assert.deepEqual(
    problems,
    [],
    "the committed record quotes only real channels",
  );
  for (const field of COMPOSABLE_FIELDS) {
    assert.doesNotMatch(
      filled[field],
      /\{\{/,
      `${field} still carries an unresolved placeholder`,
    );
  }
  assert.match(filled.tests_summary, /^1362\/1362 npm test green/);
  assert.match(filled.smoke_note, /runs 166 gates/);
});

test("an unresolved placeholder is a named problem, not a blank", () => {
  const { prose: filled, problems } = composeMeasuredCounts(
    { tests_summary: "{{tests_passed}}/{{tests_total}} green" },
    {},
  );
  assert.equal(problems.length, 2, "one problem per unresolved placeholder");
  assert.match(filled.tests_summary, /\{\{/, "the literal stays visible");
});

test("a placeholder resolves only from its own run's measurement", () => {
  const { prose: filled } = composeMeasuredCounts(
    { smoke_note: "{{tests_total}} tests" },
    { "web-smoke": { measurements: { smoke_gates_total: 166 } } },
  );
  assert.match(
    filled.smoke_note,
    /\{\{tests_total\}\}/,
    "a web-smoke measurement must not be able to fill a test-count placeholder",
  );
});

// ── the two measurement producers agree with what they report ──────────────
test("the test-count parser reads the runner's own summary block", () => {
  const output = [
    "ℹ tests 1362",
    "ℹ suites 0",
    "ℹ pass 1362",
    "ℹ fail 0",
    "ℹ cancelled 0",
    "ℹ skipped 0",
    "ℹ todo 0",
  ].join("\n");
  assert.deepEqual(parseCounts(output), {
    tests: 1362,
    pass: 1362,
    fail: 0,
    skipped: 0,
    cancelled: 0,
  });
  const m = measurementFrom(parseCounts(output));
  assert.equal(m.tests_total ?? m.tests, 1362);
  assert.match(m.command, /node --test/);
});

test("a summary block the runner never printed is reported as missing, not zero", () => {
  const counts = parseCounts("something went sideways\n");
  assert.equal(counts.tests, null, "a missing count is null, never 0");
});

test("the wrapper captures BOTH streams, because the runner writes the summary to stderr", () => {
  const src = readFileSync(join(ROOT, "scripts", "run-tests.mjs"), "utf8");
  // This is not a style preference. Node's test runner puts its summary block
  // on stderr, and whether it ALSO lands on stdout varies by environment: it did
  // locally and did not on the first CI run, so the wrapper recorded nothing and
  // the record reached the builder with unresolved placeholders. Reading one
  // stream and hoping is how a measurement silently becomes zero.
  assert.match(
    src,
    /stdio:\s*\["ignore",\s*"pipe",\s*"pipe"\]/,
    "the wrapper must capture both streams",
  );
  assert.match(src, /tee\(child\.stdout/);
  assert.match(src, /tee\(child\.stderr/);
});

test("the summary block is parsed out of combined output, not one stream", () => {
  // The exact failure: a summary that arrives on stderr alone still parses.
  const stderrOnly = "ℹ tests 1378\nℹ pass 1378\nℹ fail 0\n";
  assert.equal(parseCounts(stderrOnly).tests, 1378);
  assert.equal(parseCounts(stderrOnly).pass, 1378);
});

test("both reporter formats parse, because the default reporter is version-dependent", () => {
  // The second CI failure: Node 22 defaults to TAP, Node 24 to spec, this repo's
  // CI pins 22 and a developer machine runs 24, and the parser read zero on one
  // of them. The reporter is now pinned; both forms are parsed anyway so the
  // next version bump costs a parser line rather than an empty measurement.
  const tap = "# tests 1397\n# suites 0\n# pass 1397\n# fail 0\n# skipped 0\n";
  const spec = "ℹ tests 1397\nℹ suites 0\nℹ pass 1397\nℹ fail 0\nℹ skipped 0\n";
  for (const block of [tap, spec]) {
    const c = parseCounts(block);
    assert.equal(c.tests, 1397, `tests not parsed from:\n${block}`);
    assert.equal(c.pass, 1397);
    assert.equal(c.fail, 0);
  }
});

test("the wrapper pins the reporter, so the format cannot drift with the runtime", () => {
  const src = readFileSync(join(ROOT, "scripts", "run-tests.mjs"), "utf8");
  assert.match(
    src,
    /--test-reporter=spec/,
    "an unpinned reporter is a measurement that disappears on a Node upgrade",
  );
});

test("npm test is the wrapper that records, and the wrapper spawns node --test", () => {
  assert.equal(
    pkg.scripts.test,
    "node scripts/run-tests.mjs",
    "if npm test stops being the wrapper, no count is recorded and the record " +
      "goes back to being typed",
  );
  const src = readFileSync(join(ROOT, "scripts", "run-tests.mjs"), "utf8");
  assert.match(src, /"--test"/, "the wrapper must run the real test runner");
  assert.match(
    src,
    /tests\/\*\.test\.mjs/,
    "the wrapper must keep the suite's own glob, or it measures a different suite",
  );
});

test("the smoke gate reporter counts every gate it reports", () => {
  const src = readFileSync(
    join(ROOT, "scripts", "smoke", "runtime.mjs"),
    "utf8",
  );
  assert.match(src, /smoke-measurement\.json/);
  assert.match(
    src,
    /gates_total/,
    "the count the record quotes must be written",
  );
  // The counter has to advance on every gate, not only failing ones, or the
  // number the record quotes is the number that broke.
  assert.match(src, /total\+\+\s*;\s*if \(!ok\) failures\+\+;/);
});
