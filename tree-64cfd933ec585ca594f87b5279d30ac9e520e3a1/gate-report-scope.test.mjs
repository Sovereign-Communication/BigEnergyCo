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
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  breachSection as budgetBreachSection,
  breachesOf,
  enforcementLine as budgetEnforcementLine,
  limitOf,
  overLimitMetrics,
} from "../scripts/check-byte-budgets.mjs";
import {
  breachSection as a11yBreachSection,
  enforcementLine as a11yEnforcementLine,
  summaryLines as a11ySummaryLines,
} from "../scripts/check-a11y-matrix.mjs";
import {
  BYTE_BUDGET_LIMITS,
  brotliBytes,
} from "../scripts/lib/byte-budgets.mjs";
import {
  currencySentence,
  describeCodeSha,
} from "../scripts/lib/quality-evidence.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "scripts/check-byte-budgets.mjs");
const EVIDENCE_CLI = join(ROOT, "scripts/validate-quality-evidence.mjs");

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

// ── the artifact, not just the terminal ──────────────────────────────────────
//
// The report wrote a hardcoded `breaches: []` while the same run named three
// over-limit budgets on the terminal. That is the same defect one level down
// from the one the two fixes above address, and it is the worse of the two:
// `breaches` is a field scripts/lib/quality-evidence.mjs REQUIRES every
// byte_budgets artifact to carry, the committed evidence is what that validator
// certifies as current, and a required field that is always empty asserts
// nothing while the terminal says the opposite. These two tests drive the real
// CLI and read what it wrote, because the defect lived in the write.

/** A staged tree whose CSS genuinely beats the §3.1 `css_total` limit. */
function stageOverCssLimit() {
  const dir = mkdtempSync(join(tmpdir(), "jev-budget-artifact-"));
  // Pseudo-random, so brotli cannot squeeze it back under the limit.
  let seed = 987654321;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
  const css = Array.from(
    { length: 4000 },
    (_, i) =>
      `.c${i}{color:rgb(${next() % 255},${next() % 255},${next() % 255});margin:${next() % 97}px}`,
  ).join("");
  assert.ok(
    brotliBytes(Buffer.from(css)) > BYTE_BUDGET_LIMITS.css_total,
    "the fixture must actually exceed the plan's CSS budget, or this test proves nothing",
  );
  writeFileSync(
    join(dir, "index.html"),
    '<!doctype html><html><head><link rel="stylesheet" href="./site.css"></head></html>',
  );
  writeFileSync(join(dir, "site.css"), css);
  writeFileSync(join(dir, "ledger.jsonl"), "");
  return dir;
}

/** Run the gate over a staged tree and read back both of its surfaces. */
function runGate(dir) {
  const run = spawnSync(
    process.execPath,
    [
      CLI,
      "--stage",
      dir,
      "--ledger",
      join(dir, "ledger.jsonl"),
      "--out",
      join(dir, "r.json"),
    ],
    { encoding: "utf8" },
  );
  return { run, report: JSON.parse(readFileSync(join(dir, "r.json"), "utf8")) };
}

