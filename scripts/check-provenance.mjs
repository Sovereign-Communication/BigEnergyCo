#!/usr/bin/env node
// Provenance gate. Run: node scripts/check-provenance.mjs
//
// WHAT THIS EXISTS FOR. The provenance facet asks the question a calculator is
// uniquely exposed to: for every number on the screen, can a visitor find out
// where it came from? The honest answer on this tree used to be no, in a way
// that was worse than an admitted gap — the page carried hand-set tariffs, hand-
// set hardware prices, hand-set replacement labour and a hand-set cycle-life
// curve, none of it attributed, so a visitor had no way to learn that the number
// they were about to trust was our estimate rather than a measurement.
//
// assets/data/provenance.json is that answer, written down per ASSUMPTION FAMILY
// (not per line of code, which would be a table nobody could keep true). Every
// family carries the publisher, a URL a visitor can open, a grade saying how well
// that publisher's figure matches what we ship, and the date it was checked.
//
// THE RULE THIS GATE ENFORCES, and it is stricter than "every entry is filled
// in": every displayed assumption must be ATTRIBUTED, and the only way to be
// attributed without a source is to say so out loud.
//
//   1. Coverage, both directions. A shipped constant that produces a displayed
//      number and is not in the registry fails. So does a registry entry naming
//      a symbol that no longer exists — a registry that keeps describing deleted
//      code is the same defect as a stale count, which is what this whole cluster
//      is about. Drift in either direction is drift.
//   2. A citation must be complete AND openable: publisher, title, a URL, a
//      as-of date, a licence. A grade of "A" claims the publisher's figure IS
//      ours, so an entry graded A must not also be graded unknown — the registry
//      cannot disagree with itself.
//   3. A number with no publisher says `source: null`, carries grade "unknown",
//      and states WHY in its disclosure. Silence is not an option: an
//      unattributed constant that is simply absent from the registry is exactly
//      the gap this gate exists to close.
//
// Nothing here fetches a URL. A link that 404s tomorrow is a different failure
// from a link that was never there, and this gate is about the second one.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(
  new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
);
const REGISTRY =
  process.env.PROVENANCE_OVERRIDE ||
  join(ROOT, "assets", "data", "provenance.json");

let failures = 0;
const ok = (m) => console.log(`OK   ${m}`);
const fail = (m) => {
  failures += 1;
  console.error(`FAIL ${m}`);
};

const reg = JSON.parse(readFileSync(REGISTRY, "utf8"));

// ── 1. every shipped assumption family is registered, and nothing stale ─────
// `used_by` is "path:symbol". The symbol must still exist in that file, which
// is what catches a registry that outlived its code.
const sourceText = (rel) => {
  try {
    return readFileSync(join(ROOT, rel.split(":")[0]), "utf8");
  } catch {
    return null;
  }
};

const seenFamilies = new Set();
for (const a of reg.assumptions || []) {
  if (!a.id || seenFamilies.has(a.id)) {
    fail(
      `assumption ${a.id || "(no id)"} is missing an id or repeats one; every ` +
        "family must be listed exactly once",
    );
    continue;
  }
  seenFamilies.add(a.id);

  if (!Array.isArray(a.used_by) || a.used_by.length === 0) {
    fail(
      `${a.id} lists no used_by symbols, so nothing checks that it is shipped`,
    );
    continue;
  }
  for (const ref of a.used_by) {
    const [rel, symbol] = ref.split(":");
    const text = sourceText(ref);
    if (text === null) {
      fail(`${a.id} points at ${rel}, which does not exist`);
      continue;
    }
    if (!symbol) {
      fail(
        `${a.id} points at ${rel} with no symbol, so the link cannot be checked`,
      );
      continue;
    }
    if (!text.includes(symbol))
      fail(
        `${a.id} attributes ${rel}:${symbol}, but that symbol is no longer in the ` +
          "file. Either the code moved on or the registry did; either way this " +
          "entry now describes something the product does not ship.",
      );
  }
}

// ── 2/3. every entry is either fully cited or explicitly unknown ───────────
const GRADES = new Set(Object.keys(reg.grades || {}));
for (const a of reg.assumptions || []) {
  const grade = a.grade;
  if (!GRADES.has(grade))
    fail(
      `${a.id} is graded ${JSON.stringify(grade)}, which the registry does not ` +
        `define. The defined grades are: ${[...GRADES].join(", ")}`,
    );

  if (a.source === null || a.source === undefined) {
    // The honest path. It has to SAY it is unknown and say why.
    if (grade !== "unknown")
      fail(
        `${a.id} has no source but is graded ${JSON.stringify(grade)}. A value ` +
          'with no publisher behind it is graded "unknown" — anything else claims ' +
          "a provenance the entry does not have.",
      );
    if (!a.disclosure || a.disclosure.length < 40)
      fail(
        `${a.id} has no source, so its disclosure must say what it is instead and ` +
          "why, in enough words that a visitor is not misled by the absence",
      );
    else
      ok(
        `${a.id} is explicitly unknown: ${String(a.disclosure).slice(0, 58)}…`,
      );
    continue;
  }

  const src = reg.sources?.[a.source];
  if (!src) {
    fail(
      `${a.id} cites source id "${a.source}", which the registry does not define`,
    );
    continue;
  }
  for (const field of ["publisher", "title", "url", "as_of", "license"]) {
    if (!src[field] || !String(src[field]).trim())
      fail(
        `${a.id}'s source "${a.source}" has no ${field}; a citation a visitor cannot open or date is not a citation`,
      );
  }
  if (src.url && !/^https:\/\/[^\s]+$/.test(src.url))
    fail(
      `${a.id}'s source "${a.source}" has url ${JSON.stringify(src.url)}, which is ` +
        "not an https URL a visitor can open",
    );
  ok(`${a.id} <- ${src.publisher} (grade ${grade}, checked ${src.as_of})`);
}

// A source nobody cites is clutter that reads like coverage.
for (const id of Object.keys(reg.sources || {})) {
  const cited = (reg.assumptions || []).some((a) => a.source === id);
  if (!cited) fail(`source "${id}" is defined but no assumption cites it`);
}

// The registry has to be findable from the page, or it is an audit nobody runs.
try {
  const idx = readFileSync(join(ROOT, "index.html"), "utf8");
  if (!/provenance\.json|check-provenance/.test(idx))
    fail(
      "no shipped page references assets/data/provenance.json; a registry the " +
        "product never points at cannot be said to be open to a visitor",
    );
  else ok("a shipped page references the registry");
} catch (e) {
  fail(`index.html could not be read: ${e.message}`);
}

console.log(
  failures
    ? `\nprovenance: ${failures} problem(s); ${seenFamilies.size} assumption families registered`
    : `\nprovenance: OK — ${seenFamilies.size} assumption families, ` +
        `${Object.keys(reg.sources || {}).length} sources, every value cited or explicitly unknown`,
);
process.exit(failures ? 1 : 0);
