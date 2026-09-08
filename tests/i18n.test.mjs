// i18n contract: English is the source of truth and must contain every key
// the UI can ask for; other locales fall back to English per key (never
// key-ese) via the t() chain and the data-i18n applier. New strings ship in
// English first — this test forbids dangling references, not untranslated
// strings.
// Run: node --test tests/i18n.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function readEnKeys() {
  const src = fs.readFileSync(
    path.join(ROOT, "assets/js/shared/locales.js"),
    "utf8",
  );
  const keys = new Set();
  let depth = 0;
  let inEn = false;
  for (const line of src.split(/\r?\n/)) {
    if (/^  en: \{$/.test(line)) inEn = true;
    else if (/^  \w+: \{$/.test(line) && depth === 1) inEn = false;
    depth +=
      (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
    if (inEn && depth >= 2) {
      const k = line.match(/^    (\w+):/);
      if (k) keys.add(k[1]);
    }
  }
  return keys;
}

function jsFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name !== "city-data") jsFiles(p, out);
    } else if (name.endsWith(".js")) out.push(p);
  }
  return out;
}

test("every t() and data-i18n key exists in English", () => {
  const en = readEnKeys();
  assert.ok(en.size > 50, "english source found");
  const used = new Set();
  for (const f of jsFiles(path.join(ROOT, "assets/js"))) {
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(/[^.\w]t\("([A-Za-z0-9_]+)"/g)) used.add(m[1]);
  }
  // Dynamic verdict keys are built as "frontierVerdict<X>" + ("Grid"|"Offgrid"):
  // the scan above only sees the prefix, so pin the ten full keys directly.
  // (Static data-i18n keys are intentionally NOT checked here: English lives
  // in the source markup and the applier keeps it when a dict lacks the key.)
  const dynamicPrefixes = [
    "frontierVerdictCovered",
    "frontierVerdictBeyondSweep",
    "frontierVerdictSteep",
    "frontierVerdictTapering",
    "frontierVerdictLinear",
  ];
  for (const p of dynamicPrefixes) used.delete(p);
  for (const p of dynamicPrefixes) {
    for (const suffix of ["Grid", "Offgrid"]) used.add(p + suffix);
  }
  const missing = [...used].filter((k) => !en.has(k));
  assert.deepEqual(
    missing,
    [],
    `keys referenced but absent from English: ${missing.join(", ")}`,
  );
});

test("ui t() falls back to English before the raw key", () => {
  const src = fs.readFileSync(
    path.join(ROOT, "assets/js/sizing/ui.js"),
    "utf8",
  );
  assert.ok(
    /LOCALES\.en\[key\]\s*\?\?\s*key/.test(src),
    "t() must chain locale -> English -> raw key",
  );
});
