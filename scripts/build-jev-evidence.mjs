#!/usr/bin/env node
// Build the Jev gate's evidence file from CI job outcomes. Plan §8 P0.3(e) /
// F-45: the evidence must come from real job results, never from a hand-edited
// file, and a hand-written evidence file is never proof on its own (§13.3).
//
//   node scripts/build-jev-evidence.mjs --artifacts DIR --out FILE
//                                  [--prose FILE] [--sha S] [--run-id N]
//                                  [--now ISO] [--allow-problems]
//
// Artifacts are the per-job result files the jobs themselves write from the
// runner's own step outcomes. Prose is the committed run record: the narrative
// measurements a script cannot take (which gate covers which surface, what a
// re-measurement found). Prose may describe a run; only an artifact may assert
// one — the two never share a field.
//
// Exit codes:
//   0  the evidence is complete and written
//   1  the evidence could not be completed: an artifact is missing, a job did
//      not succeed, a step never ran, or a step is red. The file is STILL
//      written, with those fields red, so the failure is diagnosable — but the
//      caller must not spend a live judgment scoring a run it cannot trust.
//   2  usage error
//
// The provider key is never read here. This file is a committed artifact, so it
// carries outcomes and provenance and nothing else.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  composeEvidence,
  composeQualityContractClause,
  evidenceSourceKind,
  parseJobResult,
  QUALITY_CONTRACT_AXIS,
  QUALITY_CONTRACT_CLAUSE_MAX,
  QUALITY_CONTRACT_FIELDS,
  requiredJobsFromWorkflow,
  RUN_RECORD_FIELDS,
} from "./lib/jev-evidence.mjs";
import { COMPLETE_FACET_CLIP } from "./lib/jev-complete.mjs";
import { QUALITY_SIZE_CLAUSE_MAX } from "./lib/byte-budgets.mjs";
import {
  A11Y_CONTROLS_CLAUSE_MAX,
  A11Y_FACET_AXES,
} from "./lib/a11y-controls.mjs";
import { A11Y_MATRIX_CLAUSE_MAX } from "./lib/quality-matrix.mjs";
import { exitWhenDrained } from "./lib/graceful-exit.mjs";

// The workflow these artifacts came from, resolved against this script rather
// than the caller's cwd: "CI was green" is defined by what the workflow runs,
// and the one that runs it is this repository's own file. There is deliberately
// no flag to point elsewhere — a required set is not an input an operator gets
// to choose.
const WORKFLOW = fileURLToPath(
  new URL("../.github/workflows/test.yml", import.meta.url),
);

const USAGE =
  "usage: node scripts/build-jev-evidence.mjs --artifacts DIR --out FILE " +
  "[--prose FILE] [--sha S] [--run-id N] [--now ISO] [--allow-problems]";

function usageError(msg) {
  process.stderr.write(`build-jev-evidence: ${msg}\n${USAGE}\n`);
  process.exit(2);
}

/**
 * Join one axis's clauses into the single line the judge reads for that axis.
 *
 * The `quality` join invented this shape — the byte gate's size half and the
 * contract suite's clarity half, neither allowed to claim the axis alone — and
 * `accessibility` is the second axis with the same shape, joined by this same
 * code because the failure it exists to prevent is identical: a line SILENTLY
 * CUT on its way to the judge drops whichever sentence limits the claim, and
 * that is exactly what a trim would eat.
 *
 * Bounded from both ends rather than trimmed: each clause carries its own
 * declared maximum, so naming the half that grew is what makes the failure
 * fixable, and a union over the transport clip is a named problem — never a
 * shortened line. Returns true when the joined line was written.
 */
function joinAxisClauses(evidence, problems, axis, clauses) {
  if (clauses.some((c) => !c || typeof c.text !== "string" || !c.text))
    return false;
  // Each half against ITS OWN bound, not just the total: a clause that grew
  // past its budget moves the other half out of room.
  const over = clauses
    .filter((c) => c.text.length > c.max)
    .map((c) => `${c.half} ${c.text.length}>${c.max}`);
  const joined = clauses.map((c) => c.text).join(" ");
  if (over.length || joined.length > COMPLETE_FACET_CLIP) {
    const which = over.length
      ? over.join(", ")
      : `joined ${joined.length}>${COMPLETE_FACET_CLIP}`;
    problems.push(
      `the ${axis} facet line is over budget (${which}); ` +
        "it would be cut in transit, which for this axis drops the sentence " +
        "that limits the claim — shorten the clause rather than letting it " +
        "silently lose its tail",
    );
    return false;
  }
  evidence.facet_evidence[axis] = joined;
  return true;
}

