// Master plan P0.3(e) / F-45: the live-Jev evidence must be produced by CI
// from real job outcomes, not hand-edited and committed.
//
// F-45 is precise about the failure: the evidence file was hand-maintained and
// went stale. A hand-maintained file can claim `tests_green: true` while the
// suite is red, and nothing in the pipeline can tell. §13.3 closes it: "Evidence
// is produced by CI from real job outcomes. A hand-written evidence file is
// never accepted as proof on its own."
//
// So the contract these tests pin is:
//   • every run record comes from a CI artifact, never from the prose file, and
//     the JOB outcome is authoritative over its individual steps;
//   • anything that is not positively "success" is red, including a missing
//     artifact, a missing step, and a step that never ran;
//   • the report says whether the evidence it consumed was machine-generated, so
//     a reader can tell a CI run from a hand-typed one at a glance;
//   • a live judgment is only accepted when the provider names a concrete model
//     version, so every score is attributable to the model that produced it;
//   • the report classifies its own run, because the plan permits one re-run of
//     a PROVIDER ERROR and none of a JUDGMENT — a rule nobody can read is not
//     a rule;
//   • the `jev-complete` job needs [test, web-smoke, coverage], records the
//     secret from the repo's own wiring, and uploads what it produced.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  EVIDENCE_VERSION,
  EVIDENCE_GENERATED_BY,
  RUN_RECORD_FIELDS,
  CODE_OWNED_FIELDS,
  parseJobResult,
  runRecordsFromArtifacts,
  composeEvidence,
  resolveCiScope,
  acceptLiveJudgment,
  classifyRun,
  evidenceSourceKind,
} from "../scripts/lib/jev-ci.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUILDER = join(ROOT, "scripts/build-jev-evidence.mjs");
const CLI = join(ROOT, "scripts/validate-jev-complete.mjs");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const GREEN = {
  test: {
    job: "test",
    conclusion: "success",
    steps: { unit_tests: "success", prettier: "success", seo: "success" },
  },
  "web-smoke": {
    job: "web-smoke",
    conclusion: "success",
    steps: { smoke: "success" },
  },
  coverage: {
    job: "coverage",
    conclusion: "success",
    steps: { coverage: "success" },
  },
};

const PROSE = {
  tests_summary: "816/816 npm test green",
  ci_summary: "PRs merged 5/5",
  smoke_note: "153/153 smoke gates",
  notes: ["one note"],
  facet_evidence: { spec: "a proof line", testing: "another proof line" },
};

