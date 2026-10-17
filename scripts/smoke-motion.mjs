import { normalizeBase } from "./lib/base-url.mjs";
import { createActions } from "./smoke/actions.mjs";
import { runA11yFlow } from "./smoke/a11y.js";
import { runDeferredChatStartupFlow } from "./smoke/deferred-startup.js";
import { start, gate, gateSummary } from "./smoke/runtime.mjs";

const BASE = normalizeBase(
  process.argv[2] || "https://freeoffgridcalculator.com/",
);
const isLocalBase = /^https?:\/\/localhost|^http:\/\/127\.0\.0\.1/.test(BASE);

async function main() {
  console.log(`SMOKE      base: ${BASE}`);
  const ctx = { base: BASE, isLocalBase, ...(await start()) };
  const actions = createActions(ctx);
  try {
    await ctx.send("Page.enable");
    await ctx.send("Runtime.enable");
    await ctx.send("Log.enable");
    console.log("SMOKE      focused motion flows (Jev flow skipped)");
    await runDeferredChatStartupFlow(ctx, "normal");
    await runDeferredChatStartupFlow(ctx, "reduced");

    await actions.navigate(`${BASE}?smoke=${Date.now()}`);
    const cityReady = await actions.chooseHonolulu();
    gate("focused motion sizing location is selected", cityReady);
    if (cityReady) {
      const tariff = await actions.setInputs("gridtie");
      gate(
        "focused motion sizing has a positive tariff",
        Number.isFinite(tariff) && tariff > 0,
        `$${tariff}/kWh`,
      );
      const cardReady = await actions.runAndWaitCard();
      gate("focused motion sizing result renders", cardReady);
      if (cardReady) await runA11yFlow(ctx);
    }
    gate(
      "focused motion flow adds no console/page errors",
      ctx.errors.length === 0,
      ctx.errors.slice(0, 4).join(" | ").slice(0, 240),
    );
  } catch (error) {
    gate(
      "focused motion run completed",
      false,
      String(error?.message || error).slice(0, 300),
    );
  } finally {
    await ctx.close();
  }
  process.exit(gateSummary());
}

main();
