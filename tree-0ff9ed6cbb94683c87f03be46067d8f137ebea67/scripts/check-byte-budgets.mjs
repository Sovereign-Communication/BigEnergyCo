#!/usr/bin/env node
// Plan §8 P0.4 / §3.1: measure the compressed byte and request budgets on the
// staged build and ratchet them against the baseline the ledger declares.
//
//   node scripts/check-byte-budgets.mjs [--stage DIR] [--ledger FILE] [--out FILE]
//
// Defaults: --stage _pages_staging (what `npm run deploy:check` produces),
// --ledger docs/plan/LEDGER.jsonl, --out none.
//
// P0.4 RATCHETS. §3.2 makes these gates regression-blocking from P0 and
// absolute only from P6 (/next/) and P8 (all), so a reading that is already
// over its limit is printed as a breach and does not fail the run; only getting
// WORSE against the declared baseline does. That is the whole point of P0.4's
// exit evidence: it records where the build stands today, breach and all.
//
// Exit codes:
//   0  no budget regressed against the declared baseline
//   1  a budget regressed; every reading is still printed and written out
//   2  usage error, or the staged build / ledger could not be read
//
// WHY THE ENFORCEMENT RULE IS NOW PRINTED, AND WHY IT IS ONE CONSTANT. The
// `breach` tag in the verdict column is deliberate (see `verdictOf` below), but
// a reader of the TERMINAL had no way to learn what produced it: the run printed
// `breach` on two budgets, exited 0, and said "no regression against the
// declared baseline", with the rule that makes a breach non-blocking written
// only in the report JSON. Three budgets were over the table's §3.1 figures
// when P0.4 measured them — `registry_country` by 12x — and A-002 (owner-
// approved 2026-09-29) moved the REPORTED line to shipped +10 % for those
// three, so an over-limit reading today means worse than what shipped at the
// amendment. A bare "breach" next to a green run is exactly
// the reading this gate's own header warns against. `scripts/check-lighthouse.mjs`
// already does the honest version in its human output ("N Q-02 breaches
// (non-blocking until P5/P8)"). One constant, used by the JSON and the terminal,
// so the two can never disagree about which rule is in force.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  BYTE_BUDGET_FACET_AXES,
  compareToBaseline,
  composeQualityFacetLine,
  formatReading,
  measureStagedBuild,
  QUALITY_SIZE_CLAUSE_MAX,
  readByteBudgetBaseline,
  REGRESSION_TOLERANCE_BYTES,
} from "./lib/byte-budgets.mjs";
import { exitWhenDrained } from "./lib/graceful-exit.mjs";

/** The tree this report describes, so committed evidence can be matched to a
 *  commit and judged for freshness. */
function codeSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

const USAGE =
  "usage: node scripts/check-byte-budgets.mjs [--stage DIR] [--ledger FILE] [--out FILE]";

// One owner for the rule, so the report and the terminal cannot disagree about
// which bar is in force. §3.2 is the citation; the human-readable half is what
// the terminal prints.
const ENFORCEMENT =
  "regression-blocking from P0 (plan §3.2); absolute from P6 (/next/) and P8 (all)";
const ABSOLUTE_BINDS_FROM = "P6 (/next/) and P8 (all)";

/** A budget's limit, formatted the way its unit reads. */
export function limitOf(m) {
  return m.unit === "count"
    ? `${m.limit} req`
    : formatReading(m.limit, "bytes");
}

/** The rule that judges the verdict column, on the terminal as well as in JSON. */
export function enforcementLine() {
  return `enforcement: ${ENFORCEMENT}\n`;
}

/** Every budget over the plan's §3.1 limit, whether or not it blocks. */
export function overLimitMetrics(metrics) {
  return Object.entries(metrics).filter(
    ([, m]) => typeof m.value === "number" && m.value > m.limit,
  );
}

/**
 * THE BREACHES, AS RECORDS. The one computation of "which budgets are over the
 * plan's §3.1 limit", and both consumers of it come from here: the terminal
 * below and the `breaches` array the report writes.
 *
 * The artifact used to carry a hardcoded `breaches: []` while the same run
 * printed three over-limit budgets on the terminal. That is the worst version of
 * the defect this gate was fixed for: the JSON is what a downstream consumer
 * reads, `.quality-evidence/byte-budgets.json` is what
 * `scripts/lib/quality-evidence.mjs` validates as current evidence, and
 * `breaches` is a field that registry REQUIRES to be an array. A required field
 * that is always empty is a required field that asserts nothing.
 *
 * The shape follows `compareToBaseline` in scripts/lib/byte-budgets.mjs, which
 * is what the sibling `regressions` / `improvements` / `unmeasured` arrays
 * already use in this same report: `metric`, the numbers, and a `message` in
 * the gate's own voice. Nothing here is invented — every field is a value the
 * measurement already produced.
 */
export function breachesOf(metrics) {
  return overLimitMetrics(metrics).map(([metric, m]) => ({
    metric,
    value: m.value,
    limit: m.limit,
    unit: m.unit,
    message: `${metric}: ${formatReading(m.value, m.unit)} > ${limitOf(m)}`,
  }));
}

