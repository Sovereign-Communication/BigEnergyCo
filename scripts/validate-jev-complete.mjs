#!/usr/bin/env node
// The Jev complete gate CLI — scores THIS repo's current state 0-100 against
// the 99 google-quality bar across all 21 facets, emits the pack-declared
// required-work buckets, and groups recommended actions by work type (the pass
// repertoire this repo actually runs).
//
//   node scripts/validate-jev-complete.mjs [--evidence ev.json] [--out r.json]
//                                          [--json] [--local-only]
//                                          [--scope P<n>.<m>] [--require-live]
//
// Evidence split (fail-closed both ways):
//   auto facts   — collected here from code the evidence file cannot fake:
//                  `git status` (tree_clean + dirty paths), `git grep` for
//                  tracked secret shapes, .gitignore .env coverage, the test
//                  suite size, HEAD sha.
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
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildStateText,
  completeQuestionPack,
  heuristicFacetLevels,
  loadCompletePack,
  matchCompleteKeywords,
  mergeEvidence,
  parseLiveAnswers,
  resolveScopeFacets,
  readRatchetBaseline,
  checkRatchet,
  scoreCompleteGate,
  planItemAtLeast,
  COMPLETE_EXIT_RULE_FROM,
} from "./lib/jev-complete.mjs";
// P0.3(e) / F-45: the report has to say what kind of evidence it consumed and
// what kind of run it was, so a CI judgment is distinguishable from a hand-typed
// one, and the plan's re-run rule is readable from the report itself.
import {
  acceptLiveJudgment,
  classifyRun,
  evidenceSourceKind,
  JEV_MODEL_ALIAS,
} from "./lib/jev-ci.mjs";
import { exitWhenDrained } from "./lib/graceful-exit.mjs";
// P0.3(a) / R-AI-08: the price lives in exactly one module, shared with the
// worker. The previous private `JEV_INPUT_PRICE_PER_MILLION = 42.0` was 100,000x
// the canonical D-13 rate (see worker/jev-price.mjs and plan finding F-37).
import { jevCostUsd } from "../worker/jev-price.mjs";
const JEV_TIMEOUT_MS = 15000;
const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";

function usageError(msg) {
  process.stderr.write(`validate-jev-complete: ${msg}\n`);
  process.stderr.write(
    "usage: node scripts/validate-jev-complete.mjs [--scope P<n>.<m>] " +
      "[--evidence FILE] [--out FILE] [ --json] [--local-only] " +
      "[--require-live]\n",
  );
  process.exit(2);
}

function parseArgs(argv) {
  const opts = {
    evidence: null,
    out: null,
    json: false,
    localOnly: false,
    scope: null,
    requireLive: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--scope") {
      opts.scope =
        argv[++i] ?? usageError("--scope requires a plan item id, e.g. P1.1");
    } else if (arg === "--evidence") {
      opts.evidence =
        argv[++i] ?? usageError("--evidence requires a file path");
    } else if (arg === "--out") {
      opts.out = argv[++i] ?? usageError("--out requires a file path");
    } else if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--local-only") {
      opts.localOnly = true;
    } else if (arg === "--require-live") {
      opts.requireLive = true;
    } else if (arg === "--help" || arg === "-h") {
      usageError("this is the help text");
    } else {
      usageError(`unknown argument ${JSON.stringify(arg)}`);
    }
  }
  return opts;
}

function git(args) {
  const r = spawnSync("git", args, { encoding: "utf8", timeout: 15000 });
  if (r.error) throw new Error(`git ${args[0]} failed: ${r.error.message}`);
  return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}

