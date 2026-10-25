#!/usr/bin/env node
// Jev battery re-run — the authorized source for the CAR queues (#197, #201).
//
// WHY THIS EXISTS: the per-function queues behind CAR #197 (fail-closed
// dispositions) and CAR #201 (test gaps) live only in an uncommitted audit.db
// on a machine that is not available. Tracker #194's guardrail forbids the
// lane from inventing ranks or queues, so on 2026-10-25 the owner authorized
// a ~US$0.01 battery re-run: the same batteries judged again against the
// CURRENT tree, with the rubric written down here before the first call
// (docs/jev-frozen-rubric.md's freeze-first discipline). The re-run's numbers
// are its own: they are recorded as a re-run and never presented as the
// historical audit's numbers.
//
//   node scripts/jev-battery-rerun.mjs --smoke 2      # shape probe, 2 fns
//   node scripts/jev-battery-rerun.mjs --limit 20     # pilot
//   node scripts/jev-battery-rerun.mjs                # full run
//   node scripts/jev-battery-rerun.mjs --csv-only     # rebuild CSVs from raw
//
// WIRE: TypeSafe direct (docs/jev-api-format.md is canonical: top-level
// {model, state, questions}; the UUID nonce rides INSIDE state; score
// criteria is a LIST of <=5 levels, choice criteria is a DICT; answers come
// back under `answers`). The key is resolved exactly the way
// scripts/lib/jev-live.mjs resolves it (env, then .env, then the harness
// jev.env). TypeSafe direct is the only path — no provider fallback (D-13).
// At most ONE transport retry per batch, only for a request that never
// produced a judgment (network error / 429 / 5xx / timeout), never to re-roll
// an answer that came back; both attempts are recorded.
//
// SPEND: metered from the provider's own usage.input_tokens at the single
// price in worker/jev-price.mjs, with a hard fail-stop at --cost-cap
// (default US$0.05 against the owner's ~US$0.01 authorization).
//
// POPULATION: every tracked .js/.mjs under assets/js, worker, scripts and
// tests (the historical audit's population — its must-fix lists name test and
// script functions too). Extraction here is brace/regex-based, so counts will
// differ from the historical tree-sitter extraction; that difference is
// recorded in the summary, not smoothed over.

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

import { resolveKeys } from "./lib/jev-live.mjs";
import { jevCostUsd } from "../worker/jev-price.mjs";

const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
const PRIMARY_MODEL = "jev-1.13.0"; // the battery's original pin
const FALLBACK_MODEL = "jev-latest"; // used ONCE if the pin is refused
const BATCH = 5; // ~386 batches / 1,986 fns in the historical audit
const CONCURRENCY = 4;
const TIMEOUT_MS = 90000;
const DEFAULT_COST_CAP_USD = 0.05;
const DEFAULT_OUT = "docs/jev-completion/battery-rerun-2026-10-25";
const ROOTS = ["assets/js", "worker", "scripts", "tests"];
const SKIP = /^(vendor|node_modules|tmp|docs|build|dist)\//;

// ── population ─────────────────────────────────────────────────────────────

const SIGNS = [
  {
    kind: "function",
    re: /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)\s*\(/,
  },
  {
    kind: "arrow",
    re: /^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/,
  },
  {
    kind: "method",
    re: /^(?:static\s+|get\s+|set\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{\s*$/,
  },
];
const NOT_A_METHOD = new Set([
  "if",
  "for",
  "while",
  "switch",
  "catch",
  "do",
  "else",
  "try",
  "return",
  "function",
  "constructor",
]);

export function extractFunctions(source, file) {
  const lines = source.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const { kind, re } of SIGNS) {
      const m = re.exec(line);
      if (!m) continue;
      const name = m[1];
      if (kind === "method" && NOT_A_METHOD.has(name)) continue;
      const body = captureBody(lines, i);
      out.push({
        file,
        line: i + 1,
        name,
        kind,
        body:
          body.length > 4000 ? body.slice(0, 4000) + "\n/* truncated */" : body,
      });
      break;
    }
  }
  return out;
}