function parseArgs(argv) {
  const opts = {
    artifacts: null,
    out: null,
    prose: null,
    sha: null,
    runId: null,
    runAttempt: null,
    ref: null,
    event: null,
    repository: null,
    now: null,
    allowProblems: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i] ?? usageError(`${arg} requires a value`);
    if (arg === "--artifacts") opts.artifacts = next();
    else if (arg === "--out") opts.out = next();
    else if (arg === "--prose") opts.prose = next();
    else if (arg === "--sha") opts.sha = next();
    else if (arg === "--run-id") opts.runId = next();
    else if (arg === "--run-attempt") opts.runAttempt = next();
    else if (arg === "--ref") opts.ref = next();
    else if (arg === "--event") opts.event = next();
    else if (arg === "--repository") opts.repository = next();
    else if (arg === "--now") opts.now = next();
    else if (arg === "--allow-problems") opts.allowProblems = true;
    else usageError(`unknown argument ${JSON.stringify(arg)}`);
  }
  if (!opts.artifacts) usageError("--artifacts is required");
  if (!opts.out) usageError("--out is required");
  return opts;
}

// Provenance is an explicit whitelist, never a spread of the environment: a
// runner has TYPESAFE_API_KEY in its environment and this file is committed.
function runProvenance(opts) {
  const run = {};
  if (opts.sha) run.sha = opts.sha;
  if (opts.runId) run.run_id = opts.runId;
  if (opts.runAttempt) run.run_attempt = opts.runAttempt;
  if (opts.ref) run.ref = opts.ref;
  if (opts.event) run.event = opts.event;
  if (opts.repository) run.repository = opts.repository;
  return run;
}

/**
 * Gate REPORTS, as distinct from job results, in the same artifacts directory.
 *
 * A gate that measures something the judge should read puts its report here and
 * declares which facet axes it speaks for. The builder then composes those
 * axes' proof lines FROM THE RUN rather than reading them from the prose file,
 * where a typed line can sit looking like a measurement while being one.
 *
 * Two properties this is built to have:
 *
 *   · DISCOVERED, NOT LISTED. The axes come from the reports themselves, so a
 *     new gate that measures a facet becomes visible to the judge with no edit
 *     here — the same derivation that replaced CI_GREEN_JOBS in #161. A list of
 *     gate names kept beside this script is the defect that made ci_green read
 *     true on a red quality-lab run, and it is not reintroduced here.
 *   · A MISSING REPORT IS NOT A CLEAN ONE. When a report is absent the axis is
 *     simply absent from the record, and an absent proof line reads as
 *     "mixed — partial or unverified evidence", never as proven. The job being
 *     a required gate already makes its missing artifact a named fatal problem,
 *     so the two mechanisms agree: no report, no claim, and a named hole.
 */