test("BUDGETS: the artifact names exactly the breaches the terminal names", () => {
  const dir = stageOverCssLimit();
  try {
    const { run, report } = runGate(dir);
    assert.equal(
      run.status,
      0,
      `an over-limit reading is reported, not failed, until P6/P8 (plan §3.2): ${run.stderr}`,
    );

    // The invariant, derived from the numbers this run measured: whatever is
    // over its limit is in the array, and nothing else is. Written as a
    // derivation rather than as three literal names, so it holds for whatever
    // the build measures tomorrow.
    const over = Object.entries(report.metrics)
      .filter(([, m]) => typeof m.value === "number" && m.value > m.limit)
      .map(([name]) => name)
      .sort();
    assert.ok(
      over.length,
      `the fixture must breach something: ${JSON.stringify(report.metrics)}`,
    );
    assert.deepEqual(
      report.breaches.map((b) => b.metric).sort(),
      over,
      "the artifact's breaches must be exactly the budgets over the plan's §3.1 limit",
    );

    for (const b of report.breaches) {
      // The terminal's own line, character for character. If the two surfaces
      // are rendered from one `message` they cannot drift; this is what proves
      // that they are, rather than a coincidence of today's numbers.
      const line = run.stdout
        .split("\n")
        .find((l) => l.startsWith(`  ${b.metric}: `));
      assert.ok(
        line,
        `${b.metric} is in the artifact but not on the terminal:\n${run.stdout}`,
      );
      assert.equal(
        b.message,
        line.trimStart(),
        `${b.metric}: the artifact's message must be the terminal's line`,
      );
      // And every number in the record is one the measurement produced, in the
      // shape compareToBaseline already uses for this report's other arrays.
      const m = report.metrics[b.metric];
      assert.equal(
        b.value,
        m.value,
        `${b.metric}: the reading must be the measured one`,
      );
      assert.equal(
        b.limit,
        m.limit,
        `${b.metric}: the limit must be the plan's`,
      );
      assert.equal(
        b.unit,
        m.unit,
        `${b.metric}: the unit must be the measured one`,
      );
    }

    assert.match(
      run.stdout,
      new RegExp(`${over.length} over the §3\\.1 limit`),
      "the summary's count must be the number of breaches in the artifact",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("BUDGETS: a run with nothing over the limit writes no breaches", () => {
  // The other direction, so the field is pinned as COMPUTED rather than
  // constant: hardcoding `[]` fails the test above, and hardcoding a list of
  // names fails this one.
  const dir = mkdtempSync(join(tmpdir(), "jev-budget-clean-"));
  try {
    writeFileSync(
      join(dir, "index.html"),
      "<!doctype html><html><head><title>t</title></head><body></body></html>",
    );
    writeFileSync(join(dir, "ledger.jsonl"), "");
    const { run, report } = runGate(dir);
    assert.equal(run.status, 0, `a clean run passes: ${run.stderr}`);
    assert.deepEqual(
      report.breaches,
      [],
      "a build inside every limit has nothing to report as a breach",
    );
    assert.match(
      run.stdout,
      /0 over the §3\.1 limit/,
      "and the terminal must agree with the empty array",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("BUDGETS: one computation, and both consumers go through it", () => {
  // The reason the two surfaces cannot drift is that there is one function.
  // A second place that decides "which budgets are over" is the defect the
  // hardcoded array was, one refactor away.
  const metrics = {
    a: bytes(100, 200),
    b: bytes(300, 200),
    d: count(11, 10),
  };
  assert.deepEqual(
    breachesOf(metrics).map((b) => b.metric),
    overLimitMetrics(metrics).map(([name]) => name),
    "breachesOf must be the same set overLimitMetrics reports",
  );
  // And the terminal section is rendered from the records, not recomputed: every
  // indented line in it is a breach record's own `message`.
  const records = breachesOf(metrics);
  const printed = budgetBreachSection(metrics)
    .split("\n")
    .filter((l) => l.startsWith("  "));
  assert.equal(printed.length, records.length, "one line per breach, no more");
  for (const line of printed) {
    assert.ok(
      records.some((b) => line.trim() === b.message),
      `the section printed a line no breach record carries: ${line}`,
    );
  }
  assert.deepEqual(breachesOf({ a: bytes(1, 2) }), []);
  assert.deepEqual(
    breachesOf({ a: bytes(2, 2) }),
    [],
    "at the limit is not over it",
  );
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

// ── what the evidence says it measured ──────────────────────────────────────
//
// The third instance of this file's defect class, and the one that could hide
// longest: `code_sha` is REQUIRED on every registry entry, five gates write it,
// and nothing read it. Freshness was `generated_at` against a 45-day window —
// how OLD a run is, never WHICH TREE it measured. The report's summary said
// "committed evidence is current", which is a claim about a tree, while four of
// the five committed artifacts carried a sha eleven commits behind HEAD.
//
// The constraint that shapes the fix, from the requester: the evidence file is
// committed IN the commit that changes the tree, so its sha can never equal
// HEAD. A gate demanding a match is red by construction. So the relationship is
// STATED and never judged — these tests pin the statement and, just as
// importantly, pin that stating it did not move the exit code.
//
// A real temporary git repository with real commits is the only way to test
// this honestly: a fixture with a made-up sha would let a test pass against an
// artifact that no checkout could ever place.

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@example.com",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@example.com",
  GIT_CONFIG_COUNT: "2",
  GIT_CONFIG_KEY_0: "user.name",
  GIT_CONFIG_VALUE_0: "t",
  GIT_CONFIG_KEY_1: "user.email",
  GIT_CONFIG_VALUE_1: "t@example.com",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
};

function gitIn(dir, args) {
  const result = spawnSync("git", args, {
    cwd: dir,
    encoding: "utf8",
    env: GIT_ENV,
  });
  assert.equal(
    result.status,
    0,
    `git ${args.join(" ")} failed: ${result.stderr || result.stdout || result.error?.message}`,
  );
  return result;
}

function commitFile(dir, rel, contents) {
  const abs = join(dir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, contents);
  gitIn(dir, ["add", rel]);
  gitIn(dir, ["commit", "-q", "-m", `add ${rel}`]);
  return gitIn(dir, ["rev-parse", "HEAD"]).stdout.trim();
}

/** A byte_budgets artifact that satisfies the registry's required_keys. */
function evidenceDoc(codeSha, extra = {}) {
  return JSON.stringify(
    {
      plan_item: "P0.4",
      metric: "byte_budgets",
      generated_at: "2026-09-28T00:00:00.000Z",
      code_sha: codeSha,
      regressions: [],
      breaches: [],
      metrics: {},
      ...extra,
    },
    null,
    2,
  );
}

/** A throwaway repository: `commits` empty commits, then the caller writes. */
function evidenceRepo() {
  const dir = mkdtempSync(join(tmpdir(), "jev-evidence-sha-"));
  gitIn(dir, ["init", "-q", "-b", "main"]);
  return dir;
}

function runEvidence(dir, args = []) {
  return spawnSync(
    process.execPath,
    [EVIDENCE_CLI, ...args, "--now", "2026-09-28T00:00:00.000Z"],
    {
      cwd: dir,
      encoding: "utf8",
      env: GIT_ENV,
    },
  );
}

test("EVIDENCE: a SHA that names a tree object, not a commit, is unplaceable", () => {
  const dir = evidenceRepo();
  try {
    const head = commitFile(dir, "seed.txt", "one");
    const tree = gitIn(dir, ["rev-parse", "HEAD^{tree}"]).stdout.trim();
    mkdirSync(join(dir, ".quality-evidence"), { recursive: true });
    writeFileSync(
      join(dir, ".quality-evidence/byte-budgets.json"),
      evidenceDoc(tree),
    );
    const run = runEvidence(dir);
    assert.equal(run.status, 0);
    assert.match(
      run.stdout,
      /relation to this tree cannot be established from this checkout/,
      "a tree sha is not a commit sha; merge-base can answer yes to both, but rev-list cannot count the distance",
    );
    assert.notEqual(tree, head);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("EVIDENCE: an artifact says which commit it measured, and how far it is behind", () => {
  const dir = evidenceRepo();
  try {
    const measured = commitFile(dir, "seed.txt", "one");
    commitFile(
      dir,
      ".quality-evidence/byte-budgets.json",
      evidenceDoc(measured),
    );
    commitFile(dir, "second.txt", "two");
    commitFile(dir, "third.txt", "three");
    const head = gitIn(dir, ["rev-parse", "HEAD"]).stdout.trim();

    const run = runEvidence(dir);
    assert.equal(
      run.status,
      0,
      `stating the relationship is not a verdict: ${run.stdout}${run.stderr}`,
    );
    assert.match(
      run.stdout,
      new RegExp(`tree: ${head}`),
      "the report must name the tree it is judging against, once",
    );
    assert.match(
      run.stdout,
      new RegExp(
        `describes ${measured.slice(0, 7)} — 3 commits behind this tree`,
      ),
      `the artifact measured a commit three behind and must say so:\n${run.stdout}`,
    );
    // The sentence that made the claim nothing supported. It is gone, and what
    // replaced it is countable from the artifacts themselves.
    assert.doesNotMatch(
      run.stdout,
      /committed evidence is current/,
      "the old summary claimed a currency nothing checked",
    );
    assert.match(
      run.stdout,
      /1 artifact describes an earlier commit \(oldest is 3 commits behind this tree\)/,
      "the summary must carry the same fact the per-artifact lines do",
    );
    // The other four entries have no file in this repo, and that stays a gap
    // rather than a failure — the line between failing and unmeasured.
    assert.match(run.stdout, /gap\s+a11y_matrix/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("EVIDENCE: an artifact measured on this tree says so", () => {
  const dir = evidenceRepo();
  try {
    const head = commitFile(dir, "seed.txt", "one");
    // In the fixture the report is uncommitted, so it can truthfully say it was
    // measured on HEAD. A real committed report cannot: adding the sha changes
    // the commit hash, which is the constraint the production report explains.
    mkdirSync(join(dir, ".quality-evidence"), { recursive: true });
    writeFileSync(
      join(dir, ".quality-evidence/byte-budgets.json"),
      evidenceDoc(head),
    );

    const run = runEvidence(dir);
    assert.equal(run.status, 0);
    assert.match(
      run.stdout,
      /describes [0-9a-f]{7} — this tree$/m,
      `an artifact measured on HEAD is not behind it:\n${run.stdout}`,
    );
    assert.equal(head.length, 40);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("EVIDENCE: a commit that is not in this history is not the same as one this checkout cannot see", () => {
  // The distinction the shallow clone forces. `fetch-depth: 1` is the default
  // on actions/checkout, so in CI the commit a report measured against is
  // frequently absent from the clone — and calling that "a different tree"
  // would be a reading the checkout cannot support.
  const dir = evidenceRepo();
  try {
    const main1 = commitFile(dir, "seed.txt", "one");
    gitIn(dir, ["checkout", "-q", "-b", "side"]);
    const onSide = commitFile(dir, "side.txt", "side");
    gitIn(dir, ["checkout", "-q", "main"]);
    commitFile(dir, "main.txt", "two");

    // Present, and genuinely not an ancestor of this tree.
    commitFile(dir, ".quality-evidence/byte-budgets.json", evidenceDoc(onSide));
    const foreign = runEvidence(dir);
    assert.equal(foreign.status, 0);
    assert.match(
      foreign.stdout,
      new RegExp(
        `describes ${onSide.slice(0, 7)} — present in this checkout, but not in this tree's history`,
      ),
      `a commit from another branch must not read as "behind":\n${foreign.stdout}`,
    );

    // Absent entirely: a sha no checkout has.
    writeFileSync(
      join(dir, ".quality-evidence/byte-budgets.json"),
      evidenceDoc("0".repeat(40)),
    );
    const absent = runEvidence(dir);
    assert.equal(absent.status, 0);
    assert.match(
      absent.stdout,
      /relation to this tree cannot be established from this checkout/,
      `a sha this checkout does not have is unmeasured, not a verdict:\n${absent.stdout}`,
    );
    assert.doesNotMatch(
      absent.stdout,
      /present in this checkout, but not in this tree's history/,
      "and an absent sha must not be called a known foreign commit",
    );
    assert.equal(main1.length, 40);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("EVIDENCE: --json carries the relationship, and the full sha", () => {
  const dir = evidenceRepo();
  try {
    const measured = commitFile(dir, "seed.txt", "one");
    commitFile(
      dir,
      ".quality-evidence/byte-budgets.json",
      evidenceDoc(measured),
    );
    commitFile(dir, "second.txt", "two");

    const run = runEvidence(dir, ["--json"]);
    assert.equal(run.status, 0);
    const json = JSON.parse(run.stdout);
    const budgets = json.code_sha.find((c) => c.metric === "byte_budgets");
    assert.equal(
      budgets.code_sha,
      measured,
      "a consumer gets the unabbreviated sha, not the 7 characters a human reads",
    );
    assert.equal(budgets.relation.state, "behind");
    assert.equal(budgets.relation.commits, 2);
    assert.match(
      json.currency,
      /1 artifact describes an earlier commit/,
      "and the same sentence the terminal prints",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("EVIDENCE: the wording covers every state, and says nothing it cannot support", () => {
  // The lib half, so a state with no CLI path today is still worded rather than
  // silently falling through to the "unknown" branch.
  assert.match(
    describeCodeSha("abc1234def", { state: "behind", commits: 1 }),
    /describes abc1234 — 1 commit behind this tree$/,
  );
  assert.match(
    describeCodeSha("abc1234def", { state: "behind", commits: 4 }),
    /4 commits behind this tree$/,
  );
  assert.match(describeCodeSha("abc1234def", { state: "head" }), /this tree$/);
  assert.match(
    describeCodeSha("abc1234def", { state: "unknown" }),
    /relation to this tree cannot be established from this checkout/,
  );
  assert.match(
    describeCodeSha(null, { state: "head" }),
    /declares no code_sha/,
    "an artifact that records no commit says so rather than being skipped",
  );
  // No state may print a full 40-character sha: the human report abbreviates so
  // the number a reader came for is not buried under hashes.
  for (const state of ["head", "behind", "foreign", "unknown"]) {
    const line = describeCodeSha("a".repeat(40), { state, commits: 2 });
    assert.doesNotMatch(line, /a{40}/, `${state} prints a full sha`);
  }
  assert.equal(
    currencySentence([]),
    "no artifact records the commit it measured",
  );
  assert.match(
    currencySentence([
      { state: "head" },
      { state: "behind", commits: 3 },
      { state: "foreign" },
      { state: "unknown" },
    ]),
    /^1 artifact describes this tree; 1 artifact describes an earlier commit \(oldest is 3 commits behind this tree\); 1 artifact names a commit outside this tree's history \(but present in this checkout\); 1 artifact reports a code_sha whose relation to this tree cannot be established from this checkout$/,
  );
});
