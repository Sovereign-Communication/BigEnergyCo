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
  LEGACY_GATE_JOBS,
  parseJobResult,
  requiredJobsFromWorkflow,
  runRecordsFromArtifacts,
  composeEvidence,
  evidenceSourceKind,
} from "../scripts/lib/jev-evidence.mjs";
import { resolveCiScope } from "../scripts/lib/jev-scope.mjs";
import {
  acceptLiveJudgment,
  attachRunFacts,
  classifyRun,
  gateExitCode,
  liveRunRecord,
} from "../scripts/lib/jev-run.mjs";
// F-37: the price has one owner, shared with the worker. Imported here so the
// assertion below fails if the record ever grows a private rate.
import { jevCostUsd } from "../worker/jev-price.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUILDER = join(ROOT, "scripts/build-jev-evidence.mjs");
const CLI = join(ROOT, "scripts/validate-jev-complete.mjs");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

// The required set is read from the workflow, never hand-listed here: a test
// that pinned the list would be the same drift the field had, one file over.
const WORKFLOW_REL = ".github/workflows/test.yml";
const WORKFLOW_YAML = read(WORKFLOW_REL);
const WORKFLOW_PATH = join(ROOT, WORKFLOW_REL);
const REQUIRED = requiredJobsFromWorkflow(WORKFLOW_YAML);

// A job's block runs until the next line indented by exactly two spaces and
// then a non-space. Matching "\n  " alone would stop at the first nested line,
// because every deeper line contains it as a substring.
const jobBlock = (yaml, name) => {
  const start = yaml.search(new RegExp(`^  ${name}:$`, "m"));
  assert.notEqual(start, -1, `the ${name} job exists`);
  const rest = yaml.slice(start);
  const next = rest.slice(1).search(/\n {2}\S/);
  return next === -1 ? rest : rest.slice(0, next + 1);
};

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
  "quality-lab": {
    job: "quality-lab",
    conclusion: "success",
    steps: { "a11y-matrix": "success" },
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

function writeProse(dir) {
  const prose = join(dir, "prose.json");
  writeFileSync(prose, JSON.stringify(PROSE));
  return prose;
}

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
  const { records, problems } = runRecordsFromArtifacts(RED_TESTS, REQUIRED);
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
  const { records, problems } = runRecordsFromArtifacts(
    {
      test: {
        job: "test",
        conclusion: "cancelled",
        steps: { unit_tests: "success", prettier: "success", seo: "success" },
      },
      "web-smoke": GREEN["web-smoke"],
      "quality-lab": GREEN["quality-lab"],
      coverage: GREEN.coverage,
    },
    REQUIRED,
  );
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
  const missing = runRecordsFromArtifacts({ test: GREEN.test }, REQUIRED);
  assert.equal(missing.records.smoke_green, false);
  assert.equal(missing.records.ci_green, false);
  assert.ok(
    missing.problems.some((p) => p.includes("web-smoke")),
    `the missing job must be named: ${JSON.stringify(missing.problems)}`,
  );

  // A job that failed before the prettier step never records that step. An
  // absent step is not a pass.
  const earlyExit = runRecordsFromArtifacts(
    {
      test: { job: "test", conclusion: "failure", steps: { seo: "success" } },
      "web-smoke": GREEN["web-smoke"],
      "quality-lab": GREEN["quality-lab"],
      coverage: GREEN.coverage,
    },
    REQUIRED,
  );
  assert.equal(earlyExit.records.prettier_clean, false);
  assert.equal(earlyExit.records.seo_green, true, "that step did run and pass");
  assert.ok(
    earlyExit.problems.some((p) => p.includes("prettier")),
    "an unrecorded step must be named, not inferred",
  );
});

// ── what "CI was green" means ───────────────────────────────────────────────

