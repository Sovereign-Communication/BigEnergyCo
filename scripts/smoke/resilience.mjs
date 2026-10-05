// The adversarial pass over the delivery path, driven through the real page.
//
// WHAT THIS IS, and what it is not. The `resilience` facet was carried by a prose
// line describing intent — retries, timeouts, fallbacks, a deadline — and not
// one of those mechanisms had ever been made to fail on purpose. A guard that
// reports resilience it has not exercised is a comment with an exit code, and
// this repo has spent a whole cycle removing exactly those.
//
// So every claim below is made by BREAKING something and watching what the page
// does. Nothing here is inferred from reading the source, and the one thing that
// IS read from source — the inner/outer timeout arithmetic — is computed from the
// constants the shipped modules export and is reported as a source-level
// invariant rather than dressed up as an observation.
//
// THE FOUR FAILURE MODES, and why all four. A transport failure is not one thing
// and a guard that only proves "the network broke" has proved the easiest case:
//
//   · FAILED      — the connection could not be made. A TypeError from fetch.
//   · ABORTED     — the request was cancelled. Distinguishable from FAILED only
//                   inside the page, and the product treats it differently.
//   · REFUSED     — nothing listening. Same wire outcome as FAILED on most
//                   stacks, so a guard that conflates them proves less than it
//                   appears to.
//   · SERVER 503  — a real HTTP response with a failure status. The response
//                   EXISTS, which is the case a `res.ok` check exists for and
//                   the one a network-error fixture never reaches.
//   · MALFORMED   — HTTP 200 with a body that is not the expected shape. This is
//                   the nastiest of the five and the most commonly untested: the
//                   transport succeeded, so nothing in a network layer complains.
//   · TIMEOUT     — the request hangs and the product's own abort fires. Forced
//                   with the exact production timer, shortened in the browser
//                   only, rather than by pointing the fixture at a dead port.
//
// All six must land on the SAME honest outcome, and that outcome is the claim:
// the page still answers, says in words that it degraded, and never shows a
// number it did not earn. A failure mode that produced a DIFFERENT answer per
// mode would mean the classification is not really shared, which is precisely
// what "classification covers transport failures end to end" has to mean.
//
// HOW THE FAILURES ARE INJECTED. CDP's Fetch domain, on the page session and on
// every attached worker session, because the sizing worker is a separate target
// and a NASA pull issued from inside it is invisible to a page-session-only
// fixture. Nothing in the build is edited: the page under test is byte-for-byte
// the staged artifact, and the only difference is that one request cannot
// succeed.
//
// THE TIMER SHIM. The timeout mode shortens exactly one timer — the one armed
// with the production constant `FETCH_TIMEOUT_MS` — by wrapping window.setTimeout
// and matching on that exact value, counting its own rewrites so a test can
// prove it shortened one timer and not all of them. This is the idiom
// scripts/smoke/deadline.js already uses for the run deadline, for the same
// reason: a 45-second wait is not a thing a gate can afford, and raising the
// product's own timeout to suit a test would be testing a different product.
import { RUN_TIMEOUT_MS } from "./actions.mjs";

/** The result card text every flow in this repo uses to detect a finished run. */
const CARD = "Total 20-year cost";

/**
 * The six transport failure modes, each with the Fetch-domain action that
 * produces it and the class of failure it is meant to represent.
 *
 * `hold` is separate because it is the only mode that must NOT be completed: a
 * held request is what lets the product's OWN abort timer fire, which is the
 * only way to exercise the timeout classification rather than a fixture of it.
 */
export const TRANSPORT_FAILURES = [
  {
    id: "connection_failed",
    label: "connection could not be made",
    action: "fail",
    reason: "Failed",
  },
  {
    id: "request_aborted",
    label: "request cancelled",
    action: "fail",
    reason: "Aborted",
  },
  {
    id: "connection_refused",
    label: "nothing listening",
    action: "fail",
    reason: "ConnectionRefused",
  },
  {
    id: "server_503",
    label: "a real 5xx response",
    action: "fulfill",
    status: 503,
    body: "upstream unavailable",
  },
  {
    id: "malformed_200",
    label: "HTTP 200 with a body that is not the expected shape",
    action: "fulfill",
    status: 200,
    body: "{ this is not the JSON anyone parses",
    contentType: "application/json",
  },
  // A HANG IS NOT HERE, and that is a finding rather than an omission.
  //
  // The sixth mode this file used to declare held a NASA request open so the
  // product's own 45s abort would fire. It cannot be driven that way, and the
  // measurement says so plainly: with a page-realm timer probe recording every
  // delay the page arms, a full city-select-plus-run flow arms exactly three —
  // 2000 (the search debounce), 3500 (the Jev probe in validate.js) and 180000
  // (the run reply deadline) — and 45000 never appears, because
  // FETCH_TIMEOUT_MS is armed inside the SIZING WORKER's realm. A shim installed
  // in the page rewrites a timer nothing is waiting on; the stage therefore
  // held three requests, armed nothing, and produced no card in fifteen seconds.
  //
  // Reporting that as a sixth passing mode would be the exact defect this gate
  // exists to end, so the hang case is not claimed. What IS exercised for a
  // silent upstream is the page-side deadline that the probe showed the page
  // really does arm — the 180s run deadline — in runStuckRunRecovery below.
  // The 45s weather abort is covered by the source-level budget in
  // scripts/lib/resilience-budgets.mjs, which is labelled as a source invariant
  // precisely because no browser in this repo can shorten it.
];

