// What a CI run PROVED, and what the evidence file therefore is.
//
// F-45, precisely: the live-Jev evidence file was hand-maintained and went
// stale. A hand-maintained file can assert `tests_green: true` while the suite
// is red, and nothing downstream can tell — the judge scores the claim, not the
// run. Plan §13.3 closes it: evidence is produced by CI from real job outcomes,
// and a hand-written evidence file is never accepted as proof on its own.
//
// The contract this module enforces, in one sentence: every run record comes
// from a CI artifact, a job's own conclusion outranks its steps, and anything
// that is not positively "success" is red and named.
//
// This is one concern: the run records. It has no imports, no network and no
// filesystem, so the rules here are testable on their own. The side effects live
// in scripts/build-jev-evidence.mjs (which writes the file) and
// scripts/validate-jev-complete.mjs (which judges it).

export const EVIDENCE_VERSION = 1;
export const EVIDENCE_GENERATED_BY = "scripts/build-jev-evidence.mjs";

// The fields a CI run can prove. Each names the job and the step that proves it;
// there is no default and no inference, so a renamed step fails loudly instead
// of quietly going unmeasured.
export const RECORD_SOURCES = {
  tests_green: { job: "test", step: "unit_tests" },
  prettier_clean: { job: "test", step: "prettier" },
  seo_green: { job: "test", step: "seo" },
  hygiene_clean: { job: "test", step: "hygiene" },
  smoke_green: { job: "web-smoke", step: "smoke" },
};

// The whole of `ci_green`: every job the gate depends on, concluded success.
//
// It used to be a list written here, and that is the drift this replaces. A
// hand-written list of job names in the evidence code and the set of gates the
// workflow actually runs are two sources that fall apart silently: quality-lab
// was a required gate and this list did not know it existed, so a run with
// quality-lab red recorded `ci_green: true` — a field the judge reads directly,
// describing a run that was not green. See requiredJobsFromWorkflow.
export const EVIDENCE_JUDGE_MARKER = "build-jev-evidence.mjs";

/**
 * The required set, read from the workflow's own declarations: every job it
 * defines, minus the one that builds the evidence.
 *
 * Pure text in, list out — no YAML dependency, and the workflow file is the
 * repo's own file, so what "CI was green" means is defined by what CI runs
 * rather than by a second list to remember to update. The judge is excluded by
 * what it does, not by name: a job that composes the record cannot be a
 * required job whose own conclusion that record must carry (it is red by
 * design until owner action O-01 lands, and a self-referential gate could
 * never pass).
 *
 * A gate that declares no result artifact is still required: the missing
 * artifact is then a named, fatal problem, not a pass.
 */
export function requiredJobsFromWorkflow(workflowText) {
  if (typeof workflowText !== "string" || !workflowText.trim()) return [];
  const jobsAt = workflowText.search(/^jobs:\s*$/m);
  if (jobsAt === -1) return [];
  const section = workflowText.slice(jobsAt);
  const blockOf = (name) => {
    const start = section.search(new RegExp(`^ {2}${name}:[ \\t]*$`, "m"));
    if (start === -1) return "";
    const rest = section.slice(start);
    // A job's block runs to the next two-space key. Matching "\n  " alone would
    // stop at the first nested line, because every deeper line contains it.
    const next = rest.slice(1).search(/\n {2}\S/);
    return next === -1 ? rest : rest.slice(0, next + 1);
  };
  const names = [...section.matchAll(/^ {2}([A-Za-z0-9_-]+):[ \t]*$/gm)].map(
    (m) => m[1],
  );
  return names.filter((name) => !blockOf(name).includes(EVIDENCE_JUDGE_MARKER));
}

// What `ci_green` meant before it was widened: the three jobs this module named
// for years. Kept as its own record because the ratchet has been comparing what
// it describes — the release facet's floor, which lib/jev-complete.mjs derives
// from it — and widening ci_green must not silently change what a ratchet
// compares from one run to the next. It is a measurement, not a gate: a red
// legacy job is already named as a problem because all three are required jobs.
export const LEGACY_GATE_JOBS = ["test", "web-smoke", "coverage"];

export const RUN_RECORD_FIELDS = [
  ...Object.keys(RECORD_SOURCES),
  "ci_green",
  "legacy_gates_green",
];