// Brace match with light string/comment awareness — imperfect by design (a
// documented heuristic, not a parser), good enough to show the judge a body.
function captureBody(lines, startIdx) {
  let text = "";
  let depth = 0;
  let started = false;
  let inStr = null;
  let inBlock = false;
  for (let i = startIdx; i < Math.min(lines.length, startIdx + 220); i += 1) {
    const line = lines[i];
    for (let j = 0; j < line.length; j += 1) {
      const c = line[j];
      const n = line[j + 1];
      if (inBlock) {
        if (c === "*" && n === "/") {
          inBlock = false;
          j += 1;
        }
        continue;
      }
      if (inStr) {
        if (c === "\\") {
          j += 1;
          continue;
        }
        if (c === inStr) inStr = null;
        continue;
      }
      if (c === "/" && n === "/") break; // rest of line is a comment
      if (c === "/" && n === "*") {
        inBlock = true;
        j += 1;
        continue;
      }
      if (c === "'" || c === '"' || c === "`") {
        inStr = c;
        continue;
      }
      if (c === "{") {
        depth += 1;
        started = true;
      } else if (c === "}") {
        depth -= 1;
      }
    }
    text += line + "\n";
    if (started && depth <= 0) break;
    if (text.length > 4000) break;
  }
  return text;
}

function trackedSources() {
  const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .filter((f) => /\.(js|mjs)$/.test(f) && !SKIP.test(f))
    .filter((f) => ROOTS.some((r) => f.startsWith(r + "/")))
    .filter((f) => !/\.min\.js$/.test(f))
    .filter((f) => !f.includes("jev-battery-rerun"));
  return files;
}

function testIndex() {
  const names = new Set();
  for (const f of trackedSources()) {
    if (!f.startsWith("tests/")) continue;
    const text = readFileSync(f, "utf8");
    for (const m of text.matchAll(/\b([A-Za-z_$][\w$]{2,})\b/g))
      names.add(m[1]);
  }
  return names;
}

// ── the rubric (frozen here before the first call) ─────────────────────────

function questionsFor(batch) {
  const q = {};
  batch.forEach((fn, i) => {
    const at = `${fn.name} (${fn.file}:${fn.line})`;
    q[`f${i}_fail_closed`] = {
      type: "score",
      instructions: `Function ${at} is in source block F${i}. When it meets an unexpected error or a missing input mid-flight, what does it do? Score only the behavior visible in the code, never a comment's promise.`,
      criteria: [
        "fails open — silently continues, invents a plausible value, or swallows the error",
        "degrades without marking the degraded state — downstream still treats the result as good",
        "propagates the failure or returns an explicit degraded/error state",
        "rejects strictly before any side effect",
      ],
    };
    q[`f${i}_blast`] = {
      type: "score",
      instructions: `If ${at} returned a wrong result, how far can that wrong result travel before anything recomputes or rechecks it?`,
      criteria: [
        "one call site; the next recompute overwrites it",
        "one UI surface's text or one transient state",
        "persisted state, or a number shown to the user as fact",
        "sizing results, money figures, or data sent off-device",
      ],
    };
    q[`f${i}_mode`] = {
      type: "choice",
      instructions: `If ${at} failed, the most user-visible failure class would be:`,
      criteria: {
        "silent-wrong-output":
          "a wrong number or wrong sizing answer shown with no error",
        "ui-crash-freeze":
          "the UI crashes, freezes, or an operation never completes",
        "security-bypass":
          "a check meant to keep something out or private is skipped",
        "lost-user-action":
          "the user's input or action is dropped without being saved",
        "stale-data-shown": "old data is shown as if it were current",
      },
    };
    q[`f${i}_covered`] = {
      type: "choice",
      instructions: `Existing test coverage for ${at} in this repository:`,
      criteria: {
        unit: "unit tests exercise it directly",
        integration: "it is only exercised through a larger flow or live smoke",
        both: "both unit and flow-level tests exercise it",
        none: "no test exercises it",
      },
    };
    q[`f${i}_strategy`] = {
      type: "choice",
      instructions: `If tests were added for ${at}, the right strategy would be:`,
      criteria: {
        unit: "a focused unit test is enough",
        integration: "only a flow-level integration test is meaningful",
        both: "both are warranted",
        "none-needed": "the function does not warrant its own tests",
      },
    };
    q[`f${i}_priority`] = {
      type: "score",
      instructions: `How much would shipping tests for ${at} improve confidence in the product's core promises (correct sizing numbers, honest costs, working offline, privacy)?`,
      criteria: [
        "little — trivial, or fully covered elsewhere",
        "some — a regression here would be annoying but visible",
        "a lot — a regression here could silently corrupt a user-facing answer",
        "critical — this guards money, safety, privacy, or the sizing engine's math",
      ],
    };
  });
  return q;
}

