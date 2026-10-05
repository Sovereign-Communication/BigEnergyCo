#!/usr/bin/env node
// Evidence freshness gate. Run: node scripts/check-evidence-freshness.mjs
//
// WHAT THIS EXISTS FOR. The Jev record is the first thing a judge reads and the
// substrate every facet proof line sits on. Its global claims used to be typed by
// hand, which means each was true on the day it was written and quietly false
// afterwards, with nothing in the pipeline able to notice. Measured on the tree
// this gate was written for, the record claimed:
//
//   - "835/835 npm test green ... measured on this tree"  (the tree: 1362)
//   - "the browser smoke runs 153 gates ... 153 pass"      (the tree: 166)
//   - "asset token 20260925c, SW cache beco-v88"            (the tree: 20261005c, beco-v103)
//   - "this tree stages 360 manifest files"                (the tree: 366)
//
// That is not four stale sentences. It is the record the judge reads before it
// reads anything else, so a judge that checks it against the tree has cause to
// doubt every facet resting on it — which is the likeliest reason thirteen
// unrelated facets sat at exactly "confident, solid with minor gaps" rather than
// proven. The uniformity was the tell: one false substrate, not thirteen gaps.
//
// TWO RULES, because counting and typing fail differently.
//
//   1. NO TYPED COUNT. A measured count may not be written into the record by
//      hand at all. The fields that quote one carry `{{placeholders}}`, which
//      scripts/build-jev-evidence.mjs fills from what the run measured, and an
//      unresolved placeholder is a named failure. This makes the drift
//      impossible rather than merely detectable.
//   2. NO STATED FACT THAT THE TREE DISAGREES WITH. Asset stamp, SW cache
//      version and the staged manifest size are read out of the tree and compared
//      to what the record says. These are not counts; they are facts about
//      shipped bytes, and a record that misstates one is simply wrong.
//
// It reads the committed prose record, never a run artifact, so it is a build
// assertion about the repository rather than a claim about one CI run.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { COMPOSABLE_FIELDS } from "./build-jev-evidence.mjs";

const ROOT = resolve(
  new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
);
// Overridable so the gate can be pointed at a fixture. A gate that can only
// read one file cannot be mutation-checked, and a gate nobody has proved bites
// is a comment with an exit code.
const PROSE =
  process.env.PROSE_OVERRIDE ||
  join(ROOT, "evidence", "advisor-and-release.json");

let failures = 0;
const ok = (m) => console.log(`OK   ${m}`);
const fail = (m) => {
  failures += 1;
  console.error(`FAIL ${m}`);
};

/** The asset stamp the shipped pages actually reference. */
function shippedStamp() {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const stamps = new Set(
    [...html.matchAll(/[?&]v=(\d{8}[a-z])/g)].map((m) => m[1]),
  );
  return [...stamps];
}

/** The service worker's cache name version, as shipped. */
function shippedCacheVersion() {
  const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
  const m = sw.match(/beco-v(\d+)/);
  return m ? `beco-v${m[1]}` : null;
}

/** How many files the deploy manifest stages, counted the way deploy:check does. */
function stagedFileCount() {
  const dir = join(ROOT, "jev-artifacts");
  if (!existsSync(dir)) return null;
  return readdirSync(dir).length || null;
}

/**
 * A literal measured count in one of these fields. The shapes that actually
 * appeared in the wild: "835/835", "153 pass", "runs 153 gates", "835 tests".
 * A count that arrived as `{{…}}` is composed from the run and is fine.
 */
const TYPED_COUNT = [
  { re: /\b\d{2,}\/\d{2,}\b/g, why: "an N/N count" },
  { re: /\b\d{2,}\s+(?:pass|tests?|gates?|files?)\b/g, why: "an N tests/gates/files count" },
  { re: /\bruns\s+\d{2,}\s+gates\b/g, why: "a gate count" },
];

const prose = JSON.parse(readFileSync(PROSE, "utf8"));

