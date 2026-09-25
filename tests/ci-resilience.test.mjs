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
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import {
  BudgetExhausted,
  deadlineFrom,
  isTransientFailure,
  retryTransient,
} from "../scripts/lib/transient-retry.mjs";
import {
  JOB_TIMEOUT_MINUTES,
  PROMOTE_TIMEOUT_MS,
  SMOKE_ATTEMPT_TIMEOUT_MS,
  VERIFY_BUDGET_MS,
  budgetFitsInside,
  budgetFromEnv,
} from "../scripts/lib/budgets.mjs";
import {
  DEFAULT_BAILOUT_ABOVE,
  classifyCancelProbeStatus,
  selectStuckRuns,
} from "../scripts/lib/stuck-runs.mjs";
import { deployedFiles } from "../scripts/lib/gates.mjs";

const url = (rel) => new URL(`../${rel}`, import.meta.url);
const read = (rel) => readFileSync(url(rel), "utf8");
const exists = (rel) => existsSync(url(rel));
const list = (rel) => readdirSync(fileURLToPath(url(rel)));

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

// The fixtures below are COPIES of strings headless Chrome actually emitted,
// captured against local proxies that failed on purpose (2026-09-19): a 503 on
// a navigation, a 503 on a subresource, a 404 on a subresource, an uncaught
// page exception, a refused connection, a reset connection, an unresolvable
// host. They are the evidence that the classification covers what the browser
// really says, rather than what we imagine it says.
test("Chrome's transient wording is classified", () => {
  for (const text of [
    // A navigation whose response was 5xx. This is the one that turned a flake
    // into a red `Verify staging` while parity absorbed it and passed.
    "log.error: Failed to load resource: the server responded with a status of 503 (Service Unavailable) [http://127.0.0.1:18442/nav-503]",
    // The same status on a subresource.
    "log.error: Failed to load resource: the server responded with a status of 503 (Service Unavailable) [http://127.0.0.1:18442/boom.js]",
    // Navigation-level transport failures. Chrome logs nothing for these, so
    // the smoke records the navigate error itself; without that they never
    // reach any classifier.
    "navigation: net::ERR_CONNECTION_REFUSED [http://127.0.0.1:18449/]",
    "navigation: net::ERR_CONNECTION_RESET [http://127.0.0.1:18461/]",
    "navigation: net::ERR_NAME_NOT_RESOLVED [http://no-such-host.invalid/]",
    // Observed for real: the edge accepted the request and then killed the
    // connection, so the navigation reported no response at all.
    "SMOKE FAIL  no other console/page errors — navigation: net::ERR_EMPTY_RESPONSE [http://127.0.0.1:8154/solar-heatmap/?smoke=1789846701076]",
    // Also observed for real, under load: the harness's own CDP call timed out
    // while the renderer was starved — no assertion was involved.
    "SMOKE FAIL  smoke run completed — CDP timeout: Runtime.evaluate",
  ])
    assert.equal(isTransientFailure(text), true, `should retry: ${text}`);
});

test("Chrome's non-transient wording stays non-transient", () => {
  for (const text of [
    // Byte-identical to the 503 line apart from the number: a missing asset is
    // the regression this gate exists to catch, so 4xx must never match.
    "log.error: Failed to load resource: the server responded with a status of 404 (Not Found) [http://127.0.0.1:18442/missing.js]",
    // Chrome's own text for an uncaught page error.
    "page exception: Uncaught",
    // The request was cancelled by the page, not by the network: an assertion
    // about what the artifact did, not a flake to absorb.
    "log.error: Failed to load resource: net::ERR_ABORTED [http://127.0.0.1:8154/assets/js/sizing/ui.js]",
    "log.error: net::ERR_BLOCKED_BY_CLIENT [http://127.0.0.1:8154/assets/site.css]",
  ])
    assert.equal(isTransientFailure(text), false, `must not retry: ${text}`);
});

