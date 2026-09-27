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
import { pathToFileURL } from "node:url";

import {
  composeEvidence,
  evidenceSourceKind,
  parseJobResult,
  RUN_RECORD_FIELDS,
} from "./lib/jev-ci.mjs";
import { exitWhenDrained } from "./lib/graceful-exit.mjs";

const USAGE =
  "usage: node scripts/build-jev-evidence.mjs --artifacts DIR --out FILE " +
  "[--prose FILE] [--sha S] [--run-id N] [--now ISO] [--allow-problems]";

function usageError(msg) {
  process.stderr.write(`build-jev-evidence: ${msg}\n${USAGE}\n`);
  process.exit(2);
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
      };
    } else {
      ignored.push(name);
    }
  }
  return { artifacts, ignored };
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

  const { artifacts, ignored } = readArtifacts(opts.artifacts);
  const { evidence, problems } = composeEvidence({
    artifacts,
    prose,
    run: runProvenance(opts),
    generatedAt: opts.now || new Date().toISOString(),
  });
  if (ignored.length) {
    evidence.ci.ignored_files = ignored;
  }

  const outDir = dirname(opts.out);
  if (outDir && !existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(opts.out, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

  const kind = evidenceSourceKind(evidence);
  const green = problems.length === 0;
  process.stdout.write(
    `evidence: ${opts.out} (${kind})\n` +
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
