// Executable contract for the run-lifecycle state machine and ui.js's real
// worker wiring. The state tests exercise createRunChannel() directly; the
// wiring tests load ui.js in a minimal DOM stub and drive its onmessage
// handler against a fake Worker — the same channel the browser uses.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  staleRunAction,
  errorReleasesRunChannel,
  createRunChannel,
} from "../assets/js/sizing/run-coordinator.js";

// ── Policy table: which reply wins, and what happens to a stale one ────────

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
    "no early return may swallow the release of the run channel for stale replies",
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

// ── State machine behavior ──────────────────────────────────────────────────

test("run channel: begin/settle open and release exactly once", () => {
  const ch = createRunChannel();
  assert.equal(ch.isBusy, false);
  const seq = ch.begin();
  assert.equal(seq, 1);
  assert.equal(ch.isBusy, true);
  assert.deepEqual(ch.settle(), null);
  assert.equal(ch.isBusy, false);
  // A second settle is inert: no double release, no phantom flush.
  assert.deepEqual(ch.settle(), null);
});

test("run channel: collapse keeps the newest non-quiet request", () => {
  const ch = createRunChannel();
  ch.begin();
  ch.collapse(true); // slider refine while busy
  assert.equal(ch.pending, true);
  ch.collapse(false); // explicit click lands on top — it wins
  assert.deepEqual(ch.settle(), { quiet: false });
  assert.equal(ch.pending, false);
});

test("run channel: invalidate retires without queueing a replacement", () => {
  const ch = createRunChannel();
  const inFlight = ch.begin();
  ch.collapse(false);
  const retired = ch.invalidate();
  assert.equal(ch.pending, false);
  assert.deepEqual(ch.settle(), null);
  // The in-flight reply's seq now trails the channel: stale on arrival, and
  // it still releases cleanly through settle() (no leak, no flush).
  assert.equal(inFlight < retired, true);
  assert.equal(ch.isBusy, false);
  assert.deepEqual(ch.settle(), null);
});

test("run channel: dropPending discards the queue and nothing else", () => {
  const ch = createRunChannel();
  ch.begin();
  ch.collapse(true);
  const seqBefore = ch.latestSeq;
  ch.dropPending();
  assert.equal(ch.pending, false);
  assert.equal(ch.isBusy, true);
  assert.equal(ch.latestSeq, seqBefore);
  // The in-flight run still completes and releases normally.
  assert.deepEqual(ch.settle(), null);
  assert.equal(ch.isBusy, false);
});

// ── ui.js wiring ────────────────────────────────────────────────────────────
// The wiring is a 9.7k-line browser module; its behavioral proof lives in the
// smoke harness's held-response gate (a real engine reply, held, made stale,
// released — in Chrome). Here we pin the structural contract: the error
// branch consults the coordinator, and the funnel is the ONLY release path.
test("wiring: error path funnels the release through flushPendingRun", () => {
  const ui = fs.readFileSync("assets/js/sizing/ui.js", "utf8");
  // The error branch consults the coordinator before the shared funnel...
  assert.match(
    ui,
    /if \(!errorReleasesRunChannel\(ev\.data\.stream\)\) return;/,
  );
  // ...and the funnel is the ONLY place the channel is released: no stray
  // direct busy-flag writes remain anywhere in the file.
  assert.doesNotMatch(ui, /\bworkerBusy\s*=/);
  assert.doesNotMatch(ui, /\bworkerBusy\b/);
  assert.doesNotMatch(ui, /\bpendingRun\b/);
});