test("the smoke surfaces a navigation-level transport error", () => {
  // The channel, not just the classifier: a failed navigation is invisible to
  // every other collector, so removing this line makes a transport flake fail
  // the smoke as an unexplained gate failure.
  const src = read("scripts/smoke/actions.mjs");
  assert.match(
    src,
    /if \(nav\?\.errorText\)[\s\S]{0,120}errors\.push\(`navigation: /,
    "a navigation that never loaded must be recorded, with its Chrome error",
  );
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

// ── the stalled-run remedy is ON DEMAND, deliberately not scheduled ────────

test("the stalled-run remedy is not scheduled, and that stays deliberate", () => {
  // It ran hourly, produced ZERO runs, and every scheduled run this repo can
  // observe fires 4.4-6.5 hours late (measured; see the runbook). A cron here
  // cannot deliver timely unattended remediation, so the component was
  // retired rather than left unprovable. Re-adding a schedule means
  // re-arguing that evidence, which is the point of pinning it.
  assert.equal(
    exists(".github/workflows/workflow-watchdog.yml"),
    false,
    "the watchdog schedule was retired — restore it only with new evidence",
  );
  for (const f of list(".github/workflows"))
    assert.ok(
      !read(`.github/workflows/${f}`).includes("unstick-queued-runs.mjs"),
      `${f} must not quietly reschedule a remedy that cannot run on time`,
    );
});

test("the remedy stays runnable and documented for the human who needs it", () => {
  assert.ok(
    exists("scripts/unstick-queued-runs.mjs"),
    "the tool itself is kept — it IS the remedy, run when a stall is noticed",
  );
  const runbook = read("docs/DEPLOY_RUNBOOK.md");
  assert.match(
    runbook,
    /scripts\/unstick-queued-runs\.mjs/,
    "an undocumented remedy is one nobody runs",
  );
  assert.match(
    runbook,
    /hours late/,
    "the measured reason it is not scheduled must stay on the record",
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

test("the remedy can prove its own permission to act", () => {
  // The probe is what makes running this safe to hand to a human: it answers
  // "may this token cancel?" without cancelling anything.
  const src = read("scripts/unstick-queued-runs.mjs");
  assert.match(
    src,
    /--check-permissions/,
    "the act path must be checkable before anything is cancelled",
  );
  assert.match(
    read("docs/DEPLOY_RUNBOOK.md"),
    /--check-permissions/,
    "and the operator must be told it exists",
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

// ── the time budget: a slow failure must produce a verdict, not a kill ──────
//
// Without this, the retry loop multiplied per-attempt timeouts (3 x 15min for
// the smoke) and outlived both the CI job (25min) and promote's subprocess cap
// (20min), so a slow transport failure was killed mid-run and reported as a
// timeout/cancel — indistinguishable from "the gate passed". The budget is now
// a single deadline, and these tests pin the algebra that makes it fit.
test("the verifier's budget provably fits inside every limit that wraps it", () => {
  assert.ok(
    budgetFitsInside(VERIFY_BUDGET_MS, PROMOTE_TIMEOUT_MS),
    "the verifier must finish inside promote's subprocess cap, or a slow run is killed instead of judged",
  );
  assert.ok(
    budgetFitsInside(VERIFY_BUDGET_MS, JOB_TIMEOUT_MINUTES * MINUTE),
    "and inside the CI job that runs it",
  );
  assert.ok(
    PROMOTE_TIMEOUT_MS < JOB_TIMEOUT_MINUTES * MINUTE,
    "the wrapper's cap cannot exceed the job that runs it",
  );
  assert.ok(
    SMOKE_ATTEMPT_TIMEOUT_MS * 3 > VERIFY_BUDGET_MS,
    "three smoke attempts really do outlast the whole budget — which is exactly why a total deadline, not more attempts, is the cap",
  );
});

test("the budget knob can only make the gate stricter", () => {
  assert.equal(
    budgetFromEnv({ VERIFY_BUDGET_MS: String(60 * MINUTE) }),
    VERIFY_BUDGET_MS,
    "a larger budget must be clamped: the knob can never buy a longer run",
  );
  assert.equal(budgetFromEnv({ VERIFY_BUDGET_MS: "5000" }), 5000);
  assert.equal(
    budgetFromEnv({}),
    VERIFY_BUDGET_MS,
    "absent means the real budget",
  );
  assert.equal(budgetFromEnv({ VERIFY_BUDGET_MS: "-1" }), VERIFY_BUDGET_MS);
  assert.equal(budgetFromEnv({ VERIFY_BUDGET_MS: "abc" }), VERIFY_BUDGET_MS);
});

test("the CI job's timeout is the number the budget module declares", () => {
  const yml = read(".github/workflows/verify-staging.yml");
  const declared = yml.match(/timeout-minutes:\s*(\d+)/);
  assert.ok(declared, "the verify job must declare a timeout");
  assert.equal(
    Number(declared[1]),
    JOB_TIMEOUT_MINUTES,
    "editing the workflow's timeout alone would break the budget algebra",
  );
});

// A job without an explicit cap inherits GitHub's 6-hour default, which is how
// one hung step occupies a runner all afternoon on a free-tier account. Every
// job must declare its own bound, measured against its real duration.
test("every workflow job declares a timeout-minutes", () => {
  const bare = [];
  for (const f of list(".github/workflows")) {
    const yml = read(`.github/workflows/${f}`);
    if (!yml.includes("\njobs:")) continue;
    const jobs = yml
      .slice(yml.indexOf("\njobs:") + 6)
      .split(/^  [\w-]+:/m)
      .slice(1);
    for (const job of jobs)
      if (!/timeout-minutes:\s*\d+/.test(job))
        bare.push(`${f}: ${job.match(/^[\w-]+/)[0].trim()}`);
  }
  assert.deepEqual(
    bare,
    [],
    `these jobs run under GitHub's 6-hour default:\n${bare.join("\n")}`,
  );
});

// Cloudflare's managed challenge answers every non-browser probe of the
// custom domain (403 "Just a moment" interstitial), which turned the daily
// static check red on an up site. The content assertion must therefore run
// against the GitHub Pages origin (identical build, no challenge), while the
// custom-domain probe keeps asserting DNS/routing health and accepts the
// challenge itself as "up".
test("daily static check survives the Cloudflare bot challenge", () => {
  const yml = read(".github/workflows/scheduled-static.yml");
  // Compare HOSTS parsed from the workflow's URLs, never substrings of the
  // file: "does this text mention example.com?" is equally true of
  // example.com.evil.test, of a comment, and of a host that merely ends in the
  // same label. (This is also CodeQL's
  // js/incomplete-url-substring-sanitization rule, which blocks the merge.)
  const hosts = new Set();
  for (const m of yml.matchAll(/https:\/\/[^\s"'`)]+/g)) {
    try {
      hosts.add(new URL(m[0]).host);
    } catch {
      // A malformed match proves nothing about the workflow; the assertions
      // below fail loudly if a real probe host is missing.
    }
  }
  assert.ok(
    hosts.has("sovereign-communication.github.io"),
    "content drift is detected from the challenge-free Pages origin",
  );
  assert.ok(
    hosts.has("freeoffgridcalculator.com"),
    "the custom domain is still probed for DNS/routing health",
  );
  assert.ok(
    hosts.has("bigenergyco-api.bigenergyco.workers.dev"),
    "the API health probe still runs",
  );
  assert.match(
    yml,
    /Just a moment/,
    "the challenge interstitial is an explicit accepted 'up' state, not a silent skip",
  );
});

test("promote wraps the verifier in the shared cap, not a hardcoded one", () => {
  const src = read("scripts/promote.mjs");
  // Scoped to the block that launches the verifier: other subprocesses in this
  // file legitimately carry their own, unrelated timeouts.
  const block = src
    .slice(src.indexOf('"scripts/verify-staging.mjs"'))
    .slice(0, 800);
  assert.ok(block.length > 100, "expected to find the verifier invocation");
  assert.match(
    block,
    /timeout: PROMOTE_TIMEOUT_MS/,
    "the verifier's cap must be the number the budget module owns",
  );
  assert.ok(
    !/timeout:\s*\d/.test(block),
    "a literal here could silently drop below the verifier's own budget",
  );
  assert.match(
    src,
    /budgetFitsInside\(VERIFY_BUDGET_MS, PROMOTE_TIMEOUT_MS\)/,
    "and it must refuse at startup if the two ever drift apart",
  );
});

test("the retry loop never sleeps or starts an attempt past its deadline", async () => {
  let calls = 0;
  const slept = [];
  const err = await retryTransient(
    async () => {
      calls++;
      throw new Error("net::ERR_CERT_VERIFIER_CHANGED");
    },
    {
      attempts: 5,
      delayMs: 5000,
      deadline: deadlineFrom(100),
      sleep: async (ms) => slept.push(ms),
    },
  ).catch((e) => e);
  assert.ok(
    err instanceof BudgetExhausted,
    `expected a budget verdict, got ${err}`,
  );
  assert.ok(
    calls < 5,
    "it must stop spending attempts once the budget is gone",
  );
  assert.deepEqual(slept, [], "and never sleep into the deadline");
});

test("the last failure before a budget verdict is reported, not swallowed", async () => {
  const err = await retryTransient(
    async () => {
      throw new Error("net::ERR_CERT_VERIFIER_CHANGED");
    },
    { attempts: 3, delayMs: 5000, deadline: deadlineFrom(100), sleep: noSleep },
  ).catch((e) => e);
  assert.match(
    err.message,
    /ERR_CERT_VERIFIER_CHANGED/,
    "a budget verdict must still say what was failing",
  );
});

test("a budget verdict is final: it is never retried, never called transient", async () => {
  let calls = 0;
  const err = await retryTransient(
    async () => {
      calls++;
      throw new BudgetExhausted("budget gone");
    },
    { attempts: 3, sleep: noSleep },
  ).catch((e) => e);
  assert.equal(calls, 1, "retrying is what would have exceeded the budget");
  assert.equal(err.budgetExhausted, true);
  assert.notEqual(
    err.transient,
    true,
    "it must not be reported as a network flake",
  );
});

test("each attempt is told how much budget is left, so it can clamp itself", async () => {
  const seen = [];
  await retryTransient(
    async (_attempt, left) => {
      seen.push(left);
      return "ok";
    },
    { deadline: deadlineFrom(1234) },
  );
  assert.ok(seen[0] > 0 && seen[0] <= 1234, `remaining was ${seen[0]}`);
});

test("every retried step in the verifier carries the deadline", () => {
  const src = read("scripts/verify-staging.mjs");
  const retried = (src.match(/retryTransient\(/g) || []).length;
  const bounded = (src.match(/deadline: DEADLINE,/g) || []).length;
  assert.ok(retried >= 3, `expected the retried steps, saw ${retried}`);
  assert.equal(
    bounded,
    retried,
    "a retried step without the shared deadline can outlive the gate",
  );
  assert.match(src, /budgetFromEnv\(\)/, "the budget comes from one module");
  assert.ok(
    !/AbortSignal\.timeout\(FETCH_TIMEOUT_MS\)/.test(src),
    "an unclamped request could outlive the deadline by its whole 30s ceiling",
  );
  assert.match(
    src,
    /budgetExhausted \? "budget" : "network"/,
    "a file the budget ran out on must not be reported as a network failure",
  );
});

// The end-to-end direction: a source that fails SLOWLY (every request 5xx) under
// a compressed budget must return a verdict that names the budget and reports
// its retries — exiting 1 on its own terms, well inside any outer cap.
test("a slow failure under a compressed budget returns a verdict, not a kill", async () => {
  const server = createServer((_req, res) => {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("upstream is down");
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  // Big enough for a real retry to happen (first failure + one 5s backoff), and
  // far too small for the loop to finish — so the run must cut itself short and
  // still report both the retries and the reason.
  const budgetMs = 8000;
  const started = Date.now();
  const child = spawn(
    process.execPath,
    [
      "scripts/verify-staging.mjs",
      "--base",
      `http://127.0.0.1:${port}/`,
      "--json",
    ],
    {
      env: { ...process.env, VERIFY_BUDGET_MS: String(budgetMs) },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (out += d));
  const code = await new Promise((r) => child.on("close", r));
  const elapsed = Date.now() - started;
  await new Promise((r) => server.close(r));

  const payload = JSON.parse(out.slice(out.indexOf("{")));
  assert.equal(code, 1, "an exhausted budget is a FAILED gate, not a crash");
  assert.equal(payload.verified, false);
  assert.equal(
    payload.budgetMs,
    budgetMs,
    "the compressed budget is visible in the verdict",
  );
  assert.ok(
    payload.transientRetries.length > 0,
    "the retries it did make must be reported",
  );
  assert.ok(
    payload.failures.some((f) => /budget/i.test(f)),
    `the verdict must name the budget: ${payload.failures.join(" | ")}`,
  );
  assert.ok(
    payload.failures.some((f) => /were NOT/.test(f)),
    "and say the unchecked work was not checked rather than claiming it differs",
  );
  assert.ok(
    !payload.failures.some((f) => /all \d+ deployed files match/.test(f)),
    "it must never claim every file matched when some were never fetched",
  );
  assert.ok(
    elapsed < budgetMs + 30_000,
    `it must end on its own budget (${elapsed}ms), not be killed`,
  );
  // The checkout itself is intact: the failure came from the source, so a red
  // verdict here is about the source and not about missing build inputs.
  assert.match(read("index.html"), /\?v=/);
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
