#!/usr/bin/env node
// The adversarial pass over the delivery path, measured through the real page.
//
//   node scripts/check-resilience.mjs [--stage DIR] [--out FILE] [--only STAGE]
//
// WHY THIS IS A SEPARATE GATE AND NOT A SECTION OF ANOTHER ONE. The `resilience`
// facet was carried for a whole cycle by a prose line describing intent —
// retries, timeouts, fallbacks, a deadline — and not one of those mechanisms had
// ever been made to fail on purpose. A guard that reports resilience it has not
// exercised is a comment with an exit code, and this repo has spent a cycle
// removing exactly those. So this gate drives the failures and reads what
// happens.
//
// It stages the SAME allowlisted artifact the deploy workflows publish and serves
// it under the real `_headers` policy, so the thing measured is the thing that
// ships. It drives the installed Chrome/Edge over CDP like every other flow in
// scripts/smoke/, and takes no dependency the repo does not already have.
//
// WHAT IT CLAIMS, AND WHAT IT DELIBERATELY DOES NOT. Transport-failure
// classification and the stuck-run deadline are OBSERVED: the failures are
// injected at the network layer and the page is watched. The inner/outer timeout
// arithmetic is a SOURCE-LEVEL invariant over the constants the modules export,
// because the 45s weather abort is armed inside the sizing worker's realm and no
// page-realm shim can reach it. Both kinds are reported as what they are; see
// RESILIENCE_SCOPE_LIMIT, which travels in the report and near the facet line.
//
// FAILURE POLICY. A measured defect exits non-zero. So does a stage that did not
// run, or ran and matched nothing: an unexercised path is a hole, never a pass.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { ROOT, serveStatic } from "./serve-static.mjs";
import { start } from "./smoke/runtime.mjs";
import {
  runShareRestore,
  runStaleInputs,
  runStuckRunRecovery,
  runTransportClassification,
} from "./smoke/resilience.mjs";
import { jevHealthAtDocumentStart } from "./smoke/jev.js";
import { RUN_REPLY_DEADLINE_MS } from "../assets/js/sizing/run-coordinator.js";
import {
  BUDGET_FITS,
  RESILIENCE_EXPECTATIONS,
  RESILIENCE_FACET_AXES,
  RESILIENCE_SCOPE_LIMIT,
  TIMEOUT_GRAPH,
  composeResilienceFacetLine,
  evaluateBudgetFits,
  evaluateResilience,
  readTimeoutGraph,
} from "./lib/resilience-budgets.mjs";
import { COMPLETE_FACET_CLIP } from "./lib/jev-complete.mjs";

const argv = process.argv.slice(2);
const opts = { stage: "_pages_resilience", out: null, only: null };
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--stage") opts.stage = argv[++i];
  else if (argv[i] === "--out") opts.out = argv[++i];
  else if (argv[i] === "--only") opts.only = argv[++i];
  else {
    console.error(
      "usage: node scripts/check-resilience.mjs [--stage DIR] [--out FILE] [--only STAGE]",
    );
    process.exit(2);
  }
}
if (!existsSync(resolve(opts.stage))) {
  console.error(`check-resilience: no staged build at ${opts.stage}`);
  process.exit(2);
}

function codeSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

let failures = 0;
const ok = (m) => console.log(`OK   ${m}`);
const fail = (m) => {
  failures += 1;
  console.error(`FAIL ${m}`);
};

// ── 1. the timeout graph, read live from the shipped modules ────────────────
const graph = await readTimeoutGraph();
const budget = evaluateBudgetFits(graph, BUDGET_FITS);
if (budget.failures.length === 0)
  ok(
    `budget: ${budget.checked.length} inner/outer fit(s) hold ` +
      `(tightest ${Math.round(Math.min(...budget.checked.map((c) => c.slack_ms)) / 1000)}s of slack)`,
  );
for (const f of budget.failures) fail(`budget: ${f.message}`);
for (const c of budget.checked)
  console.log(
    `     ${c.id}: ${c.worst_ms}ms worst case inside a ${c.cap_ms}ms cap ` +
      `(slack ${c.slack_ms}ms)`,
  );

// ── 2. the browser stages ───────────────────────────────────────────────────
const srv = await serveStatic({ dir: resolve(opts.stage) });
console.log(
  `RESILIENCE staged build served at ${srv.url} (with _headers policy)`,
);

