#!/usr/bin/env node
// The Jev complete gate CLI — scores THIS repo's current state 0-100 against
// the 99 google-quality bar across all 21 facets, emits the pack-declared
// required-work buckets, and groups recommended actions by work type (the pass
// repertoire this repo actually runs).
//
//   node scripts/validate-jev-complete.mjs [--evidence ev.json] [--out r.json]
//                                          [--explain-out explain.md]
//                                          [--json] [--local-only]
//                                          [--scope P<n>.<m>] [--require-live]
//
// This file is the PIPELINE, and nothing else. Every concern it touches has an
// owner elsewhere, and the data flows one way:
//
//   lib/jev-auto-facts.mjs   the tree in front of this process  ─┐
//   --evidence JSON          the run records CI recorded       ─┤
//                                                                 ├─► lib/jev-complete.mjs
//   lib/jev-live.mjs         the one request to a judge  ───────┘      (score, ratchet, facets)
//
//   the scored report ──► lib/jev-verdict.mjs   (does the scoped judgment pass?)
//                   ──► lib/jev-run.mjs         (what kind of run was it?)
//                   ──► lib/jev-report-print.mjs (how it reads) ──► exit code
//
// Evidence split (fail-closed both ways):
//   auto facts   — collected by lib/jev-auto-facts.mjs from code the evidence
//                  file cannot fake: `git status` (tree_clean + dirty paths),
//                  `git grep` for tracked secret shapes, .gitignore .env
//                  coverage, the test suite size, HEAD sha.
//   run records  — tests/prettier/seo/smoke/ci outcomes via --evidence JSON;
//                  ABSENT KEYS DEFAULT TO FALSE (a run nobody recorded is a
//                  run that did not pass — never optimistically green).
//
// Live Jev (unless --local-only): ONE direct attempt at TypeSafe with the
// local key (env TYPESAFE_API_KEY / HARNESS_JEV_KEY, else ~/.config/harness/
// jev.env) — a single request with a hard timeout, never a retry loop.
// P0.3(b) / D-13: TypeSafe direct is the ONLY Jev path. The OpenRouter backup
// that used to follow it is removed, so a provider failure is now an honest
// blocker recorded in the report rather than a silent reroute to a second
// provider. Failing is recorded, not crashed, and never worked around.
//
// Exit code: 0 only when the gate passes (all hard gates + score >= target +
// no blocking facet); 1 otherwise; 2 on usage errors. `--out` writes the
// JSON report before the exit decision, so a failing gate still leaves its
// full evidence behind.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildStateText,
  completeQuestionPack,
  loadCompletePack,
  matchCompleteKeywords,
  mergeEvidence,
  parseLiveAnswers,
  scoreCompleteGate,
} from "./lib/jev-complete.mjs";
// P0.3(e) / F-45: the report has to say what kind of evidence it consumed and
// what kind of run it was, so a CI judgment is distinguishable from a hand-typed
// one, and the plan's re-run rule is readable from the report itself.
import {
  acceptLiveJudgment,
  attachRunFacts,
  gateExitCode,
  JEV_MODEL_ALIAS,
  liveRunRecord,
} from "./lib/jev-run.mjs";
import { collectAutoFacts } from "./lib/jev-auto-facts.mjs";
import { liveJevCall, resolveKeys } from "./lib/jev-live.mjs";
import { scopedVerdict } from "./lib/jev-verdict.mjs";
import {
  printExplanation,
  printReport,
  renderExplanationMarkdown,
} from "./lib/jev-report-print.mjs";
import { explainLowScore } from "./lib/jev-explain.mjs";
import { exitWhenDrained } from "./lib/graceful-exit.mjs";

function usageError(msg) {
  process.stderr.write(`validate-jev-complete: ${msg}\n`);
  process.stderr.write(
    "usage: node scripts/validate-jev-complete.mjs [--scope P<n>.<m>] " +
      "[--evidence FILE] [--out FILE] [--explain-out FILE] [--json] " +
      "[--local-only] [--require-live]\n",
  );
  process.exit(2);
}

function parseArgs(argv) {
  const opts = {
    evidence: null,
    out: null,
    explainOut: null,
    json: false,
    localOnly: false,
    requireLive: false,
    scope: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--evidence") opts.evidence = argv[++i] ?? usageError("x");
    else if (arg === "--out") opts.out = argv[++i] ?? usageError("x");
    else if (arg === "--explain-out")
      opts.explainOut = argv[++i] ?? usageError("x");
    else if (arg === "--scope") opts.scope = argv[++i] ?? usageError("x");
    else if (arg === "--json") opts.json = true;
    else if (arg === "--local-only") opts.localOnly = true;
    else if (arg === "--require-live") opts.requireLive = true;
    else usageError(`unknown argument: ${arg}`);
  }
  return opts;
}

function loadEvidenceFile(path) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    usageError(`cannot read evidence file: ${err.message}`);
  }
  try {
    const data = JSON.parse(raw);
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      usageError("evidence file must contain a JSON object");
    }
    return data;
  } catch (err) {
    usageError(`evidence file is not valid JSON: ${err.message}`);
  }
}

