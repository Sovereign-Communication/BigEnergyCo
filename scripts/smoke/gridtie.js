// Structural feasibility + grid-tie result flow: the infeasible banner for
// off-grid + solar-only (reason up top, no broken fallback box), then the
// full grid-tie run with its chart/canvas contract.
import { gate, sleep } from "./runtime.mjs";
import { RUN_TIMEOUT_MS } from "./actions.mjs";

export async function runGridTieFlow(ctx, actions) {
  const { evaluate } = ctx;

  // ── Structural infeasibility (off-grid + solar-only) ───────────────
  // Reports a reason up top and hides the broken savings-unavailable box.
  console.log("SMOKE      ── infeasible off-grid + solar-only ──");
  // Settle first: a click landing on a disabled Run button (previous run
  // still in flight, e.g. from auto-location) is silently swallowed, and
  // input changes made before the first payload never trigger their quiet
  // run — either way no new run starts and the banner can never appear.
  await ctx.poll(
    async () =>
      !(await evaluate(`document.getElementById("btnRunSizing")?.disabled`)),
    180000,
    2000,
  );
  await evaluate(`(() => {
      document.getElementById("systemGoal").value = "offgrid";
      document.getElementById("systemGoal").dispatchEvent(new Event("change", { bubbles: true }));
      const hw = document.getElementById("hardwareConfig");
      hw.value = "solar";
      hw.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
  await evaluate(`document.getElementById("btnRunSizing").click()`);
  // Re-click while idle: guarantees a run actually started even if the
  // first click hit a disabled button. Repeated clicks are harmless —
  // same inputs, stale responses are dropped by seq.
  let infeasibleShown = false;
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    if (
      await evaluate(
        `document.getElementById("infeasibleBanner")?.style.display === "block"`,
      )
    ) {
      infeasibleShown = true;
      break;
    }
    if (
      !(await evaluate(`document.getElementById("btnRunSizing")?.disabled`))
    ) {
      await evaluate(`document.getElementById("btnRunSizing").click()`);
    }
  }
  gate(
    "infeasible banner shown for offgrid+solar-only",
    infeasibleShown,
    String(
      await evaluate(
        `document.getElementById("infeasibleBanner")?.style.display ?? "absent"`,
      ),
    ),
  );
  gate(
    "no savings-unavailable fallback on infeasible run",
    !(await evaluate(
      `document.body.textContent.includes("Savings data unavailable for this result")`,
    )),
  );
  // Restore default hardware for downstream gates.
  await evaluate(`(() => {
      const hw = document.getElementById("hardwareConfig");
      hw.value = "both";
      hw.dispatchEvent(new Event("change", { bubbles: true }));
      document.getElementById("systemGoal").value = "gridtie";
      document.getElementById("systemGoal").dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
  gate(
    "chat bridge loaded (extracted classic script)",
    await evaluate(`typeof window.sendChatMsg === "function"`),
  );
  const loadMs = await evaluate(
    `(() => { const t = performance.timing; return (t.loadEventEnd || Date.now()) - t.navigationStart; })()`,
  );
  gate(
    "page load under 60s",
    Number.isFinite(loadMs) && loadMs < 60000,
    `${loadMs} ms`,
  );

  // ── Full grid-tie run: card + charts ───────────────────────────────
  if (!(await actions.chooseHonolulu()))
    throw new Error("city select failed; aborting run");
  const tariff = await actions.setInputs("gridtie");
  gate(
    "positive grid price",
    Number.isFinite(tariff) && tariff > 0,
    `$${tariff}/kWh`,
  );
  gate("result card has Total 20-year cost", await actions.runAndWaitCard());
  // This session showed a real infeasible banner above, so a stale one would
  // still be sitting here. The reason explains the payload on screen, and the
  // run that replaced it solved — so both the banner and the sr-only region
  // that mirrors it must be retracted, while the region itself stays rendered
  // (display:none is exactly what a screen reader will not announce, so
  // "clearing" it by hiding it would silently disable the feature).
  const bannerAfter = await evaluate(`(() => {
      const b = document.getElementById("infeasibleBanner");
      const live = document.getElementById("infeasibleLive");
      return {
        display: b ? getComputedStyle(b).display : "absent",
        htmlEmpty: b ? b.innerHTML === "" : true,
        liveEmpty: live ? live.textContent === "" : true,
        liveRendered: live ? getComputedStyle(live).display !== "none" : false,
      };
    })()`);
  gate(
    "solvable run retracts the previous infeasible reason",
    bannerAfter.display !== "block" &&
      bannerAfter.htmlEmpty &&
      bannerAfter.liveEmpty,
    JSON.stringify(bannerAfter),
  );
  gate(
    "infeasible live region stays rendered while empty",
    bannerAfter.liveRendered,
    JSON.stringify(bannerAfter),
  );
  gate(
    "savings chart heading present",
    await evaluate(
      `document.body.textContent.includes("What does solar really save you?")`,
    ),
  );
  gate(
    "no savings-unavailable fallback",
    !(await evaluate(
      `document.body.textContent.includes("Savings data unavailable")`,
    )),
  );
  const canvasBox = await evaluate(
    `(() => { const c = document.getElementById("cumCostCanvas"); if (!c) return null; const r = c.getBoundingClientRect(); return { w: r.width, h: r.height }; })()`,
  );
  gate(
    "cumCostCanvas non-zero",
    !!canvasBox && canvasBox.w > 0 && canvasBox.h > 0,
    JSON.stringify(canvasBox),
  );
  const caption = await evaluate(
    `(document.getElementById("cumCostCaption")?.textContent || "").trim().length`,
  );
  gate(
    "cumCostCaption explains running cost",
    (caption || 0) > 20,
    `${caption} chars`,
  );

  // ── Battery-only (no panels): peak offset must not be sold as a bill cut ──
  // run.js stores the peak-offset fraction in cutPct when pvKw is 0. The chip,
  // the money bar and the matrix all labelled that a "bill cut" and promised a
  // payback, while the panel beside them reported "never" break-even and 20-year
  // bills identical to staying on the grid. This gate is what fails on that.
  console.log("SMOKE      ── battery-only: peak offset, not a bill cut ──");
  await evaluate(`(() => {
      const hw = document.getElementById("hardwareConfig");
      hw.value = "battery";
      hw.dispatchEvent(new Event("change", { bubbles: true }));
      document.getElementById("systemGoal").value = "gridtie";
      document.getElementById("systemGoal").dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
  await evaluate(`document.getElementById("btnRunSizing").click()`);
  // Wait for the BATTERY-ONLY payload specifically, not merely for some result
  // card. The previous grid-tie card is still on screen, so a generic card
  // check returns instantly and reads the solar system's surfaces — which is
  // how a time-based version of this gate would pass while proving nothing.
  const battRan = await ctx.poll(
    async () =>
      evaluate(`(() => {
          const p = document.getElementById("resultsRegion");
          // textContent, not innerText: innerText is "" for a hidden
          // subtree, so an innerText-based poll can never observe the state
          // it is waiting for and just burns its whole timeout.
          return !!p && p.textContent.includes("None (Battery-only)");
        })()`),
    RUN_TIMEOUT_MS,
    2000,
  );
  gate("battery-only run renders a no-panel result", battRan);
  await sleep(1200);
  const battSurfaces = await evaluate(`(() => {
      const clean = (id) => {
        const e = document.getElementById(id);
        return e ? e.innerText.replace(/\\s+/g, " ").trim() : "";
      };
      return {
        chips: clean("focusChips"),
        money: clean("moneyBar"),
        simple: clean("simpleResultsWrap"),
        panel: clean("resultsRegion"),
      };
    })()`);
  gate(
    "battery-only chip says peak offset, not bill cut",
    /peak offset/.test(battSurfaces.chips) &&
      !/bill cut/.test(battSurfaces.chips),
    battSurfaces.chips.replace(/\s+/g, " ").slice(0, 160),
  );
  gate(
    "battery-only money bar promises no payback",
    /no panels/.test(battSurfaces.money) &&
      !/repays itself|bill after solar/i.test(battSurfaces.money),
    battSurfaces.money.slice(0, 160),
  );
  gate(
    "battery-only panel still reports no break-even",
    /break-even/.test(battSurfaces.panel) && /never/.test(battSurfaces.panel),
  );
  gate(
    "battery-only build has no solar array",
    /Solar array None/.test(battSurfaces.panel),
  );
  gate(
    "no surface claims a bill cut for a battery-only build",
    !/bill cut|off your bill/.test(
      battSurfaces.chips + " " + battSurfaces.money,
    ),
  );
  // Leave the default hardware behind for every downstream flow.
  await evaluate(`(() => {
      const hw = document.getElementById("hardwareConfig");
      hw.value = "both";
      hw.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
}
