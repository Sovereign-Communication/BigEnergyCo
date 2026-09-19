// CI resilience: telling a platform flake apart from a regression.
//
// Both halves here exist because of a real incident on 2026-09-19: a post-merge
// `Verify staging` run died on ERR_CERT_VERIFIER_CHANGED (a runner transport
// flake that passed on rerun and passes locally), and two runs sat `queued`
// for ~45 minutes until they were manually cancelled and rerun.
//
// The tests that matter most are the NEGATIVE ones: a real regression must not
// be classified as retryable, the retry must still fail when the transport
// error persists, and the queue watchdog must refuse to run without
// credentials rather than silently doing nothing.
//
// Run: node --test tests/ci-resilience.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  isTransientFailure,
  retryTransient,
} from "../scripts/lib/transient-retry.mjs";
import {
  DEFAULT_BAILOUT_ABOVE,
  classifyCancelProbeStatus,
  selectStuckRuns,
} from "../scripts/lib/stuck-runs.mjs";
import { deployedFiles } from "../scripts/lib/gates.mjs";

const url = (rel) => new URL(`../${rel}`, import.meta.url);
const read = (rel) => readFileSync(url(rel), "utf8");

const MINUTE = 60 * 1000;
const iso = (agoMs) => new Date(Date.now() - agoMs).toISOString();

// ── classification ──────────────────────────────────────────────────────────

test("the observed runner cert flake is retryable", () => {
  // Verbatim shape of the failure that blocked the 2026-09-19 post-merge run.
  const flake =
    "SMOKE FAIL no console errors — log.error: Failed to load resource: " +
    "net::ERR_CERT_VERIFIER_CHANGED " +
    "[https://sovereign-communication.github.io/BigEnergyCo/assets/js/chat.js?v=20260919d]";
  assert.equal(isTransientFailure(flake), true);
});

test("transient transport families are retryable", () => {
  for (const text of [
    "Error: connect ECONNRESET 140.82.1.1:443",
    "fetch failed",
    "The operation was aborted due to timeout",
    "socket hang up",
    "parity assets/js/sizing/ui.js — missing: HTTP 503",
    "network: ERR_CONNECTION_RESET",
    "curl: (7) Failed to connect … ERR_NAME_NOT_RESOLVED",
  ])
    assert.equal(isTransientFailure(text), true, `should retry: ${text}`);
});

test("a real regression is never retryable", () => {
  for (const text of [
    // A failed smoke gate: the retry would re-run it and fail again, but we
    // must not even pretend a broken build might be a flake.
    "SMOKE FAIL results region renders",
    "SMOKE FAIL no console errors — log.error: Uncaught TypeError: e is not a function",
    // A missing deployed file is the exact regression this gate guards.
    "VERIFY FAIL parity assets/js/sizing/ui.js — missing: HTTP 404",
    "VERIFY FAIL parity index.html — differs: local 1a2b3c4d vs served 5e6f7a8b",
    // A dropped CSP directive must fail immediately, not look like noise.
    "Refused to connect to 'https://power.larc.nasa.gov' because it violates the following Content Security Policy directive: \"connect-src 'self'\"",
    // A stale stamp / wrong artifact.
    "VERIFY FAIL staging serves the checkout's stamp — staging 20260917a vs checkout 20260919d",
    "VERIFY FAIL surface cloudflare: _headers is absent",
  ])
    assert.equal(isTransientFailure(text), false, `must not retry: ${text}`);
});

test("empty and non-string input is not transient", () => {
  assert.equal(isTransientFailure(""), false);
  assert.equal(isTransientFailure(undefined), false);
  assert.equal(isTransientFailure(null), false);
  assert.equal(isTransientFailure(404), false);
});

// ── retry behaviour ─────────────────────────────────────────────────────────

const noSleep = () => Promise.resolve();

test("a transient failure is retried and the later success is returned", async () => {
  let calls = 0;
  const seen = [];
  const out = await retryTransient(
    async () => {
      calls++;
      if (calls === 1) throw new Error("net::ERR_CERT_VERIFIER_CHANGED");
      return "verified";
    },
    {
      sleep: noSleep,
      onRetry: (info) => seen.push(info.attempt),
    },
  );
  assert.equal(out, "verified");
  assert.equal(calls, 2, "it must actually run a second time");
  assert.deepEqual(seen, [1], "and report that it did");
});

test("an assertional failure is not retried even once", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      retryTransient(
        async () => {
          calls++;
          throw new Error("VERIFY FAIL parity index.html — differs");
        },
        { sleep: noSleep },
      ),
    /differs/,
  );
  assert.equal(calls, 1, "a real regression must fail on the first attempt");
});

test("a transport error that persists still fails the gate", async () => {
  let calls = 0;
  const err = await retryTransient(
    async () => {
      calls++;
      throw new Error("net::ERR_CERT_VERIFIER_CHANGED");
    },
    { attempts: 3, sleep: noSleep },
  ).catch((e) => e);
  assert.equal(calls, 3, "every attempt is spent before giving up");
  assert.match(err.message, /ERR_CERT_VERIFIER_CHANGED/);
  assert.equal(
    err.transient,
    true,
    "and the verdict says a transport error outlived the retries",
  );
});

