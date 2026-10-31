// Run-lifecycle flow: the consent boundary (pre-calculation inputs wait for
// the explicit click) and the held-response race (a stale real reply must be
// dropped without deadlocking the next explicit run).
import { gate, sleep } from "./runtime.mjs";
import { RUN_TIMEOUT_MS } from "./actions.mjs";

export async function runLifecycleFlow(ctx, actions) {
  const { evaluate } = ctx;

  // Every pre-calculation control must invalidate the result without
  // starting another worker run. The single explicit click below proves the
  // boundary in the same browser session, rather than from source text.
  const preCalcGate = await evaluate(`(() => {
      const workerProto = Worker.prototype;
      const originalPost = workerProto.postMessage;
      window.__originalPostMessage = originalPost;
      window.__explicitRunPosts = 0;
      workerProto.postMessage = function (message) {
        if (message?.type === "run") window.__explicitRunPosts += 1;
        return originalPost.apply(this, arguments);
      };
      const fire = (id, type, value) => {
        const node = document.getElementById(id);
        if (!node) return false;
        if (type === "checkbox") node.checked = !node.checked;
        else if (value !== undefined) node.value = value;
        node.dispatchEvent(new Event(type === "input" ? "input" : "change", { bubbles: true }));
        return true;
      };
      // These are assumptions about the system, not result-stage spectrum
      // controls. Each must leave the results hidden and the worker idle.
      const originalValues = {};
      for (const id of [
        "loadMode",
        "dailyKwhInput",
        "systemGoal",
        "chemSelect",
        "hardwareConfig",
        "autoTier",
        "customRateVal",
        "fixedChargeVal",
        "roofAreaM2",
        "wiringOverride",
        "mpptOverride",
        "panelWatts",
        "cutSlider",
        "budgetSlider",
      ]) {
        originalValues[id] = document.getElementById(id)?.value;
      }
      const originalClimate = document.getElementById("climateAwareToggle")?.checked;
      const cases = [
        ["loadMode", "change", "appliances"],
        ["dailyKwhInput", "input", "11"],
        ["systemGoal", "change", "offgrid"],
        ["chemSelect", "change", "lfp"],
        ["hardwareConfig", "change", "solar"],
        ["autoTier", "change", "tier95"],
        ["customRateVal", "input", "0.43"],
        ["fixedChargeVal", "input", "12"],
        ["roofAreaM2", "input", "120"],
        ["climateAwareToggle", "change", undefined],
        ["wiringOverride", "change", "97"],
        ["mpptOverride", "change", "97"],
        ["panelWatts", "input", "450"],
      ];
      for (const [id, type, value] of cases) fire(id, type, value);
      // Restore the exact pre-gate scenario before the one permitted run, so
      // subsequent spectrum and Jev gates exercise their normal path.
      for (const id of Object.keys(originalValues)) {
        const type = id === "customRateVal" || id === "fixedChargeVal" || id === "roofAreaM2" ? "input" : "change";
        fire(id, type, originalValues[id]);
      }
      const climate = document.getElementById("climateAwareToggle");
      if (climate && climate.checked !== originalClimate) fire("climateAwareToggle", "change");
      fire("cutSlider", "change", originalValues.cutSlider);
      fire("budgetSlider", "change", originalValues.budgetSlider);
      return JSON.stringify({
        ran: window.__explicitRunPosts,
        hidden: document.getElementById("resultsRegion")?.hidden === true,
      });
    })()`);
  const preCalcState = JSON.parse(preCalcGate);
  gate(
    "pre-calculation inputs wait for explicit sizing",
    preCalcState.ran === 0 && preCalcState.hidden === true,
    preCalcGate,
  );
  await evaluate(`document.getElementById("btnRunSizing").click()`);
  const preCalcRecovered = await ctx.poll(
    async () => evaluate(`!document.getElementById("resultsRegion")?.hidden`),
    RUN_TIMEOUT_MS,
  );
  gate("explicit sizing resumes after pre-calculation edits", preCalcRecovered);
  await evaluate(
    `(() => { Worker.prototype.postMessage = window.__originalPostMessage || Worker.prototype.postMessage; delete window.__originalPostMessage; })()`,
  );

  // ── Held-response race (real worker reply, not a fixture) ─────────
  // The defect class the run lifecycle exists for: a sizing reply that lands
  // while a pre-calculation edit has made it stale must be dropped WITHOUT
  // deadlocking the next explicit run. This gate holds the REAL worker's
  // reply (one-shot onmessage capture — the engine genuinely computed it),
  // edits a pre-calc input so the reply goes stale, releases it, and proves
  // the next explicit click completes. Teeth: reverting the stale-release
  // path (workerBusy never freed) leaves the button disabled and fails this
  // gate.
  console.log("SMOKE      ── held-response race ──");
  const heldRace = await evaluate(`(async () => {
      const proto = Worker.prototype;
      const postDesc = Object.getOwnPropertyDescriptor(proto, "postMessage");
      const origPost = proto.postMessage;
      window.__held = null;
      window.__holdNext = true;
      window.__runPosts2 = 0;
      // Instance-level capture: the app assigns worker.onmessage when the
      // worker is created, so the hook must wrap the LIVE handler at the
      // moment the run is posted. The real engine computes the reply; this
      // only defers its delivery by one shot.
      let workerRef = null;
      let appHandler = null;
      proto.postMessage = function (msg) {
        if (msg?.type === "run") {
          window.__runPosts2 += 1;
          // Wrap the LIVE handler synchronously before the run is sent: the
          // worker cannot reply before the message goes out, so the very
          // next "ok" is capturable.
          if (window.__holdNext && window.__held === null && !workerRef) {
            const current = this.onmessage;
            if (typeof current === "function") {
              workerRef = this;
              appHandler = current;
              this.onmessage = function (ev) {
                if (
                  ev.data?.type === "ok" &&
                  window.__holdNext &&
                  window.__held === null
                ) {
                  window.__holdNext = false;
                  const w = this;
                  window.__held = {
                    seq: ev.data.seq,
                    deliver: () => appHandler.call(w, ev),
                  };
                  return;
                }
                return appHandler.call(this, ev);
              };
            }
          }
        }
        return origPost.apply(this, arguments);
      };
      const k = document.getElementById("dailyKwhInput");
      const btn = document.getElementById("btnRunSizing");
      const t = (ms) => new Promise((r) => setTimeout(r, ms));
      try {
        // 1. Explicit run; its real reply is captured mid-flight.
        btn.click();
        const t0 = Date.now();
        while (!window.__held && Date.now() - t0 < 15000) await t(100);
        const held = !!window.__held;
        const heldSeq = window.__held?.seq ?? null;
        // 2. Pre-calc edit while the reply is held: runToken++ makes it stale.
        k.value = String(Number(k.value || "10") + 5);
        k.dispatchEvent(new Event("input", { bubbles: true }));
        await t(100);
        // 3. Release the stale reply: must be dropped, button re-enabled,
        //    NO render and NO new run post.
        window.__held?.deliver();
        const t1 = Date.now();
        let staleDropped = false;
        while (Date.now() - t1 < 10000) {
          if (!btn.disabled) {
            staleDropped = true;
            break;
          }
          await t(100);
        }
        const resultsStillHidden = document.getElementById("resultsRegion")?.hidden === true;
        const postsAfterDrop = window.__runPosts2;
        // 4. The next explicit click must complete end-to-end.
        btn.click();
        const t2 = Date.now();
        let recovered = false;
        while (Date.now() - t2 < 60000) {
          if (!btn.disabled && document.getElementById("resultsRegion")?.hidden === false) {
            recovered = true;
            break;
          }
          await t(100);
        }
        return JSON.stringify({ held, heldSeq, staleDropped, resultsStillHidden, postsAfterDrop, totalPosts: window.__runPosts2, recovered });
      } finally {
        if (postDesc) Object.defineProperty(proto, "postMessage", postDesc);
        else proto.postMessage = origPost;
        if (workerRef && appHandler) workerRef.onmessage = appHandler;
        delete window.__held;
        delete window.__holdNext;
        delete window.__runPosts2;
      }
    })()`);
  let race = {};
  try {
    race = JSON.parse(heldRace);
  } catch (_) {
    race = { err: String(heldRace).slice(0, 120) };
  }
  gate(
    "stale held reply is dropped without deadlocking the next run",
    race.held === true &&
      race.staleDropped === true &&
      race.resultsStillHidden === true &&
      race.postsAfterDrop === 1 &&
      race.recovered === true,
    heldRace,
  );

  // ── Warm-path timing + weather-cache regression ────────────────────
  // A re-run at an UNCHANGED location must pull zero weather data (layered
  // cache + session memo), and the warm fast path must feel instant. Counted
  // at the fetch layer — node-injected weather bypasses the memo by design.
  console.log("SMOKE      ── responsiveness ──");
  const rerunMs = await evaluate(
    `(async () => {
        const t0 = performance.now();
        document.getElementById("btnRunSizing").click();
        // Resolve when the speed badge is set or the button re-enables.
        await new Promise((resolve) => {
          const t0b = Date.now();
          const tick = () => {
            const note = document.getElementById("speedNote");
            if ((note && note.style.display === "block") ||
                !document.getElementById("btnRunSizing")?.disabled) return resolve();
            if (Date.now() - t0b > 60000) return resolve();
            setTimeout(tick, 50);
          };
          tick();
        });
        return Math.round(performance.now() - t0);
      })()`,
  );
  gate(
    "warm re-run under 2s",
    Number.isFinite(rerunMs) && rerunMs < 2000,
    `${rerunMs} ms (payload-cache fast path)`,
  );

  const nasaRepulls = await evaluate(
    `(async () => {
        let n = 0;
        const of = window.fetch;
        window.fetch = function (u, o) {
          if (String(u).indexOf("power.larc.nasa.gov") !== -1) n += 1;
          return of.apply(this, arguments);
        };
        try {
          document.getElementById("btnRunSizing").click();
          const t0 = Date.now();
          while (document.getElementById("btnRunSizing")?.disabled && Date.now() - t0 < 30000) {
            await new Promise((r) => setTimeout(r, 50));
          }
          await new Promise((r) => setTimeout(r, 500));
          return n;
        } finally {
          window.fetch = of;
        }
      })()`,
  );
  gate(
    "same-location re-run pulls zero weather data",
    nasaRepulls === 0,
    `${nasaRepulls} NASA fetches (expect 0)`,
  );
  gate(
    "instant-run badge shown on repeat",
    await evaluate(
      `(() => { const n = document.getElementById("speedNote"); return !!n && n.style.display === "block" && /Instant/i.test(n.textContent); })()`,
    ),
  );
  const preconnects = await evaluate(
    `[...document.querySelectorAll('link[rel="preconnect"]')].map(l => l.href).filter(h => /power\\.larc\\.nasa\\.gov|open\\.er-api\\.com|nominatim\\.openstreetmap\\.org/.test(h)).length`,
  );
  gate("preconnect hints present", preconnects >= 3, `${preconnects} hints`);

  // Re-run choreography: loading pipeline appears and completes.
  const pipelineWorks = await evaluate(
    `(async () => {
        const pipe = document.getElementById("loadingPipeline");
        document.getElementById("btnRunSizing").click();
        // On a warm repeat the whole run finishes before we can observe the
        // pipeline; that is fine — instant beats visible.
        for (let i = 0; i < 40; i++) {
          if (pipe && pipe.style.display === "block") return "visible";
          await new Promise((r) => setTimeout(r, 50));
        }
        const note = document.getElementById("speedNote");
        return note && note.style.display === "block" ? "instant" : "missing";
      })()`,
  );
  gate(
    "loading pipeline or instant path observed",
    pipelineWorks === "visible" || pipelineWorks === "instant",
    String(pipelineWorks),
  );
}
