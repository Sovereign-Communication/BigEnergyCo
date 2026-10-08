#!/usr/bin/env node
// Plan §8 P0.4, quality axis: dead code and duplication, measured on the
// tracked tree — the instrument the quality facet line has been admitting it
// lacks ("Beyond them, dead code or duplication is unmeasured").
//
//   node scripts/check-code-hygiene.mjs [--out FILE] [--root DIR]
//
// What it reads: every tracked .js/.mjs/.html source as the consumer corpus,
// and the SHIPPED modules (the deploy allowlist's .js files) as the subject.
// Pure text, no build, no network — it runs as a step of the `test` job, so
// its outcome travels on the same job record the quality facet's clarity
// clause is worded from (RECORD_SOURCES in scripts/lib/jev-evidence.mjs).
//
// Exit codes:
//   0  nothing dead, nothing duplicated — the two facts are measured and clean
//   1  a finding: named on the terminal and in the report, never softened
//   2  usage error, or the tree could not be read
//
// The analysis under-reports by design (see scripts/lib/code-hygiene.mjs):
// a name counts as used if ANY tracked file mentions it, comments and strings
// included. A miss is a hole to close; a false finding would fail a green run
// on a lie.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { analyzeHygiene, HYGIENE_WINDOW_LINES } from "./lib/code-hygiene.mjs";
import { deployList } from "./lib/deploy-manifest.mjs";
import { exitWhenDrained } from "./lib/graceful-exit.mjs";

const USAGE =
  "usage: node scripts/check-code-hygiene.mjs [--out FILE] [--root DIR]";

function parseArgs(argv) {
  const opts = { out: null, root: "." };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out") opts.out = argv[++i] ?? usage();
    else if (argv[i] === "--root") opts.root = argv[++i] ?? usage();
    else usage(`unknown argument ${argv[i]}`);
  }
  return opts;
}
function usage(msg) {
  if (msg) process.stderr.write(`check-code-hygiene: ${msg}\n`);
  process.stderr.write(`${USAGE}\n`);
  process.exit(2);
}

function gitLines(args) {
  return execFileSync("git", args, { encoding: "utf8" })
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
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

const SOURCE_EXT = /\.(js|mjs|html|htm)$/;

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const root = resolve(opts.root);
  if (
    !existsSync(join(root, ".git")) &&
    !existsSync(join(root, "package.json"))
  ) {
    usage(`--root ${opts.root} does not look like the repository root`);
  }

  let tracked;
  let modules;
  try {
    tracked = gitLines(["-C", root, "ls-files"]);
    // The SHIPPED modules: what the deploy allowlist stages, .js only. Claims
    // about dead code are about what ships, not about this tool's own scripts.
    modules = deployList().filter((f) => f.endsWith(".js"));
  } catch (err) {
    process.stderr.write(
      `check-code-hygiene: could not read the tree: ${err.message}\n`,
    );
    process.exit(2);
  }

  const corpus = new Map();
  for (const rel of tracked) {
    if (!SOURCE_EXT.test(rel)) continue;
    const path = join(root, rel);
    if (!existsSync(path)) continue;
    corpus.set(rel, readFileSync(path, "utf8"));
  }
  const moduleMap = new Map();
  for (const rel of modules) {
    const src = corpus.get(rel);
    if (src !== undefined) moduleMap.set(rel, src);
  }
  if (!moduleMap.size) {
    process.stderr.write(
      "check-code-hygiene: no shipped JS modules found in the allowlist\n",
    );
    process.exit(2);
  }

  const report = {
    metric: "code_hygiene",
    plan_item: "P0.4",
    plan_ref:
      "docs/plan/MASTER_PLAN.md §8 P0.4, quality axis (pack: quality_gap)",
    generated_at: new Date().toISOString(),
    code_sha: codeSha(),
    window_lines: HYGIENE_WINDOW_LINES,
    method:
      "under-reporting by design: a name is dead only when no other tracked source mentions it (comments and strings count as mentions), default exports are counted unmeasured rather than assumed clean, and duplicate windows exclude import/export declarations so module skeletons are not reported as logic",
    ...analyzeHygiene({ modules: moduleMap, corpus }),
  };

  if (opts.out) {
    writeFileSync(join(root, opts.out), `${JSON.stringify(report, null, 2)}\n`);
  }

  const c = report.counts;
  process.stdout.write(
    `code hygiene: ${c.modules_scanned} shipped modules, ${c.exports_checked} exports checked, ` +
      `${c.default_exports_unmeasured} default exports (unmeasured), ${c.logic_lines} logic lines\n`,
  );
  if (report.ok) {
    process.stdout.write(
      "OK — dead code and duplication measured: 0 dead files, 0 unreferenced exports, 0 duplicated blocks\n",
    );
    return 0;
  }
  process.stderr.write("DEAD CODE OR DUPLICATION FOUND:\n");
  for (const f of report.dead_files)
    process.stderr.write(`  dead file: ${f}\n`);
  for (const e of report.unreferenced_exports.slice(0, 20)) {
    process.stderr.write(
      `  unreferenced export: ${e.name} (${e.module})${e.used_locally ? " — live locally, the export is dead" : " — dead definition"}\n`,
    );
  }
  if (report.unreferenced_exports.length > 20) {
    process.stderr.write(
      `  (+${report.unreferenced_exports.length - 20} more in the report)\n`,
    );
  }
  for (const d of report.dup_regions.slice(0, 10)) {
    process.stderr.write(
      `  duplicated block: ${d.files[0]} lines ${fmtRanges(d.a_lines)} == ${d.files[1]} lines ${fmtRanges(d.b_lines)}\n`,
    );
  }
  if (report.dup_regions.length > 10) {
    process.stderr.write(
      `  (+${report.dup_regions.length - 10} more in the report)\n`,
    );
  }
  return 1;
}

function fmtRanges(ranges) {
  return ranges.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(",");
}

exitWhenDrained(main());