test("success on the first attempt costs exactly one call", async () => {
  let calls = 0;
  const out = await retryTransient(
    async () => {
      calls++;
      return 42;
    },
    { sleep: noSleep },
  );
  assert.equal(out, 42);
  assert.equal(calls, 1);
});

// ── stuck-run selection ─────────────────────────────────────────────────────

const run = (o) => ({
  id: 1,
  workflow: "Tests",
  status: "queued",
  branch: "main",
  createdAt: iso(MINUTE),
  url: "https://example.test/run/1",
  ...o,
});

test("a run queued only briefly is left alone", () => {
  const { selected, stuckCount } = selectStuckRuns([
    run({ createdAt: iso(MINUTE) }),
  ]);
  assert.deepEqual(selected, []);
  assert.equal(stuckCount, 0);
});

test("a main run queued past the threshold is selected", () => {
  const { selected } = selectStuckRuns([
    run({ id: 7, createdAt: iso(45 * MINUTE) }),
  ]);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].id, 7);
});

test("a run waiting behind a sibling of the same workflow is waiting, not stuck", () => {
  const { selected, waitingBehindSibling } = selectStuckRuns([
    run({ id: 1, createdAt: iso(45 * MINUTE) }),
    run({ id: 2, status: "in_progress", createdAt: iso(44 * MINUTE) }),
  ]);
  assert.deepEqual(selected, [], "concurrency queueing must not be cancelled");
  assert.equal(waitingBehindSibling, 1);
});

test("pull request runs are never touched by the watchdog", () => {
  // Cancelling a PR run leaves a CANCELLED check on its head SHA, which
  // shadows a passing one for required-status purposes.
  const { selected } = selectStuckRuns([
    run({ id: 1, branch: "fix/something", createdAt: iso(90 * MINUTE) }),
  ]);
  assert.deepEqual(selected, []);
});

test("in_progress runs are not candidates", () => {
  const { selected } = selectStuckRuns([
    run({ id: 1, status: "in_progress", createdAt: iso(90 * MINUTE) }),
  ]);
  assert.deepEqual(selected, []);
});

test("a mass of stuck runs stands the watchdog down instead of amplifying", () => {
  const many = Array.from({ length: DEFAULT_BAILOUT_ABOVE + 1 }, (_, i) =>
    run({ id: i, workflow: `wf-${i}`, createdAt: iso(60 * MINUTE) }),
  );
  const { selected, standDown, stuckCount } = selectStuckRuns(many);
  assert.deepEqual(
    selected,
    [],
    "a backlog is a platform incident, not a nudge",
  );
  assert.ok(standDown, "and it must say why it stood down");
  assert.equal(stuckCount, many.length);
});

test("one pass unsticks at most the cap", () => {
  const many = Array.from({ length: 3 }, (_, i) =>
    run({ id: i, workflow: `wf-${i}`, createdAt: iso(60 * MINUTE) }),
  );
  const { selected } = selectStuckRuns(many, { cap: 2 });
  assert.equal(selected.length, 2);
});

test("an unparseable createdAt is ignored rather than assumed stuck", () => {
  const { selected } = selectStuckRuns([run({ createdAt: "not-a-date" })]);
  assert.deepEqual(selected, []);
});

// ── the wiring ──────────────────────────────────────────────────────────────

