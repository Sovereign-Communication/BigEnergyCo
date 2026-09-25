// Jev sanity-badge flow: the badge is fire-and-forget and must NEVER block
// or alter results, so the honest smoke assertion is wiring — a NEW result
// state renders the right badge shape with a stubbed /api/jev, and nothing
// changes the run. The interpretation thresholds themselves are pinned in
// node tests against live-measured calibration.
import { gate, sleep } from "./runtime.mjs";

const STUB_HEALTH = `if (String(u).indexOf("/api/health") !== -1) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: "ok", jevSanity: true }) });
          }`;

function stubFetch(callsVar, jevJson) {
  return `window.fetch = function (u, o) {
          ${STUB_HEALTH}
          if (String(u).indexOf("/api/jev") !== -1) {
            ${callsVar} = (${callsVar} || 0) + 1;
            return Promise.resolve({ ok: true, json: () => Promise.resolve(${jevJson}) });
          }
          return of.apply(this, arguments);
        };`;
}

const PASS_JSON = `{
              available: true, model: "jev-smoke", plausible: 0.9,
              verdict: "reasonable", verdictConfidence: 0.9,
              redFlag: 0.2, redFlagConfidence: 0.8,
            }`;
const UNCERTAIN_JSON = `{
              available: true, model: "jev-smoke", plausible: 0.45,
              verdict: "reasonable", verdictConfidence: 0.5,
              redFlag: 1.2, redFlagConfidence: 0.2,
            }`;

