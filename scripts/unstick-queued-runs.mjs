// Unstick runs GitHub never gave a runner to.
//
// The failure mode this automates, observed on 2026-09-19: two runs created in
// the same minute sat `queued` for ~45 minutes while other runs on the same
// repo completed normally. No runner was ever allocated. The remedy that worked
// was manual — cancel the run, then rerun it — which produced fresh job ids
// that were picked up immediately.
//
// Cancelling a queued run leaves a CANCELLED check run on its head SHA, and a
// cancelled check shadows a passing one for required-status purposes (see the
// note in .github/workflows/test.yml). That is exactly how a PR ends up
// BLOCKED with every check green — so this tool NEVER touches pull_request
// runs. `scripts/lib/stuck-runs.mjs` selects main-branch runs only, and skips
// anything legitimately waiting behind a sibling of the same workflow.
//
// Limitation, stated plainly: if the platform has no runners at all, this job
// cannot run either — it helps the partial stall, which is what was observed.
//
// Usage:
//   GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo \
//     node scripts/unstick-queued-runs.mjs [--dry-run] [--min-minutes N] [--cap N]
// Exit: 0 = nothing to do or the remedy was applied, 1 = the remedy failed.

import { exitWhenDrained } from "./lib/graceful-exit.mjs";
import {
  classifyCancelProbeStatus,
  selectStuckRuns,
} from "./lib/stuck-runs.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : fallback;
};

const DRY = process.argv.includes("--dry-run");
// Proves the token may actually act, without acting on anything. See
// checkPermissions() for why the probe is side-effect free.
const CHECK_PERMISSIONS = process.argv.includes("--check-permissions");
const MIN_MINUTES = arg("--min-minutes", NaN);
const CAP = arg("--cap", NaN);

const API = (process.env.GITHUB_API_URL || "https://api.github.com").replace(
  /\/$/,
  "",
);
const REPO = process.env.GITHUB_REPOSITORY || "";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

const log = (line) => console.log(`UNSTICK  ${line}`);
const summary = [];
const note = (line) => {
  log(line);
  summary.push(line);
};
// No such run exists, so the probe's cancel request cannot affect anything.
const PROBE_RUN_ID = "999999999999";

if (!REPO || !TOKEN) {
  console.error(
    "UNSTICK FAIL  GITHUB_REPOSITORY and GITHUB_TOKEN are required — this tool talks to the Actions API and must not guess a target",
  );
  process.exit(1);
}

const api = async (path, init = {}) => {
  const res = await fetch(`${API}/repos/${REPO}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });
  const text = res.ok ? "" : await res.text().catch(() => "");
  if (!res.ok) {
    const err = new Error(
      `${init.method || "GET"} ${path} → HTTP ${res.status} ${text.slice(0, 200)}`,
    );
    // The probe classifies on the status code, so carry it rather than making
    // callers parse the message.
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json().catch(() => null);
};

const snapshot = (r) => ({
  id: r.id,
  workflow: r.name,
  status: r.status,
  branch: r.head_branch,
  createdAt: r.created_at,
  url: r.html_url,
  attempt: r.run_attempt,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Answer, from inside a real CI run, the question the dry path cannot: may this
 * token actually CANCEL a run? Both checks are side-effect free — the cancel is
 * aimed at a run id that does not exist, so at worst GitHub answers 404. A 403
 * is the actionable verdict (the workflow is missing `actions: write`); an
 * unexpected status is reported as inconclusive rather than failing an hourly
 * job on a transient blip.
 * @returns {Promise<number>} 0 = can read and cancel, 1 = it cannot
 */
async function checkPermissions() {
  let verdict = 0;
  try {
    await api("/actions/runs?per_page=1");
    note("permission probe: actions: read OK (runs are listable)");
  } catch (e) {
    verdict = 1;
    note(`permission probe: CANNOT list runs — ${e.message}`);
  }
  try {
    await api(`/actions/runs/${PROBE_RUN_ID}/cancel`, { method: "POST" });
    note(
      "permission probe: unexpected 2xx on a non-existent run — inconclusive",
    );
  } catch (e) {
    const how = classifyCancelProbeStatus(e.status);
    if (how === "authorized")
      note(
        `permission probe: actions: write OK (cancel of non-existent run ${PROBE_RUN_ID} answered 404, so the request was authorised and touched nothing)`,
      );
    else if (how === "denied") {
      verdict = 1;
      note(
        `permission probe: CANNOT cancel runs — HTTP ${e.status}. Fix the workflow's permissions: block (needs actions: write).`,
      );
    } else
      note(
        `permission probe: inconclusive (HTTP ${e.status ?? "none"}) — a transient API answer, not a verdict`,
      );
  }
  return verdict;
}