function readGateReports(dir) {
  const reports = [];
  const problems = [];
  if (!existsSync(dir)) return { reports, problems };
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith(".json") || name === "evidence.json") continue;
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(join(dir, name), "utf8"));
    } catch {
      continue; // a job result, or unreadable: readArtifacts already rules on it
    }
    if (!parsed || typeof parsed !== "object") continue;
    if (!Array.isArray(parsed.facet_axes) || parsed.facet_axes.length === 0)
      continue;
    // ONE LINE PER AXIS, and this is the reason. A report may speak for several
    // facets, and a single string applied to all of them says the same thing
    // twice while answering neither: the experience walk's line is evidence
    // about a first-run journey, and reusing it as the translation facet's line
    // would file six locales of measured copy under a heading that never
    // mentions a locale. So `facet_lines` maps an axis to the line composed FOR
    // that axis, and `facet_line` remains the fallback for a gate that owns one.
    const perAxis =
      parsed.facet_lines && typeof parsed.facet_lines === "object"
        ? parsed.facet_lines
        : null;
    const lineFor = (axis) => {
      if (perAxis) {
        // A report that composes per axis must compose EVERY axis. Falling back
        // to the single line for one of them is the silent-wins failure with an
        // extra step: the second facet's proof would be a copy of the first's.
        return typeof perAxis[axis] === "string"
          ? { line: perAxis[axis], from: `facet_lines.${axis}` }
          : null;
      }
      // No per-axis map: one sentence may serve the report only while it speaks
      // for one facet. Two axes off one string means the second facet's proof
      // line is a duplicate of the first's, which is worse than no line.
      if (parsed.facet_axes.length > 1)
        return { line: null, from: "facet_line" };
      return typeof parsed.facet_line === "string"
        ? { line: parsed.facet_line, from: "facet_line" }
        : null;
    };
    const missing = parsed.facet_axes.filter((a) => !lineFor(a)?.line?.trim());
    if (missing.length) {
      problems.push(
        `${name} declares facet_axes [${missing.join(", ")}] but carries no ` +
          (parsed.facet_axes.length > 1 && !perAxis
            ? "line of its own for each. One sentence cannot be the proof line " +
              "for two facets — a duplicate reads as a second measurement, and " +
              "the facet it actually describes is the one that gets read. Use " +
              "`facet_lines`"
            : "line for them, so those axes get no proof line from the run that " +
              "measured them"),
      );
      continue;
    }
    // The clip is enforced here, loudly, and PER LINE. A line that overflows is
    // SILENTLY cut on its way to the judge, and for this cluster the honest tail
    // is exactly what gets cut — so an over-long line is a named problem, not a
    // trim. Checked per axis because two axes from one gate are two sentences
    // the judge reads separately, and either can be the one that overflows.
    for (const axis of parsed.facet_axes) {
      const { line, from } = lineFor(axis);
      if (line.length > COMPLETE_FACET_CLIP) {
        problems.push(
          `${name} ${from} is ${line.length} chars, over the ` +
            `${COMPLETE_FACET_CLIP}-char per-axis clip; it would be cut in ` +
            "transit, which would silently drop the part that says how to read it",
        );
        continue;
      }
      reports.push({ axis, line, source: name, metric: parsed.metric });
    }
  }
  return { reports, problems };
}

function readArtifacts(dir) {
  if (!existsSync(dir)) {
    usageError(`artifacts directory not found: ${dir}`);
  }
  const artifacts = {};
  // A file that is not a job result is recorded and skipped, not treated as a
  // broken artifact. The contract is JOB COVERAGE, not file parsing: if a file
  // is unreadable, or carries the wrong job name, the job it was supposed to
  // prove is simply absent — and a missing job is already a named, fatal
  // problem. That way an unrelated file dropped into the directory cannot fail a
  // run, and a corrupted one still cannot pass it.
  const ignored = [];
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith(".json") || name === "evidence.json") continue;
    const parsed = parseJobResult(readFileSync(join(dir, name), "utf8"));
    if (parsed.ok) {
      artifacts[parsed.job] = {
        job: parsed.job,
        conclusion: parsed.conclusion,
        steps: parsed.steps,
        measurements: parsed.measurements || {},
      };
    } else {
      ignored.push(name);
    }
  }
  return { artifacts, ignored };
}

/**
 * The fields of the prose record that may quote a measured count, and so may
 * carry `{{placeholders}}`.
 *
 * A count is the one thing in this record that is true only on the day it was
 * measured. Typed, it goes stale silently and nobody notices, because a stale
 * count still reads as a confident sentence. Composed from the run, it cannot.
 */
export const COMPOSABLE_FIELDS = [
  "tests_summary",
  "ci_summary",
  "smoke_note",
  "seo_summary",
];

const PLACEHOLDER = /\{\{([a-z0-9_]+)\}\}/g;

/**
 * Replace `{{name}}` in the composable prose fields with what the run measured.
 *
 * Fails closed, and this is the important part: a placeholder no artifact
 * answered is a NAMED problem, and the literal is left visible rather than
 * silently blanked or quietly dropped. A judge reading "the browser smoke runs
 * {{smoke_gates_total}} gates" learns the record is unfinished; a judge reading
 * a smoothed-over sentence learns nothing at all.
 */
export function composeMeasuredCounts(prose, artifacts) {
  const measured = {};
  for (const art of Object.values(artifacts || {})) {
    for (const [k, v] of Object.entries(art.measurements || {}))
      measured[k] = v;
  }
  const problems = [];
  const filled = { ...prose };
  for (const field of COMPOSABLE_FIELDS) {
    const text = filled[field];
    if (typeof text !== "string" || !PLACEHOLDER.test(text)) {
      PLACEHOLDER.lastIndex = 0;
      continue;
    }
    PLACEHOLDER.lastIndex = 0;
    filled[field] = text.replace(PLACEHOLDER, (whole, name) => {
      if (Object.hasOwn(measured, name) && measured[name] !== null)
        return String(measured[name]);
      problems.push(
        `\`${field}\` quotes {{${name}}}, which no artifact on this run ` +
          "measured, so the record would reach the judge with the number still " +
          "unresolved — write the number the run measured, or drop the claim",
      );
      return whole;
    });
  }
  return { prose: filled, problems, measured };
}