function verdictQuestionFor(batch) {
  const q = {};
  batch.forEach((fn, i) => {
    q[`f${i}_verdict`] = {
      type: "choice",
      instructions: `The security battery judged ${fn.name} (${fn.file}:${fn.line}) fail-open: on an unexpected error it can keep going instead of failing closed. In this repository failing open is sometimes the designed, safe behavior (sizing fallbacks that degrade gracefully and say so). What is the right disposition for this function?`,
      criteria: {
        "acceptable-fail-open":
          "failing open is the designed behavior — the downstream path degrades gracefully and marks or signals the degradation",
        "must-fix":
          "failing open here can produce a silent wrong sizing/cost answer, a security bypass, or a lost user action — harden to fail-closed with a test",
        "needs-human-look":
          "the correct behavior depends on product intent this code cannot show — a human must decide",
      },
    };
  });
  return q;
}

// ── the wire ───────────────────────────────────────────────────────────────

function stateText(batch) {
  const head =
    `run_class: battery-rerun (owner-authorized 2026-10-25). nonce: ${randomUUID()}\n` +
    `The blocks below are verbatim source from BigEnergyCo, a client-side solar-sizing calculator (vanilla JS + Web Workers, sizing math shown to users as fact). Judge ONLY the numbered function blocks; question keys f0_..f${batch.length - 1}_ refer to them in order.\n`;
  return (
    head +
    batch
      .map(
        (fn, i) =>
          `F${i}: ${fn.name} (${fn.file}:${fn.line}) [${fn.kind}]\n\`\`\`js\n${fn.body}\n\`\`\`\n`,
      )
      .join("\n")
  );
}

export function readAnswer(a) {
  if (a === null || a === undefined) return { kind: "missing" };
  if (typeof a === "number") return { kind: "score", score: a };
  if (typeof a === "string") return { kind: "choice", choice: a };
  if (typeof a === "object") {
    const conf =
      typeof a.confidence === "number" && Number.isFinite(a.confidence)
        ? a.confidence
        : null;
    if (typeof a.score === "number" && Number.isFinite(a.score))
      return { kind: "score", score: a.score, confidence: conf };
    if (typeof a.choice === "string")
      return { kind: "choice", choice: a.choice, confidence: conf };
    if (a.probabilities && a.legend) {
      let best = null;
      let bestP = -1;
      for (const [anchor, lvl] of Object.entries(a.legend)) {
        const p = a.probabilities[String(anchor)];
        if (typeof p !== "number" || !Number.isFinite(p)) continue;
        if (p > bestP) {
          bestP = p;
          best = lvl;
        }
      }
      const n = Number(best);
      if (best !== null && Number.isFinite(n))
        return { kind: "score", score: n, confidence: conf };
      if (typeof best === "string")
        return { kind: "choice", choice: best, confidence: conf };
    }
  }
  return { kind: "unmatched", raw: a };
}