// ── The `quality` facet's CONTRACT half, from the required job's own steps ───
//
// WHY THE AXIS HAS TWO INSTRUMENTS, and why this half belongs here. The pack
// asks QUALITY for two different things — "no unnecessary lines, branches,
// abstractions, dead scaffolding, or duplicated logic; formatting clean" and
// "the smallest version that keeps the proven behavior". The plan §3.1 byte
// gate measures the second on the shipped payload
// (scripts/lib/byte-budgets.mjs composes that clause from its own run), and the
// FIRST is what the required `test` job asserts every run: the suite carries the
// one-owner and no-second-copy contracts (a duplicated implementation fails
// there), the formatter runs over the tracked tree, and the site-integrity gates
// assert the page invariants. `RECORD_SOURCES` is already the mapping from those
// three readings to the job and step that produce them, so this half is worded
// from the same records the judge's hard gates are derived from — no new step
// name, no new artifact, no second list to keep in step.
//
// What it deliberately does NOT do: claim the axis. "No unnecessary lines or
// branches" still has NO instrument anywhere in this repository — the hygiene
// step measures dead scaffolding and duplicated logic (scripts/check-code-hygiene.mjs),
// the formatter covers formatting, and the byte gate covers shipped size; what
// remains unmeasured is said so in the clause itself — the same discipline the
// size clause's own bound enforces from the other end. A clause that named the
// readings without that sentence would read as "this code is minimal", which
// nothing measured.
const QUALITY_CONTRACT_PHRASES = {
  tests_green: {
    green: "suite (one-owner/no-second-copy)",
    red: "unit tests",
  },
  prettier_clean: { green: "prettier", red: "formatting" },
  seo_green: { green: "site-integrity", red: "site-integrity" },
  hygiene_clean: {
    green: "dead-code/duplication scan",
    red: "dead-code/duplication scan",
  },
};

// Bounded like the size clause's name list, so the clause is bounded BY
// CONSTRUCTION: at most two red readings are named and the rest counted (all
// three names are in the record's run fields anyway).
const MAX_RED_NAMES = 2;

/**
 * The record fields the contract clause words, DERIVED from the job/step map
 * rather than written again here: a reading that moves to another job, or a
 * fourth reading added to `test`'s own steps, changes this set with no edit.
 * tests/jev-derived-facets.test.mjs asserts every one of these has a phrase
 * above, so a new reading can never be silently left out of the clause.
 */
export const QUALITY_CONTRACT_FIELDS = Object.entries(RECORD_SOURCES)
  .filter(([, src]) => src.job === "test")
  .map(([field]) => field)
  .sort();

/**
 * The axis this clause belongs to. Named here because the clause is worded
 * here; the OTHER half of the same axis is declared by the gate that measures
 * it (`BYTE_BUDGET_FACET_AXES` in scripts/lib/byte-budgets.mjs), and a test
 * asserts the two agree — so the axis is declared once per instrument and a
 * disagreement fails the build rather than producing two axes or none.
 */
export const QUALITY_CONTRACT_AXIS = "quality";

/**
 * The most characters the contract clause may take. The other half of the
 * 280-char clip belongs to the size clause
 * (QUALITY_SIZE_CLAUSE_MAX in scripts/lib/byte-budgets.mjs), and the join is
 * asserted against the clip from both ends.
 */
export const QUALITY_CONTRACT_CLAUSE_MAX = 138;

/**
 * Compose the clarity clause of the `quality` axis from the run records.
 *
 * Two honest shapes, and no third. `null` when the required job left no records
 * at all: an absent measurement contributes nothing rather than a claim, and the
 * builder then carries the size clause alone.
 *
 * A reading that is not `true` is RED, named, and never softened — the same rule
 * `runRecordsFromArtifacts` applies to the hard gates, worded for the facet.
 */
