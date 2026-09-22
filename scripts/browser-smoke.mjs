// Approved real-browser smoke test for the production runbook.
// Zero dependencies: drives the installed Chrome (or Edge fallback) over CDP
// using only Node built-ins. Behavior lives in focused per-flow modules under
// scripts/smoke/ — this file only sequences them and reports the exit code.
//
// Run: node scripts/browser-smoke.mjs [baseUrl]
//   default base: https://freeoffgridcalculator.com/
//   npm run smoke
//
// Coverage (every gate fails the run):
//   main page: hero CTA, weather persistence (cold pulls / warm zero), auto-
//   location consent, grid-tie run, result card, charts, pre-calc consent,
//   held-response race, responsiveness, Jev badges, sliders, CSP-wired
//   controls, a11y basics, service worker, re-slice, Simple mode,
//   off-grid run, external integrations, no console/CSP errors.
//   heatmap page: Leaflet loads, map initializes, no console/page errors.
// Exit 0 = pass, 1 = fail (prints every failed gate).
import { normalizeBase } from "./lib/base-url.mjs";
import { start, gate, gateSummary } from "./smoke/runtime.mjs";
import { createActions } from "./smoke/actions.mjs";
import { runWeatherFlow } from "./smoke/weather.js";
import { runGridTieFlow } from "./smoke/gridtie.js";
import { runLifecycleFlow } from "./smoke/lifecycle.js";
import { runResultsFlow } from "./smoke/results.js";
import { runJevFlow } from "./smoke/jev.js";
import { runShareFlow } from "./smoke/share.js";
import { runClosingFlow } from "./smoke/closing.js";

// BASE must always end in "/": sub-pages are built as `${BASE}solar-heatmap/`,
// so a slash-less argument like `https://example.com` would otherwise produce
// the invalid host `example.comsolar-heatmap` (Chrome error page → false
// heatmap gate failures). normalizeBase (scripts/lib/base-url.mjs, unit-tested)
// canonicalizes any argv form to a trailing slash.
const BASE = normalizeBase(
  process.argv[2] || "https://freeoffgridcalculator.com/",
);
// Localhost/base-URL runs are harness-only: a few gates are origin-bound
// (the API worker's CORS allowlist covers production origins), so they are
// classified as warnings instead of failures there. Production runs keep
// full strictness.
const isLocalBase = /^https?:\/\/localhost|^http:\/\/127\.0\.0\.1/.test(BASE);

async function main() {
  console.log(`SMOKE      base: ${BASE}`);
  const ctx = { base: BASE, isLocalBase, ...(await start()) };
  const actions = createActions(ctx);
  try {
    await ctx.send("Page.enable");
    await ctx.send("Runtime.enable");
    await ctx.send("Log.enable");

    // ── Main page: grid-tie (the runbook flow, verbatim) ──────────────
    console.log("SMOKE      ── main page: grid-tie ──");
    await actions.navigate(`${BASE}?smoke=${Date.now()}`);
    gate(
      "hero CTA present",
      await ctx.evaluate(
        `document.body.textContent.includes("Start a Free Estimate")`,
      ),
    );
    // Jev is optional and rate-limited by design. The dedicated Jev gates
    // stub its response, so repeated smoke runs test the UI contract rather
    // than consuming the shared provider quota; the real endpoint is checked
    // separately by the staging API probe.

    await runWeatherFlow(ctx, actions);
    await runGridTieFlow(ctx, actions);
    await runLifecycleFlow(ctx, actions);
    await runJevFlow(ctx);
    await runShareFlow(ctx, actions);
    await runResultsFlow(ctx);
    await runClosingFlow(ctx, actions);
  } catch (e) {
    gate(
      "smoke run completed",
      false,
      String((e && e.message) || e).slice(0, 300),
    );
  } finally {
    await ctx.close();
  }
  process.exit(gateSummary());
}

main();