const NASA = /power\.larc\.nasa\.gov/;

/**
 * Install a NASA interceptor on the page session and every worker session that
 * attaches, and hand back the control surface.
 *
 * Returns `{ set, release, stats }`. `stats` is what makes the stage checkable:
 * how many NASA requests were actually intercepted. A stage whose interceptor
 * matched nothing has proved nothing about a transport failure — it proved the
 * page works — and the gate is given that number so it can say so.
 */
export function installNasaInterceptor(ctx) {
  const { send, ws } = ctx;
  const sessions = new Set();
  const stats = {
    intercepted: 0,
    matched: 0,
    mode: null,
    released: 0,
    held: 0,
    nasa_sessions: new Set(),
  };
  let enabled = false;
  // Source injected into every worker session that attaches, or null. The NASA
  // fetch is issued from INSIDE the sizing worker, so a shim installed only in
  // the page rewrites a timer nothing is waiting on: the first draft of this
  // file did exactly that and the hang stage simply never timed out. Injecting at
  // attach time is what puts the shim in the realm that owns the fetch.

  // Hold the requests we have deliberately paused, keyed by session+id, so the
  // product's own abort is what ends them. Forgetting them would let a held
  // request land after the stage finished and quietly invalidate the NEXT one.
  const held = new Map();

  const handlePaused = (sessionId, params) => {
    if (!NASA.test(params?.request?.url || "")) {
      send(
        "Fetch.continueRequest",
        { requestId: params.requestId },
        sessionId,
      ).catch(() => {});
      return;
    }
    stats.matched += 1;
    // WHICH target asked. The sizing worker is a separate session, and a shim
    // installed anywhere other than here has rewritten a timer nothing waits on
    // \u2014 so the session is recorded rather than assumed.
    stats.nasa_sessions.add(sessionId || "page");
    // Disarmed is NOT "hold": a paused request that is never continued hangs the
    // page forever. The first draft returned here without answering, so the
    // moment a stage finished, the next page load waited on a request no one was
    // going to release and every evaluate timed out. Disarmed means transparent.
    if (!stats.mode) {
      send(
        "Fetch.continueRequest",
        { requestId: params.requestId },
        sessionId,
      ).catch(() => {});
      return;
    }
    const m = stats.mode;
    if (m.action === "fail") {
      send(
        "Fetch.failRequest",
        { requestId: params.requestId, errorReason: m.reason },
        sessionId,
      ).catch(() => {});
      stats.intercepted += 1;
      return;
    }
    if (m.action === "fulfill") {
      // The CORS header is not decoration. The real endpoint sends
      // Access-Control-Allow-Origin, and a synthetic response without one is
      // rejected by the browser's CORB check BEFORE the page's own status
      // handling ever runs — so the first draft of these two modes was measuring
      // a CORS failure wearing a 503's name. With the header present the page
      // sees exactly what it would see from the real service.
      send(
        "Fetch.fulfillRequest",
        {
          requestId: params.requestId,
          responseCode: m.status,
          responseHeaders: [
            { name: "content-type", value: m.contentType || "text/plain" },
            { name: "access-control-allow-origin", value: "*" },
          ],
          body: Buffer.from(m.body || "", "utf8").toString("base64"),
        },
        sessionId,
      ).catch(() => {});
      stats.intercepted += 1;
      return;
    }
    // hold: deliberately answer nothing, so the product's own abort timer is
    // what resolves this request.
    held.set(`${sessionId}:${params.requestId}`, true);
    stats.held += 1;
    stats.intercepted += 1;
  };

  const enableOn = (sessionId) =>
    send(
      "Fetch.enable",
      { patterns: [{ urlPattern: "*", requestStage: "Request" }] },
      sessionId,
    ).catch(() => {});

  const baseOnmessage = ws.onmessage;
  ws.onmessage = (ev) => {
    baseOnmessage(ev);
    try {
      const m = JSON.parse(ev.data);
      if (m.method === "Target.attachedToTarget" && m.params?.sessionId) {
        const sid = m.params.sessionId;
        sessions.add(sid);
        // A worker that attaches after interception is armed is still intercepted:
        // otherwise the sizing worker quietly fetches real weather and the stage
        // measures a page that was never actually offline.
        if (enabled) enableOn(sid);
      } else if (m.method === "Fetch.requestPaused" && m.params?.requestId) {
        handlePaused(m.sessionId || null, m.params);
      }
    } catch {
      /* not a frame we care about */
    }
  };

  return {
    async enable() {
      await send("Target.setAutoAttach", {
        autoAttach: true,
        waitForDebuggerOnStart: false,
        flatten: true,
      }).catch(() => {});
      await enableOn(null);
      enabled = true;
    },
    /** Aim the interceptor at one failure mode. `null` lets everything through. */
    async set(mode) {
      stats.mode = mode;
      stats.intercepted = 0;
      stats.held = 0;
    },
    /** How many worker sessions exist, so a shim can be reported as unplaced. */
    sessions: () => sessions.size,
    /**
     * Release only the requests this mode is holding. Called BETWEEN modes, not
     * at the end.
     *
     * The first draft of this file called the full `release()` between modes,
     * which also sent Fetch.disable and unhooked the message listener — so only
     * the FIRST mode was ever intercepted and the other five quietly fetched
     * real weather and reported a healthy card. The `intercepted: 0` in the
     * report is what caught it, which is the reason that counter is reported
     * per mode rather than once at the end.
     */
    async releaseHeld() {
      for (const key of [...held.keys()]) {
        const sid = key.slice(0, key.lastIndexOf(":"));
        const requestId = key.slice(key.lastIndexOf(":") + 1);
        await send("Fetch.continueRequest", { requestId }, sid).catch(() => {});
        held.delete(key);
        stats.released += 1;
      }
    },
    async release() {
      // Release anything still held BEFORE disarming, so a held request cannot
      // resolve into a later stage and read as that stage's weather.
      for (const key of [...held.keys()]) {
        const sid = key.slice(0, key.lastIndexOf(":"));
        const requestId = key.slice(key.lastIndexOf(":") + 1);
        await send("Fetch.continueRequest", { requestId }, sid).catch(() => {});
        held.delete(key);
        stats.released += 1;
      }
      stats.mode = null;
      for (const sid of [null, ...sessions])
        await send("Fetch.disable", {}, sid).catch(() => {});
      ws.onmessage = baseOnmessage;
    },
    sessions: () => sessions.size,
    stats: () => ({
      ...stats,
      sessions: sessions.size,
      nasa_sessions: [...stats.nasa_sessions],
    }),
  };
}