export function composeQualityContractClause(records) {
  if (!records || typeof records !== "object") return null;
  const present = QUALITY_CONTRACT_FIELDS.filter((f) => f in records);
  if (!present.length) return null;
  const green = present.filter((f) => records[f] === true);
  const red = present.filter((f) => records[f] !== true);
  if (red.length) {
    const named = red
      .slice(0, MAX_RED_NAMES)
      .map((f) => QUALITY_CONTRACT_PHRASES[f]?.red || f);
    const more =
      red.length > MAX_RED_NAMES ? ` (+${red.length - MAX_RED_NAMES})` : "";
    return (
      `Test job RED (${named.join(", ")}${more}): the clarity readings did ` +
      "not all pass. Unmeasured: branches/abstractions"
    );
  }
  const names = green
    .map((f) => QUALITY_CONTRACT_PHRASES[f]?.green || f)
    .join(", ");
  // The hole, said once and bounded: it is the sentence that stops this clause
  // reading as "this code is minimal". Dead scaffolding and duplicated logic are
  // now measured (the hygiene scan above); unnecessary branches and
  // abstractions are not, and that stays said.
  return `Test job green: ${names}. ` + "Unmeasured: branches/abstractions";
}

// The gate measures these itself, from the tree in front of the process. An
// evidence file cannot assert them: code-owned facts outrank any claim, and
// `mergeEvidence` already refuses to let a file override them. They are listed
// here so the builder can assert that nothing copied them.
export const CODE_OWNED_FIELDS = ["secrets_clean", "env_ignored", "tree_clean"];

// GitHub's own vocabulary for a step or job outcome. Anything else is refused
// rather than treated as a pass.
const OUTCOMES = new Set([
  "success",
  "failure",
  "cancelled",
  "skipped",
  "timed_out",
  "action_required",
  "neutral",
  "stale",
]);

/**
 * Parse one job-result artifact. Strict on purpose: an artifact this cannot
 * read is an artifact that cannot prove anything, and the safe reading of an
 * unreadable proof is "red", never "probably fine".
 */
export function parseJobResult(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: `not valid JSON: ${err.message}` };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { ok: false, error: "must be a JSON object" };
  }
  if (typeof data.job !== "string" || !data.job.trim()) {
    return { ok: false, error: "requires a non-empty job name" };
  }
  if (typeof data.conclusion !== "string" || !OUTCOMES.has(data.conclusion)) {
    return {
      ok: false,
      error: `conclusion must be one of: ${[...OUTCOMES].join(", ")}`,
    };
  }
  if (
    typeof data.steps !== "object" ||
    data.steps === null ||
    Array.isArray(data.steps)
  ) {
    return { ok: false, error: "steps must be an object" };
  }
  for (const [name, outcome] of Object.entries(data.steps)) {
    if (typeof outcome !== "string" || !OUTCOMES.has(outcome)) {
      return {
        ok: false,
        error: `step "${name}" has an unknown outcome ${JSON.stringify(outcome)}`,
      };
    }
  }
  return {
    ok: true,
    job: data.job,
    conclusion: data.conclusion,
    steps: { ...data.steps },
  };
}

/**
 * The run records, from artifacts alone.
 *
 * Two channels, deliberately separate:
 *
 *   - A FIELD is what a step's own outcome says. A step that concludes
 *     `success` did pass — GitHub's per-step conclusion is authoritative for
 *     that step — so the record keeps it even when a later step in the same job
 *     failed. Overwriting a real measurement with `false` would make the report
 *     less truthful, which is the opposite of fail-closed.
 *   - A PROBLEM is anything that means the run cannot be trusted to describe
 *     itself: a missing artifact, an unreadable one, a step that never ran
 *     because the job died earlier, a step that recorded an outcome other than
 *     success, or a job that did not conclude success (so the run was cut short
 *     and whatever came after it is missing). A problem stops the caller; it
 *     does not invent an outcome.
 *
 * So a cancelled job with green steps records those steps honestly AND reports
 * the cancellation, and the builder exits non-zero. Nothing is papered over and
 * nothing real is thrown away.
 */
