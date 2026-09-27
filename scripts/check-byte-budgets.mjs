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
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  compareToBaseline,
  formatReading,
  measureStagedBuild,
  readByteBudgetBaseline,
  REGRESSION_TOLERANCE_BYTES,
} from "./lib/byte-budgets.mjs";
import { exitWhenDrained } from "./lib/graceful-exit.mjs";

const USAGE =
  "usage: node scripts/check-byte-budgets.mjs [--stage DIR] [--ledger FILE] [--out FILE]";

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

  const kb = (n) => formatReading(n, "bytes");
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

  const out = process.stdout;
  out.write(
    `byte budgets (plan §3.1) — stage ${opts.stage}, ${tree.files.length} files, brotli q11\n`,
  );
  out.write(
    `baseline: ${
      baseline.source
        ? `${baseline.source} (ledger ${opts.ledger})`
        : `NONE DECLARED — every budget is unmeasured (ledger ${opts.ledger})`
    }\n\n`,
  );
  out.write(
    `${pad("budget", 30)}${pad("measured", 12)}${pad("limit", 10)}verdict\n`,
  );
  for (const [name, m] of Object.entries(metrics)) {
    const limit = m.unit === "count" ? `${m.limit} req` : kb(m.limit);
    const over =
      typeof m.value === "number" && m.value > m.limit
        ? "  <- over the plan's limit"
        : "";
    out.write(
      `${pad(name, 30)}${pad(formatReading(m.value, m.unit), 12)}${pad(limit, 10)}${verdictOf(name)}${over}\n`,
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
    stage: opts.stage,
    ledger: opts.ledger,
    baseline_ref: baseline.source,
    tolerance_bytes: REGRESSION_TOLERANCE_BYTES,
    enforcement:
      "regression-blocking from P0 (plan §3.2); absolute from P6 (/next/) and P8 (all)",
    metrics,
    regressions,
    improvements,
    unmeasured,
    ledger_notes: baseline.skipped,
  };
  if (opts.out)
    writeFileSync(opts.out, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  out.write(`\nreport: ${opts.out || "not written (pass --out FILE)"}\n`);

  if (regressions.length) {
    process.stderr.write(
      `check-byte-budgets: ${regressions.length} byte-budget regression(s) against the ` +
        `declared baseline:\n${regressions.map((r) => `  - ${r.message}`).join("\n")}\n`,
    );
    return 1;
  }
  out.write(
    `no regression against the declared baseline (${regressions.length} regressions, ` +
      `${improvements.length} improvements, ${unmeasured.length} unmeasured)\n`,
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