/**
 * Choose a city through the page's own search box, and say so when it fails.
 *
 * Factored out because every stage needs it and one of them forgot it: the
 * stuck-run stage reloaded the page and went straight to Run with no location
 * set, so no run ever started and its evaluate sat until the CDP client's own
 * 30-second cap produced a bare "CDP timeout" naming no stage at all. A stage
 * that cannot name its own precondition fails opaquely.
 *
 * Returns true when a suggestion was chosen. Every caller treats false as a hole
 * rather than proceeding, because a run with no location proves nothing about
 * stuck runs, stale inputs, or transport failures.
 */
export async function chooseCity(ctx, city = "Honolulu") {
  const { evaluate, poll } = ctx;
  await evaluate(
    `(() => { const s = document.getElementById("citySearch");
       if (!s) return false;
       s.focus(); s.value = ${JSON.stringify(city)};
       s.dispatchEvent(new InputEvent("input", { bubbles: true }));
       return true; })()`,
  ).catch(() => {});
  const suggested = await poll(
    async () =>
      (await evaluate(
        `document.querySelectorAll('#citySuggestions [role="option"]').length`,
      ).catch(() => 0)) > 0,
    20000,
    400,
  );
  if (!suggested) return false;
  await evaluate(
    `document.querySelector('#citySuggestions [role="option"]').click()`,
  ).catch(() => {});
  await new Promise((r) => setTimeout(r, 1500));
  return true;
}