export function runRecordsFromArtifacts(artifacts, requiredJobs) {
  const byJob = new Map();
  const problems = [];
  for (const [name, raw] of Object.entries(artifacts || {})) {
    const parsed = typeof raw === "string" ? parseJobResult(raw) : raw;
    if (!parsed || parsed.ok === false) {
      problems.push(
        `unreadable artifact for "${name}": ${
          parsed && parsed.error ? parsed.error : "not a job result"
        }`,
      );
      continue;
    }
    byJob.set(parsed.job, parsed);
  }

  const records = {};
  for (const [field, source] of Object.entries(RECORD_SOURCES)) {
    const job = byJob.get(source.job);
    if (!job) {
      records[field] = false;
      problems.push(
        `no artifact for job "${source.job}", which is the only proof of ${field}`,
      );
      continue;
    }
    const step = job.steps[source.step];
    if (typeof step !== "string") {
      records[field] = false;
      problems.push(
        `job "${source.job}" never recorded step "${source.step}", so ${field} is unproven`,
      );
      continue;
    }
    records[field] = step === "success";
    if (step !== "success") {
      // A step that recorded an outcome other than success is the same kind of
      // news as a job that did not conclude success: the run cannot be trusted
      // to describe itself. Reachable whenever a recorded step is guarded by
      // `if:` or `continue-on-error:`, because the job still concludes success.
      // Without this, a skipped step left the builder exiting 0 with an
      // evidence file that said the record was false and never said why.
      problems.push(
        `step "${source.step}" of job "${source.job}" concluded ${step}, so the run is cut short and ${field} is unproven`,
      );
    }
  }

  // `ci_green` is the whole required set, and nothing else: the job that
  // fails this is the one the judge reads. The set comes from the workflow, so
  // the next gate declared there is covered without a code edit.
  const required = Array.isArray(requiredJobs) ? requiredJobs : [];
  if (required.length === 0) {
    records.ci_green = false;
    problems.push(
      "the required job set was not derived from the workflow, so ci_green is unproven",
    );
  } else {
    const missingOrRed = required.filter((name) => {
      const job = byJob.get(name);
      return !job || job.conclusion !== "success";
    });
    records.ci_green = missingOrRed.length === 0;
    for (const name of missingOrRed) {
      const job = byJob.get(name);
      const detail = job
        ? `concluded ${job.conclusion}, so the run is cut short`
        : "has no artifact at all";
      problems.push(`job "${name}" ${detail}`);
    }
  }

  // The legacy triple, as its own fact: computed from the same artifacts and
  // never inferred from the wider ci_green, so the two can be compared
  // honestly and the ratchet's older comparison keeps its meaning.
  records.legacy_gates_green = LEGACY_GATE_JOBS.every((name) => {
    const job = byJob.get(name);
    return Boolean(job) && job.conclusion === "success";
  });
  return { records, problems };
}

// The narrative fields a committed record legitimately carries. These are
// measurements a script cannot take ("30 of 153 smoke gates are battery-only,
// all green, none before"), so they pass through — everything EXCEPT the
// booleans, which only a run may assert.
const PROSE_ALLOWLIST = new Set([
  "tests_summary",
  "ci_summary",
  "prettier_clean_summary",
  "seo_summary",
  "smoke_note",
  "advisor_audit",
  "notes",
  "facet_evidence",
]);

/**
 * Compose the evidence file: machine fields from CI, narrative from the record.
 *
 * The one rule that matters is that a prose file can never assert a run. It may
 * say what was measured; only an artifact may say what passed.
 */
export function composeEvidence({
  artifacts,
  requiredJobs,
  prose,
  run = {},
  generatedAt = null,
  problems: extraProblems = [],
} = {}) {
  const { records, problems } = runRecordsFromArtifacts(
    artifacts,
    requiredJobs,
  );
  const allProblems = [...problems, ...extraProblems];
  const narrative = {};
  const source =
    prose && typeof prose === "object" && !Array.isArray(prose) ? prose : {};
  for (const key of PROSE_ALLOWLIST) {
    if (source[key] !== undefined) narrative[key] = source[key];
  }
  return {
    evidence: {
      evidence_version: EVIDENCE_VERSION,
      generated_by: EVIDENCE_GENERATED_BY,
      generated_at: generatedAt,
      run: { ...run },
      ci: { jobs: artifacts ? { ...artifacts } : {} },
      // Machine records, last so a reader scanning the file meets provenance
      // first and the claims second.
      ...records,
      ...narrative,
    },
    records,
    problems: allProblems,
  };
}

/**
 * Was this evidence generated by CI, or typed by a person? §13.3 says a
 * hand-written evidence file is never accepted as proof on its own, which is
 * only enforceable if the report says which it read.
 */
export function evidenceSourceKind(evidence) {
  if (typeof evidence !== "object" || evidence === null) return "none";
  return evidence.generated_by === EVIDENCE_GENERATED_BY
    ? "ci-generated"
    : "hand-maintained";
}
