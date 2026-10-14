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
import { deployList } from "../scripts/lib/deploy-manifest.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROSE = join(ROOT, "evidence", "advisor-and-release.json");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const prose = JSON.parse(readFileSync(PROSE, "utf8"));

/** Run the gate against a mutated copy of the record, in a temp dir. */
function gateAgainst(mutate, env = {}) {
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
          env: { ...process.env, PROSE_OVERRIDE: file, ...env },
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

// ── the 2026-10-13 widening ────────────────────────────────────────────────
// Every rule below exists because the audit found a stated fact about the build
// or about production that nothing in this pipeline read: three facet proof
// lines named a build three releases old, the staged-manifest half of rule 2
// compared its claim to nothing at all, and the record's one sentence about
// production was typed by hand and never measured. Each rule is mutation-checked
// here — a claim the tree disagrees with must fail and must fail NAMING what it
// was compared against — and each is also checked from the other side, because a
// rule that fires on a truthful fact is worse than no rule.

const PROBE = join(ROOT, "evidence", "production-probe.json");
const probe = JSON.parse(readFileSync(PROBE, "utf8"));
const committed = JSON.parse(readFileSync(PROSE, "utf8"));
const ledgerRecords = readFileSync(
  join(ROOT, "docs", "release-ledger.jsonl"),
  "utf8",
)
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));
const lastRelease = ledgerRecords
  .filter((r) => typeof r.stamp === "string")
  .pop().stamp;
const servedByProbe = probe.targets.find(
  (t) => t.name === committed.production.target,
).served_stamp;

test("a stale build identity in a facet proof line fails the gate", () => {
  const r = gateAgainst((p) => {
    p.facet_evidence.seo = p.facet_evidence.seo.replace(
      /2026\d{4}[a-z]/,
      "20260925c",
    );
  });
  assert.notEqual(r.code, 0, "a facet line naming another build must not pass");
  assert.match(r.out, /facet_evidence\.seo states asset stamp 20260925c/);
  assert.match(r.out, /but the shipped pages reference/);
});

test("a stale SW cache version in a facet proof line fails the gate", () => {
  const r = gateAgainst((p) => {
    p.facet_evidence.seo = p.facet_evidence.seo.replace(
      /beco-v\d+/,
      "beco-v88",
    );
  });
  assert.notEqual(r.code, 0);
  assert.match(
    r.out,
    /facet_evidence\.seo states SW cache beco-v88, but sw\.js ships/,
  );
});

test("a stated manifest size is checked against the real deploy allowlist", () => {
  const real = deployList().length;
  const wrong = gateAgainst((p) => {
    p.facet_evidence.docs = "this tree stages 999 manifest files";
  });
  assert.notEqual(wrong.code, 0, "a manifest size nothing ships must not pass");
  assert.match(
    wrong.out,
    /states the deploy manifest stages 999 files, but the deploy allowlist holds/,
  );
  const right = gateAgainst((p) => {
    p.facet_evidence.docs = `this tree stages ${real} manifest files`;
  });
  assert.equal(
    right.code,
    0,
    "the size the allowlist actually holds must pass: the rule checks a fact, not a shape",
  );
});

test("a production claim with no measured block fails the gate", () => {
  const r = gateAgainst((p) => {
    delete p.production;
  });
  assert.notEqual(
    r.code,
    0,
    "a production claim no measurement backs must not pass",
  );
  assert.match(r.out, /states production facts/);
  assert.match(r.out, /with no measured block to check them against/);
});

test("a production number the probe did not measure fails the gate", () => {
  const r = gateAgainst((p) => {
    p.production.served_stamp = "20260917h";
  });
  assert.notEqual(r.code, 0, "a retyped served stamp must not pass");
  assert.match(
    r.out,
    /production\.served_stamp is "20260917h", but the probe measured/,
  );
});

