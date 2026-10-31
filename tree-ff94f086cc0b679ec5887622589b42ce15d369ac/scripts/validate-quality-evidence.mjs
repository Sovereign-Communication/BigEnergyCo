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
//
// WHAT IT NOW SAYS ABOUT `code_sha`. Every artifact records the commit it was
// measured against and every registry entry REQUIRES the field, but nothing
// read it: freshness was `generated_at` alone, which says how old a run is and
// nothing about which tree it measured. This report therefore also states the
// relationship, per artifact and in one sentence, because "committed evidence
// is current" is a claim about a tree and only the sha can support it.
//
// It states it and does not judge it. The evidence file is committed IN the
// commit that changes the tree, so its sha can never equal HEAD — a gate that
// demanded a match would be red on every PR by construction, which is noise.
// What a reader is owed is the plain relationship, so that is what is printed.
// The exit code and the registry's blocking rules are untouched.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

import {
  EVIDENCE_REGISTRY,
  currencySentence,
  describeCodeSha,
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

const { problems, gaps } = validateEvidence(EVIDENCE_REGISTRY, docs, {
  now,
});
const all = [...unreadable, ...problems];

// ── the tree each artifact says it measured ─────────────────────────────────
//
// One `git rev-parse` for the tree, then one ancestry test per artifact, and a
// count only where the ancestry test says the sha is one of our own commits. A
// sha this checkout does not have is `unknown`, not `foreign`: `fetch-depth: 1`
// is the default on actions/checkout, so in CI the commit most reports were
// measured against is simply not in the clone, and calling that "a different
// tree" would be a reading this report cannot support.
function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

let head = null;
try {
  head = git(["rev-parse", "HEAD"]).trim();
} catch {
  head = null; // not a checkout, or a repository with no commits yet
}

const cache = new Map();
function relationTo(sha) {
  if (cache.has(sha)) return cache.get(sha);
  const unknown = (reason) => ({ state: "unknown", head, reason });
  let result;
  if (!sha) {
    result = unknown("the artifact declares no commit");
  } else if (!head) {
    result = unknown("this checkout has no HEAD");
  } else if (sha === head) {
    result = { state: "head", head };
  } else {
    let isAncestor;
    let present = true;
    try {
      git(["merge-base", "--is-ancestor", sha, head]);
      isAncestor = true;
    } catch (err) {
      // Two different facts, and conflating them would be exactly the kind of
      // imprecision this report exists to remove. Exit 1: git found the commit
      // and answered no — it is a real commit, just not one this tree contains.
      // Anything else (128 and up): git could not find the object at all, which
      // is the `fetch-depth: 1` case, and guessing there would be inventing a
      // reading.
      isAncestor = false;
      present = err?.status === 1;
    }
    if (!isAncestor) {
      result = present
        ? { state: "foreign", head }
        : unknown("the commit is not in this checkout");
    } else {
      let count;
      try {
        const output = git(["rev-list", "--count", `${sha}..${head}`]).trim();
        if (!/^\d+$/.test(output))
          throw new Error("git returned no commit count");
        count = Number(output);
      } catch {
        result = unknown(
          "the commit distance cannot be counted from this checkout",
        );
        cache.set(sha, result);
        return result;
      }
      result =
        count === 0
          ? { state: "head", head }
          : { state: "behind", head, commits: count };
    }
  }
  cache.set(sha, result);
  return result;
}

const codeShas = EVIDENCE_REGISTRY.map((entry) => {
  const doc = docs[entry.metric];
  const sha = doc && typeof doc.code_sha === "string" ? doc.code_sha : null;
  const relation = relationTo(sha);
  return {
    metric: entry.metric,
    committed: doc !== null && doc !== undefined,
    code_sha: sha,
    relation,
    line: describeCodeSha(sha, relation),
  };
});

if (argv.includes("--json")) {
  console.log(
    JSON.stringify(
      {
        ok: all.length === 0,
        problems: all,
        gaps,
        head,
        code_sha: codeShas,
        currency: currencySentence(
          codeShas.filter((c) => c.committed).map((c) => c.relation),
        ),
      },
      null,
      2,
    ),
  );
  process.exit(all.length === 0 ? 0 : 1);
}

// The tree, once, so each artifact's line can speak about "this tree" without
// repeating two 40-character hashes six times.
if (head) console.log(`tree: ${head}\n`);

for (const entry of EVIDENCE_REGISTRY) {
  const committed =
    docs[entry.metric] !== null && docs[entry.metric] !== undefined;
  console.log(
    `  ${committed ? "committed" : "gap      "}  ${entry.metric.padEnd(15)} ${entry.q_metric}  ${entry.file}`,
  );
  // The relationship, on the artifact's own line, whether or not the run
  // passes. A file that is not committed has no tree to describe and the
  // listing above already says so.
  const sha = codeShas.find((c) => c.metric === entry.metric);
  if (committed && sha) {
    console.log(`  ${" ".repeat(10)}${sha.line}`);
  }
}

if (all.length === 0) {
  console.log(
    `\nQUALITY EVIDENCE OK: ${EVIDENCE_REGISTRY.length} declared; schema, blocking thresholds and the freshness window hold. ` +
      currencySentence(
        codeShas.filter((c) => c.committed).map((c) => c.relation),
      ) +
      ".",
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
