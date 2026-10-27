// Car 4 of the Jev audit carried 42 error-discipline and URL/sink suspects. Most
// are already guarded or no longer exist; the dispositions live on #199. These
// four tests cover the items the read confirmed, and each fails on the unfixed
// tree.
//
// Scope: P0.6, completion-program evidence (facets: `docs`).
import { test } from "node:test";
import assert from "node:assert/strict";

import { runChild } from "../scripts/lib/run-child.mjs";
import {
  laborMidPerKwh,
  INSTALL_LABOR_PER_KWH_USABLE,
} from "../assets/js/sizing/money.js";
import { paretoFront } from "../assets/js/sizing/frontier.js";

// ── the two staging gates that could not report a failed spawn ─────────────

test("a child that cannot start resolves non-zero instead of crashing", async () => {
  // Reached when the executable is missing or the cwd does not exist. Before
  // runChild, `spawn` emitted "error" with no listener, which is a thrown
  // exception: the gate died with a raw stack before its `finally` closed the
  // static server and removed the staging directory.
  const code = await runChild("definitely-not-a-real-binary-xyz", []);
  assert.equal(code, 1, "a failed spawn must report a failure code");
});

test("a child that runs resolves its own exit code", async () => {
  const code = await runChild(process.execPath, ["-e", "process.exit(3)"]);
  assert.equal(code, 3, "the child's status is the result, not a constant");
  const ok = await runChild(process.execPath, ["-e", "process.exit(0)"]);
  assert.equal(ok, 0);
});

test("a child killed by a signal is a failure, not a success", async () => {
  const code = await runChild(process.execPath, [
    "-e",
    "process.kill(process.pid, 'SIGTERM')",
  ]);
  assert.notEqual(code, 0, "a signalled child never counts as green");
});

// ── production fallback-default items ─────────────────────────────────────

test("an unusable labor range falls back instead of throwing", () => {
  const installed =
    (INSTALL_LABOR_PER_KWH_USABLE[0] + INSTALL_LABOR_PER_KWH_USABLE[1]) / 2;
  // `laborPerKwh: null` is not covered by a default parameter, which only
  // applies to `undefined`, and it used to throw inside the cost model.
  assert.equal(laborMidPerKwh(null), installed);
  assert.equal(laborMidPerKwh(undefined), installed);
  assert.equal(laborMidPerKwh({}), installed);
  assert.equal(laborMidPerKwh([Number.NaN, 30]), installed);
  // A real range still wins.
  assert.equal(laborMidPerKwh([10, 20]), 15);
  assert.equal(laborMidPerKwh(["10", "20"]), 15, "numeric strings still parse");
});

test("paretoFront drops unplaceable points instead of throwing", () => {
  assert.deepEqual(paretoFront(undefined), []);
  assert.deepEqual(paretoFront(null), []);
  assert.deepEqual(paretoFront([]), []);

  const cheapGood = { capexUsd: 1000, outcome: 70 };
  const dearBetter = { capexUsd: 5000, outcome: 90 };
  const unpriced = { capexUsd: Number.NaN, outcome: 99 };
  const front = paretoFront([cheapGood, null, unpriced, dearBetter]);
  assert.deepEqual(
    front,
    [cheapGood, dearBetter],
    "a frontier of the priced points only, cheapest first",
  );
});