/** Put the form in a known state and click Run, timed by the page's own clock. */
function runSource({ timeoutMs }) {
  return `(async () => {
    const CARD = ${JSON.stringify(CARD)};
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const region = document.getElementById("resultsRegion");
    // Visibility, not text presence. Hiding a region does not remove its text
    // from document.body.textContent, so a text-only check reports "done" the
    // instant a PREVIOUS run's card is still in the DOM — which is what made the
    // first run of this stage return immediately and never wait for the deadline
    // at all. Every stage here hides the region first precisely so that "done"
    // has to mean this run put a card on screen.
    const cardUp = () =>
      document.body.textContent.includes(CARD) && region && region.hidden === false;
    const out = {};

    const set = (id, value) => {
      const node = document.getElementById(id);
      if (!node) return false;
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    };
    set("dailyKwhInput", "12");
    const g = document.getElementById("systemGoal");
    if (g) { g.value = "gridtie"; g.dispatchEvent(new Event("change", { bubbles: true })); }
    const t = document.getElementById("customRateVal");
    if (t && !(parseFloat(t.value) > 0)) {
      t.value = "0.42";
      t.dispatchEvent(new Event("input", { bubbles: true }));
    }
    await wait(150);

    const region2 = document.getElementById("resultsRegion");
    if (region2) region2.hidden = true;
    const btn = document.getElementById("btnRunSizing");
    if (!btn) { out.error = "no run button"; return out; }

    const t0 = performance.now();
    btn.click();
    const end = Date.now() + ${timeoutMs};
    let done = false;
    while (Date.now() < end) {
      if (cardUp()) { done = true; break; }
      await wait(25);
    }
    out.ms = done ? Math.round(performance.now() - t0) : null;
    out.card_rendered = done;
    out.status = (document.getElementById("sizingStatus")?.textContent || "").trim().slice(0, 200);
    out.button_disabled = btn.disabled === true;
    out.results_hidden = region2 ? region2.hidden === true : null;
    // What the page SAID about the degradation, and WHERE it said it.
    //
    // The first draft matched /OFFLINE MODE|typical-year/i against the whole
    // document body and read YES on every single mode — including the ones
    // that had fetched healthy five-year weather. The page explains
    // typical-year weather somewhere permanent, so a body-wide match is a
    // detector that cannot fail. This reads the run's own STATUS LINE, and the
    // control stage below proves the difference on a run where the answer is
    // known to be no.
    const statusText = (document.getElementById("sizingStatus")?.textContent || "").trim();
    out.offline_label = /typical-year|offline/i.test(statusText.slice(-120));
    out.status_years = /(\\d+)\\s*yr of hourly data/.exec(statusText)?.[1] ?? null;
    return out;
  })()`;
}

/**
 * Drive every transport failure mode through one cold sizing run each, and
 * report what the page did about each.
 *
 * Each mode gets a fresh page load, because the weather caches are layered
 * (memory, IndexedDB, Cache Storage, localStorage) and a mode measured against a
 * cache the previous mode populated would be measuring the cache, not the
 * failure. That is why this is one page load PER MODE and not one session with
 * six toggles — the isolation is the measurement. The interceptor stays ARMED
 * across all of them; only the mode changes.
 *
 * It ends with a CONTROL: the same flow with nothing intercepted. That stage
 * exists because a detector nobody has seen refuse is not a detector. The offline
 * check is supposed to be FALSE on a run that reached real weather, and until a
 * control asserts that, every `offline_label: true` above could be the check
 * saying yes to everything.
 */
export async function runTransportClassification(ctx, options = {}) {
  const {
    city = "Honolulu",
    timeoutMs = RUN_TIMEOUT_MS,
    settleMs = 6000,
    modes = TRANSPORT_FAILURES,
    onStage = null,
  } = options;
  const { send, evaluate, errors, poll } = ctx;

  const net = installNasaInterceptor(ctx);
  await net.enable();

  const stages = [
    ...modes.map((m) => ({ mode: m, control: false })),
    { mode: null, control: true },
  ];
  const results = [];
  try {
    for (const { mode, control } of stages) {
      // Stage progress is reported as each one STARTS, not when it finishes: a
      // stage that hangs is then identifiable by name instead of by a single
      // timeout thirty seconds later with no clue which of six it was.
      if (onStage) onStage(mode?.id || "control", "start");
      const errBefore = errors.length;
      await send("Page.reload", { ignoreCache: false }).catch(() => {});
      await new Promise((r) => setTimeout(r, settleMs));
      await evaluate(
        `(() => { const s = document.getElementById("citySearch");
           if (s) { s.focus(); s.value = ${JSON.stringify(city)};
             s.dispatchEvent(new InputEvent("input", { bubbles: true })); }
           return true; })()`,
      ).catch(() => {});
      const suggested = await poll(
        async () =>
          (await evaluate(
            `document.querySelectorAll('#citySuggestions [role="option"]').length`,
          ).catch(() => 0)) > 0,
        20000,
        400,
      );
      if (!suggested) {
        results.push({
          id: mode?.id || "control",
          label: mode?.label || "control: nothing intercepted",
          ok: false,
          reason: "no city suggestion",
        });
        continue;
      }
      await evaluate(
        `document.querySelector('#citySuggestions [role="option"]').click()`,
      ).catch(() => {});

      await net.set(mode);
      const run = await evaluate(runSource({ timeoutMs }));
      // EVERY counter is captured here, before teardown, and the reason is worth
      // stating because it bit twice. `set(null)` zeroes the interceptor's
      // counters, and `removeTimeoutShim()` deletes the page's own rewrite
      // counter — so reading either after teardown reported 0 for stages that
      // had genuinely intercepted three requests and fired their timer. Order is
      // not cosmetic in a measurement; it is the measurement.
      const stats = net.stats();
      await net.releaseHeld();
      await net.set(null);
      results.push({
        id: mode?.id || "control",
        label: mode?.label || "control: nothing intercepted",
        control,
        ok: true,
        // Without this the stage proves nothing: an interceptor that matched
        // nothing exercised no failure at all.
        intercepted: stats.intercepted,
        held: stats.held,
        nasa_sessions: stats.nasa_sessions,
        card_rendered: run.card_rendered === true,
        ms: run.ms,
        status: run.status || "",
        status_years: run.status_years ?? null,
        offline_label: run.offline_label === true,
        button_disabled: run.button_disabled === true,
        // A page that leaves the Run button disabled after a failure is a page
        // that needs a reload, and a visitor who does not know that is stuck.
        button_released: run.button_disabled === false,
        page_errors: errors.slice(errBefore),
        error: run.error || null,
      });
      if (onStage) onStage(mode?.id || "control", "done");
    }
  } finally {
    await net.release();
  }
  return { ok: true, modes: results };
}

