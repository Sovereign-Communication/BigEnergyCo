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
