import { readFileSync, writeFileSync } from "node:fs";
import { LOCALES } from "file:///C:/tmp/be-mission-pr230-20261022/assets/js/shared/locales.js";

const sourcePath = "C:/tmp/be-mission-pr230-20261022/assets/js/shared/locales.js";
const additionsPath = "C:/tmp/be-pr230-dutch-additions.json";
const source = readFileSync(sourcePath, "utf8");
const additions = JSON.parse(readFileSync(additionsPath, "utf8"));
const expected = Object.keys(LOCALES.en).filter((key) => !(key in LOCALES.nl));
const added = Object.keys(additions);
const missing = expected.filter((key) => !(key in additions));
const extra = added.filter((key) => !(key in LOCALES.en) || key in LOCALES.nl);
if (missing.length || extra.length) {
  throw new Error(`mapping mismatch: ${missing.length} missing (${missing.slice(0, 5)}), ${extra.length} extra (${extra.slice(0, 5)})`);
}
const placeholders = (value) => [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((m) => m[1]).sort();
for (const [key, value] of Object.entries(additions)) {
  if (JSON.stringify(placeholders(value)) !== JSON.stringify(placeholders(LOCALES.en[key]))) {
    throw new Error(`placeholder mismatch for ${key}`);
  }
}
const start = source.indexOf("  nl: {");
const boundary = /\r?\n  },\r?\n  ar: \{/.exec(source.slice(start));
const end = boundary ? start + boundary.index : -1;
if (start < 0 || end < 0) throw new Error("could not locate Dutch locale block");
const lines = Object.entries(additions)
  .map(([key, value]) => `    ${key}: ${JSON.stringify(value)},`)
  .join("\n");
writeFileSync(sourcePath, source.slice(0, end) + "\n" + lines + source.slice(end), "utf8");
console.log(`inserted ${added.length} Dutch keys; placeholders match`);
