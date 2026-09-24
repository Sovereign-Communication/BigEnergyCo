// Pure worker-lifecycle policy; no DOM or engine state belongs here.
export function staleRunAction(responseSeq, currentSeq, hasPendingRun) {
  if (responseSeq === undefined || responseSeq === currentSeq) return "current";
  return hasPendingRun ? "flush" : "hold";
}

// Which error streams may free the full-run channel? Only run errors: the
// run stream owns workerBusy, and a slice error must never release it — a
// full run can legitimately still be computing behind the slice. Run errors
// free the channel whether fresh or stale: a stale one means the worker has
// already moved on, and swallowing the release deadlocks the next explicit
// run behind a finished worker (the same leak the "ok" path guards against).
export function errorReleasesRunChannel(stream) {
  return stream !== "slice";
}

// A worker run gets three minutes before the UI retires a hung worker and
// permits an explicit retry. Application inputs cannot alter this bound.
export const RUN_REPLY_DEADLINE_MS = 180000;

// ── Run channel state machine ───────────────────────────────────────────────
//
// One owner for the full-run channel: whether the worker is busy, the
// sequence that retires superseded replies, and any collapsed trailing
// request. The UI asks it questions (isBusy, latestSeq, pending) and funnels
// every full-run reply through settle(). The two historical stale-reply
// leaks — a released-mid-paint ok path and an early-returned error path —
// are structurally closed by that single funnel instead of per-branch
// release lines.
//
// Lifecycle: idle → begin() → busy → settle() → idle. A request that
// arrives while busy collapses via collapse() (a non-quiet request wins so
// an explicit run still scrolls + spins); settle() returns the replacement
// to run after releasing, or null. invalidate() retires in-flight work
// WITHOUT queueing a replacement — a pre-calculation edit invalidates the
// very inputs the in-flight run carries, so its reply must neither paint
// nor trigger a re-run.
export function createRunChannel() {
  let busy = false;
  let seq = 0;
  let pending = null; // { quiet } — the latest superseding request
  let watchGen = 0; // deadline-watch generation (see armDeadline below)
  let deadlineSeq = null; // run whose reply the active deadline still owns

  return {
    get isBusy() {
      return busy;
    },
    get pending() {
      return pending !== null;
    },
    get latestSeq() {
      return seq;
    },
    // Collapse: only the latest inputs matter, re-read fresh when flushed.
    // Retiring the in-flight run FIRST (the seq bump) keeps its stale
    // response from ever passing the freshness check — e.g. an off-grid
    // response landing mid grid-tie run and hiding the cut slider under it.
    collapse(quiet = false) {
      pending = { quiet: (pending ? pending.quiet : true) && quiet };
      return ++seq;
    },
    invalidate() {
      pending = null;
      return ++seq;
    },
    // The run() validation-failure path discards queued work while leaving
    // the busy state and sequence unchanged.
    dropPending() {
      pending = null;
    },
    // Open a run: bumps the sequence and marks the channel busy. The
    // returned seq travels with the message and comes back on the reply.
    begin() {
      busy = true;
      return ++seq;
    },
    // Worker reply deadline (ui.js arms the timer): the watch lives exactly
    // as long as the channel is busy. armDeadline() issues a token the fire
    // callback must validate — a stale timer (answered or superseded run)
    // reports nothing — and settle() retires it, so every settle path
    // disarms structurally instead of remembering to. invalidate() and
    // collapse() do NOT touch the watch: the in-flight reply they retire is
    // precisely the one the deadline is still waiting on.
    armDeadline(runSeq) {
      deadlineSeq = runSeq;
      return ++watchGen;
    },
    deadlineCurrent(token) {
      return token === watchGen;
    },
    deadlineOwns(runSeq) {
      return deadlineSeq !== null && runSeq === deadlineSeq;
    },
    // The one release path for a full-run reply (ok, error, unknown):
    // frees the channel and hands back any collapsed replacement. A stale
    // reply releases too — the worker has already moved on, and swallowing
    // the release deadlocks the next explicit run behind a finished one.
    // Calling settle() twice is inert: the second call releases nothing and
    // returns null.
    settle() {
      busy = false;
      watchGen++; // the channel is free: the deadline watch retires with it
      deadlineSeq = null;
      const next = pending;
      pending = null;
      return next;
    },
  };
}
