import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  staleRunAction,
  errorReleasesRunChannel,
} from "../assets/js/sizing/run-coordinator.js";

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

// The historical leak: a stale-error early return that skipped the release.
const STALE_LEAK = /s !== undefined && !fresh\s*\) return;/;

test("a stale reply always releases the full-run channel", () => {
  const ui = fs.readFileSync("assets/js/sizing/ui.js", "utf8");
  assert.doesNotMatch(
    ui,
    STALE_LEAK,
    "no early return may swallow the release of workerBusy for stale replies",
  );
});

test("error streams follow the release contract", () => {
  // Slice errors never free the run channel: a full run can still be
  // computing behind the slice.
  assert.equal(errorReleasesRunChannel("slice"), false);
  assert.equal(errorReleasesRunChannel("slice", 3, 4), false);
  assert.equal(errorReleasesRunChannel("slice", 5, 5), false);
  // Run errors always free it, stale or fresh: the worker has already
  // moved on, so the next explicit run must not queue behind a ghost.
  assert.equal(errorReleasesRunChannel("run", 3, 4), true);
  assert.equal(errorReleasesRunChannel("run", 5, 5), true);
  assert.equal(errorReleasesRunChannel("unknown", 3, 4), true);
});

test("the worker error path releases the run channel exactly once", () => {
  const ui = fs.readFileSync("assets/js/sizing/ui.js", "utf8");
  // The error branch must consult the coordinator before the shared release.
  assert.match(
    ui,
    /if \(!errorReleasesRunChannel\(ev\.data\.stream\)\) return;/,
  );
  // And the shared release must be the unconditional tail, not nested under
  // a freshness check that a stale reply could skip.
  assert.match(
    ui,
    /workerBusy = false;\s*restoreRunButton\(\);\s*flushPendingRun\(\);/,
  );
});