/**
 * The over-limit budgets, each named with its reading and its limit, under a
 * heading that says the limit is not yet a bar and when it becomes one. Empty
 * string when nothing is over, so a clean run says nothing about breaches.
 *
 * Its own section rather than a tag in the verdict column, because the verdict
 * column answers "did this get worse" and this answers "is this over the
 * plan's number" — two different rules, and a reader who cannot tell which one
 * produced a `breach` is reading neither.
 *
 * Rendered from `breachesOf`, so a line on the terminal and a row in the report
 * cannot disagree: they are the same `message`.
 */
export function breachSection(metrics) {
  const over = breachesOf(metrics);
  if (!over.length) return "";
  const lines = [
    // "over the plan's limit" is the phrase tests/byte-budgets.test.mjs has
    // always asserted for this, and it is the better one: the limit is the
    // plan's, the regression is the baseline's, and the two are different bars.
    `\nover the plan's limit (plan §3.1; reported, not blocking until ${ABSOLUTE_BINDS_FROM}):\n`,
  ];
  for (const b of over) lines.push(`  ${b.message}\n`);
  return lines.join("");
}

// The staged build, described the way the module wants it: a list of posix
// relative paths and a reader. Skipped: symlinks and anything unreadable, which
// is what `deploy:check` stages out of the way in the first place.
function stagedTree(dir) {
  const files = [];
  const walk = (rel) => {
    for (const entry of readdirSync(join(dir, rel), { withFileTypes: true })) {
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile()) files.push(child);
    }
  };
  walk("");
  return {
    files: files.sort(),
    read: (rel) => readFileSync(join(dir, rel)),
  };
}

function pad(text, width) {
  return String(text).padEnd(width);
}

const FLAGS = { "--stage": "stage", "--ledger": "ledger", "--out": "out" };

function parseArgs(argv) {
  const opts = {
    stage: "_pages_staging",
    ledger: join("docs", "plan", "LEDGER.jsonl"),
    out: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      process.stdout.write(`${USAGE}\n`);
      return null;
    }
    const key = FLAGS[arg];
    if (!key) {
      process.stderr.write(
        `check-byte-budgets: unknown argument ${arg}\n${USAGE}\n`,
      );
      process.exit(2);
    }
    // A bare flag with no value must name itself, not surface later as a
    // missing directory.
    const value = argv[++i];
    if (value === undefined || value.startsWith("--")) {
      process.stderr.write(
        `check-byte-budgets: ${arg} requires a value\n${USAGE}\n`,
      );
      process.exit(2);
    }
    opts[key] = value;
  }
  return opts;
}