// Code-owned auto facts: an evidence file can claim anything about a past CI
// run, but it cannot fake the working tree in front of this process.
function collectAutoFacts(repoRoot) {
  const status = git(["-C", repoRoot, "status", "--porcelain"]);
  if (status.status !== 0) {
    throw new Error(`git status failed: ${status.stderr.trim()}`);
  }
  const dirtyPaths = status.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.slice(3).replace(/^"|"$/g, ""));

  // Tracked-tree secret shapes: never print matches, only the count. The
  // patterns cover the provider key formats this repo actually uses.
  const scan = git([
    "-C",
    repoRoot,
    "grep",
    "-I",
    "-n",
    "-E",
    "(sk-or-v1-[0-9a-f]{20,}|apik[-_][0-9a-zA-Z]{16,}|AKIA[0-9A-Z]{16}|ghp_[0-9A-Za-z]{36})",
    "--",
    ".",
  ]);
  // git grep exit: 0 = match, 1 = clean, >1 = error (treat as NOT clean).
  const secretHits =
    scan.status === 0 ? scan.stdout.split("\n").filter(Boolean).length : 0;
  const secretsClean = scan.status <= 1 && secretHits === 0;

  const gitignorePath = join(repoRoot, ".gitignore");
  const gitignore = existsSync(gitignorePath)
    ? readFileSync(gitignorePath, "utf8")
    : "";
  const envIgnored = /^\.env[\s*]/m.test(gitignore);

  // A fresh repo has no HEAD yet — report it, never crash the gate on it.
  const shaRes = git(["-C", repoRoot, "rev-parse", "--short", "HEAD"]);
  const sha = shaRes.status === 0 ? shaRes.stdout.trim() : "unborn";
  const branchRes = git(["-C", repoRoot, "branch", "--show-current"]);
  const branch =
    branchRes.status === 0 && branchRes.stdout.trim()
      ? branchRes.stdout.trim()
      : "?";

  let testCount = 0;
  const testsDir = join(repoRoot, "tests");
  if (existsSync(testsDir)) {
    testCount = git(["-C", repoRoot, "ls-files", "tests"])
      .stdout.split("\n")
      .filter((f) => f.endsWith(".test.mjs")).length;
  }

  return {
    target: `${branch} @ ${sha}`,
    sha,
    branch,
    treeClean: dirtyPaths.length === 0,
    dirtyPaths,
    secretsClean,
    secretHitCount: secretHits,
    envIgnored,
    testCount,
  };
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

// Key resolution mirrors the harness config chain for the LOCAL copy's needs:
// env first, then this repo's .env, then the harness jev.env (read-only —
// config is the one sanctioned way to reuse the local harness setup).
function resolveKeys(repoRoot) {
  const fromEnv = (names) => {
    for (const n of names) {
      const v = process.env[n];
      if (v && v.trim()) return v.trim();
    }
    return null;
  };
  const fromFile = (path, names) => {
    if (!path || !existsSync(path)) return null;
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
      if (m && names.includes(m[1]) && m[2].trim()) return m[2].trim();
    }
    return null;
  };

  const typesafeKey =
    fromEnv(["TYPESAFE_API_KEY", "HARNESS_JEV_KEY", "JEV_API_KEY"]) ||
    fromFile(join(repoRoot, ".env"), ["TYPESAFE_API_KEY", "HARNESS_JEV_KEY"]) ||
    fromFile(join(homedir(), ".config", "harness", "jev.env"), [
      "HARNESS_JEV_KEY",
      "JEV_API_KEY",
      "TYPESAFE_API_KEY",
    ]);
  // P0.3(b) / D-13: OpenRouter is no longer a Jev path, so it is no longer
  // read from the environment or from .env. Nothing resolves an OpenRouter
  // key here, and nothing downstream can ask for one.
  return { typesafeKey };
}

async function attemptFetch(url, options) {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  }
}

// ONE direct attempt — a single request with a hard timeout, never a retry
// loop. P0.3(b) / D-13: TypeSafe direct is the only path, and the request asks
// for the loose alias; what the gate will ACCEPT is a response naming a
// concrete version (acceptLiveJudgment), so every score is attributable.
async function liveJevCall(stateText, questions, keys) {
  const notes = [];
  // The official request shape is {model, state, questions} — the same
  // envelope worker/index.js and the harness evaluator send; `state` carries
  // the evidence text the facets are judged against.
  const payload = {
    state: { gate: "jev-complete", evidence: stateText },
    questions,
  };

  if (keys.typesafeKey) {
    const r = await attemptFetch(TYPESAFE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${keys.typesafeKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(JEV_TIMEOUT_MS),
      body: JSON.stringify({ model: JEV_MODEL_ALIAS, ...payload }),
    });
    if (r.ok && r.body) {
      return {
        answers: r.body.answers || r.body,
        usage: r.body.usage || null,
        provider: "typesafe",
        model: r.body.model,
        notes,
      };
    }
    notes.push(
      `direct: ${r.error ? `network error: ${r.error}` : `HTTP ${r.status}`}`,
    );
  } else {
    notes.push("direct: no key (TYPESAFE_API_KEY / HARNESS_JEV_KEY)");
  }

  // P0.3(b) / D-13: TypeSafe direct is the ONLY Jev path. The bounded
  // OpenRouter backup that used to follow it is removed, so a provider outage
  // is now an honest "no answers" in the report rather than a silent reroute to
  // a second provider. Do not reintroduce a fallback here without an amendment.

  return { answers: null, usage: null, provider: null, model: null, notes };
}

