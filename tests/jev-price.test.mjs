// Master plan P0.3(a) / R-AI-08: "A single exported constant
// `JEV_PRICE_USD_PER_MILLION_TOKENS = 0.00042` (D-13) is imported by the worker
// and the gate script and pinned by a test."
//
// These gates pin the VALUE and the SINGLE-SOURCE rule. The value alone is
// trivial to satisfy by editing a number in place; the rule is what stops the
// worker's accounting and the gate's roll-up from drifting apart again, which
// is exactly how the 42.0 constant survived unnoticed (finding F-37).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  JEV_PRICE_USD_PER_MILLION_TOKENS,
  jevCostUsd,
} from "../worker/jev-price.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

// Comments are documentation, not code. A comment that NAMES the thing this
// change removes ("the old constant was X") must not read as the constant
// still being there — so every source assertion below runs on stripped code.
// CRLF matters: `$` does not match before a trailing \r, hence the normalise.
const stripComments = (src) =>
  src
    .replace(/\r\n?/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\/\/.*/, ""))
    .join("\n");

test("GATE: the canonical Jev price is exactly 0.00042 (D-13)", () => {
  assert.equal(JEV_PRICE_USD_PER_MILLION_TOKENS, 0.00042);
});

test("GATE: the price constant is a number, not a string or a stringified float", () => {
  assert.equal(typeof JEV_PRICE_USD_PER_MILLION_TOKENS, "number");
  assert.ok(Number.isFinite(JEV_PRICE_USD_PER_MILLION_TOKENS));
  // A rounding accident (0.00042 -> 4.2e-4 spelled differently) is still the
  // same number, so assert the exact literal survives a round-trip.
  assert.equal(String(JEV_PRICE_USD_PER_MILLION_TOKENS), "0.00042");
});

test("GATE: jevCostUsd prices a call at the canonical rate", () => {
  // 1,000,000 input tokens at 0.00042/M = exactly $0.00042.
  assert.equal(jevCostUsd(1_000_000), 0.00042);
  // 2 billion tokens — the owner's reported volume — is $0.84 at this rate.
  // Plan V-11 records that this does not reconcile with the ~$0.07 reported;
  // the constant stands, so the arithmetic is pinned here on purpose.
  assert.ok(Math.abs(jevCostUsd(2_000_000_000) - 0.84) < 1e-9);
  assert.equal(jevCostUsd(0), 0);
});

test("GATE: jevCostUsd never returns NaN for junk telemetry", () => {
  // A NaN here would poison a ledger row, so bad input must degrade to 0.
  for (const bad of [undefined, null, NaN, -5, "abc", {}, []]) {
    assert.equal(jevCostUsd(bad), 0, `jevCostUsd(${String(bad)}) must be 0`);
  }
});

test("GATE: the gate script imports the price, it does not redeclare it", () => {
  const gate = stripComments(read("scripts/validate-jev-complete.mjs"));
  assert.match(
    gate,
    /from\s+"\.\.\/worker\/jev-price\.mjs"/,
    "the gate must import the shared price module",
  );
  assert.doesNotMatch(
    gate,
    /JEV_INPUT_PRICE_PER_MILLION\s*=/,
    "the private JEV_INPUT_PRICE_PER_MILLION is exactly what P0.3(a) removes",
  );
  assert.match(
    gate,
    /jevCostUsd\(/,
    "the gate must cost via the shared helper",
  );
});

test("GATE: the worker imports the same price, not a second copy", () => {
  const worker = stripComments(read("worker/index.js"));
  assert.match(
    worker,
    /from\s+"\.\/jev-price\.mjs"/,
    "the worker must import the shared price module",
  );
  assert.match(
    worker,
    /jevCostUsd\(/,
    "the worker must actually use it — an unused import is not R-AI-08",
  );
});

test("GATE: no second copy of the price exists anywhere in the Jev path", () => {
  // The failure mode being prevented: someone re-adds a local constant because
  // they did not know about the shared module. Catch the literal, not the name.
  const consumers = [
    "scripts/validate-jev-complete.mjs",
    "worker/index.js",
    "worker/jev-price.mjs",
    "scripts/lib/jev-complete.mjs",
  ];
  for (const rel of consumers) {
    const body = read(rel);
    const code = stripComments(body);
    if (rel === "worker/jev-price.mjs") {
      // The owner of the number is allowed to state it, exactly once.
      const hits = code.match(/0\.00042/g) || [];
      assert.equal(
        hits.length,
        1,
        "the shared module must state the canonical rate exactly once",
      );
      continue;
    }
    assert.doesNotMatch(
      code,
      /0\.00042|42\.0\s*;/,
      `${rel} must not restate the Jev price; import worker/jev-price.mjs`,
    );
  }
});

test("GATE: the worker logs token counts, never content", () => {
  // R-AI-08: "The worker logs token counts only (never content)". The usage
  // line must carry metered volume and cost, and must not carry the state,
  // the questions, or the answers.
  const worker = read("worker/index.js");
  const idx = worker.indexOf("jev_usage");
  assert.ok(idx > -1, "the worker must emit a jev_usage record");
  const window = worker.slice(idx, idx + 400);
  assert.match(window, /input_tokens/, "the record must carry token counts");
  assert.match(window, /cost_usd/, "the record must carry the computed cost");
  for (const leak of ["state", "questions", "answers", "body"]) {
    assert.doesNotMatch(
      window,
      new RegExp(`${leak}\\s*[:,}]`),
      `the usage record must not log ${leak}`,
    );
  }
});
