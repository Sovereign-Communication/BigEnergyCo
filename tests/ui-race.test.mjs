import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { staleRunAction } from "../assets/js/sizing/run-coordinator.js";

const CASES = [
  ["current reply", 4, 4, false, "current"],
  ["current reply with queued work", 4, 4, true, "current"],
  ["stale reply flushes queued replacement", 3, 4, true, "flush"],
  ["stale reply does not release active replacement", 3, 4, false, "hold"],
  [
    "legacy reply without a sequence stays current",
    undefined,
    4,
    false,
    "current",
  ],
];

test("stale worker replies follow the run lifecycle contract", () => {
  for (const [label, responseSeq, currentSeq, pending, expected] of CASES) {
    assert.equal(
      staleRunAction(responseSeq, currentSeq, pending),
      expected,
      label,
    );
  }
});

test("a stale reply always releases the full-run channel", () => {
  const ui = fs.readFileSync("assets/js/sizing/ui.js", "utf8");
  assert.match(
    ui,
    /if \(staleAction !== "current"\) \{[\s\S]*?workerBusy = false;[\s\S]*?if \(staleAction === "flush"\) flushPendingRun\(\);/,
  );
});