export function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  if (!opts) return 0;

  const stage = resolve(opts.stage);
  if (!existsSync(stage)) {
    process.stderr.write(
      `check-byte-budgets: no staged build at ${opts.stage} — run \`npm run deploy:check\` first\n`,
    );
    return 2;
  }
  if (!existsSync(join(stage, "index.html"))) {
    process.stderr.write(
      `check-byte-budgets: ${opts.stage} has no index.html, so it is not a staged build\n`,
    );
    return 2;
  }
  if (!existsSync(opts.ledger)) {
    process.stderr.write(
      `check-byte-budgets: no ledger at ${opts.ledger}; the declared baseline lives there\n`,
    );
    return 2;
  }

  const tree = stagedTree(stage);
  const { metrics } = measureStagedBuild(tree);
  const baseline = readByteBudgetBaseline(readFileSync(opts.ledger, "utf8"));
  const { regressions, improvements, unmeasured } = compareToBaseline(
    metrics,
    baseline.metrics,
  );

  // More than one tag can be true of a budget at once, and dropping any of them
  // loses something: a metric can be over the plan's limit AND unmeasured
  // against no bar. A verdict column that printed "ok" beside a 3.3x breach is
  // how a breach stops being read, so the tags accumulate and "ok" means what
  // it says — within the limit, and not moved.
  const verdictOf = (name) => {
    const m = metrics[name];
    const tags = [];
    if (regressions.some((r) => r.metric === name)) tags.push("REGRESSION");
    if (typeof m.value === "number" && m.value > m.limit) tags.push("breach");
    if (unmeasured.some((u) => u.metric === name)) tags.push("unmeasured");
    if (improvements.some((i) => i.metric === name)) tags.push("improved");
    return tags.length ? tags.join("+") : "ok";
  };

  // One computation, three consumers: the `breach` tag above, the breach section
  // on the terminal, and the `breaches` array in the report. A budget over the
  // plan's limit is the same fact in all three.
  const breaches = breachesOf(metrics);

  const out = process.stdout;
  out.write(
    `byte budgets (plan §3.1) — stage ${opts.stage}, ${tree.files.length} files, brotli q11\n`,
  );
  out.write(
    `baseline: ${
      baseline.source
        ? `${baseline.source} (ledger ${opts.ledger})`
        : `NONE DECLARED — every budget is unmeasured (ledger ${opts.ledger})`
    }\n`,
  );
  // The rule that judges the two columns above, stated where a reader sees it.
  out.write(`${enforcementLine()}\n`);
  out.write(
    `${pad("budget", 30)}${pad("measured", 12)}${pad("limit", 10)}verdict\n`,
  );
  for (const [name, m] of Object.entries(metrics)) {
    out.write(
      `${pad(name, 30)}${pad(formatReading(m.value, m.unit), 12)}${pad(limitOf(m), 10)}${verdictOf(name)}\n`,
    );
  }
  if (improvements.length) {
    out.write(`\nimproved: ${improvements.map((i) => i.message).join("; ")}\n`);
  }
  if (unmeasured.length) {
    const metricsByName = Object.fromEntries(
      Object.entries(metrics).map(([n, m]) => [n, m]),
    );
    out.write(
      `\nunmeasured (${unmeasured.length}): ${unmeasured
        .map(
          (u) =>
            `${u.metric}=${formatReading(u.value, metricsByName[u.metric]?.unit || "bytes")} (${u.reason})`,
        )
        .join(", ")}\n`,
    );
  }
  for (const note of baseline.skipped) {
    process.stderr.write(`check-byte-budgets: ledger ${note}\n`);
  }

  const report = {
    plan_item: "P0.4",
    plan_ref: "docs/plan/MASTER_PLAN.md §3.1, §3.2, §8 P0.4",
    // The name the no-browser validator looks this report up by, and when the
    // run happened and which tree it measured. Without the two timestamps a
    // committed report cannot be checked for being current, which is the whole
    // reason the validator exists (scripts/lib/quality-evidence.mjs).
    metric: "byte_budgets",
    generated_at: new Date().toISOString(),
    code_sha: codeSha(),
    stage: opts.stage,
    ledger: opts.ledger,
    baseline_ref: baseline.source,
    tolerance_bytes: REGRESSION_TOLERANCE_BYTES,
    enforcement: ENFORCEMENT,
    metrics,
    regressions,
    improvements,
    unmeasured,
    breaches,
    ledger_notes: baseline.skipped,
    // Which facet axis this report IS the evidence for, declared by the gate
    // that measured it, and the line composed from THIS run's reading. The
    // judge's evidence builder discovers `facet_axes` inside whatever report it
    // finds in the artifacts directory — the same derivation the Lighthouse and
    // a11y-controls reports already use — so the `quality` proof line and the
    // numbers behind it cannot drift apart, and a run that measured no budgets
    // says so instead of leaving a typed claim standing. See
    // `composeQualityFacetLine` in scripts/lib/byte-budgets.mjs for what the
    // line says, what it refuses to claim, and why it fits the per-axis clip by
    // construction rather than by trimming.
    facet_axes: BYTE_BUDGET_FACET_AXES,
  };
  // Composed HERE, from this run, exactly as the Lighthouse gate does it.
  report.facet_line = composeQualityFacetLine(report);
  out.write(
    `\nfacet line (${report.facet_line.length} chars):\n  ${report.facet_line}\n`,
  );
  if (opts.out)
    writeFileSync(opts.out, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  out.write(`\nreport: ${opts.out || "not written (pass --out FILE)"}\n`);
  // The clause is HALF of the `quality` axis — the shipped-size half — and its
  // budget is smaller than the transport clip because the builder appends the
  // clarity clause the required test job's own steps support
  // (`composeQualityContractClause`). A clause over this budget would push the
  // JOIN over the clip, and an over-long line is silently cut on its way to the
  // judge: a red gate with the clause printed beats a green one whose claim
  // quietly lost its numbers. The clause is bounded by construction, so this is
  // a backstop and not a trimmer.
  if (report.facet_line.length > QUALITY_SIZE_CLAUSE_MAX) {
    process.stderr.write(
      `check-byte-budgets: facet clause is ${report.facet_line.length} chars, ` +
        `over the ${QUALITY_SIZE_CLAUSE_MAX}-char budget for the size half of the ` +
        "`quality` axis; the clarity clause the builder appends has to fit " +
        "beside it. Shorten a phrase in composeQualityFacetLine rather than " +
        "raising the budget.\n",
    );
    return 1;
  }

  if (regressions.length) {
    process.stderr.write(
      `check-byte-budgets: ${regressions.length} byte-budget regression(s) against the ` +
        `declared baseline:\n${regressions.map((r) => `  - ${r.message}`).join("\n")}\n`,
    );
  }
  // What the run was judged on, and what it merely reported. Lighthouse's shape:
  // the count, and the phase at which the limit starts to block.
  out.write(breachSection(metrics));
  if (regressions.length) return 1;
  out.write(
    `no regression against the declared baseline (${regressions.length} regressions, ` +
      `${improvements.length} improvements, ${unmeasured.length} unmeasured, ` +
      `${breaches.length} over the §3.1 limit)\n`,
  );
  return 0;
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  try {
    exitWhenDrained(main());
  } catch (err) {
    process.stderr.write(`check-byte-budgets: ${err.message}\n`);
    exitWhenDrained(2);
  }
}