function printHuman(report) {
  const bar = (ok) => (ok ? "PASS" : "FAIL");
  process.stdout.write(`\n=== Jev complete gate: ${report.target} ===\n`);
  process.stdout.write(
    `score: ${report.score.toFixed(2)} / 100  (target ${report.min_score})  [${bar(report.pass)}]\n`,
  );
  process.stdout.write(
    `mechanical: ${report.mechanical_score}  semantic: ${report.semantic_score}\n`,
  );
  process.stdout.write(`hard gates:\n`);
  for (const [k, v] of Object.entries(report.hard_gates)) {
    process.stdout.write(`  ${v ? "✓" : "✗"} ${k}\n`);
  }
  process.stdout.write(`facets (${Object.keys(report.facets).length}):\n`);
  for (const [axis, f] of Object.entries(report.facets)) {
    const mark = f.index <= 0 ? "✗" : f.index < 3 ? "·" : "✓";
    process.stdout.write(
      `  ${mark} ${axis.padEnd(14)} ${f.level}  (ordinal ${f.ordinal}, ${f.source})\n`,
    );
  }
  if (report.blocking_facets.length) {
    process.stdout.write(`blocking: ${report.blocking_facets.join(", ")}\n`);
  }
  if (report.facets_not_proven && report.facets_not_proven.length) {
    process.stdout.write(
      `not proven (${report.facets_not_proven.length}/${Object.keys(report.facets).length}): ${report.facets_not_proven.join(", ")}\n`,
    );
  }
  if (report.scoped) {
    const s = report.scoped;
    process.stdout.write(
      `\nscoped (${s.scope}): ${s.score.toFixed(2)} / 100  (target ${s.min_score})  [${bar(s.pass)}]\n`,
    );
    process.stdout.write(`  facets in scope: ${s.facets.join(", ")}\n`);
    process.stdout.write(
      `  short of proven: ${s.facets_short_of_proven.length ? s.facets_short_of_proven.join(", ") : "none"}\n`,
    );
    process.stdout.write(
      `  ratchet: ${s.ratchet.status}${
        s.ratchet.regressions && s.ratchet.regressions.length
          ? ` — ${s.ratchet.regressions.length} regression(s): ` +
            s.ratchet.regressions
              .map(
                (r) => `${r.axis} ${r.previous_ordinal}->${r.current_ordinal}`,
              )
              .join(", ")
          : ""
      }\n`,
    );
  }
  if (report.required_work.length) {
    process.stdout.write(`required work (by severity):\n`);
    for (const item of report.required_work) {
      const star = item.primary ? "*" : " ";
      process.stdout.write(
        `  ${star} [${item.bucket}] ${item.label} — ${item.work_type}\n` +
          `      ${item.suggested_next_action}\n`,
      );
    }
    process.stdout.write(`recommended actions by work type:\n`);
    for (const [workType, items] of Object.entries(
      report.recommended_actions,
    )) {
      process.stdout.write(`  ${workType} (${items.length}):\n`);
      for (const it of items)
        process.stdout.write(`    - ${it.suggested_next_action}\n`);
    }
  } else {
    process.stdout.write(
      `required work: none — every facet at or above the bar\n`,
    );
  }
  if (report.blockers.length) {
    process.stdout.write(`blockers:\n`);
    for (const b of report.blockers) process.stdout.write(`  - ${b}\n`);
  }
  const live = report.live_jev || {};
  process.stdout.write(
    `live: provider=${live.provider || "none"} fallback=${live.is_fallback}` +
      (live.blocker ? ` blocker: ${live.blocker}` : "") +
      (live.cost_usd != null ? ` cost=$${live.cost_usd.toFixed(6)}` : "") +
      "\n",
  );
  process.stdout.write(`\n`);
}

