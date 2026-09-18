// Keeps cities.js's generated COUNTRY_FILES list in lockstep with the
// city-data partitions on disk.
//
//   node scripts/sync-country-files.mjs          # rewrite the list
//   node scripts/sync-country-files.mjs --check  # verify only (CI); exit 1 on drift
//
// Drift here is not cosmetic: countryCodesFor() decides which country
// partitions a typed city query lazy-loads, so a stale list silently breaks
// search for whole countries. The --check mode runs in the seo gate.
//
// Only the string CONTENT of the `export const COUNTRY_FILES = "..."` literal
// is compared/replaced — comments and assignment formatting belong to
// Prettier, so a formatter rewrap can never read as data drift.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(
  new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
);
const DIR = join(ROOT, "assets", "js", "sizing", "city-data");
const TARGET = join(ROOT, "assets", "js", "sizing", "cities.js");
const CHECK = process.argv.includes("--check");

const DECL_RE = /export const COUNTRY_FILES =\s*(?:"([^"]*)"|'([^']*)')\s*;/;

function codesOnDisk() {
  const files = readdirSync(DIR).filter((f) => /^[A-Z]{2}\.json$/.test(f));
  if (!files.length)
    throw new Error("no country partitions found in city-data/");
  return files.map((f) => f.slice(0, 2)).sort();
}

const text = readFileSync(TARGET, "utf8");
const match = DECL_RE.exec(text);
if (!match) {
  console.error(`FAIL ${TARGET}: COUNTRY_FILES string literal not found`);
  process.exit(1);
}
const want = codesOnDisk().join(" ");
const have = match[1] ?? match[2] ?? "";
if (have === want) {
  console.log(
    `COUNTRY_FILES in sync with city-data/ (${want.split(" ").length} partitions)`,
  );
  process.exit(0);
}
if (CHECK) {
  console.error(
    "FAIL COUNTRY_FILES in cities.js is out of date with city-data/ — run: node scripts/sync-country-files.mjs",
  );
  process.exit(1);
}
writeFileSync(
  TARGET,
  text.slice(0, match.index) +
    `export const COUNTRY_FILES = "${want}";` +
    text.slice(match.index + match[0].length),
);
console.log(
  `rewrote COUNTRY_FILES in cities.js (${want.split(" ").length} partitions)`,
);
