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
// WHAT THE 2026-10-13 AUDIT ADDED, and why rules 1 and 2 were not enough. Both
// were real, and both were narrower than they read:
//
//   - Rule 2 checked the asset stamp and the cache version in `seo_summary`
//     ALONE. Three facet proof lines and smoke_note named a build three releases
//     old and no rule read them. (v2a/v2b now scan the whole record.)
//   - The staged-manifest half of rule 2 matched a claim and then compared it to
//     NOTHING: `stagedFileCount()` counted files in jev-artifacts/, which has
//     nothing to do with the deploy contract, and the matched claim was never
//     used. It is now compared to the allowlist the deploy actually stages.
//   - Nothing verified the record's one claim about PRODUCTION. Measured on the
//     live surfaces: the record said "PRODUCTION IS BEHIND THIS TREE ... the
//     deployed build is at servedStamp 20260925c and this tree ships 20261005c"
//     while production served exactly this tree's build — 20261005h, 366/366
//     allowlist files byte-identical. A sentence that was true when typed
//     outlived three releases with every gate green. Rule 3 now requires what
//     production serves to be a MEASUREMENT mirrored in the record, taken
//     against this tree, with every surface the probe could not verify named.
//   - A committed run report (.jev-*-report.json) could name a served release
//     that never happened. Rule 4 checks every one against the release ledger.
//
// It reads the committed prose record, never a run artifact, so it is a build
// assertion about the repository rather than a claim about one CI run.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { COMPOSABLE_FIELDS } from "./build-jev-evidence.mjs";
import { deployList } from "./lib/deploy-manifest.mjs";
import { parseLedger } from "./lib/stamps.mjs";

const ROOT = resolve(
  new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
);
// Overridable so the gate can be pointed at a fixture. A gate that can only
// read one file cannot be mutation-checked, and a gate nobody has proved bites
// is a comment with an exit code.
const PROSE =
  process.env.PROSE_OVERRIDE ||
  join(ROOT, "evidence", "advisor-and-release.json");
// The measurement rule 3 checks the record against, and the release of record
// rule 3 and rule 4 check stamps against. Both overridable for the same reason.
const PROBE =
  process.env.PROBE_OVERRIDE || join(ROOT, "evidence", "production-probe.json");
const RELEASE_LEDGER =
  process.env.RELEASE_LEDGER_OVERRIDE ||
  join(ROOT, "docs", "release-ledger.jsonl");

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

/**
 * Every string in the record, with the path that names it.
 *
 * Rules 2 and 3 are about facts, not about fields: a build identity or a
 * production claim is exactly as wrong in a facet proof line, in smoke_note or
 * in a note as it is in seo_summary, and reading one field is how three stale
 * sentences survived every gate in the pipeline.
 */
function stringLeaves(value, path = "") {
  if (typeof value === "string")
    return [{ path: path || "(record)", text: value }];
  if (Array.isArray(value))
    return value.flatMap((v, i) => stringLeaves(v, `${path}[${i}]`));
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([k, v]) =>
      stringLeaves(v, path ? `${path}.${k}` : k),
    );
  return [];
}

/**
 * A literal measured count in one of these fields. The shapes that actually
 * appeared in the wild: "835/835", "153 pass", "runs 153 gates", "835 tests".
 * A count that arrived as `{{…}}` is composed from the run and is fine.
 */
const TYPED_COUNT = [
  { re: /\b\d{2,}\/\d{2,}\b/g, why: "an N/N count" },
  {
    re: /\b\d{2,}\s+(?:pass|tests?|gates?|files?)\b/g,
    why: "an N tests/gates/files count",
  },
  { re: /\bruns\s+\d{2,}\s+gates\b/g, why: "a gate count" },
];

