// Off-grid mode-chrome regression flow: the exact owner-reported repro.
//
// Owner report (2026-10-19): after a grid-tie result, clicking "Off-grid"
// still showed the "Cut ~80% of your bill" slider — a bill question for a
// user with no bill. The fix (PR #244) makes #cutSliderRow's visibility a
// pure function of current state with ONE writer (syncCutRowVisibility).
//
// This flow drives the real page through the repro in Chrome:
// grid-tie result rendered -> click #btnGoalOffgrid -> the bill-cut row
// must hide. The generator-runtime question is asked on the off-grid USE
// CASE's inputs (input panels are registry-driven: only the declared inputs
// are visible, so the question appears when the off-grid use case is
// selected, not on a bare goal flip) — the flow selects that use case the
// way a visitor does and verifies the question is shown there.
//
// State is restored on the way out (use case + goal toggle) so later flows
// inherit exactly what runGridTieFlow left behind. It runs right after
// runGridTieFlow, which leaves the grid-tie result on screen.
import { gate } from "./runtime.mjs";

const displayOf = (id) =>
  `(() => { const n = document.getElementById(${JSON.stringify(id)}); return n ? getComputedStyle(n).display : "MISSING"; })()`;

// Visibility via computed display, not offsetParent: offsetParent is null
// for this select even when both it and its panel render (panel display
// block, select inline-block — proven by CI diagnostic 2026-10-21), so it
// is not a reliable visibility signal here.
const genStateOf = `(() => {
    const s = document.getElementById("generatorRuntime");
    if (!s) return { missing: true };
    const panel = document.getElementById("offgridInputs");
    const visible =
      !!panel &&
      getComputedStyle(panel).display !== "none" &&
      getComputedStyle(s).display !== "none";
    const opts = [...s.options].map((o) => o.value);
    return { visible, opts, value: s.value };
  })()`;

export async function runOffgridChromeFlow(ctx, actions) {
  const { evaluate } = ctx;
  console.log("SMOKE      ── off-grid mode chrome (reported repro) ──");

  // Remember the entry state so the flow leaves no trace for later flows.
  const savedUseCase = await evaluate(
    `document.getElementById("useCase")?.value || "billcut"`,
  );

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

  // The generator question is asked on the off-grid use case's inputs.
  // Select it the way a visitor does: the use-case dropdown.
  await evaluate(`(() => {
    const uc = document.getElementById("useCase");
    uc.value = "offgrid";
    uc.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  const panelShown = await ctx.poll(
    async () =>
      (await evaluate(`!document.getElementById("offgridInputs")?.hidden`)) ===
      true,
    15000,
    500,
  );
  gate(
    "off-grid chrome: off-grid inputs shown for the off-grid use case",
    panelShown === true,
    `shown=${panelShown}`,
  );
  const genState = await evaluate(genStateOf);
  gate(
    "off-grid chrome: generator question visible on the off-grid use case",
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

  // Restore the entry state: use case back, goal toggle back to grid-tie.
  // The bill-cut row must come back with it — the toggle works both ways,
  // and the next flows inherit a clean grid-tie page.
  await evaluate(`(() => {
    const uc = document.getElementById("useCase");
    uc.value = ${JSON.stringify(savedUseCase)};
    uc.dispatchEvent(new Event("change", { bubbles: true }));
    document.getElementById("btnGoalGridtie").click();
  })()`);
  const restored = await ctx.poll(
    async () => (await evaluate(displayOf("cutSliderRow"))) !== "none",
    15000,
    500,
  );
  gate(
    "off-grid chrome: bill-cut row restored after Grid-tie click (clean state)",
    restored === true,
    `display=${await evaluate(displayOf("cutSliderRow"))}`,
  );
}
