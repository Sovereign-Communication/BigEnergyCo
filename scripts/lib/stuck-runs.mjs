// Which queued workflow runs are genuinely STUCK, and which are merely waiting.
//
// Why this exists: on 2026-09-19 two runs created in the same minute sat in the
// `queued` state for ~45 minutes while other runs on the same repo completed
// normally. Nothing was wrong with the code — GitHub never allocated a runner.
// The remedy that worked was manual: cancel the run, then rerun it, which
// produced fresh job ids that were picked up immediately.
//
// This module decides, from a snapshot of runs, which ones are stuck in that
// way. It is pure so the decision can be tested without the API, because the
// dangerous part is not the cancelling — it is cancelling something that was
// working fine.
//
// Two guards matter:
//
//   1. A run queued behind a SIBLING of the same workflow is waiting, not
//      stuck. `concurrency:` groups make that normal (verify-staging queues
//      with cancel-in-progress: false), and cancelling it would destroy a
//      legitimate run.
//   2. A mass of stuck runs means the platform is having an incident, not that
//      individual runs need a nudge. Cancel-then-rerun across a backlog would
//      AMPLIFY it, so above `bailoutAbove` the watchdog stands down and only
//      reports.

/**
 * Interpret the response to a cancel request aimed at a run id that does not
 * exist. This is how the cancel permission is proven without cancelling
 * anything: GitHub checks authorisation BEFORE existence, so an unauthorised
 * token is refused with 403 while an authorised one is told the run is absent
 * (404). A 2xx on a non-existent id is impossible, and 5xx tells us nothing.
 * @param {number} status
 * @returns {"authorized"|"denied"|"inconclusive"}
 */
export function classifyCancelProbeStatus(status) {
  if (status === 404) return "authorized";
  if (status === 403 || status === 401) return "denied";
  return "inconclusive";
}

export const DEFAULT_MIN_QUEUED_MS = 20 * 60 * 1000;
export const DEFAULT_CAP = 3;
export const DEFAULT_BAILOUT_ABOVE = 8;
export const DEFAULT_BRANCH = "main";

/**
 * @typedef {object} RunSnapshot
 * @property {number} id
 * @property {string} workflow workflow name
 * @property {string} status queued | in_progress | completed
 * @property {string} branch head branch
 * @property {string|number} createdAt ISO timestamp or epoch ms
 * @property {string} [url]
 */

/**
 * Select the runs worth unsticking.
 * @param {RunSnapshot[]} runs every recent run (any status)
 * @param {object} [opts]
 * @param {number} [opts.now] epoch ms
 * @param {number} [opts.minQueuedMs] how long is too long to sit queued
 * @param {number} [opts.cap] most runs to unstick in one pass
 * @param {number} [opts.bailoutAbove] stand down above this many stuck runs
 * @param {string} [opts.branch] only this branch is considered
 * @returns {{selected: RunSnapshot[], standDown: string|null, stuckCount: number, waitingBehindSibling: number}}
 */
export function selectStuckRuns(runs, opts = {}) {
  const {
    now = Date.now(),
    minQueuedMs = DEFAULT_MIN_QUEUED_MS,
    cap = DEFAULT_CAP,
    bailoutAbove = DEFAULT_BAILOUT_ABOVE,
    branch = DEFAULT_BRANCH,
  } = opts;

  const all = Array.isArray(runs) ? runs : [];
  const queued = all.filter(
    (r) => r.status === "queued" && r.branch === branch,
  );
  const busy = new Set(
    all.filter((r) => r.status === "in_progress").map((r) => r.workflow),
  );

  const oldEnough = queued.filter((r) => {
    const t = Date.parse(String(r.createdAt));
    if (!Number.isFinite(t)) return false;
    return now - t >= minQueuedMs;
  });
  const stuck = oldEnough.filter((r) => !busy.has(r.workflow));

  const result = {
    selected: [],
    standDown: null,
    stuckCount: stuck.length,
    waitingBehindSibling: oldEnough.length - stuck.length,
  };

  if (stuck.length > bailoutAbove) {
    result.standDown =
      `${stuck.length} runs are queued past ${Math.round(minQueuedMs / 60000)}m — ` +
      `that is a platform backlog, not individual stalls; cancelling them would ` +
      `add load instead of removing it. Standing down and reporting only.`;
    return result;
  }

  result.selected = stuck.slice(0, cap);
  return result;
}