const wants = (name) => !opts.only || opts.only === name;
let ctx = null;
const reading = { budget_fits: budget };
try {
  ctx = await start();
  await ctx.send("Page.enable");
  await ctx.send("Runtime.enable");
  await ctx.send("Log.enable");
  // The Jev stub is installed at document start for every load the stages make,
  // so a stage is never measuring the third-party probe instead of the product.
  await ctx.send("Page.addScriptToEvaluateOnNewDocument", {
    source: jevHealthAtDocumentStart,
  });
  await ctx.send("Page.navigate", { url: srv.url });
  await new Promise((r) => setTimeout(r, 8000));

  if (wants("transport"))
    reading.transport = await runTransportClassification(ctx);
  if (wants("stuck"))
    reading.stuck_run = await runStuckRunRecovery(ctx, {
      runDeadlineMs: RUN_REPLY_DEADLINE_MS,
    });
  if (wants("stale")) reading.stale_inputs = await runStaleInputs(ctx);
  if (wants("share")) reading.share_restore = await runShareRestore(ctx);
} catch (err) {
  // A browser that could not be driven is a hole, not a pass. It is recorded as
  // a reading so the evaluator below rules on its absence and the gate says so
  // rather than exiting quietly green.
  reading.driver_error = String(err?.message || err);
} finally {
  await ctx?.close().catch(() => {});
  await srv.close();
}

// ── 3. rule the reading ─────────────────────────────────────────────────────
const verdict = evaluateResilience(reading);
for (const n of verdict.notes) console.log(`     ${n}`);
for (const h of verdict.holes) fail(`hole: ${h.what}: ${h.why}`);
for (const r of verdict.regressions) fail(`regression: ${r.message}`);
if (reading.driver_error)
  fail(`the browser could not be driven: ${reading.driver_error}`);

// ── 4. the report, with the facet line composed from THIS run ───────────────
const report = {
  plan_item: "P0.4",
  metric: "resilience",
  generated_at: new Date().toISOString(),
  code_sha: codeSha(),
  // Declared by the gate that measured them, so the evidence builder discovers
  // which axes this report speaks for instead of holding a list of gate names
  // beside it. One owner per axis: the builder OVERWRITES
  // prose.facet_evidence[axis], so a second resilience gate would not add a
  // proof line, it would delete this one.
  facet_axes: RESILIENCE_FACET_AXES,
  unit: "browser-observed stage outcomes plus source-level timeout arithmetic, on the staged build",
  stage: opts.stage,
  timeout_graph: graph,
  budget_fits: budget,
  expectations: RESILIENCE_EXPECTATIONS,
  recorded_graph: TIMEOUT_GRAPH,
  resilience_reading: reading,
  regressions: verdict.regressions,
  holes: verdict.holes,
  notes: verdict.notes,
  scope_limit: RESILIENCE_SCOPE_LIMIT,
  enforcement:
    "blocking from P0: a measured defect, a stage that did not run, a stage " +
    "that ran and intercepted nothing, and an inner budget that does not fit " +
    "its outer cap",
};

// The line is composed from the run, so the numbers the judge reads and the
// numbers in this report cannot drift apart — the defect a hand-typed line in
// the prose file was.
report.facet_line = composeResilienceFacetLine(report) || "";
if (report.facet_line.length > COMPLETE_FACET_CLIP) {
  fail(
    `the composed facet line is ${report.facet_line.length} chars, over the ` +
      `${COMPLETE_FACET_CLIP}-char clip. It would be cut in transit and the ` +
      "limit half of the claim is exactly what gets cut. Shorten the clause; " +
      "do not raise the clip.",
  );
} else if (report.facet_line)
  console.log(
    `facet line (${report.facet_line.length} chars):\n  ${report.facet_line}`,
  );
else
  fail(
    "no facet line could be composed: the adversarial pass measured nothing, " +
      "so the axis has no proof line from this run",
  );

if (opts.out) {
  mkdirSync(dirname(opts.out), { recursive: true });
  writeFileSync(opts.out, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`\nreport written: ${opts.out}`);
}

console.log(
  `\nresilience: ${verdict.regressions.length} regression(s), ` +
    `${verdict.holes.length} hole(s), ${budget.failures.length} budget failure(s)`,
);
console.log(RESILIENCE_SCOPE_LIMIT);
process.exit(failures ? 1 : 0);