test("the verifier retries transient failures and reports them", () => {
  const src = read("scripts/verify-staging.mjs");
  assert.match(
    src,
    /retryTransient\(/,
    "the staging verifier must use the bounded retry",
  );
  assert.match(
    src,
    /transientRetries: retries/,
    "and every retry must appear in the JSON verdict",
  );
  assert.match(
    src,
    /onRetry: \(info\) => recordRetry\("browser smoke"/,
    "the browser smoke — the step that actually flaked — must be retried",
  );
});

test("the queue watchdog is scheduled and allowed to act", () => {
  const wf = read(".github/workflows/workflow-watchdog.yml");
  // The cadence is pinned because it IS the budget decision: each tick takes a
  // runner slot, and a finer cron buys low-value latency on a rare event.
  assert.match(
    wf,
    /cron: "0 \* \* \* \*"/,
    "the watchdog runs hourly — a finer cadence spends runner slots for latency nothing waits on",
  );
  assert.match(wf, /actions: write/, "cancelling a run needs actions: write");
  assert.match(
    wf,
    /node scripts\/unstick-queued-runs\.mjs/,
    "and it must call the tool",
  );
});

// ── the deploy skip-list ────────────────────────────────────────────────────

// The patterns below are the shapes actually used in deploy.yml; a general glob
// engine would be more machinery than the two forms in play (`dir/**` and
// `**/*.ext`).
const matchesPattern = (pattern, file) => {
  if (pattern.endsWith("/**")) return file.startsWith(pattern.slice(0, -2));
  if (pattern.startsWith("**/")) return file.endsWith(pattern.slice(2));
  return file === pattern;
};

const deploySkipPatterns = () => {
  const block = read(".github/workflows/deploy.yml").split(/paths-ignore:/)[1];
  assert.ok(block, "deploy.yml must declare paths-ignore");
  const end = block.indexOf("workflow_dispatch:");
  return [
    ...(end >= 0 ? block.slice(0, end) : block).matchAll(/^\s+- "([^"]+)"/gm),
  ].map((m) => m[1]);
};

test("the deploy skip-list can never mask a deployable change", () => {
  const patterns = deploySkipPatterns();
  assert.ok(
    patterns.length >= 5,
    `expected a real skip-list, saw ${JSON.stringify(patterns)}`,
  );
  const offenders = [];
  for (const pattern of patterns)
    for (const file of deployedFiles())
      if (matchesPattern(pattern, file)) offenders.push(`${pattern} → ${file}`);
  assert.deepEqual(
    offenders,
    [],
    `these entries would skip publishing a deployable file:\n${offenders.join("\n")}`,
  );
});

test("the deploy skip-list covers the paths that actually churn", () => {
  const patterns = deploySkipPatterns();
  // If one of these stopped being ignored, every docs/tooling commit would
  // silently go back to costing a build, a publish and a browser smoke.
  for (const required of [
    "docs/**",
    "scripts/**",
    "tests/**",
    ".github/**",
    "**/*.md",
  ])
    assert.ok(
      patterns.includes(required),
      `${required} must stay in the skip-list`,
    );
});

test("a deployable change is never skipped", () => {
  const patterns = deploySkipPatterns();
  for (const file of [
    "index.html",
    "assets/js/sizing/ui.js",
    "blog/index.html",
    "sitemap.xml",
    "_headers",
    "sw.js",
  ])
    assert.ok(
      !patterns.some((p) => matchesPattern(p, file)),
      `${file} must always be deployed`,
    );
});

// ── proving the act path is permitted ───────────────────────────────────────

// GitHub checks authorisation before existence, so a cancel aimed at a run id
// that cannot exist is a side-effect-free permission probe.
test("the cancel-permission probe reads authorization, not existence", () => {
  assert.equal(
    classifyCancelProbeStatus(404),
    "authorized",
    "an absent run answered by an authorised token proves the token may cancel",
  );
  assert.equal(classifyCancelProbeStatus(403), "denied");
  assert.equal(classifyCancelProbeStatus(401), "denied");
  // Never let a transient answer masquerade as either verdict.
  assert.equal(classifyCancelProbeStatus(500), "inconclusive");
  assert.equal(classifyCancelProbeStatus(200), "inconclusive");
  assert.equal(classifyCancelProbeStatus(undefined), "inconclusive");
});

test("every scheduled watchdog run proves it can act", () => {
  const wf = read(".github/workflows/workflow-watchdog.yml");
  assert.match(
    wf,
    /unstick-queued-runs\.mjs --check-permissions/,
    "the act path must be proven by the run itself, not assumed from the dry path",
  );
  // The probe has to precede the unstick step, or a run could act before
  // anything established that acting is permitted.
  assert.ok(
    wf.indexOf("--check-permissions") <
      wf.indexOf("node scripts/unstick-queued-runs.mjs \\\n"),
    "the permission probe must run before the unstick step",
  );
});

test("the permission probe is itself harmless", () => {
  const src = read("scripts/unstick-queued-runs.mjs");
  assert.match(
    src,
    /const PROBE_RUN_ID = "999999999999"/,
    "the probe must aim at a run id that cannot exist",
  );
  assert.match(
    src,
    /if \(CHECK_PERMISSIONS\) return checkPermissions\(\)/,
    "the probe must short-circuit before any real cancel can be reached",
  );
});

test("the probe refuses to run without credentials instead of reporting success", () => {
  const r = spawnSync(
    process.execPath,
    ["scripts/unstick-queued-runs.mjs", "--check-permissions"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_TOKEN: "",
        GH_TOKEN: "",
        GITHUB_REPOSITORY: "",
      },
    },
  );
  assert.notEqual(r.status, 0);
  assert.match(`${r.stdout}${r.stderr}`, /GITHUB_REPOSITORY and GITHUB_TOKEN/);
});

test("the watchdog refuses to run without credentials instead of no-opping", () => {
  const r = spawnSync(process.execPath, ["scripts/unstick-queued-runs.mjs"], {
    encoding: "utf8",
    // Blank, not deleted: a CI run has GITHUB_TOKEN set for every step.
    env: {
      ...process.env,
      GITHUB_TOKEN: "",
      GH_TOKEN: "",
      GITHUB_REPOSITORY: "",
    },
  });
  assert.notEqual(
    r.status,
    0,
    "an unauthenticated watchdog must fail loudly, never report success",
  );
  assert.match(`${r.stdout}${r.stderr}`, /GITHUB_REPOSITORY and GITHUB_TOKEN/);
});
