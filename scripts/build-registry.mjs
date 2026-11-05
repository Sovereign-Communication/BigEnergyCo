#!/usr/bin/env node
// Registry build and gate (P2.1).
//
//   node scripts/build-registry.mjs --check       # validate + size gate (CI: `npm run data:check`)
//   node scripts/build-registry.mjs --freshness   # the weekly job's question only (R-DATA-07)
//   node scripts/build-registry.mjs --emit <dir>  # write the compact per-country bundles
//
// WHAT THIS GATE IS FOR. The registry is the place a number's origin is written
// down, so the failure it must catch is not "the file is missing" - that is
// loud already - but "the file says something we are not allowed to ship, or
// something we can no longer stand behind". Three questions, in order:
//
//   1. SCHEMA. Every required field exists, every value is either a well-formed
//      cited value or an explicit unknown, and no field has drifted out of the
//      schema. A missing field is a silent guess somewhere downstream, so it
//      fails here rather than at runtime.
//   2. LICENCE AND GRADE. A value citing a source whose licence does not permit
//      redistribution cannot be embedded, and a grade-D value must name its
//      derivation instead of a publisher (scripts/lib/registry.mjs owns the
//      rules; this script only reports them).
//   3. FRESHNESS. A review_by inside the field's window (6 months for policy, 12
//      for the rest). Past-due is a failure, not a warning: shipping a number we
//      promised to re-check and did not is the exact defect this programme
//      exists to stop.
//
// Two honest limits, stated because a gate that hides them is worse than no
// gate. R-DATA-07 also asks that a PR fail only on the entries it TOUCHES; that
// needs a diff against the base and is P2.2's refinement - today any past-due
// entry fails every run, which is stricter, not weaker. And nothing here fetches
// a URL: a link that rotted is a different defect from a citation that was never
// checked.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { brotliCompressSync, constants } from "node:zlib";

import {
  MAX_BUNDLE_BYTES,
  countryBundle,
  validateRegistry,
} from "./lib/registry.mjs";

const ROOT = resolve(
  new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
);
const REGISTRY_DIR = join(ROOT, "assets", "data", "registry");
const COUNTRIES_DIR = join(REGISTRY_DIR, "countries");

const argv = process.argv.slice(2);
const FRESHNESS_ONLY = argv.includes("--freshness");
const emitIdx = argv.indexOf("--emit");
const EMIT_DIR = emitIdx >= 0 ? argv[emitIdx + 1] : null;
if (emitIdx >= 0 && !EMIT_DIR) {
  console.error("FAIL --emit needs a directory");
  process.exit(2);
}

const today = new Date().toISOString().slice(0, 10);

function load() {
  const sourcesDoc = JSON.parse(
    readFileSync(join(REGISTRY_DIR, "sources.json"), "utf8"),
  );
  const countries = {};
  for (const file of readdirSync(COUNTRIES_DIR).sort()) {
    if (!/^[A-Z]{2}\.json$/.test(file)) {
      throw new Error(
        `countries/${file}: every country file must be named for its ISO 3166-1 alpha-2 code`,
      );
    }
    const code = file.slice(0, 2);
    countries[code] = JSON.parse(
      readFileSync(join(COUNTRIES_DIR, file), "utf8"),
    );
  }
  return { sources: sourcesDoc.sources ?? {}, countries };
}

/** Brotli size of a country's emitted bundle, in bytes. */
function bundleSize(code, doc) {
  const json = JSON.stringify(countryBundle(code, doc));
  return brotliCompressSync(Buffer.from(json), {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_SIZE_HINT]: json.length,
    },
  }).length;
}

let registry;
try {
  registry = load();
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exit(1);
}

const countryCodes = Object.keys(registry.countries);
const { errors, pastDue } = validateRegistry(registry, { today });

if (FRESHNESS_ONLY) {
  // A malformed file is not a freshness question, but the weekly job should not
  // report a clean sweep over a registry it could not read either.
  if (errors.length) {
    console.error(`FAIL ${errors.length} registry problem(s) as of ${today}:`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  if (pastDue.length) {
    console.error(
      `FAIL ${pastDue.length} registry entr${pastDue.length === 1 ? "y is" : "ies are"} past due (R-DATA-07):`,
    );
    for (const row of pastDue) console.error(`  - ${row}`);
    process.exit(1);
  }
  console.log(
    `registry freshness: OK - ${countryCodes.length} country file(s), no entry past due as of ${today}`,
  );
  process.exit(0);
}

if (errors.length) {
  console.error(`FAIL ${errors.length} registry problem(s) as of ${today}:`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

// The size ceiling is per R-DATA-01: a country bundle ships to the browser, so a
// registry that blows the budget has traded provenance for weight.
let oversized = 0;
for (const code of countryCodes) {
  const size = bundleSize(code, registry.countries[code]);
  if (size > MAX_BUNDLE_BYTES) {
    oversized += 1;
    console.error(
      `FAIL countries/${code}.json: bundle is ${size} B brotli, over the ${MAX_BUNDLE_BYTES} B ceiling`,
    );
  }
}
if (oversized) process.exit(1);

if (pastDue.length) {
  console.error(
    `FAIL ${pastDue.length} registry entry(ies) past due (R-DATA-07):`,
  );
  for (const row of pastDue) console.error(`  - ${row}`);
  process.exit(1);
}

if (EMIT_DIR) {
  const out = resolve(ROOT, EMIT_DIR);
  mkdirSync(out, { recursive: true });
  for (const code of countryCodes) {
    writeFileSync(
      join(out, `${code}.json`),
      `${JSON.stringify(countryBundle(code, registry.countries[code]))}\n`,
    );
  }
  console.log(
    `registry: emitted ${countryCodes.length} bundle(s) to ${EMIT_DIR}`,
  );
}

// Coverage against the place data the site already ships: a country the visitor
// can pick but the registry cannot describe is a visible gap, reported here so
// P2.3 has a worklist rather than a surprise.
const cityDataDir = join(ROOT, "assets", "js", "sizing", "city-data");
let placeCodes = [];
try {
  placeCodes = readdirSync(cityDataDir)
    .filter((f) => /^[A-Z]{2}\.json$/.test(f))
    .map((f) => f.slice(0, 2));
} catch {
  placeCodes = [];
}
const missing = placeCodes.filter((c) => !countryCodes.includes(c));
const covered = placeCodes.length - missing.length;

console.log(
  `registry: OK - ${Object.keys(registry.sources).length} source(s), ${countryCodes.length} country file(s), ` +
    `${covered}/${placeCodes.length} place-data countries covered as of ${today}`,
);
if (missing.length) {
  console.log(
    `registry coverage: ${missing.length} place-data countries have no registry file yet (P2.3 worklist): ${missing.slice(0, 12).join(" ")}${missing.length > 12 ? " ..." : ""}`,
  );
}