export async function runJevFlow(ctx) {
  const { evaluate } = ctx;
  const k = `document.getElementById("dailyKwhInput")`;
  const btn = `document.getElementById("btnRunSizing")`;

  // Pass-shaped stub on a fresh state renders the pass badge.
  const badgeGate = await evaluate(
    `(async () => {
        const of = window.fetch;
        const k = document.getElementById("dailyKwhInput");
        const btn = document.getElementById("btnRunSizing");
        const before = k.value;
        ${stubFetch("window.__jevCalls", PASS_JSON)}
        const errs = [];
        const onErr = (e) => errs.push(String((e && (e.message || e.type)) || e));
        window.addEventListener("error", onErr);
        window.addEventListener("unhandledrejection", (e) =>
          errs.push("rejection: " + String(e.reason)),
        );
        try {
          k.value = String(Number(before || "10") + 1);
          // Wait for any in-flight run to release the button before clicking,
          // so the changed input actually produces a fresh payload.
          const t0w = Date.now();
          while (btn?.disabled && Date.now() - t0w < 30000) {
            await new Promise((r) => setTimeout(r, 100));
          }
          btn.click();
          const t0 = Date.now();
          while (Date.now() - t0 < 20000) {
            const b = document.querySelector(".sanity-badge.sanity-pass");
            if (b && b.textContent.length > 0) return "badge";
            await new Promise((r) => setTimeout(r, 100));
          }
          return JSON.stringify({
            badgeAny: !!document.querySelector(".sanity-badge"),
            jevCalls: window.__jevCalls || 0,
            btnDisabled: !!btn.disabled,
            regionHidden: document.getElementById("resultsRegion")?.hidden,
            errs: errs.slice(0, 5),
          });
        } finally {
          // Restore the pre-gate scenario so later gates see the same state.
          try {
            k.value = before;
            if (!btn.disabled) btn.click();
            // Quiescence: the budget-cooperation gate that follows must not
            // start while this restore-run is still in flight.
            const t1 = Date.now();
            while (btn.disabled && Date.now() - t1 < 30000) {
              await new Promise((r) => setTimeout(r, 100));
            }
          } catch {}
          window.fetch = of;
        }
      })()`,
  );
  gate(
    "Jev sanity badge renders on a fresh result (wired, pass-shaped stub)",
    badgeGate === "badge",
    String(badgeGate),
  );

  // The uncertain band renders the NEUTRAL inconclusive badge — never a pass
  // or warning. Not vacuous: the gate proves the /api/jev request fired
  // (calls ≥ 1). Teeth: removing the uncertain render fails this gate.
  const uncertainGate = await evaluate(
    `(async () => {
        const of = window.fetch;
        const k = document.getElementById("dailyKwhInput");
        const btn = document.getElementById("btnRunSizing");
        const before = k.value;
        ${stubFetch("window.__jevCalls2", UNCERTAIN_JSON)}
        try {
          // Clear the prior real/stubbed badge so this gate proves the new
          // inconclusive request, rather than passing on stale DOM.
          document.querySelectorAll(".sanity-badge").forEach((b) => b.remove());
          // +2, not +1: the badge gate above already ran before+1, and the
          // sanity cache would satisfy a repeated key without any fetch.
          k.value = String(Number(before || "10") + 2);
          const t0w = Date.now();
          while (btn?.disabled && Date.now() - t0w < 30000) {
            await new Promise((r) => setTimeout(r, 100));
          }
          btn.click();
          const t0 = Date.now();
          while (Date.now() - t0 < 10000) {
            const badge = document.querySelector(".sanity-badge.sanity-uncertain");
            if (badge && badge.textContent.length > 0)
              return JSON.stringify({ badge: true, calls: window.__jevCalls2 || 0 });
            await new Promise((r) => setTimeout(r, 100));
          }
          return JSON.stringify({ badge: false, calls: window.__jevCalls2 || 0 });
        } finally {
          try {
            k.value = before;
            if (!btn.disabled) btn.click();
            const t1 = Date.now();
            while (btn.disabled && Date.now() - t1 < 30000) {
              await new Promise((r) => setTimeout(r, 100));
            }
          } catch {}
          window.fetch = of;
        }
      })()`,
  );
  let unc = {};
  try {
    unc = JSON.parse(uncertainGate);
  } catch (_) {
    unc = { badge: false, calls: 0 };
  }
  gate(
    "Jev inconclusive verdict renders a neutral badge (request fires)",
    unc.badge === true && unc.calls >= 1,
    uncertainGate,
  );

  // The badge must survive a Simple-mode toggle: applySimpleMode re-renders
  // the simple card through the SAME sanity owner (runSanityCheck), which
  // re-mounts from the state cache — no second /api/jev request. Teeth:
  // reverting the toggle-path call to runSanityCheck re-renders without the
  // badge and fails this gate.
  const toggleGate = await evaluate(
    `(async () => {
        const of = window.fetch;
        const k = document.getElementById("dailyKwhInput");
        const btn = document.getElementById("btnRunSizing");
        const toggle = document.getElementById("simpleModeToggle");
        if (!toggle) return JSON.stringify({ err: "no toggle" });
        const before = k.value;
        ${stubFetch("window.__jevCalls3", PASS_JSON)}
        const flip = (on) => {
          toggle.checked = on;
          toggle.dispatchEvent(new Event("change"));
        };
        try {
          // Earlier gates leave appended badges and cache entries behind; a
          // fresh, unambiguous scenario keeps this gate self-contained.
          document.querySelectorAll(".sanity-badge").forEach((b) => b.remove());
          k.value = String(Number(before || "10") + 40);
          const t0w = Date.now();
          while (btn?.disabled && Date.now() - t0w < 30000) {
            await new Promise((r) => setTimeout(r, 100));
          }
          btn.click();
          const t0 = Date.now();
          let regularBadge = false;
          while (Date.now() - t0 < 15000) {
            if (document.querySelector("#resultsRegion .sanity-badge.sanity-pass")) {
              regularBadge = true;
              break;
            }
            await new Promise((r) => setTimeout(r, 100));
          }
          const callsAtMount = window.__jevCalls3 || 0;
          flip(true);
          await new Promise((r) => setTimeout(r, 400));
          const simpleBadge = !!document.querySelector("#simpleResultsWrap .sanity-badge.sanity-pass");
          const simpleBadgeCount = document.querySelectorAll("#simpleResultsWrap .sanity-badge").length;
          flip(false);
          await new Promise((r) => setTimeout(r, 400));
          const regularBadgeBack = !!document.querySelector("#resultsRegion .sanity-badge.sanity-pass");
          const regularBadgeCount = document.querySelectorAll("#resultsRegion .sanity-badge").length;
          return JSON.stringify({
            regularBadge,
            simpleBadge,
            regularBadgeBack,
            regularBadgeCount,
            simpleBadgeCount,
            callsAtMount,
            callsAfterToggles: window.__jevCalls3 || 0,
          });
        } finally {
          try {
            flip(false);
            k.value = before;
            if (!btn.disabled) btn.click();
            const t1 = Date.now();
            while (btn.disabled && Date.now() - t1 < 30000) {
              await new Promise((r) => setTimeout(r, 100));
            }
          } catch {}
          window.fetch = of;
        }
      })()`,
  );
  let tg = {};
  try {
    tg = JSON.parse(toggleGate);
  } catch (_) {
    tg = { err: String(toggleGate).slice(0, 120) };
  }
  gate(
    "Jev badge survives Simple-mode toggle (cache re-mount, no refetch)",
    tg.regularBadge === true &&
      tg.simpleBadge === true &&
      tg.regularBadgeBack === true &&
      tg.regularBadgeCount === 1 &&
      tg.simpleBadgeCount === 1 &&
      tg.callsAfterToggles === tg.callsAtMount,
    toggleGate,
  );
}