/**
 * A stuck run: the worker never replies, the page-side deadline fires, and an
 * explicit retry recovers — with the worker and the run channel actually
 * released, not merely the button re-enabled.
 *
 * The worker/channel release is the half that is easy to claim and hard to prove.
 * A button that comes back is necessary and not sufficient: what matters is that
 * the NEXT run is posted to a NEW worker and settles, because a page that
 * re-enables the button while still holding the dead one recovers on screen and
 * hangs again on the second failure. So the assertion is that the retry posts,
 * completes, and is answered — and the post count is read from the same wrapper
 * that swallowed the first message.
 */
export async function runStuckRunRecovery(ctx, options = {}) {
  const {
    runDeadlineMs,
    smokeDeadlineMs = 400,
    timeoutMs = RUN_TIMEOUT_MS,
    settleMs = 6000,
    city = "Honolulu",
  } = options;
  const { send, evaluate, errors, poll } = ctx;

  // Bounded well inside the CDP client's 30s cap: the shimmed deadline fires in
  // milliseconds, so anything longer than this is a stage that did not recover
  // rather than a machine that is slow.
  const deadlineWaitMs = 20000;
  // The retry gets longer than the deadline wait: a fresh worker has to boot and
  // re-read weather through caches that died with the old one, so a few seconds
  // of honest work here is not a slow machine.
  const retryWaitMs = 27000;
  await send("Page.reload", { ignoreCache: false }).catch(() => {});
  await new Promise((r) => setTimeout(r, settleMs));
  if (!(await chooseCity(ctx, city)))
    return {
      ok: false,
      reason: `no city suggestion for ${city}, so no run could start`,
    };

  // Prime: the baseline run must settle BEFORE the silent-worker fixture is
  // installed, so a stage that never worked cannot be mistaken for a stage that
  // recovered.
  const primed = await evaluate(runSource({ timeoutMs }));
  if (!primed.card_rendered)
    return { ok: false, reason: "the baseline run never rendered a card" };

  const errBefore = errors.length;
  // Swallow exactly ONE full-run message, so the worker goes silent for one run
  // and every later run still has to travel. The postMessage wrapper STAYS
  // installed for the whole stage so the retry's post is observable.
  await evaluate(`(() => {
    window.__holdRun = 1;
    window.__runPosts = 0;
    window.__heldRunPosts = 0;
    window.__workerConstructions = 0;
    const OriginalWorker = window.Worker;
    // A Proxy with a construct trap, not a hand-rolled wrapper function: the
    // first draft assigned window.Worker = function(...) and then copied the
    // prototype, which left the counter at zero for the whole run because
    // nothing about a real construction was observable. The trap sees every
    // new Worker(...) call the page performs, which is the event the recovery claim
    // is actually about: a dead worker must be REPLACED, not reused.
    window.Worker = new Proxy(OriginalWorker, {
      construct(target, args) {
        window.__workerConstructions += 1;
        return new target(...args);
      },
    });
    const original = OriginalWorker.prototype.postMessage;
    window.__originalPostMessage = original;
    OriginalWorker.prototype.postMessage = function (m) {
      if (m && m.type === "run") {
        window.__runPosts += 1;
        if (window.__holdRun === 1) {
          window.__holdRun = 2;
          window.__heldRunPosts += 1;
          return;
        }
      }
      return original.call(this, m);
    };

    // Shorten ONLY the timer armed with the production run deadline. Matching
    // the exact constant is what keeps this from quietly shortening every other
    // timer on the page, and the count is reported so a test can prove it.
    window.__naturalSetTimeout = window.setTimeout;
    window.__runDeadlineRewrites = 0;
    window.setTimeout = function (callback, delay, ...args) {
      if (delay === ${runDeadlineMs}) {
        window.__runDeadlineRewrites += 1;
        return window.__naturalSetTimeout.call(this, callback, ${smokeDeadlineMs}, ...args);
      }
      return window.__naturalSetTimeout.call(this, callback, delay, ...args);
    };
    return true;
  })()`);

  // Click Run with the fixture armed, then wait for the DEADLINE rather than for a
  // card. The difference is the whole shape of the claim. A stuck run must NOT
  // produce a result card — a card here would mean the engine answered, and there
  // is nothing to answer with. What it must produce is an ACTIONABLE error in the
  // status line and a released button, and both of those are what the wait below
  // is for. Polling for a card instead (which is what this stage did first)
  // waits out the full 180s bound inside one evaluate and dies on the CDP
  // client's 30s cap, which is the exact failure the deadline exists to prevent
  // being invisible.
  await evaluate(
    `(() => {
       // Hide the previous run's card FIRST. "The stuck run rendered a result"
       // is a claim about THIS run, and the priming run's card is still in the
       // document and still visible — without this the stage reports a card for
       // a run that produced nothing, which is the same text-presence mistake
       // the cardUp fix above exists to stop.
       const region = document.getElementById("resultsRegion");
       if (region) region.hidden = true;
       document.getElementById("btnRunSizing").click();
       return true;
     })()`,
  );
  const deadlineFired = await poll(
    async () =>
      evaluate(`(() => {
        const status = document.getElementById("sizingStatus")?.textContent || "";
        const button = document.getElementById("btnRunSizing");
        return /did not reply in time/i.test(status) && button && button.disabled === false;
      })()`).catch(() => false),
    deadlineWaitMs,
    100,
  );
  const stuck = await evaluate(`(() => ({
    status: (document.getElementById("sizingStatus")?.textContent || "").trim().slice(0, 200),
    // VISIBILITY, not text presence. The priming run's card text is still in the
    // document while hidden, so a text-only check reports "the stuck run
    // rendered a card" when what happened is that the PREVIOUS card is sitting
    // there. The claim is that a stuck run shows no result AT ALL.
    cardPresent: document.getElementById("resultsRegion")?.hidden === false
      && document.body.textContent.includes(${JSON.stringify(CARD)}),
    buttonDisabled: document.getElementById("btnRunSizing")?.disabled ?? null,
    resultsHidden: document.getElementById("resultsRegion")?.hidden ?? null,
    runPosts: window.__runPosts,
  }))()`);
  const rewrites = await evaluate("window.__runDeadlineRewrites");

  // The recovery, as a SEPARATE explicit click — which is the whole point. A page
  // that recovers by itself has not recovered, it has only not failed yet; the
  // visitor has to be able to try again.
  await evaluate(`(() => { window.__holdRun = 0; return true; })()`);
  // Bounded for the same reason the deadline wait is: a recovery that has not
  // happened by now is a finding this gate should print, not a 30-second CDP
  // timeout that names nothing.
  const retry = await evaluate(runSource({ timeoutMs: retryWaitMs }));
  const after = await evaluate(`(() => ({
    runPosts: window.__runPosts,
    heldRunPosts: window.__heldRunPosts,
    workerConstructions: window.__workerConstructions,
    buttonDisabled: document.getElementById("btnRunSizing")?.disabled ?? null,
    status: (document.getElementById("sizingStatus")?.textContent || "").trim().slice(0, 200),
    resultsHidden: document.getElementById("resultsRegion")?.hidden ?? null,
  }))()`);

  await evaluate(`(() => {
    if (window.__naturalSetTimeout) {
      window.setTimeout = window.__naturalSetTimeout;
      delete window.__naturalSetTimeout;
    }
    if (window.__originalPostMessage) {
      OriginalWorker.prototype.postMessage = window.__originalPostMessage;
      delete window.__originalPostMessage;
    }
    delete window.__holdRun;
    return true;
  })()`).catch(() => {});

  const timeoutError = /did not reply in time/i.test(stuck.status || "");
  return {
    ok: true,
    // The fixture's own honesty: it must have swallowed exactly one message and
    // shortened exactly the production timer. Both are reported, not assumed.
    rewrites,
    held_run_posts: after.heldRunPosts,
    run_posts: after.runPosts,
    worker_constructions: after.workerConstructions,
    // What the visitor sees while stuck.
    stuck_status: stuck.status || "",
    stuck_error_is_actionable: timeoutError,
    // A stuck run that rendered a CARD would mean something answered, and there
    // is nothing to answer with. The honest outcome is no card plus a named
    // error, and both halves are asserted.
    stuck_card_rendered: stuck.cardPresent === true,
    stuck_deadline_fired: deadlineFired === true,
    stuck_button_released: stuck.buttonDisabled === false,
    // The recovery.
    retry_card_rendered: retry.card_rendered === true,
    retry_ms: retry.ms,
    retry_status: retry.status || "",
    retry_status_cleared: !timeoutError,
    retry_button_released: after.buttonDisabled === false,
    retry_results_visible: after.resultsHidden === false,
    // A retry that renders the card without a NEW worker would mean the dead one
    // was never released and the second failure would hang identically.
    fresh_worker_after_failure: after.workerConstructions >= 2,
    page_errors: errors.slice(errBefore),
  };
}