async function callJudge(state, questions, keys, model) {
  const payload = { model, state, questions };
  const body = JSON.stringify(payload);
  const doFetch = () =>
    fetch(TYPESAFE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${keys.typesafeKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body,
    });
  let attempts = 0;
  let lastError = null;
  // At most one transport retry: only for a request that produced NO judgment.
  while (attempts < 2) {
    attempts += 1;
    try {
      const res = await doFetch();
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      if (res.ok && json) {
        return {
          answers: json.answers ?? json,
          usage: json.usage ?? null,
          model: json.model ?? model,
          attempts,
          error: null,
        };
      }
      lastError = `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`;
      if (res.status !== 429 && res.status < 500) break; // refusal: do not retry
    } catch (err) {
      lastError = `network: ${err.message}`;
    }
  }
  return {
    answers: null,
    usage: null,
    model: null,
    attempts,
    error: lastError,
  };
}

// ── driver ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = {
    smoke: 0,
    limit: 0,
    out: DEFAULT_OUT,
    costCap: DEFAULT_COST_CAP_USD,
    concurrency: CONCURRENCY,
    csvOnly: false,
    model: PRIMARY_MODEL,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--smoke") opts.smoke = Number(argv[++i]) || 2;
    else if (a === "--limit") opts.limit = Number(argv[++i]) || 0;
    else if (a === "--out") opts.out = argv[++i];
    else if (a === "--cost-cap") opts.costCap = Number(argv[++i]);
    else if (a === "--concurrency") opts.concurrency = Number(argv[++i]) || 1;
    else if (a === "--csv-only") opts.csvOnly = true;
    else {
      process.stderr.write(`jev-battery-rerun: unknown argument ${a}\n`);
      process.exit(2);
    }
  }
  return opts;
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function pool(tasks, width) {
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const idx = next;
      next += 1;
      results[idx] = await tasks[idx]();
    }
  }
  await Promise.all(Array.from({ length: width }, worker));
  return results;
}

