// Off-grid mode-chrome regression flow: the exact owner-reported repro.
//
// Owner report (2026-10-19): after a grid-tie result, clicking "Off-grid"
// still showed the "Cut ~80% of your bill" slider — a bill question for a
// user with no bill. The fix (PR #244) makes #cutSliderRow's visibility a
// pure function of current state with ONE writer (syncCutRowVisibility),
// and asks the generator-runtime question instead.
//
// This flow drives the real page through the repro in Chrome:
// grid-tie result rendered -> click #btnGoalOffgrid -> the bill-cut row
// must hide and #generatorRuntime must appear. It runs right after
// runGridTieFlow, which leaves the grid-tie result on screen.
import { gate } from "./runtime.mjs";

const displayOf = (id) =>
  `(() => { const n = document.getElementById(${JSON.stringify(id)}); return n ? getComputedStyle(n).display : "MISSING"; })()`;

export async function runOffgridChromeFlow(ctx, actions) {
  const { evaluate } = ctx;
  console.log("SMOKE      ── off-grid mode chrome (reported repro) ──");

  // Precondition: the grid-tie run left the bill-cut row visible.
  const before = await evaluate(displayOf("cutSliderRow"));
  gate(
    "off-grid chrome: bill-cut row visible after grid-tie result (repro precondition)",
    before !== "none" && before !== "MISSING",
    `display=${before}`,
  );

  // The reported repro: click the Off-grid goal button.
  const btn = await evaluate(displayOf("btnGoalOffgrid"));
  gate(
    "off-grid chrome: goal button present",
    btn !== "MISSING",
    `display=${btn}`,
  );
  await evaluate(`document.getElementById("btnGoalOffgrid").click()`);

  // The fix hides the row synchronously in setGoal; poll briefly for it.
  const hidden = await ctx.poll(
    async () => (await evaluate(displayOf("cutSliderRow"))) === "none",
    15000,
    500,
  );
  gate(
    "off-grid chrome: bill-cut row hidden after Off-grid click",
    hidden === true,
    `display=${await evaluate(displayOf("cutSliderRow"))}`,
  );

  // The generator question replaces the bill question.
  const genState = await evaluate(`(() => {
    const s = document.getElementById("generatorRuntime");
    if (!s) return { missing: true };
    const visible = !!s.offsetParent;
    const opts = [...s.options].map((o) => o.value);
    return { visible, opts, value: s.value };
  })()`);
  gate(
    "off-grid chrome: generator question visible",
    genState.visible === true,
    JSON.stringify(genState),
  );
  gate(
    "off-grid chrome: generator offers 0% / 1% / 2%+ with 1% default",
    Array.isArray(genState.opts) &&
      genState.opts.join(",") === "gen0,gen1,gen2" &&
      genState.value === "gen1",
    JSON.stringify(genState),
  );
}