/**
 * Stale inputs: a run started for one set of inputs must not be allowed to
 * render as the answer for a DIFFERENT set the visitor has since typed.
 *
 * The worker cannot be preempted, so the design collapses a second request into
 * a single trailing run and retires the superseded reply. That is only correct
 * if the card the visitor ends up looking at belongs to the inputs currently on
 * screen — so this drives the race and reads the NUMBER the page settled on,
 * rather than asserting that a function called `staleRunAction` exists.
 */
export async function runStaleInputs(ctx, options = {}) {
  const {
    timeoutMs = RUN_TIMEOUT_MS,
    settleMs = 6000,
    city = "Honolulu",
  } = options;
  const { send, evaluate, errors } = ctx;

  await send("Page.reload", { ignoreCache: false }).catch(() => {});
  await new Promise((r) => setTimeout(r, settleMs));
  await evaluate(
    `(() => { const s = document.getElementById("citySearch");
       if (s) { s.focus(); s.value = ${JSON.stringify(city)};
         s.dispatchEvent(new InputEvent("input", { bubbles: true })); }
       return true; })()`,
  ).catch(() => {});
  await evaluate(
    `new Promise((res) => {
      const t0 = Date.now();
      const tick = () => {
        const o = document.querySelector('#citySuggestions [role="option"]');
        if (o || Date.now() - t0 > 20000) return res(true);
        setTimeout(tick, 200);
      };
      tick();
    })`,
  ).catch(() => {});
  await evaluate(
    `document.querySelector('#citySuggestions [role="option"]')?.click() || true`,
  ).catch(() => {});

  const errBefore = errors.length;
  // Start a run, and while it is in flight change the load the whole card is
  // derived from. The weather and the engine are identical; only the consumer's
  // number changes, so a card that renders the OLD number is unambiguous.
  const race = await evaluate(`(async () => {
    const CARD = ${JSON.stringify(CARD)};
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = {};
    const k = document.getElementById("dailyKwhInput");
    k.value = "10";
    k.dispatchEvent(new Event("input", { bubbles: true }));
    k.dispatchEvent(new Event("change", { bubbles: true }));
    await wait(150);

    const region = document.getElementById("resultsRegion");
    if (region) region.hidden = true;
    document.getElementById("btnRunSizing").click();
    // Let the first run get properly under way, THEN supersede it.
    for (let i = 0; i < 40; i++) {
      if (document.getElementById("btnRunSizing").disabled) break;
      await wait(25);
    }
    out.second_run_started_while_first_in_flight =
      document.getElementById("btnRunSizing").disabled === true;

    const k2 = document.getElementById("dailyKwhInput");
    k2.value = "27";
    k2.dispatchEvent(new Event("input", { bubbles: true }));
    k2.dispatchEvent(new Event("change", { bubbles: true }));
    document.getElementById("btnRunSizing").click();

    const end = Date.now() + ${timeoutMs};
    while (Date.now() < end) {
      if (document.body.textContent.includes(CARD) && !region?.hidden) break;
      await wait(50);
    }
    // Let any superseded reply land after the visible one, which is the only
    // order in which a stale render can actually do damage.
    await wait(4000);
    out.settled_input = document.getElementById("dailyKwhInput").value;
    out.card_rendered = document.body.textContent.includes(CARD) && region && region.hidden === false;
    out.status = (document.getElementById("sizingStatus")?.textContent || "").trim().slice(0, 200);
    out.button_released = document.getElementById("btnRunSizing").disabled === false;
    // WHICH run the screen is showing, read from the share hash rather than from
    // the page text.
    //
    // The first draft searched the whole document for the digits 10 and 27 and
    // found both on every single run — this page is full of numbers, so a "10 kW"
    // in a chart axis made a perfectly clean run look like a stale one, and the
    // gate failed on a defect it had invented. The share hash is written by
    // updateShareHash from the payload that actually RENDERED, so its encoded
    // load is a single-value observable that cannot be matched by coincidence:
    // it answers "which run painted this screen", which is the claim.
    let kw = null;
    try {
      const raw = String(location.hash || "");
      const b64 = raw.replace(/^#s=/, "");
      if (b64) kw = JSON.parse(atob(b64)).kw ?? null;
    } catch (e) { kw = null; }
    out.rendered_kw = kw;
    return out;
  })()`);

  return {
    ok: true,
    second_run_started_while_first_in_flight:
      race.second_run_started_while_first_in_flight === true,
    settled_input: race.settled_input,
    card_rendered: race.card_rendered === true,
    status: race.status || "",
    button_released: race.button_released === true,
    rendered_kw: race.rendered_kw ?? null,
    // The stale case, named rather than left to a reader to infer.
    stale_figure_rendered: race.rendered_kw === 10,
    new_figure_rendered:
      typeof race.rendered_kw === "number" &&
      Math.abs(race.rendered_kw - 27) < 2,
    // A hash that could not be read is a hole, not a pass: the detector has to be
    // able to say "I do not know" rather than defaulting to clean.
    rendered_kw_readable: typeof race.rendered_kw === "number",
    page_errors: errors.slice(errBefore),
  };
}