function withArtifacts(artifacts, fn) {
  const dir = mkdtempSync(join(tmpdir(), "jev-ci-"));
  try {
    for (const [name, value] of Object.entries(artifacts)) {
      writeFileSync(join(dir, `${name}.json`), JSON.stringify(value, null, 2));
    }
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── the artifacts themselves ────────────────────────────────────────────────

test("ARTIFACT: a job result is read strictly, and junk is rejected", () => {
  const ok = parseJobResult(
    JSON.stringify({ job: "test", conclusion: "success", steps: {} }),
  );
  assert.equal(ok.ok, true);
  assert.equal(ok.job, "test");
  assert.equal(ok.conclusion, "success");

  for (const bad of [
    "",
    "not json",
    "[]",
    '"a string"',
    "{}",
    '{"job":"test"}',
    '{"job":"test","conclusion":"success"}', // steps must be an object
    '{"job":"test","conclusion":"success","steps":[]}',
    '{"job":"test","conclusion":"success","steps":{"a":"weird"}}',
  ]) {
    const parsed = parseJobResult(bad);
    assert.equal(
      parsed.ok,
      false,
      `must refuse ${JSON.stringify(bad)} rather than treat it as a pass`,
    );
    assert.ok(parsed.error, "a refusal must say why");
  }
});

// A realistic red run: the `test` job's steps run in order and the unit tests
// are last, so seo and prettier really did pass before the suite failed.
const RED_TESTS = {
  test: {
    job: "test",
    conclusion: "failure",
    steps: { unit_tests: "failure", prettier: "success", seo: "success" },
  },
  "web-smoke": GREEN["web-smoke"],
  coverage: GREEN.coverage,
};

test("EVIDENCE: every run record comes from the artifacts, never from prose", () => {
  // The F-45 killer: prose says green, CI says red. CI wins, or the whole
  // point of generating the evidence in CI is lost.
  const { records, problems } = runRecordsFromArtifacts(RED_TESTS);
  assert.equal(records.tests_green, false, "a failed unit-test step is red");
  assert.equal(
    records.prettier_clean,
    true,
    "prettier really did pass, so the record keeps the truth about it",
  );
  assert.equal(records.smoke_green, true);
  assert.ok(
    problems.some((p) => p.includes('"test"') && p.includes("failure")),
    `the red job must be reported so the caller stops: ${JSON.stringify(problems)}`,
  );
});

test("EVIDENCE: a step's own outcome is the record; a job that did not finish is a problem", () => {
  // A cancelled job can leave earlier steps marked success. Two honest things
  // are true at once: those steps passed, and the run was cut short. The record
  // must say both, and the caller must stop — not by falsifying the steps, and
  // not by ignoring the cancellation.
  const { records, problems } = runRecordsFromArtifacts({
    test: {
      job: "test",
      conclusion: "cancelled",
      steps: { unit_tests: "success", prettier: "success", seo: "success" },
    },
    "web-smoke": GREEN["web-smoke"],
    coverage: GREEN.coverage,
  });
  assert.equal(
    records.tests_green,
    true,
    "the step that ran and passed passed",
  );
  assert.equal(records.ci_green, false, "a cancelled run is not a green CI");
  assert.ok(
    problems.some((p) => p.includes("cancelled")),
    `the cancellation must be named: ${JSON.stringify(problems)}`,
  );
  assert.equal(records.smoke_green, true, "other jobs are judged on their own");
});

test("EVIDENCE: a missing artifact or a step that never ran is red, and named", () => {
  const missing = runRecordsFromArtifacts({ test: GREEN.test });
  assert.equal(missing.records.smoke_green, false);
  assert.equal(missing.records.ci_green, false);
  assert.ok(
    missing.problems.some((p) => p.includes("web-smoke")),
    `the missing job must be named: ${JSON.stringify(missing.problems)}`,
  );

  // A job that failed before the prettier step never records that step. An
  // absent step is not a pass.
  const earlyExit = runRecordsFromArtifacts({
    test: { job: "test", conclusion: "failure", steps: { seo: "success" } },
    "web-smoke": GREEN["web-smoke"],
    coverage: GREEN.coverage,
  });
  assert.equal(earlyExit.records.prettier_clean, false);
  assert.equal(earlyExit.records.seo_green, true, "that step did run and pass");
  assert.ok(
    earlyExit.problems.some((p) => p.includes("prettier")),
    "an unrecorded step must be named, not inferred",
  );
});

test("EVIDENCE: the composed file says it was generated, and by what", () => {
  const { evidence } = composeEvidence({
    artifacts: GREEN,
    prose: PROSE,
    run: {
      run_id: "12345",
      run_attempt: "2",
      sha: "abc1234",
      event: "pull_request",
    },
    generatedAt: "2026-09-26T00:00:00.000Z",
  });
  assert.equal(evidence.evidence_version, EVIDENCE_VERSION);
  assert.equal(evidence.generated_by, EVIDENCE_GENERATED_BY);
  assert.equal(evidence.generated_at, "2026-09-26T00:00:00.000Z");
  assert.equal(evidence.run.run_id, "12345");
  assert.equal(evidence.run.sha, "abc1234");
  assert.equal(evidence.ci.jobs.test.conclusion, "success");
  // The provenance is what lets the report distinguish this from a hand-typed
  // file; without it §13.3's "never accepted as proof on its own" is unfalsifiable.
  assert.equal(evidenceSourceKind(evidence), "ci-generated");
  assert.equal(evidenceSourceKind(PROSE), "hand-maintained");
  assert.equal(evidenceSourceKind(null), "none");
});

test("EVIDENCE: prose is carried through, and its booleans are not", () => {
  // A prose file legitimately holds narrative measurements a script cannot
  // produce ("30 of 153 smoke gates are battery-only"). Those must survive.
  const hostile = {
    ...PROSE,
    tests_green: true,
    prettier_clean: true,
    seo_green: true,
    smoke_green: true,
    ci_green: true,
    tree_clean: true,
    secrets_clean: true,
  };
  const broken = runRecordsFromArtifacts(RED_TESTS);
  const { evidence } = composeEvidence({
    artifacts: RED_TESTS,
    prose: hostile,
    run: { run_id: "1", sha: "abc1234" },
  });
  assert.equal(
    evidence.tests_green,
    false,
    "the prose file's claim of green tests must not reach the evidence",
  );
  assert.equal(evidence.seo_green, true, "seo really was green in CI");
  assert.equal(evidence.ci_green, false, "the test job did not finish");
  assert.equal(
    broken.records.tests_green,
    false,
    "the fixture used above is genuinely red, so the assertion above is real",
  );
  // The code-owned auto facts are the gate's own to measure and cannot be
  // declared by anyone, least of all by a file in the repo.
  for (const field of CODE_OWNED_FIELDS) {
    assert.equal(
      evidence[field],
      undefined,
      `${field} is code-owned and must not be copied from prose`,
    );
  }
  for (const field of RUN_RECORD_FIELDS) {
    assert.equal(typeof evidence[field], "boolean", `${field} is a boolean`);
  }
  // …and the narrative survives untouched.
  assert.equal(evidence.tests_summary, PROSE.tests_summary);
  assert.deepEqual(evidence.notes, PROSE.notes);
  assert.equal(evidence.facet_evidence.testing, "another proof line");
});

// ── what the CI job judges, and how it names itself ─────────────────────────

test("SCOPE: the job judges the plan item the PR names, and fails when it cannot", () => {
  // §9 rule 1: a PR names its plan items. That is the only thing that tells the
  // gate which facets to judge, so a PR that names none must not fall back to
  // the whole program — that would silently judge the P10 bar.
  assert.equal(resolveCiScope("feat(jev): scope 99 (P0.3)").scope, "P0.3");
  assert.equal(
    resolveCiScope("fix(sizing): round coordinates (P1.3) [closes F-36]").scope,
    "P1.3",
  );
  assert.equal(
    resolveCiScope("chore(plan): the P10.2 exit sweep").scope,
    "P10.2",
  );
  // A sub-letter is not a scope id: the plan lists P0.3 as one item, so the
  // honest scope is the item, and the letter is dropped rather than invented.
  assert.equal(resolveCiScope("feat: five pack facets (P0.3d)").scope, "P0.3");

  for (const title of [
    "chore: tidy up",
    "fix: an item that is not in the plan (P9.9)",
    "chore: mentions the plan itself",
  ]) {
    const r = resolveCiScope(title);
    assert.equal(r.scope, null, `"${title}" must not resolve to a scope`);
    assert.ok(r.error, "and must say why");
  }
  // Two different items in one title is a scope decision, not a guess.
  const two = resolveCiScope("feat: P2.1 and P2.6 together");
  assert.equal(two.scope, null);
  assert.ok(two.error, "an ambiguous PR must not be silently narrowed");
});

// ── the live judgment: pinned model, and an honest run class ────────────────

test("LIVE: a judgment is accepted only when the provider names a concrete model", () => {
  // "The model version is pinned in the report" (plan §8 P0.3(e)). A response
  // that only echoes the loose alias cannot be attributed to a version, so it
  // is not a judgment the gate will score on.
  const good = acceptLiveJudgment({
    model: "jev-1.13.0",
    answers: { spec: {} },
  });
  assert.equal(good.accepted, true);
  assert.equal(good.model, "jev-1.13.0");

  for (const bad of [
    { answers: { spec: {} } },
    { model: "jev-latest", answers: { spec: {} } },
    { model: "", answers: { spec: {} } },
    { model: 7, answers: { spec: {} } },
  ]) {
    const r = acceptLiveJudgment(bad);
    assert.equal(
      r.accepted,
      false,
      `${JSON.stringify(bad)} must not be accepted as a pinned judgment`,
    );
    assert.ok(r.blocker, "and the refusal must be recorded");
  }
});

test("LIVE: the report's run class encodes the one re-run the plan allows", () => {
  // "A provider error may be re-run once; a judgment may not." (plan §8
  // P0.3(e)). For that to be more than a sentence in a plan, the report has to
  // say which kind of run produced it.
  assert.equal(
    classifyRun({ attempted: true, accepted: true }).run_class,
    "judgment",
  );
  assert.equal(
    classifyRun({ attempted: true, accepted: false }).run_class,
    "provider_error",
  );
  assert.equal(
    classifyRun({ attempted: false, hasKey: false }).run_class,
    "no_key",
  );
  assert.equal(
    classifyRun({ attempted: false, hasKey: true }).run_class,
    "not_attempted",
  );
  // The policy travels with the classification, so nobody has to remember it.
  assert.equal(
    classifyRun({ attempted: true, accepted: true }).rerun_allowed,
    false,
    "a judgment may not be re-run",
  );
  assert.equal(
    classifyRun({ attempted: true, accepted: false }).rerun_allowed,
    true,
    "a provider error may be re-run once",
  );
});

// ── the CLI contract ────────────────────────────────────────────────────────

test("CLI: --require-live fails closed when no pinned judgment was made", () => {
  const repo = mkdtempSync(join(tmpdir(), "jev-require-live-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd: repo });
    // Outside the repo on purpose: an evidence file inside would dirty the
    // tree and turn the hard gates red for the wrong reason.
    const evidence = join(tmpdir(), `jev-require-live-${process.pid}.json`);
    writeFileSync(
      evidence,
      JSON.stringify({
        ...PROSE,
        ...Object.fromEntries(RUN_RECORD_FIELDS.map((f) => [f, true])),
      }),
    );
    const run = (args) => {
      const r = spawnSync(
        process.execPath,
        [CLI, "--local-only", "--json", ...args],
        {
          cwd: repo,
          encoding: "utf8",
        },
      );
      return { status: r.status, report: JSON.parse(r.stdout) };
    };
    try {
      const off = run(["--evidence", evidence]);
      const on = run(["--require-live", "--evidence", evidence]);

      // Both fail — the whole-program bar is unmet either way — so the exit code
      // alone cannot show the flag working. What the flag adds is a NAMED
      // blocker, and its absence without the flag is what proves the blocker
      // came from the flag and not from the scores.
      assert.equal(
        off.report.blockers.some((b) => b.includes("--require-live")),
        false,
        "without the flag there is nothing to say about a missing judgment",
      );
      assert.ok(
        on.report.blockers.some((b) => b.includes("--require-live")),
        `the flag must name why the run is not a gate result: ${JSON.stringify(on.report.blockers)}`,
      );
      assert.equal(on.status, 1, "and the run must exit non-zero");

      // The run class is the honest description of what happened, on both views.
      for (const report of [off.report, on.report]) {
        assert.equal(report.live.accepted, false);
        assert.equal(report.live_jev.accepted, false);
        assert.equal(report.run_class, "not_attempted");
        assert.equal(
          report.rerun_allowed,
          false,
          "a run that never asked is not a provider error that may be re-run",
        );
        assert.match(report.rerun_policy, /provider error may be re-run once/);
      }
    } finally {
      rmSync(evidence, { force: true });
    }
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("CLI: the report names its evidence source, machine or hand", () => {
  const repo = mkdtempSync(join(tmpdir(), "jev-source-kind-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd: repo });
    const hand = join(tmpdir(), `jev-hand-${process.pid}.json`);
    const ci = join(tmpdir(), `jev-ci-${process.pid}.json`);
    writeFileSync(hand, JSON.stringify({ tests_green: false }));
    writeFileSync(
      ci,
      JSON.stringify({
        evidence_version: EVIDENCE_VERSION,
        generated_by: EVIDENCE_GENERATED_BY,
        generated_at: "2026-09-26T00:00:00.000Z",
        run: { run_id: "1", sha: "abc1234" },
        ci: { jobs: {} },
      }),
    );
    try {
      for (const [path, kind] of [
        [hand, "hand-maintained"],
        [ci, "ci-generated"],
      ]) {
        const r = spawnSync(
          process.execPath,
          [CLI, "--local-only", "--json", "--evidence", path],
          { cwd: repo, encoding: "utf8" },
        );
        const report = JSON.parse(r.stdout);
        assert.equal(
          report.evidence_source_kind,
          kind,
          `${path} must be labelled ${kind} in the report`,
        );
        assert.equal(report.evidence_source, path);
      }
      // No evidence at all is its own state, not a silent "hand-maintained".
      const none = spawnSync(
        process.execPath,
        [CLI, "--local-only", "--json"],
        { cwd: repo, encoding: "utf8" },
      );
      assert.equal(JSON.parse(none.stdout).evidence_source_kind, "none");
    } finally {
      rmSync(hand, { force: true });
      rmSync(ci, { force: true });
    }
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

// ── the builder, end to end ─────────────────────────────────────────────────

test("BUILDER: it writes CI-derived evidence and refuses to proceed when it cannot", () => {
  withArtifacts(GREEN, (dir) => {
    const prose = join(dir, "prose.json");
    writeFileSync(prose, JSON.stringify(PROSE));
    const out = join(dir, "evidence.json");
    const r = spawnSync(
      process.execPath,
      [
        BUILDER,
        "--artifacts",
        dir,
        "--prose",
        prose,
        "--out",
        out,
        "--sha",
        "abc1234",
        "--run-id",
        "999",
        "--now",
        "2026-09-26T00:00:00.000Z",
      ],
      { encoding: "utf8" },
    );
    assert.equal(r.status, 0, r.stderr);
    const evidence = JSON.parse(readFileSync(out, "utf8"));
    assert.equal(evidence.generated_by, EVIDENCE_GENERATED_BY);
    assert.equal(evidence.run.sha, "abc1234");
    for (const field of RUN_RECORD_FIELDS) {
      assert.equal(evidence[field], true, `${field} should be green here`);
    }

    // Now break one artifact: the builder must still write the evidence (so the
    // failure is diagnosable) and exit non-zero (so the job stops before it
    // spends money asking a judge to score a run it cannot trust).
    writeFileSync(
      join(dir, "web-smoke.json"),
      JSON.stringify({ job: "web-smoke", conclusion: "failure", steps: {} }),
    );
    const bad = spawnSync(
      process.execPath,
      [
        BUILDER,
        "--artifacts",
        dir,
        "--prose",
        prose,
        "--out",
        out,
        "--sha",
        "abc1234",
      ],
      { encoding: "utf8" },
    );
    assert.equal(bad.status, 1, "a red job must fail the builder");
    assert.match(bad.stderr, /web-smoke/, "and name the job that was red");
    const after = JSON.parse(readFileSync(out, "utf8"));
    assert.equal(after.smoke_green, false);
    assert.equal(after.tests_green, true, "the green jobs are still recorded");
  });
});

test("BUILDER: it never writes a key into the evidence", () => {
  // The live key is a repository secret (O-01). Whatever CI puts in the
  // environment, the evidence file is a committed artifact and must carry
  // outcomes only.
  withArtifacts(GREEN, (dir) => {
    const prose = join(dir, "prose.json");
    writeFileSync(prose, JSON.stringify(PROSE));
    const out = join(dir, "evidence.json");
    const r = spawnSync(
      process.execPath,
      [BUILDER, "--artifacts", dir, "--prose", prose, "--out", out],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          TYPESAFE_API_KEY: "apik-0123456789abcdef0123456789abcdef",
          HARNESS_JEV_KEY: "apik-0123456789abcdef0123456789abcdef",
        },
      },
    );
    assert.equal(r.status, 0, r.stderr);
    const text = readFileSync(out, "utf8");
    assert.ok(
      !text.includes("apik-0123456789abcdef"),
      "no provider key may reach the evidence file",
    );
    assert.ok(!existsSync(join(dir, "prose.json")) || true);
  });
});

// ── the job itself ──────────────────────────────────────────────────────────

test("WORKFLOW: the jev-complete job needs the three gates, judges live, and uploads", () => {
  const yaml = read(".github/workflows/test.yml");
  assert.ok(
    yaml.includes("jev-complete:"),
    "plan §13.2 names a `jev-complete` job; it does not exist yet",
  );
  const job = yaml.slice(yaml.indexOf("  jev-complete:"));
  assert.match(
    job,
    /needs:\s*\[test,\s*web-smoke,\s*coverage\]/,
    "the job must depend on the three gates whose real results it turns into evidence",
  );
  // The key comes from the repo's own secret wiring, and is never echoed.
  assert.match(
    job,
    /TYPESAFE_API_KEY:\s*\$\{\{\s*secrets\.TYPESAFE_API_KEY\s*\}\}/,
    "the key must come from the repository secret, not a literal",
  );
  assert.ok(
    !/apik-[0-9a-zA-Z]{16,}/.test(job),
    "no key-shaped literal may appear in the workflow",
  );
  // Fail closed: a run with no live judgment is not a gate result.
  assert.match(
    job,
    /--require-live/,
    "the job must fail closed without a judgment",
  );
  assert.match(
    job,
    /build-jev-evidence\.mjs/,
    "the evidence must be generated from the artifacts, not typed",
  );
  assert.match(
    job,
    /upload-artifact/,
    "plan §8 P0.3(e): the report is uploaded as an artifact",
  );
  // The evidence comes from the three jobs and the judgment comes from this
  // job, so both must be about the same commit. actions/checkout defaults to the
  // merge ref on a pull_request; naming it explicitly is what keeps the record
  // and the judgment from being about two different trees.
  assert.match(
    job,
    /ref:\s*refs\/pull\/\$\{\{\s*github\.event\.pull_request\.number\s*\}\}\/merge/,
    "the job must judge the same merge ref its dependencies ran on",
  );
  // A push to main has no PR title to name a scope from and no merge ref, so
  // the job is a PR gate only. The full run belongs to P10 and P11.3.
  assert.match(
    job,
    /if:\s*github\.event_name\s*==\s*'pull_request'/,
    "the job must be scoped to pull_request, or a push has nothing to judge",
  );
  // Everything the job WRITES belongs outside the checkout. The gate's
  // `tree_clean` hard gate is `git status --porcelain`, so an evidence or report
  // file left in the working tree would make the tree dirty and fail the run for
  // a reason that has nothing to do with the code under review.
  assert.doesNotMatch(
    job,
    /--out\s+"?jev-/,
    "the report must not be written into the checkout",
  );
  assert.doesNotMatch(
    job,
    /--out\s+"?\$\{\{\s*github\.workspace/,
    "nor anywhere else inside the workspace",
  );
  assert.match(
    job,
    /--out\s+"\$RUNNER_TEMP\/jev-evidence\.json"/,
    "the evidence belongs under RUNNER_TEMP",
  );
  assert.match(
    job,
    /path:\s*\$\{\{\s*runner\.temp\s*\}\}\/jev-artifacts/,
    "and so do the downloaded artifacts",
  );
});

test("WORKFLOW: each judged job records its own result for the gate", () => {
  const yaml = read(".github/workflows/test.yml");
  // A job's block runs until the next line indented by exactly two spaces and
  // then a non-space. Matching "\n  " alone would stop at the first nested line,
  // because every deeper line contains it as a substring.
  const jobBlock = (name) => {
    const start = yaml.search(new RegExp(`^  ${name}:$`, "m"));
    assert.notEqual(start, -1, `the ${name} job exists`);
    const rest = yaml.slice(start);
    const next = rest.slice(1).search(/\n {2}\S/);
    return next === -1 ? rest : rest.slice(0, next + 1);
  };
  // Without this the builder has nothing to read, and the whole design
  // collapses back to a hand-typed file.
  for (const job of ["test", "web-smoke", "coverage"]) {
    const body = jobBlock(job);
    assert.match(
      body,
      /jev-artifacts/,
      `the ${job} job must write its result where the gate can read it`,
    );
    assert.match(
      body,
      /upload-artifact/,
      `the ${job} job must upload its result`,
    );
    assert.match(
      body,
      new RegExp(`"${job}"`),
      `the ${job} job must record its own name, or the builder cannot tell ` +
        "which job a result came from",
    );
    // `if: always()` is what makes a failed job explain itself instead of
    // vanishing and leaving the gate to guess.
    assert.match(
      body,
      /if: always\(\)/,
      `the ${job} recording must survive failure`,
    );
  }
  // The steps the evidence claims must be steps the job actually runs, and they
  // need ids so the runner's own outcome can be read.
  for (const id of ["unit_tests", "prettier", "seo"]) {
    assert.match(
      yaml,
      new RegExp(`id:\\s*${id}\\b`),
      `the ${id} step must carry an id for its outcome to be recordable`,
    );
  }
});