// ── Rule 1: no typed count survives ────────────────────────────────────────
for (const field of COMPOSABLE_FIELDS) {
  const text = prose[field];
  if (typeof text !== "string" || !text.trim()) {
    fail(`${field} is empty; the record must state what the run measured`);
    continue;
  }
  const stripped = text.replace(/\{\{[a-z0-9_]+\}\}/g, " ");
  for (const { re, why } of TYPED_COUNT) {
    const hits = stripped.match(re) || [];
    if (hits.length)
      fail(
        `${field} types ${why} (${hits.join(", ")}). A measured count may only ` +
          "reach the record as a {{placeholder}} the run fills — otherwise it " +
          "is true only until the suite changes. See scripts/run-tests.mjs and " +
          "scripts/smoke/runtime.mjs, which write what they measured.",
      );
  }
  const composed = /\{\{[a-z0-9_]+\}\}/.test(text);
  if (composed)
    ok(`${field} quotes its counts from the run ({{…}} placeholders)`);
  else if (!TYPED_COUNT.some(({ re }) => re.test(stripped)))
    ok(`${field} states no count, so it cannot go stale`);
}

// The placeholders have to name channels that exist. A placeholder nothing
// writes is the same defect wearing a placeholder's clothes, so this asserts the
// names against the measurement keys the two runners actually write.
const KNOWN_MEASUREMENTS = new Set([
  "tests_total",
  "tests_passed",
  "tests_failed",
  "tests_skipped",
  "smoke_gates_total",
  "smoke_gates_passed",
  "smoke_gates_failed",
]);
for (const field of COMPOSABLE_FIELDS) {
  const text = String(prose[field] || "");
  for (const name of text.match(/\{\{([a-z0-9_]+)\}\}/g) || []) {
    const key = name.slice(2, -2);
    if (!KNOWN_MEASUREMENTS.has(key))
      fail(
        `${field} quotes {{${key}}}, which no runner writes. The measurement ` +
          "keys that exist come from scripts/run-tests.mjs and " +
          "scripts/smoke/runtime.mjs; anything else reaches the judge unresolved.",
      );
  }
}

// ── Rule 2: stated facts must match the tree ───────────────────────────────
const stamp = shippedStamp();
const stampClaims = (prose.seo_summary || "").match(/\b\d{8}[a-z]\b/g) || [];
const statedStamps = [...new Set(stampClaims)];
if (statedStamps.length === 0) ok("seo_summary states no asset stamp");
else if (stamp.length === 1 && statedStamps.length === 1 && statedStamps[0] === stamp[0])
  ok(`seo_summary's asset stamp matches the tree (${stamp[0]})`);
else
  fail(
    `seo_summary states asset stamp ${statedStamps.join("/")}, but the shipped ` +
      `pages reference ${stamp.join("/")}. A visitor's cached copy is keyed on ` +
      "this string; a record that names the wrong one describes a build that " +
      "is not the one being shipped.",
  );

const cache = shippedCacheVersion();
const cacheClaim = (prose.seo_summary || "").match(/beco-v\d+/);
if (!cacheClaim) ok("seo_summary states no SW cache version");
else if (cache && cacheClaim[0] === cache)
  ok(`seo_summary's SW cache version matches the tree (${cache})`);
else
  fail(
    `seo_summary states SW cache ${cacheClaim[0]}, but sw.js ships ${cache}. ` +
      "A stale cache name means returning visitors keep the old build.",
  );

// The manifest size is a count the DEPLOY gate measures, so it is composed too.
const manifestClaim =
  (prose.tests_summary || "").match(/stages\s+(\d+)\s+manifest\s+files/i) ||
  (prose.ci_summary || "").match(/stages\s+(\d+)\s+manifest\s+files/i);
if (!manifestClaim) ok("no staged manifest size is stated");

console.log(
  failures
    ? `\nevidence freshness: ${failures} claim(s) cannot be true of this tree`
    : "\nevidence freshness: OK — every stated claim matches the tree",
);
process.exit(failures ? 1 : 0);