test("EVIDENCE: the required set is the workflow's own jobs, judge excluded", () => {
  // The rule the field used to break: `ci_green` was a hand-written list of
  // three job names inside the evidence module, so the fourth gate the plan
  // named — quality-lab — was invisible to it and a run with that gate red
  // recorded `ci_green: true`. A list in code and a list in the workflow are
  // two sources that drift apart silently, and the field that drifts is the one
  // the judge reads. So the set is derived from the workflow's declarations.
  assert.ok(
    REQUIRED.includes("quality-lab"),
    "the fourth gate is required, whether or not any list remembers it",
  );
  for (const job of LEGACY_GATE_JOBS) {
    assert.ok(REQUIRED.includes(job), `${job} stays a required gate`);
  }
  assert.equal(
    REQUIRED.includes("jev-complete"),
    false,
    "the judge is excluded by what it does, not by name: a gate cannot be a " +
      "required job whose own conclusion the record it composes must carry",
  );

  // A gate declared tomorrow is required the day it is declared, with no edit
  // to the evidence code — which is the whole point of deriving the set.
  const tomorrow = `${WORKFLOW_YAML}\n  lighthouse:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm run gate:lighthouse\n`;
  const next = requiredJobsFromWorkflow(tomorrow);
  assert.ok(
    next.includes("lighthouse"),
    "a gate added to the workflow is required with no change to the code",
  );
  assert.equal(
    next.length,
    REQUIRED.length + 1,
    "and it is the only thing the derivation added",
  );

  // A workflow this cannot read yields no claim at all, rather than a
  // fallback list: an empty set is a red ci_green, never a green one.
  assert.deepEqual(requiredJobsFromWorkflow("name: nothing\non: [push]\n"), []);
  assert.deepEqual(requiredJobsFromWorkflow(null), []);
  assert.deepEqual(requiredJobsFromWorkflow(""), []);
});

test("EVIDENCE: ci_green is false when any required job is red; the legacy triple is its own fact", () => {
  const all = runRecordsFromArtifacts(GREEN, REQUIRED);
  assert.equal(
    all.records.ci_green,
    true,
    "every required job concluded success",
  );
  assert.equal(all.records.legacy_gates_green, true);
  assert.deepEqual(all.problems, [], "a fully green run reports no problem");

  // The defect, stated as a test: one red required job must be enough, and
  // which job it is must come from the workflow rather than from a list.
  for (const red of REQUIRED) {
    const r = runRecordsFromArtifacts(
      { ...GREEN, [red]: { ...GREEN[red], conclusion: "failure" } },
      REQUIRED,
    );
    assert.equal(r.records.ci_green, false, `a red ${red} is not a green CI`);
    assert.ok(
      r.problems.some((p) => p.includes(`"${red}"`)),
      `the red job is named, or the artifact cannot be diagnosed: ${JSON.stringify(r.problems)}`,
    );
  }

  // The case that actually happened: the three legacy gates green, the fourth
  // gate red. Before this change ci_green read TRUE here.
  const fourthRed = runRecordsFromArtifacts(
    {
      ...GREEN,
      "quality-lab": { ...GREEN["quality-lab"], conclusion: "failure" },
    },
    REQUIRED,
  );
  assert.equal(fourthRed.records.ci_green, false);
  assert.equal(
    fourthRed.records.legacy_gates_green,
    true,
    "the three legacy gates really were green; widening ci_green must not " +
      "overwrite that fact, because the ratchet has been comparing it",
  );

  // …and when the legacy triple itself is red, the legacy fact says so too.
  const legacyRed = runRecordsFromArtifacts(
    { ...GREEN, coverage: { ...GREEN.coverage, conclusion: "cancelled" } },
    REQUIRED,
  );
  assert.equal(legacyRed.records.legacy_gates_green, false);
  assert.equal(legacyRed.records.ci_green, false);

  // A required job with no artifact is red and named — the builder is handed
  // whatever survived, and a gate that vanished is not a gate that passed.
  const missing = runRecordsFromArtifacts({ test: GREEN.test }, REQUIRED);
  assert.equal(missing.records.ci_green, false);
  assert.ok(
    missing.problems.some((p) => p.includes("quality-lab")),
    `the missing required job must be named: ${JSON.stringify(missing.problems)}`,
  );

  // No derived set, no claim: ci_green is unproven rather than green.
  const unproven = runRecordsFromArtifacts(GREEN, []);
  assert.equal(unproven.records.ci_green, false);
  assert.ok(
    unproven.problems.some((p) => /required job set/.test(p)),
    `the missing derivation must be named: ${JSON.stringify(unproven.problems)}`,
  );
});