export async function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  const repoRoot = process.cwd();
  const pack = loadCompletePack(repoRoot);
  const auto = collectAutoFacts(repoRoot);
  const runRecords = opts.evidence ? loadEvidenceFile(opts.evidence) : {};
  const evidence = mergeEvidence(runRecords, auto);
  evidence._dirtyPaths = auto.dirtyPaths;

  // The transport budget is derived from the pack (P0.3(d)), so the gate hands
  // the state builder the axes it will actually ask about.
  const axisNames = Object.keys(pack.axes);
  const stateText = buildStateText(evidence, auto, axisNames);

  // One call, if the run calls for one. The wire has no opinion about the
  // report; lib/jev-run.mjs owns what the answer means.
  let judgment = null;
  let wire = null;
  let hasKey = null;
  if (!opts.localOnly) {
    const keys = resolveKeys(repoRoot);
    hasKey = Boolean(keys.typesafeKey);
    const questions = completeQuestionPack(pack);
    wire = await liveJevCall(stateText, questions, keys);
  }
  // A response is pinned BEFORE its answers are believed: an unversioned
  // response is not a judgment the gate will score on, however well-formed its
  // answers look (plan §8 P0.3(e)).
  const pin =
    wire && wire.answers ? acceptLiveJudgment({ model: wire.model }) : null;
  if (pin && pin.accepted) {
    judgment = parseLiveAnswers(wire.answers, pack);
  }
  const liveMeta = liveRunRecord({
    skipped: opts.localOnly,
    wire,
    pin,
    parsed: judgment,
    modelRequested: JEV_MODEL_ALIAS,
  });
  const accepted = liveMeta.accepted === true;

  const report = scoreCompleteGate(evidence, {
    pack,
    liveJudgment: judgment,
    keywordGap: judgment ? null : matchCompleteKeywords(stateText, pack),
  });

  // The ratchet reads the ledger the plan makes append-only (§13.4). A missing
  // or unreadable ledger is an inactive ratchet, reported as such — never a
  // silent pass.
  let ledgerText = "";
  try {
    ledgerText = readFileSync(join(repoRoot, "docs/plan/LEDGER.jsonl"), "utf8");
  } catch {
    ledgerText = "";
  }
  report.target = auto.target;
  report.scope = opts.scope || null;
  report.auto_facts = {
    tree_clean: auto.treeClean,
    secrets_clean: auto.secretsClean,
    env_ignored: auto.envIgnored,
    test_count: auto.testCount,
    dirty_paths: auto.dirtyPaths,
  };
  // Every fact about the run itself — the live view, the run class, the re-run
  // permission, the evidence provenance, and the --require-live blocker — is
  // written in one place (scripts/lib/jev-run.mjs) so the report cannot describe
  // the same run two ways.
  attachRunFacts(report, {
    liveMeta,
    // "Attempted" means a call was made, not that the key environment was
    // read. The first live run of the jev-complete job caught the difference:
    // with O-01 undone there is no key, nothing is called, and `hasKey !== null`
    // reported that as an attempt — so the run was classified a re-runnable
    // provider error while its own blocker said "no key". A configuration gap
    // is not a provider failure, and re-running cannot conjure a secret.
    attempted: !opts.localOnly && hasKey === true,
    hasKey,
    requireLive: opts.requireLive,
    evidence: opts.evidence ? runRecords : null,
    evidenceSource: opts.evidence || "(none — run records default red)",
  });

  // ── scoped judgment (P0.3(c) / §13.3) ─────────────────────────────────────
  let scopedPass = report.pass;
  if (opts.scope) {
    const verdict = scopedVerdict({
      report,
      scope: opts.scope,
      pack,
      ledgerText,
    });
    scopedPass = verdict.pass;
    report.scoped = verdict.scoped;
  }

  // Bucketed "why is the score low" explanation. Computed only when the
  // verdict failed — a passing gate's required_work is empty and printReport
  // already says so. Pure analysis over the report and the merged evidence;
  // the proof lines it quotes are the exact text the judge saw.
  const verdictFailed = opts.scope ? !scopedPass : !report.pass;
  let explanation = null;
  if (verdictFailed) {
    explanation = explainLowScore(report, evidence);
    if (opts.explainOut) {
      writeFileSync(
        opts.explainOut,
        renderExplanationMarkdown(explanation),
        "utf8",
      );
    }
  }

  if (opts.out) {
    writeFileSync(opts.out, JSON.stringify(report, null, 2), "utf8");
  }
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    printReport(report);
    if (explanation) printExplanation(explanation);
    if (opts.out) process.stdout.write(`report written: ${opts.out}\n`);
    if (opts.explainOut && explanation)
      process.stdout.write(`explanation written: ${opts.explainOut}\n`);
  }
  // `--require-live` can only ever make the run fail, never pass: a missing or
  // unpinned judgment is a blocker, so the exit is 1 regardless of what the
  // scores say.
  return gateExitCode({
    gatePassed: opts.scope ? scopedPass : report.pass,
    accepted,
    requireLive: opts.requireLive,
  });
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  // Same exit plumbing as promote.mjs: process.exit() rips the loop down
  // while the live call's undici keep-alive socket is still closing, libuv
  // aborts with UV_HANDLE_CLOSING on Windows, and the verdict's exit code is
  // lost (observed on the live path: full report, then exit=127 + the
  // async.c assertion). exitWhenDrained sets process.exitCode and lets the
  // pipe and sockets flush — the one owner of this policy in the repo.
  try {
    exitWhenDrained(await main());
  } catch (e) {
    process.stderr.write(`validate-jev-complete: ${e.message}\n`);
    exitWhenDrained(2);
  }
}
