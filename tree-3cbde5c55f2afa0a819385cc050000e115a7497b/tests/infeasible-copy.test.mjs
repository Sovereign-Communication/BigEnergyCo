// Why nothing solved: which code maps to which copy, in one pure owner.
//
// The mapping used to be a table inside the DOM controller, reachable only by
// regexing that file's source, and the copy lives in locales.js. Nothing
// connected the two, so a code with no mapping — or a mapping with no
// translation — would surface as a generic message nobody had reviewed. This
// closes the loop in both directions.
// Run: node --test tests/infeasible-copy.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasInfeasibleCopy,
  infeasibleCopyKeys,
  infeasibleGenericKeys,
  infeasibleReasonCodes,
} from "../assets/js/sizing/infeasible-copy.js";
import { infeasibleReason } from "../assets/js/sizing/engine.js";
import { LOCALES } from "../assets/js/shared/locales.js";

const MODES = ["offgrid", "gridtie"];
const HARDWARE = ["solar", "battery", "both"];
const TARGETS = [null, 0.5, 1, 1.5, 2];

test("every code the engine can emit has copy of its own", () => {
  const emitted = new Set();
  for (const mode of MODES) {
    for (const hardwareConfig of HARDWARE) {
      for (const minFraction of TARGETS) {
        const reason = infeasibleReason({ mode, hardwareConfig, minFraction });
        if (reason) emitted.add(reason);
      }
    }
  }
  assert.ok(
    emitted.size >= 3,
    `engine covers the structural combos: ${[...emitted]}`,
  );
  const known = new Set(infeasibleReasonCodes());
  for (const reason of emitted) {
    assert.ok(
      known.has(reason),
      `${reason} is emitted by the engine but has no reviewed copy`,
    );
  }
});

test("the search-limit codes run.js adds are covered too", () => {
  // These two are not structural — run.js decides them when the envelope or a
  // visitor's roof/yard cap is what made the search fail.
  for (const reason of ["area-limited", "envelope-limited"]) {
    assert.ok(
      infeasibleReasonCodes().includes(reason),
      `${reason} has a reviewed mapping`,
    );
    assert.notDeepEqual(infeasibleCopyKeys(reason), infeasibleGenericKeys());
  }
});

test("area-limited keeps its own copy — it blames the visitor's cap, not the tool", () => {
  const area = infeasibleCopyKeys("area-limited");
  const envelope = infeasibleCopyKeys("envelope-limited");
  assert.notEqual(area.titleKey, envelope.titleKey);
  assert.notEqual(area.bodyKey, envelope.bodyKey);
});

test("an unrecognised reason still explains something", () => {
  const generic = infeasibleGenericKeys();
  // "toString" and "constructor" are the interesting cases: a plain truthiness
  // read of the table would hand back an inherited Object.prototype member.
  for (const reason of [
    undefined,
    null,
    "",
    "made-up",
    42,
    "toString",
    "constructor",
    "hasOwnProperty",
  ]) {
    assert.deepEqual(
      infeasibleCopyKeys(reason),
      generic,
      `no code should render an empty banner: ${String(reason)}`,
    );
  }
});

test("hasInfeasibleCopy separates reviewed codes from the generic fallback", () => {
  for (const reason of infeasibleReasonCodes()) {
    assert.equal(hasInfeasibleCopy(reason), true, reason);
  }
  for (const reason of [undefined, null, "", "made-up", 42, "toString"]) {
    assert.equal(hasInfeasibleCopy(reason), false, String(reason));
  }
});

test("every mappable code resolves to real copy in all six locales", () => {
  const codes = [...infeasibleReasonCodes(), "__generic__"];
  for (const code of codes) {
    const keys =
      code === "__generic__"
        ? infeasibleGenericKeys()
        : infeasibleCopyKeys(code);
    for (const [lang, dict] of Object.entries(LOCALES)) {
      for (const key of [keys.titleKey, keys.bodyKey]) {
        assert.equal(
          typeof dict[key],
          "string",
          `${code} -> ${key} missing in ${lang}`,
        );
        assert.ok(
          dict[key].trim().length > 0,
          `${code} -> ${key} is empty in ${lang}`,
        );
      }
    }
  }
});

test("the controller renders through the mapping instead of owning a table", async () => {
  const { readFileSync } = await import("node:fs");
  const ui = readFileSync(
    new URL("../assets/js/sizing/ui.js", import.meta.url),
    "utf8",
  );
  // Deleting the in-file table missed a SECOND consumer — the print sheet's
  // matrix cells — which turned a latent mislabel into a hard ReferenceError
  // that aborted renderResults for every infeasible run. Moving a table fails
  // by leaving a dangling reference, so the old name is pinned by name rather
  // than trusted to be gone.
  assert.doesNotMatch(
    ui,
    /INFEASIBLE_HINTS/,
    "a dangling reference crashes the whole render",
  );
  assert.match(
    ui,
    /import \{\s*hasInfeasibleCopy,\s*infeasibleCopyKeys,\s*\} from "\.\/infeasible-copy\.js/,
    "the controller must render through the shared mapping",
  );
  assert.match(ui, /const hint = infeasibleCopyKeys\(reason\);/);
  assert.match(
    ui,
    /hasInfeasibleCopy\(reason\)/,
    "the cell labeller asks whether a code has reviewed copy",
  );
  // The old table only ever held key NAMES, so reading .title/.body off it
  // rendered the word undefined in the print sheet and in the tier cards.
  assert.doesNotMatch(ui, /hint\.title\b|hint\.body\b/);
  assert.match(ui, /function infeasibleLabel\(reason, fallback\)/);

  // renderTierCards names its loop variable `t`, shadowing the translate
  // helper for its whole body: a copy lookup written in there would call the
  // tier object instead. The label helper lives at module scope for exactly
  // that reason, and this keeps it that way.
  const tierCards = ui.slice(
    ui.indexOf("function renderTierCards(p)"),
    ui.indexOf("function renderTargetCards(p"),
  );
  assert.ok(tierCards.length > 1000, "renderTierCards was located");
  assert.doesNotMatch(
    tierCards,
    /\bt\(\s*"/,
    "renderTierCards must not call the translate helper it shadows",
  );
  assert.match(
    tierCards,
    /infeasibleLabel\(/,
    "its unsolvable cards label through the module-scope helper",
  );
});
