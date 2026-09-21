// Pure worker-lifecycle policy; no DOM or engine state belongs here.
export function staleRunAction(responseSeq, currentSeq, hasPendingRun) {
  if (responseSeq === undefined || responseSeq === currentSeq) return "current";
  return hasPendingRun ? "flush" : "hold";
}
