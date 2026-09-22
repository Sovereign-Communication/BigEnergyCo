// Share-link flow: the serialized state must survive a fresh page — inputs
// restore, sizing still requires the explicit button, then it completes.
import { gate } from "./runtime.mjs";
import { RUN_TIMEOUT_MS } from "./actions.mjs";

export async function runShareFlow(ctx, actions) {
  const { evaluate } = ctx;

  console.log("SMOKE      ── share link ──");
  const shareHash = await evaluate(`(() => {
      document.getElementById("btnShareResult").click();
      return location.hash.startsWith("#s=") ? location.hash : null;
    })()`);
  gate(
    "share click leaves a #s= link in the URL",
    !!shareHash,
    String(shareHash || "").slice(0, 24),
  );
  if (shareHash) {
    await actions.navigate(`${ctx.base}${shareHash}`);
    const restoredInputs = await ctx.poll(
      async () =>
        evaluate(
          `!!document.getElementById("dailyKwhInput")?.value && document.getElementById("resultsRegion")?.hidden === true`,
        ),
      10000,
    );
    const beforeRun = await evaluate(
      `(() => ({ kwh: document.getElementById("dailyKwhInput")?.value, results: !document.getElementById("resultsRegion")?.hidden }))()`,
    );
    gate(
      "share link restores inputs without auto-sizing",
      !!restoredInputs && beforeRun.results === false,
      JSON.stringify(beforeRun),
    );
    await evaluate(`document.getElementById("btnRunSizing").click()`);
    const restored = await ctx.poll(
      async () => evaluate(`!document.getElementById("resultsRegion")?.hidden`),
      RUN_TIMEOUT_MS,
    );
    gate("share link sizes after the explicit click", !!restored);
  }
}