const prose = JSON.parse(readFileSync(PROSE, "utf8"));
const leaves = stringLeaves(prose);
// The measured block's own numbers are checked against the measurement they
// mirror (rule 3), so they are not "typed claims" and are excluded from the
// prose scans rather than exempted by name in each of them.
const proseLeaves = leaves.filter((l) => !/^production(\.|\[|$)/.test(l.path));

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
// names against the measurement keys the runners actually write. Scanned in
// every string of the record, because a facet proof line may quote a measured
// number too — and a placeholder there is composed by the same walk.
const KNOWN_MEASUREMENTS = new Set([
  "tests_total",
  "tests_passed",
  "tests_failed",
  "tests_skipped",
  "smoke_gates_total",
  "smoke_gates_passed",
  "smoke_gates_failed",
]);
for (const { path, text } of leaves) {
  for (const name of text.match(/\{\{([a-z0-9_]+)\}\}/g) || []) {
    const key = name.slice(2, -2);
    if (!KNOWN_MEASUREMENTS.has(key))
      fail(
        `${path} quotes {{${key}}}, which no runner writes. The measurement ` +
          "keys that exist come from scripts/run-tests.mjs and " +
          "scripts/smoke/runtime.mjs; anything else reaches the judge unresolved.",
      );
  }
}

// ── Rule 2a/2b: the build identity, everywhere in the record ───────────────
const stamp = shippedStamp();
if (stamp.length !== 1)
  fail(
    `index.html references ${stamp.length} asset stamps (${stamp.join("/") || "none"}); ` +
      "the shipped build has no single identity to check a record against",
  );
const shipped = stamp.length === 1 ? stamp[0] : null;
let stampChecked = 0;
let stampStale = 0;
for (const { path, text } of proseLeaves) {
  for (const [tok] of text.matchAll(/\b\d{8}[a-z]\b/g)) {
    stampChecked += 1;
    if (tok === shipped) continue;
    stampStale += 1;
    fail(
      `${path} states asset stamp ${tok}, but the shipped pages reference ` +
        `${shipped}. A record that names a build other than the one being ` +
        "shipped is wrong however it is worded, and a visitor's cached copy is " +
        "keyed on this string. A PAST release's stamp belongs in " +
        "docs/release-ledger.jsonl, where it is dated and no judge reads it as " +
        "current.",
    );
  }
}
if (!stampStale)
  ok(
    stampChecked
      ? `every asset stamp named in the record is the shipped one (${shipped}), in ${stampChecked} mention(s) across the whole record`
      : "the record names no asset stamp",
  );

const cache = shippedCacheVersion();
let cacheMentions = 0;
let cacheStale = 0;
for (const { path, text } of proseLeaves) {
  for (const [tok] of text.matchAll(/beco-v\d+/g)) {
    cacheMentions += 1;
    if (tok === cache) continue;
    cacheStale += 1;
    fail(
      `${path} states SW cache ${tok}, but sw.js ships ${cache}. A stale cache ` +
        "name means returning visitors keep the old build.",
    );
  }
}
if (!cacheStale)
  ok(
    cacheMentions
      ? `every SW cache version named in the record is the shipped one (${cache})`
      : "the record names no SW cache version",
  );

// ── Rule 2c: a stated deploy-manifest size is the real one ─────────────────
let manifestActual = null;
const manifestCount = () => {
  if (manifestActual === null) {
    try {
      manifestActual = deployList().length;
    } catch (e) {
      manifestActual = false;
      fail(
        `the deploy allowlist could not be enumerated (${e.message}), so a ` +
          "stated manifest size cannot be checked against it",
      );
    }
  }
  return manifestActual;
};
let manifestClaims = 0;
for (const { path, text } of proseLeaves) {
  for (const [, claimed] of text.matchAll(
    /stages\s+(\d+)\s+manifest\s+files/gi,
  )) {
    manifestClaims += 1;
    const actual = manifestCount();
    if (actual === false) break;
    if (Number(claimed) === actual)
      ok(`${path} states the deploy manifest size correctly (${actual} files)`);
    else
      fail(
        `${path} states the deploy manifest stages ${claimed} files, but the ` +
          `deploy allowlist holds ${actual}. The manifest is what ships; a ` +
          "record that misstates its size describes an artifact nobody is " +
          "building.",
      );
  }
}
if (!manifestClaims) ok("no staged manifest size is stated");

// ── Rule 3: what the record says production serves is a measurement ────────
const PRODUCTION_KEYS = [
  "measured_at",
  "evidence",
  "target",
  "surface",
  "tree_stamp",
  "served_stamp",
  "files_checked",
  "matched",
  "browser_smoke",
  "verified",
  "unverified_surfaces",
  "ledger_stamp",
  "recorded_release",
];
const productionMentions = proseLeaves.filter((l) =>
  /\bproduction\b/i.test(l.text),
);
const block = prose.production;

if (!block) {
  if (productionMentions.length)
    fail(
      `the record states production facts (in ${productionMentions
        .map((l) => l.path)
        .slice(0, 3)
        .join(", ")}) with no measured block to check them against. Add ` +
        "`production`, mirroring evidence/production-probe.json — `node " +
        "scripts/probe-production.mjs` reproduces that measurement — or drop " +
        "the claim. A production sentence no measurement backs is exactly the " +
        "sentence that sat here claiming a build three releases old.",
    );
  else ok("the record makes no production claim, so none can go stale");
} else {
  if (typeof block !== "object" || Array.isArray(block))
    fail("production must be an object mirroring the probe's measured target");
  else {
    for (const key of PRODUCTION_KEYS)
      if (!(key in block)) fail(`production.${key} is missing`);

    // The committed measurement the block must mirror. Read from the probe this
    // gate was pointed at (overridable so a fixture can stand in for it), and
    // the block must name that same file — otherwise the record could point a
    // reader at one artifact while being checked against another.
    const probeRel = relative(ROOT, PROBE).split("\\").join("/");
    let probe = null;
    if (typeof block.evidence !== "string" || !block.evidence.trim())
      fail("production.evidence must name the committed probe it mirrors");
    else if (!process.env.PROBE_OVERRIDE && block.evidence !== probeRel)
      fail(
        `production.evidence names ${block.evidence}, but the measurement this ` +
          `gate checks is ${probeRel}. Point the block at that file, or re-run ` +
          "the probe that writes it.",
      );
    if (!existsSync(PROBE))
      fail(
        `${probeRel} is missing: the record's production claim has no ` +
          "measurement to rest on",
      );
    else {
      try {
        probe = JSON.parse(readFileSync(PROBE, "utf8"));
      } catch (e) {
        fail(`${probeRel} is not valid JSON: ${e.message}`);
      }
    }

    if (probe) {
      if (probe.measured_at !== block.measured_at)
        fail(
          `production.measured_at is ${block.measured_at}, but ${block.evidence} ` +
            `was measured at ${probe.measured_at}. The block is a view of the ` +
            "measurement, so it may not carry a date of its own.",
        );
      if (probe.tree_stamp !== shipped)
        fail(
          `${block.evidence} was measured against tree stamp ${probe.tree_stamp}, ` +
            `but this tree ships ${shipped}. A probe of another tree backs ` +
            "nothing here — re-run `node scripts/probe-production.mjs`.",
        );
      else ok(`${block.evidence} was measured against this tree (${shipped})`);

      const targets = Array.isArray(probe.targets) ? probe.targets : [];
      const target = targets.find((t) => t.name === block.target);
      if (!target)
        fail(
          `production.target is ${block.target}, which is not one of the ` +
            `surface(s) probed (${targets.map((t) => t.name).join(", ") || "none"})`,
        );
      else {
        for (const key of [
          "surface",
          "served_stamp",
          "files_checked",
          "matched",
          "browser_smoke",
          "verified",
        ]) {
          const stated = block[key];
          const measured = target[key];
          if (stated === measured) continue;
          fail(
            `production.${key} is ${JSON.stringify(stated)}, but the probe ` +
              `measured ${JSON.stringify(measured)} on ${target.name}. The ` +
              "numbers may not be retyped — they come from the measurement.",
          );
        }
        ok(
          `the record's production block mirrors the measured ${target.name} ` +
            `surface (stamp ${target.served_stamp}, ` +
            `${target.matched}/${target.files_checked} files, verified ${target.verified})`,
        );
      }

      const unverified = targets
        .filter((t) => t.verified !== true)
        .map((t) => t.name)
        .sort();
      const stated = Array.isArray(block.unverified_surfaces)
        ? [...block.unverified_surfaces].sort()
        : null;
      if (stated && JSON.stringify(stated) === JSON.stringify(unverified))
        ok(
          unverified.length
            ? `the record names every surface the probe could not verify (${unverified.join(", ")})`
            : "the probe verified every surface it probed",
        );
      else
        fail(
          `production.unverified_surfaces is ${JSON.stringify(block.unverified_surfaces)}, ` +
            `but the probe could not verify ${JSON.stringify(unverified)}. A ` +
            "surface the measurement does not cover must be named in the record, " +
            "never left for a reader to assume.",
        );
    }

    if (block.tree_stamp !== shipped)
      fail(
        `production.tree_stamp is ${block.tree_stamp}, but this tree ships ` +
          `${shipped}. Say which build the measurement was taken against, or it ` +
          "reads as a claim about this one.",
      );
    else if (block.served_stamp !== shipped)
      ok(
        `production is not serving this tree's build (measurement says ` +
          `${block.served_stamp}, this tree ships ${shipped}) — stated, not hidden`,
      );

    // The release of record. The record may state the build production serves
    // and this ledger's last release without them agreeing: that disagreement is
    // the finding, and it is the record's job to carry it rather than a reader's
    // job to discover it.
    let ledgerStamp = null;
    try {
      const { records, badLines } = parseLedger(
        readFileSync(RELEASE_LEDGER, "utf8"),
      );
      if (badLines.length)
        fail(
          `${relative(ROOT, RELEASE_LEDGER)} has an unparseable line at ${badLines.join(", ")}; ` +
            "the release of record cannot be read",
        );
      const released = records.filter((r) => r && typeof r.stamp === "string");
      ledgerStamp = released.length
        ? released[released.length - 1].stamp
        : null;
    } catch (e) {
      fail(`${relative(ROOT, RELEASE_LEDGER)} could not be read: ${e.message}`);
    }
    if (ledgerStamp && block.ledger_stamp !== ledgerStamp)
      fail(
        `production.ledger_stamp is ${block.ledger_stamp}, but the last release ` +
          `docs/release-ledger.jsonl records is ${ledgerStamp}. The record must ` +
          "state the release of record truthfully, including when the live " +
          "build is not it.",
      );
    else if (ledgerStamp)
      ok(
        `production.ledger_stamp matches the last recorded release (${ledgerStamp})`,
      );

    const recorded = block.served_stamp === block.ledger_stamp;
    if (block.recorded_release !== recorded)
      fail(
        `production.recorded_release is ${JSON.stringify(block.recorded_release)}, ` +
          `but the build production serves (${block.served_stamp}) is ` +
          `${recorded ? "" : "not "}the release docs/release-ledger.jsonl last ` +
          "records. This field exists so a release nothing recorded is stated " +
          "in the record instead of passing unremarked.",
      );
    else if (!recorded && ledgerStamp)
      ok(
        `the record states that the live build is not the last recorded release ` +
          `(${block.served_stamp} vs ${ledgerStamp})`,
      );
  }
}

// ── Rule 4: a committed run report may not name a release that never was ───
let reportClaims = 0;
let reportBad = 0;
let releasedStamps = new Set();
try {
  const { records } = parseLedger(readFileSync(RELEASE_LEDGER, "utf8"));
  releasedStamps = new Set(
    records.map((r) => r && r.stamp).filter((s) => typeof s === "string"),
  );
} catch {
  // Already reported by rule 3 when it ran; a report claim is checked below
  // against whatever the ledger could be read as.
  releasedStamps = new Set();
}
for (const file of readdirSync(ROOT).filter((f) =>
  /^\.jev-.*-report\.json$/.test(f),
)) {
  let text;
  try {
    text = readFileSync(join(ROOT, file), "utf8");
  } catch {
    continue;
  }
  for (const [, tok] of text.matchAll(
    /(?:servedStamp|serves stamp|served stamp)\s+([0-9a-z]{6,})/gi,
  )) {
    if (!/^\d{8}[a-z]$/.test(tok)) continue;
    reportClaims += 1;
    if (releasedStamps.has(tok) || tok === shipped) continue;
    reportBad += 1;
    fail(
      `${file} claims production served stamp ${tok}, which no release in ` +
        "docs/release-ledger.jsonl records and which this tree does not ship. A " +
        "committed status artifact may describe a release that happened, or the " +
        "build this tree ships; a stamp nothing ever released is a claim about " +
        "a build that does not exist.",
    );
  }
}
if (!reportBad)
  ok(
    reportClaims
      ? `every served-release claim in a committed run report names a recorded release or this tree's build (${reportClaims} claim(s))`
      : "no committed run report claims a served release",
  );

console.log(
  failures
    ? `\nevidence freshness: ${failures} claim(s) cannot be true of this tree`
    : "\nevidence freshness: OK — every stated claim matches the tree",
);
process.exit(failures ? 1 : 0);