async function main() {
  if (CHECK_PERMISSIONS) return checkPermissions();
  // One page of 100 is deliberate: beyond that this is a platform backlog, and
  // the selection's bailout guard stands the tool down anyway.
  const [queuedRes, busyRes] = await Promise.all([
    api("/actions/runs?status=queued&per_page=100"),
    api("/actions/runs?status=in_progress&per_page=100"),
  ]);
  const runs = [
    ...(queuedRes?.workflow_runs || []).map(snapshot),
    ...(busyRes?.workflow_runs || []).map(snapshot),
  ];

  const { selected, standDown, stuckCount, waitingBehindSibling } =
    selectStuckRuns(runs, {
      minQueuedMs: Number.isFinite(MIN_MINUTES)
        ? MIN_MINUTES * 60 * 1000
        : undefined,
      cap: Number.isFinite(CAP) ? CAP : undefined,
    });

  note(
    `queue snapshot: ${runs.filter((r) => r.status === "queued").length} queued ` +
      `(${stuckCount} stuck on main, ${waitingBehindSibling} waiting behind a sibling), ` +
      `${runs.filter((r) => r.status === "in_progress").length} in progress`,
  );

  if (standDown) {
    note(`standing down — ${standDown}`);
    return 0;
  }
  if (!selected.length) {
    note("nothing to unstick");
    return 0;
  }

  let failed = 0;
  for (const run of selected) {
    const label = `${run.workflow} #${run.id} (${run.id}, attempt ${run.attempt}, queued ${Math.round((Date.now() - Date.parse(run.createdAt)) / 60000)}m)`;
    if (DRY) {
      note(`would cancel then rerun: ${label} — ${run.url}`);
      continue;
    }
    try {
      await api(`/actions/runs/${run.id}/cancel`, { method: "POST" });
      // A rerun is only accepted once the run is no longer queued.
      let status = "queued";
      for (let i = 0; i < 20 && status === "queued"; i++) {
        await sleep(3000);
        status = (await api(`/actions/runs/${run.id}`))?.status || "queued";
      }
      if (status === "queued") throw new Error("still queued after cancel");
      await api(`/actions/runs/${run.id}/rerun`, { method: "POST" });
      note(`cancelled and requeued: ${label} — ${run.url}`);
    } catch (e) {
      failed++;
      note(`could not unstick ${label}: ${e.message}`);
    }
  }

  return failed ? 1 : 0;
}

const code = await main().catch((e) => {
  console.error(`UNSTICK FAIL  ${e.message}`);
  summary.push(`FAILED: ${e.message}`);
  return 1;
});

const stepSummary = process.env.GITHUB_STEP_SUMMARY;
if (stepSummary) {
  try {
    const { appendFileSync } = await import("node:fs");
    appendFileSync(
      stepSummary,
      `### Queue watchdog\n\n${summary.map((l) => `- ${l}`).join("\n")}\n`,
    );
  } catch {
    /* a missing summary file must never change the verdict */
  }
}

// Drain before exiting: this process has just fetched from the API, and
// process.exit() mid-close aborts libuv on Windows with
// "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)", losing the verdict.
exitWhenDrained(code);
