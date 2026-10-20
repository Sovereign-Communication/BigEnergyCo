// Mode-chrome sanity contracts: the off-grid bill-cut regression net.
//
// Owner report (2026-10-19): clicking "Off-grid / Backup" still showed the
// "Cut ~80% of your bill" slider — a bill question for a user with no bill.
// Root cause: #cutSliderRow had two writers reading two different state
// holders, and the goal-switch path re-wrote neither. These tests pin the
// cure: ONE writer, a pure decision over current state, and the generator
// question the owner specified (0% / 1% / 2%+) wired to the engine tier.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  cutRowVisible,
  GENERATOR_RUNTIMES,
  tierForGeneratorRuntime,
  generatorRuntimeForTier,
  generatorAllowedForRuntime,
} from "../assets/js/sizing/mode-chrome.js";
import { inputsFor } from "../assets/js/sizing/usecases.js";
import { LOCALES } from "../assets/js/shared/locales.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI = readFileSync(join(ROOT, "assets/js/sizing/ui.js"), "utf8");
const HTML = readFileSync(join(ROOT, "index.html"), "utf8");

test("CHROME: the bill-cut row shows only for a live grid-tie billcut state", () => {
  assert.equal(
    cutRowVisible({
      goal: "gridtie",
      resultMode: "gridtie",
      useCaseId: "billcut",
    }),
    true,
  );
  // The reported bug: off-grid goal, stale grid-tie result, billcut case.
  assert.equal(
    cutRowVisible({
      goal: "offgrid",
      resultMode: "gridtie",
      useCaseId: "billcut",
    }),
    false,
    "off-grid must never show the bill-cut row",
  );
  // No result yet: nothing to attach the row to.
  assert.equal(
    cutRowVisible({ goal: "gridtie", resultMode: null, useCaseId: "billcut" }),
    false,
  );
  // An off-grid result under a grid-tie goal (mid-switch) stays hidden.
  assert.equal(
    cutRowVisible({
      goal: "gridtie",
      resultMode: "offgrid",
      useCaseId: "billcut",
    }),
    false,
  );
  // Time-of-use is grid-tie but reports no bill-cut target.
  assert.equal(
    cutRowVisible({ goal: "gridtie", resultMode: "gridtie", useCaseId: "tou" }),
    false,
  );
});

test("CHROME: ui.js writes the cut row's display in exactly one place", () => {
  const writes = UI.match(/cutRow\.style\.display\s*=/g) || [];
  assert.equal(
    writes.length,
    1,
    "a second writer is how the stale-write bug returns",
  );
  assert.match(UI, /function syncCutRowVisibility\(\)/);
  // Every state change re-syncs: use case, goal, and the results render.
  assert.match(UI, /applyUseCase[\s\S]{0,4000}syncCutRowVisibility\(\)/);
  const renderSite = UI.indexOf("lastResultMode = isGT");
  assert.ok(renderSite > 0, "the render records its mode");
  assert.match(
    UI.slice(renderSite, renderSite + 200),
    /syncCutRowVisibility\(\)/,
    "the render re-syncs after recording its mode",
  );
});

test("GENERATOR: the off-grid question is 0% / 1% / 2%+, mapped to tiers", () => {
  assert.deepEqual(GENERATOR_RUNTIMES, ["gen0", "gen1", "gen2"]);
  assert.equal(tierForGeneratorRuntime("gen0"), "tier100");
  assert.equal(tierForGeneratorRuntime("gen1"), "tier99");
  assert.equal(tierForGeneratorRuntime("gen2"), "tier95");
  for (const rt of GENERATOR_RUNTIMES) {
    assert.equal(generatorRuntimeForTier(tierForGeneratorRuntime(rt)), rt);
  }
  assert.equal(generatorAllowedForRuntime("gen0"), false);
  assert.equal(generatorAllowedForRuntime("gen1"), true);
  assert.equal(generatorAllowedForRuntime("gen2"), true);
  // Unknown values fall back to the historical default (rare backup).
  assert.equal(tierForGeneratorRuntime("nonsense"), "tier99");
  assert.equal(generatorRuntimeForTier("nonsense"), "gen1");
});

test("GENERATOR: the control exists, is the registry's, and is translated", () => {
  assert.match(HTML, /<select id="generatorRuntime"/);
  for (const rt of GENERATOR_RUNTIMES) {
    // Prettier may wrap a long option tag across lines; match the tag
    // loosely (any attributes/line breaks between <option and its value).
    assert.match(HTML, new RegExp(`<option[^>]*value="${rt}"`));
  }
  const gen1At = HTML.indexOf('value="gen1"');
  assert.match(HTML.slice(gen1At, HTML.indexOf(">", gen1At)), /selected/);
  assert.doesNotMatch(HTML, /id="generatorAllowed"/);
  const controls = inputsFor("offgrid").map((i) => i.control);
  assert.ok(controls.includes("generatorRuntime"));
  assert.ok(!controls.includes("generatorAllowed"));
  for (const [id, L] of Object.entries(LOCALES)) {
    for (const key of [
      "generatorRuntimeLabel",
      "generatorRuntime0",
      "generatorRuntime1",
      "generatorRuntime2",
    ]) {
      assert.ok(L[key], `${id} is missing ${key}`);
    }
    assert.ok(!("generatorLabel" in L), `${id} still carries the dead key`);
  }
});

test("GENERATOR: ui.js derives engine state from the one answer", () => {
  assert.match(UI, /generatorAllowedForRuntime\(/);
  assert.match(UI, /tierForGeneratorRuntime\(genRuntime\.value\)/);
  assert.match(UI, /generatorRuntimeForTier\(o\.at\)/);
  assert.match(UI, /generatorRuntimeForTier\(autoTierNode\.value\)/);
});