test("EVIDENCE: the composed file says it was generated, and by what", () => {
  const { evidence } = composeEvidence({
    artifacts: GREEN,
    prose: PROSE,
    requiredJobs: REQUIRED,
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
    legacy_gates_green: true,
    tree_clean: true,
    secrets_clean: true,
  };
  const broken = runRecordsFromArtifacts(RED_TESTS, REQUIRED);
  const { evidence } = composeEvidence({
    artifacts: RED_TESTS,
    prose: hostile,
    requiredJobs: REQUIRED,
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
    evidence.legacy_gates_green,
    false,
    "the test job is one of the three legacy gates, so that fact is red too",
  );
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

test("RUN: the live-run record is assembled in one place, once per outcome", () => {
  // The live-run state used to be four hand-written object literals in the CLI,
  // one per branch, so the shape of what the report reads was decided by whoever
  // was calling. Its owner is scripts/lib/jev-run.mjs now, and this pins all
  // four outcomes against that one function.
  const skipped = liveRunRecord({ skipped: true });
  assert.deepEqual(skipped, {
    is_fallback: true,
    accepted: false,
    blocker: "not attempted (--local-only)",
  });
  assert.equal(
    skipped.provider,
    undefined,
    "nothing was called, so no provider",
  );
  assert.equal(
    skipped.model,
    undefined,
    "no model may be named for a call never made",
  );

  // Called, no key: the honest "no answers" case, named from the wire's own note.
  const noKey = liveRunRecord({
    wire: {
      answers: null,
      provider: null,
      model: null,
      notes: ["direct: no key"],
    },
  });
  assert.equal(noKey.provider, null);
  assert.equal(noKey.blocker, "direct: no key");
  assert.equal(noKey.accepted, false);
  assert.deepEqual(noKey.notes, ["direct: no key"]);

  // Answered, but the provider named no version: refused for that reason, not
  // for a generic one.
  const unpinned = liveRunRecord({
    wire: {
      answers: { a: 1 },
      provider: "typesafe",
      model: "jev-latest",
      notes: [],
    },
    pin: { accepted: false, model: "jev-latest", blocker: "echoed the alias" },
    parsed: { facets: {} },
  });
  assert.equal(unpinned.blocker, "echoed the alias");
  assert.equal(unpinned.model, "jev-latest");
  assert.equal(unpinned.is_fallback, true);

  // Pinned, but the engine could not read a single facet answer. A different
  // reason to refuse, and it says which.
  const unreadable = liveRunRecord({
    wire: {
      answers: { a: 1 },
      provider: "typesafe",
      model: "jev-1.13.0",
      notes: [],
    },
    pin: { accepted: true, model: "jev-1.13.0", blocker: null },
    parsed: null,
  });
  assert.equal(unreadable.accepted, false);
  assert.match(unreadable.blocker, /0-hallucination/);

  // The one accepted shape, with the cost taken from the shared rate (F-37:
  // a private 42.0 in this file was 100,000x the D-13 rate).
  const good = liveRunRecord({
    wire: {
      answers: { a: 1 },
      usage: { input_tokens: 5733 },
      provider: "typesafe",
      model: "jev-1.13.0",
      notes: [],
    },
    pin: { accepted: true, model: "jev-1.13.0", blocker: null },
    parsed: { facets: {} },
  });
  assert.equal(good.accepted, true);
  assert.equal(good.is_fallback, false);
  assert.equal(good.input_tokens, 5733);
  assert.equal(
    good.cost_usd,
    jevCostUsd(5733),
    "the cost comes from the one module that owns the rate, never a private constant",
  );
  assert.equal(
    good.model_requested,
    "jev-latest",
    "what was asked for is recorded too",
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

test("CLI: a missing key is a configuration gap, not a re-runnable provider error", () => {
  // Found by the first LIVE run of the jev-complete job, not by reading the
  // code. With O-01 undone there is no key, and the report said
  // run_class "provider_error" with rerun_allowed TRUE while its own blocker
  // said "no key". Two views of one run, disagreeing — and the disagreement
  // invited a retry loop the plan explicitly forbids: re-running cannot
  // conjure a secret.
  //
  // The pure classifier was right all along (no_key is unit-tested at line ~358)
  // and the call site never reached it: it passed attempted=true whenever the
  // key environment had been resolved, and resolving an environment that holds
  // no key is not an attempt. Unit tests of classifyRun could never have caught
  // this, so the gate runs the real CLI on the real no-key path.
  const repo = mkdtempSync(join(tmpdir(), "jev-no-key-"));
  const home = mkdtempSync(join(tmpdir(), "jev-no-key-home-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd: repo });
    // HOME is redirected on purpose. resolveKeys falls back to
    // ~/.config/harness/jev.env, so on a machine that has a harness key
    // installed a "no key" run would quietly find one, spend a real judgment
    // (a judgment may not be re-run, and this test must not cost one), and
    // assert nothing about the path it is named for. USERPROFILE as well,
    // because that is what homedir() reads on Windows.
    const env = { ...process.env, HOME: home, USERPROFILE: home };
    for (const name of ["TYPESAFE_API_KEY", "HARNESS_JEV_KEY", "JEV_API_KEY"]) {
      delete env[name];
    }
    const evidence = join(tmpdir(), `jev-no-key-${process.pid}.json`);
    writeFileSync(
      evidence,
      JSON.stringify({
        ...PROSE,
        ...Object.fromEntries(RUN_RECORD_FIELDS.map((f) => [f, true])),
      }),
    );
    try {
      const r = spawnSync(
        process.execPath,
        [CLI, "--require-live", "--json", "--evidence", evidence],
        { cwd: repo, encoding: "utf8", env },
      );
      const report = JSON.parse(r.stdout);

      assert.equal(
        report.run_class,
        "no_key",
        "nothing was called, so nothing failed: a missing secret is a gap in configuration",
      );
      assert.equal(
        report.rerun_allowed,
        false,
        "re-running cannot conjure a secret; calling this re-runnable invites a pointless retry loop",
      );
      // The two views of the run still have to agree with each other.
      assert.equal(report.live.accepted, false);
      assert.equal(report.live_jev.accepted, false);
      assert.equal(
        report.live_jev.model,
        null,
        "no provider answered, so no model may be named",
      );
      assert.match(
        report.live_jev.blocker,
        /no key/i,
        "the blocker must name the actual cause, or the class is a guess",
      );
      assert.equal(
        r.status,
        1,
        "--require-live still fails closed without a key",
      );
    } finally {
      rmSync(evidence, { force: true });
    }
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
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

test("CLI: an accepted judgment says so on every view of the report", () => {
  // The rehearsal caught this: `run_class` said "judgment" while
  // `live_jev.accepted` still read false, because the success path never set the
  // flag. One report, two views of the same run, disagreeing about whether a
  // judgment happened — which is the one thing the flag exists to prevent. The
  // rule now lives in the pure core, so it is tested rather than grepped for.
  const report = { blockers: [], live: { primary_gap: null } };
  attachRunFacts(report, {
    liveMeta: {
      is_fallback: false,
      accepted: true,
      provider: "typesafe",
      model: "jev-1.13.0",
      model_requested: "jev-latest",
      input_tokens: 4243,
      cost_usd: 0.00000178206,
    },
    attempted: true,
    hasKey: true,
    requireLive: true,
    evidence: { generated_by: EVIDENCE_GENERATED_BY },
    evidenceSource: "/tmp/ev.json",
  });
  assert.equal(report.run_class, "judgment");
  assert.equal(report.rerun_allowed, false);
  assert.equal(report.live_jev.accepted, true, "the primary view");
  assert.equal(report.live.accepted, true, "and the alias must agree with it");
  assert.equal(report.live_jev.model, "jev-1.13.0");
  assert.equal(report.live.model, "jev-1.13.0");
  assert.equal(report.evidence_source_kind, "ci-generated");
  assert.deepEqual(
    report.blockers,
    [],
    "a run with a pinned judgment owes no --require-live blocker",
  );
  assert.equal(
    gateExitCode({ gatePassed: true, accepted: true, requireLive: true }),
    0,
  );

  // The same report for a provider that named no version: one value, both views.
  const none = { blockers: [] };
  attachRunFacts(none, {
    liveMeta: { is_fallback: true, accepted: false, blocker: "no key" },
    attempted: false,
    hasKey: false,
    requireLive: true,
  });
  assert.equal(none.live_jev.accepted, false);
  assert.equal(none.live.accepted, false);
  assert.equal(none.run_class, "no_key");
  assert.ok(none.blockers.some((b) => b.includes("--require-live")));
  assert.equal(
    gateExitCode({ gatePassed: true, accepted: false, requireLive: true }),
    1,
  );
  // …and --require-live can only ever subtract, never add.
  assert.equal(
    gateExitCode({ gatePassed: true, accepted: false, requireLive: false }),
    0,
  );
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

test("BUILDER: a red step in a green job is a problem, and the run is cut short", () => {
  // The gap an audit found by running the builder instead of reading it: a job
  // that concludes `success` while one of its recorded steps is `skipped` or
  // `failure` produced tests_green=false, exit 0, and NO problem at all. The
  // file's own header promises exit 1 for "a step that is red", so the artifact
  // the judge reads described a run as untrustworthy without ever saying why —
  // the one thing the problems list exists to say.
  //
  // The pre-existing gate named "a step that never ran is red, and named" does
  // not cover this: its fixture gives the job conclusion "failure", which is
  // the path that already worked. Reaching this needs a GREEN job with a red
  // step, which is what a step under `if:` or `continue-on-error:` produces.
  for (const outcome of ["skipped", "failure", "cancelled"]) {
    withArtifacts(
      {
        ...GREEN,
        test: {
          ...GREEN.test,
          steps: { ...GREEN.test.steps, unit_tests: outcome },
        },
      },
      (dir) => {
        const out = join(dir, "evidence.json");
        const r = spawnSync(
          process.execPath,
          [
            BUILDER,
            "--artifacts",
            dir,
            "--prose",
            writeProse(dir),
            "--out",
            out,
            "--sha",
            "abc1234",
          ],
          { encoding: "utf8" },
        );

        assert.equal(
          r.status,
          1,
          `a step that concluded "${outcome}" must fail the builder like a red job does`,
        );
        assert.match(
          r.stderr,
          /unit_tests/,
          `the red step must be named, or the artifact cannot be diagnosed: ${r.stderr}`,
        );
        assert.match(
          r.stderr,
          new RegExp(outcome),
          `the message must carry the outcome, not just the step id: ${r.stderr}`,
        );

        // The evidence is still written, so the failure is diagnosable after
        // the fact — and the field is red.
        const evidence = JSON.parse(readFileSync(out, "utf8"));
        assert.equal(evidence.tests_green, false);

        // The two channels stay separate. The other steps in that job really
        // did pass, and a fix here must not invent failures for them.
        assert.equal(evidence.prettier_clean, true, "prettier did pass");
        assert.equal(evidence.seo_green, true, "seo did pass");
        assert.equal(evidence.smoke_green, true);
        assert.equal(
          evidence.ci_green,
          true,
          "ci_green tracks every required job's conclusion, and they all concluded success; the step outcome is what tests_green carries",
        );
        assert.equal(
          evidence.legacy_gates_green,
          true,
          "and the three legacy gates concluded success as well",
        );
      },
    );
  }
});

test("BUILDER: a red required gate writes ci_green false and stops, with the legacy fact kept", () => {
  // The end-to-end shape of the defect this closes: the builder was handed a
  // run in which the fourth gate was red and produced a file whose ci_green said
  // true — the field the judge reads directly, describing a run that was not.
  withArtifacts(
    {
      ...GREEN,
      "quality-lab": {
        job: "quality-lab",
        conclusion: "failure",
        steps: { "a11y-matrix": "failure" },
      },
    },
    (dir) => {
      const out = join(dir, "evidence.json");
      const r = spawnSync(
        process.execPath,
        [
          BUILDER,
          "--artifacts",
          dir,
          "--prose",
          writeProse(dir),
          "--out",
          out,
          "--sha",
          "abc1234",
        ],
        { encoding: "utf8" },
      );
      assert.equal(r.status, 1, "a red required gate must stop the builder");
      assert.match(r.stderr, /quality-lab/, `and name it: ${r.stderr}`);
      const ev = JSON.parse(readFileSync(out, "utf8"));
      assert.equal(
        ev.ci_green,
        false,
        "the file the judge reads must not call a run with a red required gate green",
      );
      assert.equal(
        ev.legacy_gates_green,
        true,
        "the three legacy gates were green",
      );
      assert.equal(
        ev.tests_green,
        true,
        "the green jobs are still recorded as green",
      );
      assert.equal(ev.ci.jobs["quality-lab"].conclusion, "failure");
      assert.deepEqual(
        ev.ci.required_jobs,
        REQUIRED,
        "the file records the set that defined ci_green, so its meaning is readable",
      );
    },
  );
});

test("BUILDER: it never writes a key into the evidence", () => {
  // The live key is a repository secret (O-01). Whatever CI puts in the
  // environment, the evidence file is a committed artifact and must carry
  // outcomes only.
  //
  // Assembled at runtime, deliberately: the repo's own secret scan matches
  // key-SHAPED strings in tracked files, and the literal that was here first
  // failed the `secrets_clean` hard gate for the whole gate. The value below is
  // still key-shaped when the builder sees it, so the assertion stays real.
  const FAKE_KEY = ["apik", "0123456789abcdef0123456789abcdef"].join("-");
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
          TYPESAFE_API_KEY: FAKE_KEY,
          HARNESS_JEV_KEY: FAKE_KEY,
        },
      },
    );
    assert.equal(r.status, 0, r.stderr);
    const text = readFileSync(out, "utf8");
    assert.ok(
      !text.includes(FAKE_KEY),
      "no provider key may reach the evidence file",
    );
    assert.ok(
      !/apik[-_][0-9a-zA-Z]{16,}/.test(text),
      "and not even a key-shaped prefix of one",
    );
  });
});

// ── the job itself ──────────────────────────────────────────────────────────

test("WORKFLOW: the jev-complete job needs every required gate, judges live, and uploads", () => {
  const yaml = WORKFLOW_YAML;
  assert.ok(
    yaml.includes("jev-complete:"),
    "plan §13.2 names a `jev-complete` job; it does not exist yet",
  );
  const job = yaml.slice(yaml.indexOf("  jev-complete:"));
  // Derived, not hand-listed: the judge must depend on exactly the jobs the
  // evidence treats as required, so a red gate is always upstream of the
  // record that has to describe it.
  const needs = (job.match(/needs:\s*\[([^\]]*)\]/) || [, ""])[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .sort();
  assert.deepEqual(
    needs,
    [...REQUIRED].sort(),
    "the judge must depend on every required gate whose real results it turns into evidence",
  );
  // …and it must still run when one of them is red. Without `always()` a red
  // gate skips the judge, so the run that most needs a record produces none.
  assert.match(
    job,
    /if:\s*always\(\)\s*&&\s*github\.event_name\s*==\s*'pull_request'/,
    "the judge must run after a red gate so the red run is recorded, not skipped",
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
    /github\.event_name\s*==\s*'pull_request'/,
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

test("WORKFLOW: every required job records its own result for the gate", () => {
  const yaml = WORKFLOW_YAML;
  // Without this the builder has nothing to read, and the whole design
  // collapses back to a hand-typed file. Looping the DERIVED set is the drift
  // net: a gate added to the workflow without a result artifact fails here,
  // in the same test, rather than reaching the judge as an unmeasured gate.
  for (const job of REQUIRED) {
    const body = jobBlock(yaml, job);
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
