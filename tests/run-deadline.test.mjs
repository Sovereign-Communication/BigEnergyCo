// The worker reply deadline contract: a silent worker must surface an
// honest, retryable error instead of hanging forever on "running…"
// (reproduced live on production through the share-restore auto-run).
// The watch lives in run-coordinator.js alongside the channel it guards:
// armed with armDeadline(), validated by deadlineCurrent() at fire time,
// retired structurally by settle() — never by a call site remembering to.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createRunChannel,
  RUN_REPLY_DEADLINE_MS,
} from "../assets/js/sizing/run-coordinator.js";

test("deadline policy: production worker timeout is fixed at three minutes", () => {
  assert.equal(RUN_REPLY_DEADLINE_MS, 180000);
});

test("deadline watch: armed token is current until settle retires it", () => {
  const ch = createRunChannel();
  const seq = ch.begin();
  const token = ch.armDeadline(seq);
  assert.ok(ch.deadlineCurrent(token), "freshly armed token must be current");
  assert.ok(ch.deadlineOwns(seq), "deadline owns the run it was armed for");
  const nextSeq = ch.begin();
  assert.equal(ch.deadlineOwns(seq), true);
  assert.equal(ch.deadlineOwns(nextSeq), false);
  ch.settle(); // every full-run reply funnels through here
  assert.equal(
    ch.deadlineCurrent(token),
    false,
    "settle must retire the watch — a fired timer after an answered run reports nothing",
  );
  const next = ch.armDeadline(99);
  assert.ok(ch.deadlineCurrent(next));
  assert.equal(
    ch.deadlineCurrent(token),
    false,
    "a newer arm must not resurrect an older token",
  );
});

test("deadline watch: invalidate and collapse keep the watch alive", () => {
  const ch = createRunChannel();
  const seq = ch.begin();
  const token = ch.armDeadline(seq);
  // A pre-calc edit retires the in-flight reply without settling — the
  // reply the deadline awaits may still never come, so the watch must
  // survive to report it.
  ch.invalidate();
  assert.ok(
    ch.deadlineCurrent(token),
    "invalidate must not disarm — the hung reply is exactly what we wait on",
  );
  assert.equal(
    ch.deadlineOwns(ch.latestSeq),
    false,
    "a superseded sequence cannot be timed out as if it were current",
  );
  // A collapsed re-click queues a replacement but the channel still holds
  // the SAME in-flight run: its watch must keep guarding it.
  ch.collapse(false);
  assert.ok(
    ch.deadlineCurrent(token),
    "collapse queues work but does not retire the watch",
  );
  assert.equal(
    ch.deadlineOwns(ch.latestSeq),
    false,
    "a queued replacement does not become the active run before settle",
  );
  assert.ok(
    ch.deadlineOwns(seq),
    "the deadline continues to belong to the active worker sequence",
  );
});

test("deadline UI: stale expiry always settles without overwriting newer status", () => {
  const ui = fs.readFileSync("assets/js/sizing/ui.js", "utf8");
  const start = ui.indexOf("function handleRunDeadline() {");
  const end = ui.indexOf("// The last full-run inputs", start);
  assert.ok(start >= 0 && end > start, "deadline handler is present");
  const handler = ui.slice(start, end);
  assert.match(handler, /stuckWorker\?\.terminate\(\)/);
  assert.match(
    handler,
    /if \(current\) \{[\s\S]*setStatus\(t\("errorTimeout"\)\)/,
  );
  assert.match(handler, /flushPendingRun\(\);\s*\}/);
  assert.doesNotMatch(handler, /if \(!current\) return/);
});

test("deadline cleanup: a stale timeout still releases queued replacement work", () => {
  const ch = createRunChannel();
  const timedOut = ch.begin();
  ch.armDeadline(timedOut);
  ch.collapse(false);
  assert.equal(ch.deadlineOwns(ch.latestSeq), false);
  assert.deepEqual(
    ch.settle(),
    { quiet: false },
    "settling a superseded timeout must hand back its queued replacement",
  );
  assert.equal(ch.isBusy, false);
});

test("browser smoke: deadline fixture shortens only the production timer and restores hooks", () => {
  const smoke = fs.readFileSync("scripts/smoke/deadline.js", "utf8");
  assert.match(
    smoke,
    /import \{ RUN_REPLY_DEADLINE_MS \} from "\.\.\/\.\.\/assets\/js\/sizing\/run-coordinator\.js"/,
  );
  assert.match(smoke, /delay === \$\{RUN_REPLY_DEADLINE_MS\}/);
  assert.match(smoke, /window\.__shortenedRunDeadlines === 0/);
  assert.match(smoke, /window\.setTimeout = window\.__nativeSetTimeout/);
  assert.match(
    smoke,
    /Worker\.prototype\.postMessage = window\.__originalPostMessage/,
  );
  assert.match(smoke, /window\.__runPosts >= 2/);
  assert.match(smoke, /window\.__holdRun = 1/);
  assert.match(smoke, /window\.__holdRun = 0/);
  assert.doesNotMatch(
    smoke,
    /Emulation\.setVirtualTimePolicy/,
    "the fixture must not freeze the browser or interfere with worker recovery",
  );
});

test("deadline watch: begin alone never resurrects a retired watch", () => {
  const ch = createRunChannel();
  const old = ch.armDeadline();
  ch.begin();
  ch.settle();
  ch.begin(); // a new run that has not armed yet must not look current
  assert.equal(
    ch.deadlineCurrent(old),
    false,
    "begin must not make a retired token current again",
  );
  assert.equal(
    ch.deadlineCurrent(0),
    false,
    "the never-armed token is never current",
  );
});
