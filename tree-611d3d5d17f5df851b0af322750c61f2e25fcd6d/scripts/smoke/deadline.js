// Deadline flow: a worker that never replies must surface an honest,
// retryable error instead of hanging forever on "running…" (the reproduced
// share-restore freeze). The browser-only timer shim shortens just the exact
// production deadline; normal browser and worker clocks stay untouched.
import { RUN_REPLY_DEADLINE_MS } from "../../assets/js/sizing/run-coordinator.js";
import { gate } from "./runtime.mjs";

const SMOKE_RUN_DEADLINE_MS = 100;

export async function runDeadlineFlow(ctx, actions) {
  const { evaluate, errors } = ctx;
  const errBefore = errors.length;
  console.log("SMOKE      ── run deadline (silent worker) ──");
  await actions.navigate(`${ctx.base}?smoke=${Date.now()}`);
  await actions.chooseHonolulu();
  try {
    const primed = await actions.runAndWaitCard();
    gate("baseline worker run settles before the silent-run test", primed);
    if (!primed) return;

    // Swallow exactly ONE full-run message so the worker never replies.
    // Later run messages pass through and remain counted for recovery.
    await evaluate(`(() => {
      window.__holdRun = 1;
      window.__runPosts = 0;
      window.__heldRunPosts = 0;
      window.__originalPostMessage = Worker.prototype.postMessage;
      const orig = window.__originalPostMessage;
      Worker.prototype.postMessage = function (m) {
        if (m && m.type === "run") {
          window.__runPosts += 1;
          if (window.__holdRun === 1) {
            window.__holdRun = 2;
            window.__heldRunPosts += 1;
            return;
          }
        }
        return orig.call(this, m);
      };

      // The test only shortens timers using the exact production bound. It
      // does not add a public URL/test hook or freeze worker/renderer time.
      window.__nativeSetTimeout = window.setTimeout;
      window.__shortenedRunDeadlines = 0;
      window.setTimeout = function (callback, delay, ...args) {
        if (
          delay === ${RUN_REPLY_DEADLINE_MS} &&
          window.__shortenedRunDeadlines === 0
        ) {
          window.__shortenedRunDeadlines += 1;
          return window.__nativeSetTimeout.call(this, callback, ${SMOKE_RUN_DEADLINE_MS}, ...args);
        }
        return window.__nativeSetTimeout.call(this, callback, delay, ...args);
      };
      return true;
    })()`);
    await evaluate(`document.getElementById("btnRunSizing").click()`);
    const timedOut = await ctx.poll(
      async () =>
        evaluate(`(() => {
          const status = document.getElementById("sizingStatus")?.textContent || "";
          const button = document.getElementById("btnRunSizing");
          return /did not reply in time/.test(status) && !button?.disabled;
        })()`),
      10000,
      50,
    );
    gate(
      "smoke shortens the exact production deadline once",
      (await evaluate("window.__shortenedRunDeadlines")) === 1,
      String(await evaluate("window.__shortenedRunDeadlines")),
    );
    gate(
      "silent worker surfaces an honest timeout and releases the button",
      timedOut,
    );

    const state = await evaluate(`(() => {
      const st = document.getElementById("sizingStatus");
      const btn = document.getElementById("btnRunSizing");
      return {
        status: st ? st.textContent : "",
        disabled: btn ? btn.disabled : null,
      };
    })()`);
    gate(
      "silent worker surfaces an honest timeout error",
      /did not reply in time/.test(state.status),
      String(state.status).slice(0, 160),
    );
    gate(
      "silent-run fixture swallowed exactly one worker message",
      (await evaluate("window.__heldRunPosts")) === 1,
      JSON.stringify({
        runPosts: await evaluate("window.__runPosts"),
        heldRunPosts: await evaluate("window.__heldRunPosts"),
      }),
    );
    gate(
      "run button restored after the timeout",
      state.disabled === false,
      String(state.disabled),
    );

    // Recovery: release the hold, then an explicit click must create a fresh
    // Worker and complete normally. Keep the postMessage wrapper active so the
    // gate proves that the second run really was posted.
    await evaluate(`(() => { window.__holdRun = 0; return true; })()`);
    await evaluate(`document.getElementById("btnRunSizing").click()`);
    const recovered = await ctx.poll(
      async () =>
        evaluate(`(() => {
          const button = document.getElementById("btnRunSizing");
          const status = document.getElementById("sizingStatus")?.textContent || "";
          const hasResults = !document.getElementById("resultsRegion")?.hidden;
          return window.__runPosts >= 2 && !button?.disabled && hasResults && status.includes("yr of hourly data");
        })()`),
      45000,
      500,
    );
    const retryState = await evaluate(`(() => ({
    status: document.getElementById("sizingStatus")?.textContent || "",
    disabled: document.getElementById("btnRunSizing")?.disabled ?? null,
    resultText: document.body.textContent.includes("Total 20-year cost"),
    resultsHidden: document.getElementById("resultsRegion")?.hidden ?? null,
    latitude: document.getElementById("latInput")?.value || "",
    longitude: document.getElementById("lonInput")?.value || "",
    dailyKwh: document.getElementById("dailyKwhInput")?.value || "",
    runPosts: window.__runPosts,
    heldRunPosts: window.__heldRunPosts,
    }))()`);
    gate(
      "a fresh explicit click recovers from the deadline",
      recovered,
      JSON.stringify(retryState).slice(0, 260),
    );
    gate(
      "deadline flow adds no console/page errors",
      errors.length === errBefore,
      errors.slice(errBefore).join(" | ").slice(0, 240),
    );
  } finally {
    await evaluate(`(() => {
      if (window.__nativeSetTimeout) {
        window.setTimeout = window.__nativeSetTimeout;
        delete window.__nativeSetTimeout;
      }
      if (window.__originalPostMessage) {
        Worker.prototype.postMessage = window.__originalPostMessage;
        delete window.__originalPostMessage;
      }
      delete window.__holdRun;
      return true;
    })()`).catch(() => {});
  }
}
