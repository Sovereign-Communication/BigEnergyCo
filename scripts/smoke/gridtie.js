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
}
