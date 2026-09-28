#!/usr/bin/env node
// Plan §8 P0.4 / F-38: the no-browser CI job that keeps the committed
// quality-pass evidence honest.
//
//   node scripts/validate-quality-evidence.mjs [--json] [--now ISO]
//
// The heavy gates (Lighthouse, axe-core over the Q-07 matrix, cross-browser
// smoke, visual regression) run locally because CI has no browsers and a free
// account should not pay that wall-clock. This is the part that still runs on
// every PR: it reads the evidence files the repository committed and asserts
// their schema, their thresholds, and their freshness.
//
// The reasoning for every decision that is not obvious — including why a
// missing file is a printed gap rather than a failure — lives with the logic
// in scripts/lib/quality-evidence.mjs. This file is only the I/O around it.
//
// Exit codes:
//   0  every committed evidence file holds its schema, its thresholds and its
//      freshness window (gaps may be printed; see the lib for why)
//   1  a committed evidence file is malformed, stale, or over a blocking bar
//   2  usage error, or a committed file could not be parsed as JSON
import { readFileSync } from "node:fs";

import {
  EVIDENCE_REGISTRY,
  validateEvidence,
} from "./lib/quality-evidence.mjs";

const argv = process.argv.slice(2);
const USAGE =
  "usage: node scripts/validate-quality-evidence.mjs [--json] [--now ISO]";

if (argv.includes("--help") || argv.includes("-h")) {
  console.log(USAGE);
  process.exit(0);
}
if (
  argv.some(
    (a) =>
      ![
        "--json",
        "--now",
        ...argv.filter((x, i) => argv[i - 1] === "--now"),
      ].includes(a),
  )
) {
  console.error(USAGE);
  process.exit(2);
}

const nowIdx = argv.indexOf("--now");
const now = nowIdx === -1 ? new Date().toISOString() : argv[nowIdx + 1];
if (!Number.isFinite(Date.parse(now))) {
  console.error(
    `validate-quality-evidence: --now is not an ISO timestamp: ${now}`,
  );
  process.exit(2);
}

// Read every declared evidence file. A file that is not committed is recorded
// as `null` and handled by the lib as a gap, so "absent" and "present but
// broken" stay distinguishable all the way to the report.
const docs = {};
const unreadable = [];
for (const entry of EVIDENCE_REGISTRY) {
  let raw;
  try {
    raw = readFileSync(entry.file, "utf8");
  } catch {
    docs[entry.metric] = null;
    continue;
  }
  try {
    docs[entry.metric] = JSON.parse(raw);
  } catch (err) {
    unreadable.push(
      `${entry.metric}: ${entry.file} is not valid JSON (${err.message})`,
    );
    docs[entry.metric] = null;
  }
}

const { ok, problems, gaps } = validateEvidence(EVIDENCE_REGISTRY, docs, {
  now,
});
const all = [...unreadable, ...problems];

if (argv.includes("--json")) {
  console.log(
    JSON.stringify({ ok: all.length === 0, problems: all, gaps }, null, 2),
  );
  process.exit(all.length === 0 ? 0 : 1);
}

for (const entry of EVIDENCE_REGISTRY) {
  const committed =
    docs[entry.metric] !== null && docs[entry.metric] !== undefined;
  console.log(
    `  ${committed ? "committed" : "gap      "}  ${entry.metric.padEnd(15)} ${entry.q_metric}  ${entry.file}`,
  );
}

if (all.length === 0) {
  console.log(
    `\nQUALITY EVIDENCE OK: ${EVIDENCE_REGISTRY.length} declared, committed evidence is current.`,
  );
  if (gaps.length > 0) {
    console.log(
      `\nP0.4 still owes these gates (not a failure; the exit evidence is the baseline ledger row):`,
    );
    for (const gap of gaps) console.log(`  - ${gap}`);
  }
  process.exit(0);
}

console.error(`\nQUALITY EVIDENCE FAILED: ${all.length} problem(s).`);
for (const problem of all) console.error(`  - ${problem}`);
process.exit(1);