export function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);

  // The prose record is required, not optional: without its facet proof lines
  // the judge scores every facet from nothing, and "mixed — partial or
  // unverified evidence" would read like a product defect rather than an empty
  // record.
  let prose = {};
  if (opts.prose) {
    if (!existsSync(opts.prose))
      usageError(`prose file not found: ${opts.prose}`);
    try {
      prose = JSON.parse(readFileSync(opts.prose, "utf8"));
    } catch (err) {
      usageError(`prose file is not valid JSON: ${err.message}`);
    }
    if (typeof prose !== "object" || prose === null || Array.isArray(prose)) {
      usageError("prose file must contain a JSON object");
    }
  } else {
    process.stderr.write(
      "build-jev-evidence: no --prose given, so the evidence carries no facet " +
        "proof lines and every facet will be judged unverified\n",
    );
  }

  let preReportNote = null;
  const { artifacts, ignored } = readArtifacts(opts.artifacts);
  // The measured counts, composed from the run rather than typed, BEFORE any
  // proof line is built: a facet line is allowed to quote them, and it may only
  // do so if the number came from this run.
  const composed = composeMeasuredCounts(prose, artifacts);
  prose = composed.prose;
  const countProblems = composed.problems;
  // Facet proof lines DERIVED from the gate reports this run produced, rather
  // than read from the prose file. Discovered, not listed: a new gate that
  // declares facet_axes becomes visible to the judge with no edit here.
  const { reports: derived, problems: reportProblems } = readGateReports(
    opts.artifacts,
  );
  for (const d of derived) {
    if (
      typeof prose?.facet_evidence !== "object" ||
      prose.facet_evidence === null
    )
      prose.facet_evidence = {};
    // A typed line for a measured axis is overridden, never merged, and the
    // override is recorded: two sources for one facet is how the record ended
    // up describing a byte count while a browser measurement went unread.
    if (Object.hasOwn(prose.facet_evidence, d.axis))
      preReportNote =
        `the prose file carried a hand-typed \`${d.axis}\` line, overridden by ` +
        `the one composed from ${d.source}`;
    prose.facet_evidence[d.axis] = d.line;
  }
  // The required set, from the workflow's own declarations rather than a list
  // kept beside this script: a gate the workflow runs and the record has never
  // heard of is exactly how ci_green came to read true on a red run.
  const preProblems = [...reportProblems, ...countProblems];
  let requiredJobs = [];
  try {
    requiredJobs = requiredJobsFromWorkflow(readFileSync(WORKFLOW, "utf8"));
    if (requiredJobs.length === 0) {
      preProblems.push(
        `no required jobs could be derived from ${WORKFLOW}, so ci_green is unproven`,
      );
    }
  } catch (err) {
    preProblems.push(
      `the workflow ${WORKFLOW} could not be read (${err.message}), so the required job set is unproven`,
    );
  }
  const { evidence, problems } = composeEvidence({
    artifacts,
    requiredJobs,
    prose,
    run: runProvenance(opts),
    generatedAt: opts.now || new Date().toISOString(),
    problems: preProblems,
  });
  if (ignored.length) {
    evidence.ci.ignored_files = ignored;
  }
  // ── ONE AXIS HAS TWO INSTRUMENTS, AND THIS IS WHERE THEY MEET ─────────────
  //
  // The `quality` axis is the only one whose subject is split across two
  // required jobs, and the split is not an accident of this layout: "the
  // smallest version that keeps the proven behavior" is measured on the shipped
  // payload by the plan §3.1 byte gate (web-smoke), while "no duplicated logic;
  // formatting clean" is measured by the contract suite, the formatter and the
  // site-integrity gates the `test` job runs. Each half words itself from its own
  // run — the byte gate composes its clause into its report, and the contract
  // clause is composed here from the run records the record already carries — and
  // neither half may claim the axis alone.
  //// So this joins them, and the join below is the only place that can: the byte
  // gate cannot see another job's outcomes, and the test job measures no bytes.
  // The join is BOUNDED from both ends rather than trimmed: each clause has its
  // own declared maximum, and a union over the transport clip is a NAMED PROBLEM
  // here — the failure mode this whole pass exists to prevent is a line silently
  // cut on its way to the judge, and silently dropping the clause that limits the
  // claim is exactly what a trim would do.
  if (derived.some((d) => d.axis === QUALITY_CONTRACT_AXIS)) {
    const contractClause = composeQualityContractClause(
      Object.fromEntries(QUALITY_CONTRACT_FIELDS.map((f) => [f, evidence[f]])),
    );
    if (contractClause) {
      joinAxisClauses(evidence, problems, QUALITY_CONTRACT_AXIS, [
        {
          half: "size",
          text: evidence.facet_evidence[QUALITY_CONTRACT_AXIS],
          max: QUALITY_SIZE_CLAUSE_MAX,
        },
        {
          half: "clarity",
          text: contractClause,
          max: QUALITY_CONTRACT_CLAUSE_MAX,
        },
      ]);
    }
  }
  // `accessibility` is the second two-instrument axis, joined by the SAME code
  // for the same reason. The controls walk (web-smoke) words the pack's four
  // questions — reachability, names, contrast, reduced motion — and ends on its
  // own limit: "1 Chrome, no screen reader, no theme/RTL matrix". The axe
  // matrix (quality-lab) is the run that measured exactly that matrix, and
  // neither half may claim the axis alone: the controls walk never loaded the
  // matrix, and the matrix never touched a keyboard. Matched by `metric`, the
  // field each gate stamps into its own report — the file names are an
  // implementation of the artifact upload, the metric is the measurement.
  const a11yAxis = A11Y_FACET_AXES[0];
  const controls = derived.find(
    (d) => d.axis === a11yAxis && d.metric === "a11y_controls",
  );
  const matrix = derived.find(
    (d) => d.axis === a11yAxis && d.metric === "a11y_matrix",
  );
  if (controls && matrix) {
    joinAxisClauses(evidence, problems, a11yAxis, [
      { half: "controls", text: controls.line, max: A11Y_CONTROLS_CLAUSE_MAX },
      { half: "matrix", text: matrix.line, max: A11Y_MATRIX_CLAUSE_MAX },
    ]);
  }
  if (derived.length) {
    // Recorded so a reader of the file can see which facet proof lines came
    // from which run's report, without re-deriving it — and, for each axis the
    // join above touched, the length that actually reaches the judge.
    const joinedAxes = new Set([QUALITY_CONTRACT_AXIS, A11Y_FACET_AXES[0]]);
    evidence.derived_facet_lines = derived.map((d) => ({
      axis: d.axis,
      source: d.source,
      metric: d.metric,
      chars: d.line.length,
      ...(joinedAxes.has(d.axis) &&
      typeof evidence.facet_evidence?.[d.axis] === "string"
        ? { joined_chars: evidence.facet_evidence[d.axis].length }
        : {}),
    }));
  }
  if (preReportNote) evidence.derived_facet_line_note = preReportNote;
  if (requiredJobs.length) {
    // Recorded so a reader of the file can see which gates "CI was green"
    // meant on this run, without re-deriving it from a workflow that has
    // since gained a job.
    evidence.ci.required_jobs = requiredJobs;
  }

  const outDir = dirname(opts.out);
  if (outDir && !existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(opts.out, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

  const kind = evidenceSourceKind(evidence);
  const green = problems.length === 0;
  process.stdout.write(
    `evidence: ${opts.out} (${kind})\n` +
      `required jobs: ${requiredJobs.length ? requiredJobs.join(" ") : "none derived"}\n` +
      // Every run record, named from the field list rather than guessed from a
      // suffix: a `_clean` field would otherwise be silently left out of the
      // very line that claims to report them all.
      `records: ${RUN_RECORD_FIELDS.map((f) => `${f}=${evidence[f]}`).join(" ")}\n`,
  );
  if (!green) {
    process.stderr.write(
      `build-jev-evidence: ${problems.length} problem(s); the evidence is written ` +
        `but the run cannot be trusted:\n${problems.map((p) => `  - ${p}`).join("\n")}\n`,
    );
  }
  // `--allow-problems` exists for a human rebuilding a record by hand from
  // known-red outcomes. It is not for CI: there, a red record must stop the
  // job before it spends a judgment.
  return green || opts.allowProblems ? 0 : 1;
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  try {
    exitWhenDrained(main());
  } catch (e) {
    process.stderr.write(`build-jev-evidence: ${e.message}\n`);
    exitWhenDrained(2);
  }
}
