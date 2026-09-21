import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const UI = readFileSync("assets/js/sizing/ui.js", "utf8");

test("stale full-run replies do not release an already-running replacement", () => {
  const start = UI.indexOf(
    "if (ev.data.seq !== undefined && ev.data.seq !== runToken)",
  );
  assert.notEqual(start, -1, "stale full-run branch must exist");
  const branch = UI.slice(start, UI.indexOf("return;", start) + 7);
  assert.match(
    branch,
    /if \(pendingRun\)/,
    "only a stale reply with a queued replacement may release and flush the worker",
  );
  assert.doesNotMatch(
    branch,
    /workerBusy = false;\s*restoreRunButton\(\);\s*flushPendingRun\(\);\s*return;/,
    "an unconditional release lets a stale reply race a replacement run",
  );
});