export async function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  const repoRoot = process.cwd();
  const pack = loadCompletePack(repoRoot);
  const auto = collectAutoFacts(repoRoot);
  const runRecords = opts.evidence ? loadEvidenceFile(opts.evidence) : {};
  const evidence = mergeEvidence(runRecords, auto);
  evidence._dirtyPaths = auto.dirtyPaths;

  let live = null;
  let liveMeta = { is_fallback: true, blocker: "not attempted (--local-only)" };
  // The transport budget is derived from the pack (P0.3(d)), so the gate hands
  // the state builder the axes it will actually ask about.
  const axisNames = Object.keys(pack.axes);
  let hasKey = null;
  let accepted = false;
  let modelRequested = JEV_MODEL_ALIAS;
  if (!opts.localOnly) {
    const keys = resolveKeys(repoRoot);
    hasKey = Boolean(keys.typesafeKey);
    const stateText = buildStateText(evidence, auto, axisNames);
    const questions = completeQuestionPack(pack);
    const result = await liveJevCall(stateText, questions, keys);
    if (result.answers) {
      // The model version is pinned BEFORE the answers are believed: an
      // unversioned response is not a judgment the gate will score on, however
      // well-formed its answers look (plan §8 P0.3(e)).
      const pin = acceptLiveJudgment({ model: result.model });
      live = pin.accepted ? parseLiveAnswers(result.answers, pack) : null;
      accepted = pin.accepted && Boolean(live);
      if (!accepted) {
        liveMeta = {
          is_fallback: true,
          provider: result.provider,
          model: pin.model,
          model_requested: modelRequested,
          blocker:
            pin.blocker ||
            "response had no valid facet answers (0-hallucination: nothing invented)",
        };
      } else {
        const inputTokens = Number(result.usage?.input_tokens) || 0;
        liveMeta = {
          is_fallback: false,
          provider: result.provider,
          model: pin.model,
          model_requested: modelRequested,
          input_tokens: inputTokens,
          cost_usd: jevCostUsd(inputTokens),
          notes: result.notes,
        };
      }
    } else {
      liveMeta = {
        is_fallback: true,
        provider: null,
        model_requested: modelRequested,
        blocker: result.notes.join("; ") || "no provider reachable",
        notes: result.notes,
      };
    }
  }

  const stateText = buildStateText(evidence, auto, axisNames);
  const keywordGap = matchCompleteKeywords(stateText, pack);
  const report = scoreCompleteGate(evidence, {
    pack,
    liveJudgment: live,
    keywordGap: live ? null : keywordGap,
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
  report.live_jev = { is_fallback: true, accepted: false, ...liveMeta };
  // `report.live` is the alias the report has always carried; the run class and
  // the pinned model belong on both, so neither view can be read as a pass when
  // the other says the run produced no judgment.
  report.live = {
    ...(report.live || {}),
    is_fallback: report.live_jev.is_fallback,
    accepted: report.live_jev.accepted,
    model: report.live_jev.model,
    model_requested: report.live_jev.model_requested,
  };
  report.evidence_source = opts.evidence || "(none — run records default red)";
  // §13.3: a hand-written evidence file is never proof on its own. That is only
  // checkable if the report says which kind of file it read, so a reader can
  // tell a CI judgment from a hand-typed one without leaving the report.
  // No evidence file at all is its own state: "hand-maintained" would imply
  // somebody maintained it, and the run records then default red.
  report.evidence_source_kind = evidenceSourceKind(
    opts.evidence ? runRecords : null,
  );
  // The plan allows one re-run of a provider error and none of a judgment
  // (plan §8 P0.3(e)). Classifying the run makes that readable from the report
  // instead of remembered from the plan.
  const classified = classifyRun({
    attempted: !opts.localOnly && hasKey !== null,
    accepted,
    hasKey,
  });
  report.run_class = classified.run_class;
  report.rerun_allowed = classified.rerun_allowed;
  report.rerun_policy = classified.policy;
  if (opts.requireLive && !accepted) {
    // Fail closed: --require-live means "this verdict only counts if a pinned
    // live judgment made it". Without one there is no verdict, whatever the
    // heuristic floors say.
    report.blockers.push(
      `--require-live: no accepted live judgment (${
        liveMeta.blocker || "none was attempted"
      }). A gate result without one is not a gate result.`,
    );
  }

  // ── scoped judgment (P0.3(c) / §13.3) ─────────────────────────────────────
  // The whole-program verdict above is the P10 bar and is expected to fail
  // until then. A scoped run judges only the facets the named item changes,
  // against the same target, AND fails on any facet that dropped below the
  // ordinal the ledger last recorded — in or out of scope.
  let scopedPass = report.pass;
  if (opts.scope) {
    const scopeFacets = resolveScopeFacets(opts.scope, pack);
    const inScope = {};
    for (const axis of scopeFacets) inScope[axis] = report.facets[axis];
    const semantic =
      Object.values(inScope).reduce((s, f) => s + f.ordinal, 0) /
      Math.max(1, scopeFacets.length);
    const scopedCombined = report.hard_gates_passed
      ? Math.max(
          0,
          Math.min(100, 0.7 * report.mechanical_score + 0.3 * semantic),
        )
      : 0;
    const ratchet = checkRatchet(
      report.facets,
      readRatchetBaseline(ledgerText, pack),
    );
    const short = scopeFacets.filter((a) => report.facets[a].index < 4);
    // The all-proven exit rule binds from COMPLETE_EXIT_RULE_FROM. P0.3(c)
    // defined the rule and is the one item it cannot judge (see the constant).
    const exitRuleBinds = planItemAtLeast(opts.scope, COMPLETE_EXIT_RULE_FROM);
    // P0.3 bootstrap (plan §9 rule 6, owner ruling 2026-09-26): a P0.3
    // sub-PR builds the gate that judges it, so it merges on green CI plus an
    // attached scoped report with NO RATCHET REGRESSION, even below 99. The
    // ≥ 99 threshold and the all-proven rule bind from P0.4. The hard gates
    // and the ratchet bind throughout and are never relaxed.
    //
    // The ratchet test is `=== "met"`, not `!== "violation"`. An inactive
    // ratchet means nothing was checked, and "no regression" must mean
    // "checked and clean" — otherwise a run with no baseline at all would
    // sail through the very clause meant to catch a drop.
    scopedPass =
      report.hard_gates_passed &&
      ratchet.status === "met" &&
      (!exitRuleBinds ||
        (scopedCombined >= report.min_score && short.length === 0));
    report.scoped = {
      scope: opts.scope,
      facets: scopeFacets,
      semantic_score: Math.round(semantic * 100) / 100,
      score: Math.round(scopedCombined * 100) / 100,
      min_score: report.min_score,
      bootstrap_applies: !exitRuleBinds,
      bootstrap_rule:
        "plan §9 rule 6: P0.3 sub-PRs merge on green CI plus no ratchet regression, even below 99",
      facets_short_of_proven: short,
      exit_rule_binds_from: COMPLETE_EXIT_RULE_FROM,
      exit_rule_binding: exitRuleBinds,
      // An inactive ratchet is stated, never implied. It is not a pass.
      ratchet:
        ratchet.status === "inactive_no_baseline"
          ? {
              status: ratchet.status,
              note:
                "no ledger row yet records per-facet ordinals, so there is no " +
                "previous level to hold; the ratchet did not run",
            }
          : ratchet,
      pass: scopedPass,
    };
  }

  if (opts.out) {
    writeFileSync(opts.out, JSON.stringify(report, null, 2), "utf8");
  }
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    printHuman(report);
    if (opts.out) process.stdout.write(`report written: ${opts.out}\n`);
  }
  // `--require-live` can only ever make the run fail, never pass: a missing or
  // unpinned judgment is a blocker, so the exit is 1 regardless of what the
  // scores say.
  const gatePassed = opts.scope ? scopedPass : report.pass;
  const failed = !accepted && opts.requireLive;
  return gatePassed && !failed ? 0 : 1;
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