/**
 * Share-restore, in the shape that actually broke in production: a run in flight
 * when the page is restored from a share link.
 *
 * A share URL re-runs sizing on load, so restoring one while a run is in flight
 * is the exact sequence that produced the reproduced freeze the run deadline now
 * guards. The assertion is that the restored page answers at all — the inputs
 * come back, the page says it loaded them, and an explicit click still works —
 * and NOT that some particular timeout fired, because on a healthy network the
 * deadline correctly never fires at all.
 */
export async function runShareRestore(ctx, options = {}) {
  const { timeoutMs = RUN_TIMEOUT_MS, settleMs = 6000 } = options;
  const { send, evaluate, errors } = ctx;

  // Get a real share link from a real result: a hand-written hash would be a
  // fixture, and the whole point is that this is the product's own link.
  await send("Page.reload", { ignoreCache: false }).catch(() => {});
  await new Promise((r) => setTimeout(r, settleMs));
  const shareHash = await evaluate(
    `(() => {
      const out = runSourceReady();
      return out;
      function runSourceReady() {
        const s = document.getElementById("citySearch");
        if (s) { s.focus(); s.value = "Honolulu"; s.dispatchEvent(new InputEvent("input", { bubbles: true })); }
        return null;
      }
    })()`,
  );
  void shareHash;
  const suggestion = await evaluate(
    `new Promise((res) => {
      const t0 = Date.now();
      const tick = () => {
        const o = document.querySelector('#citySuggestions [role="option"]');
        if (o || Date.now() - t0 > 20000) return res(!!o);
        setTimeout(tick, 200);
      };
      tick();
    })`,
  ).catch(() => false);
  if (!suggestion)
    return {
      ok: false,
      reason: "no city suggestion, so no share link could be produced",
    };
  await evaluate(
    `document.querySelector('#citySuggestions [role="option"]').click() || true`,
  );
  const settled = await evaluate(
    `(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const k = document.getElementById("dailyKwhInput");
      k.value = "14"; k.dispatchEvent(new Event("input", { bubbles: true }));
      k.dispatchEvent(new Event("change", { bubbles: true }));
      const t = document.getElementById("customRateVal");
      if (t && !(parseFloat(t.value) > 0)) { t.value = "0.42"; t.dispatchEvent(new Event("input", { bubbles: true })); }
      await wait(150);
      document.getElementById("btnRunSizing").click();
      const end = Date.now() + ${timeoutMs};
      while (Date.now() < end) {
        if (document.body.textContent.includes(${JSON.stringify(CARD)})) return true;
        await wait(50);
      }
      return false;
    })()`,
  );
  if (!settled)
    return { ok: false, reason: "the priming run never produced a share link" };
  const hash = await evaluate("String(location.hash || '')");
  if (!hash)
    return {
      ok: false,
      reason: "a completed run produced no share hash to restore",
    };

  const errBefore = errors.length;
  // Restore from that link — the product's own restore path, not a hand-set one.
  await send("Page.navigate", { url: `${ctx.base}${hash}` }).catch(() => {});
  await new Promise((r) => setTimeout(r, settleMs + 2000));

  const restored = await evaluate(`(() => ({
    dailyKwh: document.getElementById("dailyKwhInput")?.value ?? null,
    status: (document.getElementById("sizingStatus")?.textContent || "").trim().slice(0, 200),
    buttonDisabled: document.getElementById("btnRunSizing")?.disabled ?? null,
    hashPresent: String(location.hash || "") === ${JSON.stringify(hash)},
    cardRendered: document.body.textContent.includes(${JSON.stringify(CARD)}),
  }))()`);

  // And the restored page must still be USABLE: an explicit click has to answer.
  const afterRestore = await evaluate(runSource({ timeoutMs }));

  return {
    ok: true,
    share_hash: String(hash).slice(0, 120),
    restored_daily_kwh: restored.dailyKwh,
    // Restored inputs are the claim: a share link that renders a card for
    // defaults instead of the visitor's own numbers has restored nothing.
    inputs_restored: restored.dailyKwh === "14",
    hash_preserved: restored.hashPresent === true,
    status: restored.status || "",
    card_rendered_after_restore: restored.cardRendered === true,
    button_released: restored.buttonDisabled === false,
    explicit_run_after_restore: afterRestore.card_rendered === true,
    explicit_run_ms: afterRestore.ms,
    page_errors: errors.slice(errBefore),
  };
}
