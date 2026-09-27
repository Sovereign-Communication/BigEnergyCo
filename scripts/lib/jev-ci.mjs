// The pure core of P0.3(e) / F-45: turning CI job outcomes into the evidence
// the Jev gate judges, and saying honestly what kind of run produced a report.
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
// No network and no filesystem here — the side effects live in
// scripts/build-jev-evidence.mjs and scripts/validate-jev-complete.mjs, so the
// rules below are testable on their own.
import { SCOPE_FACETS } from "./jev-complete.mjs";

export const EVIDENCE_VERSION = 1;
export const EVIDENCE_GENERATED_BY = "scripts/build-jev-evidence.mjs";

// The fields a CI run can prove. Each names the job and the step that proves it;
// there is no default and no inference, so a renamed step fails loudly instead
// of quietly going unmeasured.
export const RECORD_SOURCES = {
  tests_green: { job: "test", step: "unit_tests" },
  prettier_clean: { job: "test", step: "prettier" },
  seo_green: { job: "test", step: "seo" },
  smoke_green: { job: "web-smoke", step: "smoke" },
};

// The whole of `ci_green`: every job the gate depends on, concluded success.
export const CI_GREEN_JOBS = ["test", "web-smoke", "coverage"];

export const RUN_RECORD_FIELDS = [...Object.keys(RECORD_SOURCES), "ci_green"];

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
export function runRecordsFromArtifacts(artifacts) {
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

  const missingOrRed = CI_GREEN_JOBS.filter((name) => {
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
  prose,
  run = {},
  generatedAt = null,
  problems: extraProblems = [],
} = {}) {
  const { records, problems } = runRecordsFromArtifacts(artifacts);
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

/**
 * Write the run's own facts onto the report — the live view, the run class, the
 * re-run permission, the evidence provenance, and the `--require-live` blocker.
 *
 * This lives here, in the pure core, rather than in the CLI because it is a rule
 * and not plumbing: ONE report must not be able to say "judgment" on one field
 * and "no judgment accepted" on another. A rehearsal caught exactly that — the
 * success path left `accepted` at its false default while `run_class` correctly
 * said "judgment". The two views are now written from one value.
 */
export function attachRunFacts(
  report,
  {
    liveMeta = {},
    attempted = false,
    hasKey = null,
    requireLive = false,
    evidence = null,
    evidenceSource = null,
  } = {},
) {
  const accepted = liveMeta.accepted === true;
  const live = {
    is_fallback: liveMeta.is_fallback !== false,
    accepted,
    model: liveMeta.model ?? null,
    model_requested: liveMeta.model_requested ?? JEV_MODEL_ALIAS,
    ...(liveMeta.blocker ? { blocker: liveMeta.blocker } : {}),
    ...(liveMeta.input_tokens != null
      ? { input_tokens: liveMeta.input_tokens }
      : {}),
    ...(liveMeta.cost_usd != null ? { cost_usd: liveMeta.cost_usd } : {}),
  };
  const classified = classifyRun({ attempted, accepted, hasKey });
  report.live_jev = { ...liveMeta, ...live };
  // The alias the report has always carried, kept in step with the primary view
  // so neither can be read as a pass when the other says no judgment was made.
  report.live = {
    ...(report.live || {}),
    is_fallback: live.is_fallback,
    accepted: live.accepted,
    model: live.model,
    model_requested: live.model_requested,
  };
  report.evidence_source = evidenceSource;
  // No evidence file at all is its own state: "hand-maintained" would imply
  // somebody maintained it, while the run records then default red.
  report.evidence_source_kind = evidenceSourceKind(evidence);
  report.run_class = classified.run_class;
  report.rerun_allowed = classified.rerun_allowed;
  report.rerun_policy = classified.policy;
  if (requireLive && !accepted) {
    // Fail closed: --require-live means this verdict only counts if a pinned
    // live judgment made it. Without one there is no verdict, whatever the
    // heuristic floors say.
    report.blockers.push(
      `--require-live: no accepted live judgment (${
        liveMeta.blocker || "none was attempted"
      }). A gate result without one is not a gate result.`,
    );
  }
  return report;
}

/** The exit code: the gate's own verdict, and --require-live can only subtract. */
export function gateExitCode({ gatePassed, accepted, requireLive }) {
  return gatePassed && !(requireLive && !accepted) ? 0 : 1;
}

// The loose alias the request asks for. A response that only echoes it names no
// version, so nothing about that judgment is reproducible.
export const JEV_MODEL_ALIAS = "jev-latest";

/**
 * Accept a live judgment only when it names a concrete model version.
 *
 * Plan §8 P0.3(e): "The model version is pinned in the report." A score that
 * cannot be attributed to a model version is not evidence of anything, so an
 * unversioned answer is refused rather than recorded under the alias.
 */
export function acceptLiveJudgment(body) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return {
      accepted: false,
      model: null,
      blocker: "provider returned a non-object body",
    };
  }
  const model = body.model;
  if (typeof model !== "string" || !model.trim()) {
    return {
      accepted: false,
      model: null,
      blocker: `provider named no model version, so the judgment cannot be pinned (plan §8 P0.3(e))`,
    };
  }
  const trimmed = model.trim();
  if (trimmed.toLowerCase() === JEV_MODEL_ALIAS) {
    return {
      accepted: false,
      model: trimmed,
      blocker: `provider echoed the unpinned alias "${JEV_MODEL_ALIAS}" instead of a version`,
    };
  }
  return { accepted: true, model: trimmed, blocker: null };
}

