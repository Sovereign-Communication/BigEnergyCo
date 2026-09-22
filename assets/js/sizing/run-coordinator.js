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
    // Drop any collapsed replacement without touching the in-flight run —
    // the exact semantics of the old `pendingRun = null` in run()'s
    // validation-failure blocks: an invalid request discards the queue but
    // leaves the channel's busy/sequence state alone.
    dropPending() {
      pending = null;
    },
    // Open a run: bumps the sequence and marks the channel busy. The
    // returned seq travels with the message and comes back on the reply.
    begin() {
      busy = true;
      return ++seq;
    },
    // The one release path for a full-run reply (ok, error, unknown):
    // frees the channel and hands back any collapsed replacement. A stale
    // reply releases too — the worker has already moved on, and swallowing
    // the release deadlocks the next explicit run behind a finished one.
    // Calling settle() twice is inert: the second call releases nothing and
    // returns null.
    settle() {
      busy = false;
      const next = pending;
      pending = null;
      return next;
    },
  };
}