function csvCell(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvRows(header, rows) {
  return (
    [header.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join(
      "\n",
    ) + "\n"
  );
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const repoRoot = resolve(process.cwd());
  const outDir = resolve(repoRoot, opts.out);
  const rawPath = join(outDir, "raw-results.jsonl");

  if (opts.csvOnly) {
    buildCsvs(outDir, rawPath);
    return;
  }

  const keys = resolveKeys(repoRoot);
  if (!keys.typesafeKey) {
    process.stderr.write(
      "jev-battery-rerun: no Jev key resolved (TYPESAFE_API_KEY / HARNESS_JEV_KEY / JEV_API_KEY in env, .env, or ~/.config/harness/jev.env)\n",
    );
    process.exit(2);
  }
  process.stdout.write(
    `key: resolved (${String(keys.typesafeKey).length} chars)\n`,
  );

  mkdirSync(outDir, { recursive: true });
  const files = trackedSources();
  const tested = testIndex();
  let fns = [];
  for (const f of files) {
    fns = fns.concat(extractFunctions(readFileSync(f, "utf8"), f));
  }
  for (const fn of fns) fn.name_in_tests = tested.has(fn.name);
  if (opts.smoke || opts.limit) fns = fns.slice(0, opts.smoke || opts.limit);
  process.stdout.write(
    `population: ${fns.length} functions from ${files.length} files\n`,
  );

  let model = opts.model;
  let spent = 0;
  let modelRefused = false;
  const meter = (usage, fallbackBytes) => {
    const tokens =
      usage && Number(usage.input_tokens) > 0
        ? Number(usage.input_tokens)
        : Math.ceil(fallbackBytes / 4);
    spent += jevCostUsd(tokens);
    return tokens;
  };

  const batches = chunk(fns, BATCH);
  const pass1 = await pool(
    batches.map((batch, b) => async () => {
      if (spent >= opts.costCap) return { skipped: true, batch };
      const state = stateText(batch);
      const questions = questionsFor(batch);
      let r = await callJudge(state, questions, keys, model);
      if (
        r.error &&
        r.error.startsWith("HTTP 4") &&
        model !== FALLBACK_MODEL &&
        !modelRefused
      ) {
        // the pin was refused: record it and ask the alias once
        modelRefused = true;
        model = FALLBACK_MODEL;
        r = await callJudge(state, questions, keys, model);
      }
      const tokens = meter(
        r.usage,
        state.length + JSON.stringify(questions).length,
      );
      const row = {
        pass: 1,
        batch: b,
        model: r.model,
        attempts: r.attempts,
        tokens,
        error: r.error,
        functions: batch.map((fn) => ({
          file: fn.file,
          line: fn.line,
          name: fn.name,
          kind: fn.kind,
          name_in_tests: fn.name_in_tests,
        })),
        answers: r.answers,
      };
      appendFileSync(rawPath, JSON.stringify(row) + "\n");
      process.stdout.write(
        `pass1 batch ${b + 1}/${batches.length} ${batch.map((f) => f.name).join(",")} -> ${r.error ? `ERR ${r.error}` : "ok"} (spent $${spent.toFixed(6)})\n`,
      );
      return row;
    }),
    opts.concurrency,
  );

  // PASS 2 — disposition only what pass 1 flagged fail-open (normalized < 0.5)
  const flagged = [];
  for (const row of pass1) {
    if (!row || row.skipped || !row.answers) continue;
    row.functions.forEach((fn, i) => {
      const a = readAnswer(row.answers[`f${i}_fail_closed`]);
      if (a.kind === "score" && a.score / 3 < 0.5) flagged.push(fn);
    });
  }
  process.stdout.write(
    `pass2: ${flagged.length} fail-open functions to disposition\n`,
  );
  const batches2 = chunk(flagged, BATCH);
  await pool(
    batches2.map((batch, b) => async () => {
      if (spent >= opts.costCap) return null;
      const state = stateText(batch);
      const questions = verdictQuestionFor(batch);
      const r = await callJudge(state, questions, keys, model);
      const tokens = meter(
        r.usage,
        state.length + JSON.stringify(questions).length,
      );
      appendFileSync(
        rawPath,
        JSON.stringify({
          pass: 2,
          batch: b,
          model: r.model,
          attempts: r.attempts,
          tokens,
          error: r.error,
          functions: batch.map((fn) => ({
            file: fn.file,
            line: fn.line,
            name: fn.name,
            name_in_tests: fn.name_in_tests,
          })),
          answers: r.answers,
        }) + "\n",
      );
      process.stdout.write(
        `pass2 batch ${b + 1}/${batches2.length} -> ${r.error ? `ERR ${r.error}` : "ok"} (spent $${spent.toFixed(6)})\n`,
      );
      return null;
    }),
    opts.concurrency,
  );

  const summary = {
    run_class: "battery-rerun",
    authorized: "owner, 2026-10-25 (~US$0.01)",
    rubric: "frozen in scripts/jev-battery-rerun.mjs before the first call",
    requested_model: opts.model,
    model_refused_fell_back: modelRefused,
    extraction:
      "brace/regex heuristic over tracked .js/.mjs in assets/js, worker, scripts, tests — counts differ from the historical tree-sitter extraction and are this run's own",
    population: fns.length,
    fail_open_flagged: flagged.length,
    cost_usd: Number(spent.toFixed(8)),
    cost_cap_usd: opts.costCap,
    out: opts.out,
  };
  writeFileSync(
    join(outDir, "summary.json"),
    JSON.stringify(summary, null, 2) + "\n",
  );
  buildCsvs(outDir, rawPath);
  process.stdout.write(`done. spent $${spent.toFixed(6)}, out: ${opts.out}\n`);
}

function buildCsvs(outDir, rawPath) {
  const rows = readFileSync(rawPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const p1 = rows.filter((r) => r.pass === 1 && r.answers);
  const p2 = rows.filter((r) => r.pass === 2 && r.answers);
  const verdicts = new Map();
  for (const r of p2) {
    r.functions.forEach((fn, i) => {
      const a = readAnswer(r.answers[`f${i}_verdict`]);
      verdicts.set(`${fn.file}:${fn.line}`, {
        verdict: a.kind === "choice" ? a.choice : a.kind,
        confidence: a.confidence ?? null,
      });
    });
  }
  const all = [];
  for (const r of p1) {
    r.functions.forEach((fn, i) => {
      const fc = readAnswer(r.answers[`f${i}_fail_closed`]);
      const bl = readAnswer(r.answers[`f${i}_blast`]);
      const md = readAnswer(r.answers[`f${i}_mode`]);
      const cv = readAnswer(r.answers[`f${i}_covered`]);
      const st = readAnswer(r.answers[`f${i}_strategy`]);
      const pr = readAnswer(r.answers[`f${i}_priority`]);
      const v = verdicts.get(`${fn.file}:${fn.line}`) ?? {};
      all.push({
        ...fn,
        fail_closed_score: fc.kind === "score" ? fc.score : null,
        fail_closed:
          fc.kind === "score" ? Number((fc.score / 3).toFixed(3)) : null,
        blast_radius: bl.kind === "score" ? bl.score : null,
        failure_mode: md.kind === "choice" ? md.choice : md.kind,
        test_coverage: cv.kind === "choice" ? cv.choice : cv.kind,
        strategy: st.kind === "choice" ? st.choice : st.kind,
        test_priority: pr.kind === "score" ? pr.score : null,
        verdict: v.verdict ?? "",
        verdict_confidence: v.confidence ?? "",
        judge_model: r.model,
      });
    });
  }
  const H = [
    "file",
    "line",
    "name",
    "kind",
    "fail_closed_score",
    "fail_closed",
    "blast_radius",
    "failure_mode",
    "test_coverage",
    "strategy",
    "test_priority",
    "name_in_tests",
    "verdict",
    "verdict_confidence",
    "judge_model",
  ];
  writeFileSync(
    join(outDir, "battery-security.csv"),
    csvRows(
      H,
      all
        .slice()
        .sort((a, b) => (b.blast_radius ?? -1) - (a.blast_radius ?? -1))
        .map((r) => H.map((h) => r[h])),
    ),
  );
  writeFileSync(
    join(outDir, "battery-testplan.csv"),
    csvRows(
      [
        "file",
        "line",
        "name",
        "test_priority",
        "strategy",
        "test_coverage",
        "name_in_tests",
        "judge_model",
      ],
      all
        .filter((r) => !r.name_in_tests)
        .sort((a, b) => (b.test_priority ?? -1) - (a.test_priority ?? -1))
        .map((r) => [
          r.file,
          r.line,
          r.name,
          r.test_priority,
          r.strategy,
          r.test_coverage,
          r.name_in_tests,
          r.judge_model,
        ]),
    ),
  );
  writeFileSync(
    join(outDir, "battery-dispositions.csv"),
    csvRows(
      [
        "file",
        "line",
        "name",
        "fail_closed",
        "blast_radius",
        "failure_mode",
        "verdict",
        "verdict_confidence",
        "judge_model",
      ],
      all
        .filter((r) => r.verdict)
        .sort((a, b) => (b.blast_radius ?? -1) - (a.blast_radius ?? -1))
        .map((r) => [
          r.file,
          r.line,
          r.name,
          r.fail_closed,
          r.blast_radius,
          r.failure_mode,
          r.verdict,
          r.verdict_confidence,
          r.judge_model,
        ]),
    ),
  );
  process.stdout.write(
    `csvs rebuilt in ${outDir} (${all.length} judged functions)\n`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((err) => {
    process.stderr.write(`jev-battery-rerun: ${err.stack || err}\n`);
    process.exit(1);
  });
}