export const RUN_CLASS_POLICY =
  "plan §8 P0.3(e): a provider error may be re-run once; a judgment may not.";

/**
 * Classify the run the report came from, so the re-run rule is readable from the
 * report instead of remembered from the plan.
 */
export function classifyRun({ attempted, accepted, hasKey = null } = {}) {
  if (attempted && accepted) {
    return {
      run_class: "judgment",
      rerun_allowed: false,
      policy: RUN_CLASS_POLICY,
    };
  }
  if (attempted) {
    return {
      run_class: "provider_error",
      rerun_allowed: true,
      policy: RUN_CLASS_POLICY,
    };
  }
  if (hasKey === false) {
    // Not a provider failure: a configuration gap. Re-running cannot conjure a
    // secret, so calling it re-runnable would invite a pointless retry loop.
    return {
      run_class: "no_key",
      rerun_allowed: false,
      policy: RUN_CLASS_POLICY,
    };
  }
  return {
    run_class: "not_attempted",
    rerun_allowed: false,
    policy: RUN_CLASS_POLICY,
  };
}

// Plan item ids, with an optional sub-letter the plan does not actually use:
// P0.3d normalises to P0.3 rather than inventing an id the plan never lists.
const PLAN_ITEM = /\bP(\d+)(?:\.(\d+))?([a-z])?\b/g;
function normalisePlanItem(match) {
  const [, major, minor] = match;
  return minor === undefined ? `P${major}` : `P${major}.${minor}`;
}

/**
 * Which plan item is this PR about? §9 rule 1 requires a PR to name its plan
 * items, and that name is the only thing that tells the gate which facets to
 * judge. A title that names none does not fall back to the whole program — that
 * would silently judge the P10 exit bar on every PR.
 */
export function resolveCiScope(title) {
  const text = typeof title === "string" ? title : "";
  const considered = [];
  const resolved = new Map();
  for (const match of text.matchAll(PLAN_ITEM)) {
    const id = normalisePlanItem(match);
    if (considered.includes(id)) continue;
    considered.push(id);
    if (Object.prototype.hasOwnProperty.call(SCOPE_FACETS, id)) {
      resolved.set(id, match[0]);
    }
  }
  if (resolved.size === 0) {
    return {
      scope: null,
      considered,
      error:
        `no plan item id in the title (looked for ${considered.join(", ") || "none"}). ` +
        'Name the item this PR delivers, e.g. "(P1.3)" — §9 rule 1, and the ' +
        "gate cannot choose which facets to judge without it.",
    };
  }
  if (resolved.size > 1) {
    return {
      scope: null,
      considered: [...resolved.keys()],
      error:
        `the title names more than one plan item (${[...resolved.keys()].join(", ")}). ` +
        "A scoped run judges one item's facets; split the PR, or set the scope " +
        "explicitly.",
    };
  }
  // `[...resolved]` would destructure the Map into [key, value] entries; the
  // scope is the single key, and a test pins that it is the id and not a pair.
  const [scope] = [...resolved.keys()];
  return { scope, considered, error: null };
}