test("a probe measured against another tree backs nothing here", () => {
  const dir = mkdtempSync(join(tmpdir(), "beco-probe-fixture-"));
  try {
    const file = join(dir, "probe.json");
    writeFileSync(
      file,
      JSON.stringify({ ...probe, tree_stamp: "20260925c" }, null, 2),
    );
    const r = gateAgainst(() => {}, { PROBE_OVERRIDE: file });
    assert.notEqual(
      r.code,
      0,
      "a probe of a tree that is not this one must fail, however green it was there",
    );
    assert.match(
      r.out,
      /was measured against tree stamp 20260925c, but this tree ships/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a production block dated by hand rather than by the probe fails the gate", () => {
  // The block is a VIEW of evidence/production-probe.json, so it may not carry a
  // timestamp of its own: a date typed here can outlive the measurement it
  // claims to describe, which is the whole failure this gate exists for.
  const r = gateAgainst((p) => {
    p.production.measured_at = "2026-10-01T00:00:00.000Z";
  });
  assert.notEqual(r.code, 0, "a self-dated production block must not pass");
  assert.match(
    r.out,
    /production\.measured_at is 2026-10-01T00:00:00\.000Z, but evidence\/production-probe\.json was measured at/,
  );
});

test("a production block pointing at another artifact fails the gate", () => {
  const r = gateAgainst((p) => {
    p.production.evidence = "evidence/something-else.json";
  });
  assert.notEqual(
    r.code,
    0,
    "the block must name the measurement the gate reads, or a reader is sent to a file nothing checked",
  );
  assert.match(
    r.out,
    /production\.evidence names evidence\/something-else\.json/,
  );
  assert.match(
    r.out,
    /but the measurement this gate checks is evidence\/production-probe\.json/,
  );
});

test("a production target the probe never measured fails the gate", () => {
  const r = gateAgainst((p) => {
    p.production.target = "gh-pages";
  });
  assert.notEqual(r.code, 0, "a surface nobody probed is not a measurement");
  assert.match(
    r.out,
    /production\.target is gh-pages, which is not one of the/,
  );
});

test("a tree stamp the record got from somewhere else fails the gate", () => {
  const r = gateAgainst((p) => {
    p.production.tree_stamp = "20260925c";
  });
  assert.notEqual(r.code, 0);
  assert.match(
    r.out,
    /production\.tree_stamp is 20260925c, but this tree ships/,
  );
});

test("a ledger stamp the release ledger does not record fails the gate", () => {
  const r = gateAgainst((p) => {
    p.production.ledger_stamp = "20260101a";
  });
  assert.notEqual(r.code, 0);
  assert.match(
    r.out,
    /production\.ledger_stamp is 20260101a, but the last release/,
  );
});

test("recorded_release must be the truth about the two stamps", () => {
  const shouldBe = servedByProbe === lastRelease;
  const r = gateAgainst((p) => {
    p.production.recorded_release = !shouldBe;
  });
  assert.notEqual(
    r.code,
    0,
    "the flag may not disagree with the two stamps it describes",
  );
  assert.match(
    r.out,
    /production\.recorded_release is (true|false), but the build production serves/,
  );
});

test("a surface the probe could not verify must be named in the record", (t) => {
  const unverified = probe.targets
    .filter((x) => x.verified !== true)
    .map((x) => x.name);
  if (!unverified.length) return t.skip("every probed surface is verified");
  const r = gateAgainst((p) => {
    p.production.unverified_surfaces = [];
  });
  assert.notEqual(
    r.code,
    0,
    "an unmeasured surface may not be silently omitted",
  );
  assert.match(
    r.out,
    /production\.unverified_surfaces is \[\], but the probe could not verify \[/,
  );
});

test("a committed run report may not claim a release nothing released", () => {
  const report = join(ROOT, ".jev-test-report.json");
  try {
    writeFileSync(
      report,
      JSON.stringify({
        evidence: {
          smoke_note: "Production: servedStamp 20260101a, verified:true.",
        },
      }),
    );
    const bad = gateAgainst(() => {});
    assert.notEqual(
      bad.code,
      0,
      "a stamp no release records and this tree does not ship must not pass",
    );
    assert.match(bad.out, /claims production served stamp 20260101a/);

    // …and the same claim about a build that IS this tree's passes, so the rule
    // is checking the release of record rather than the shape of a sentence.
    writeFileSync(
      report,
      JSON.stringify({
        evidence: { smoke_note: `Production serves stamp ${servedByProbe}.` },
      }),
    );
    const good = gateAgainst(() => {});
    assert.equal(good.code, 0, "a truthful served-release claim must pass");
  } finally {
    rmSync(report, { force: true });
  }
});

test("a facet proof line may quote a composed count, and an invented one fails", () => {
  const invented = gateAgainst((p) => {
    p.facet_evidence.testing = "{{smoke_gate_count}} gates";
  });
  assert.notEqual(
    invented.code,
    0,
    "a channel no runner writes is not a measurement",
  );
  assert.match(
    invented.out,
    /facet_evidence\.testing quotes \{\{smoke_gate_count\}\}, which no runner writes/,
  );
  const real = gateAgainst((p) => {
    p.facet_evidence.testing = "{{tests_total}} tests green";
  });
  assert.equal(real.code, 0, "a real channel in a facet line must pass");
});

test("composition reaches every string in the record, not a list of fields", () => {
  const { prose: filled, problems } = composeMeasuredCounts(
    {
      facet_evidence: { testing: "{{tests_total}} tests green" },
      notes: ["the smoke ran {{smoke_gates_total}} gates"],
    },
    {
      test: { measurements: { tests_total: 1668 } },
      "web-smoke": { measurements: { smoke_gates_total: 166 } },
    },
  );
  assert.deepEqual(problems, [], "every channel here exists");
  assert.equal(
    filled.facet_evidence.testing,
    "1668 tests green",
    "a facet proof line is composed like any other field",
  );
  assert.equal(filled.notes[0], "the smoke ran 166 gates");
});

test("the committed production block mirrors the committed probe", () => {
  const target = probe.targets.find(
    (x) => x.name === committed.production.target,
  );
  assert.ok(target, "the block names a surface the probe measured");
  for (const key of [
    "surface",
    "served_stamp",
    "files_checked",
    "matched",
    "verified",
  ]) {
    assert.equal(
      committed.production[key],
      target[key],
      `production.${key} must be the measurement, not a retyping of it`,
    );
  }
  assert.equal(committed.production.measured_at, probe.measured_at);
  assert.equal(committed.production.tree_stamp, probe.tree_stamp);
  assert.deepEqual(
    [...committed.production.unverified_surfaces].sort(),
    probe.targets
      .filter((x) => x.verified !== true)
      .map((x) => x.name)
      .sort(),
  );
});
