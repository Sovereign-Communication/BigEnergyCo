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
//   controls, a11y (keyboard reach + operability, names, AA contrast,
//   reduced motion), service worker, re-slice, Simple mode,
//   off-grid run, external integrations, no console/CSP errors.
//   heatmap page: Leaflet loads, map initializes, no console/page errors.
//   silent sizing worker: deadline surfaces an actionable error and an explicit
//   retry completes on a fresh worker.
// Exit 0 = pass, 1 = fail (prints every failed gate).
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeBase } from "./lib/base-url.mjs";
import { A11Y_FACET_AXES, composeA11yFacetLine } from "./lib/a11y-controls.mjs";
import { start, gate, gateSummary } from "./smoke/runtime.mjs";
import { createActions } from "./smoke/actions.mjs";
import { runLocationFlow } from "./smoke/location.js";
import { runWeatherFlow } from "./smoke/weather.js";
import { runGridTieFlow } from "./smoke/gridtie.js";
import { runLifecycleFlow } from "./smoke/lifecycle.js";
import { runResultsFlow } from "./smoke/results.js";
import { runA11yFlow } from "./smoke/a11y.js";
import { runJevFlow, jevHealthAtDocumentStart } from "./smoke/jev.js";
import { runShareFlow } from "./smoke/share.js";
import { runClosingFlow } from "./smoke/closing.js";
import { runAdvisorFlow } from "./smoke/advisor.js";
import { runDeadlineFlow } from "./smoke/deadline.js";

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

/**
 * Write the `accessibility` facet report from the a11y flow that just ran.
 *
 * The judge's evidence builder DISCOVERS this file — it carries `facet_axes`,
 * so the `accessibility` line on the judge's record is the one composed from
 * this run rather than a sentence typed beside it. That is the whole reason the
 * file exists, and it is written even when the flow did not finish: a run that
 * measured nothing must say that, not leave a stale claim standing.
 *
 * The name and the upload are the wire (see the web-smoke job in
 * .github/workflows/test.yml): the judge downloads `jev-results-*`, so a report
 * under any other name is read by nobody.
 */
function writeA11yControlsReport(a11y, base) {
  const summary = a11y || {
    ran: false,
    error: "the a11y flow did not complete in this run",
  };
  const report = {
    plan_item: "P0.4",
    plan_ref: "docs/plan/MASTER_PLAN.md §3.2, Q-07",
    metric: "a11y_controls",
    base,
    generated_at: new Date().toISOString(),
    facet_axes: A11Y_FACET_AXES,
    facet_line: composeA11yFacetLine(summary),
    measured: summary,
  };
  try {
    writeFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "..",
        "a11y-controls-report.json",
      ),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
  } catch (e) {
    // Loud rather than silent: without the file the judge sees no accessibility
    // measurement at all, which is a real gap and must not look like a green run.
    console.error(
      `SMOKE FAIL  could not write a11y-controls-report.json (${(e && e.message) || e})`,
    );
  }
  return report;
}

async function main() {
  console.log(`SMOKE      base: ${BASE}`);
  const ctx = { base: BASE, isLocalBase, ...(await start()) };
  const actions = createActions(ctx);
  let a11ySummary = null;
  try {
    await ctx.send("Page.enable");
    await ctx.send("Runtime.enable");
    await ctx.send("Log.enable");

    // Registered BEFORE the first navigation, so the harness answers the
    // app's own boot-time /api/health probe. The client gate keeps one answer
    // per page session, so a stub installed later can no longer be consulted —
    // see jevHealthAtDocumentStart for the full reason.
    //
    // LOCAL STAGE ONLY. The local server is a workerless emulator whose
    // /api/health says the Jev route is off and whose /api/jev 503s, so the
    // stub is what makes the Jev gates meaningful there. On a real surface
    // (staging, pages.dev, the brand domain) the probe must reach the real
    // worker and a real /api/jev must answer: faking either would turn
    // "API health reachable" and the server-side activation state into lies.
    if (isLocalBase) {
      await ctx.send("Page.addScriptToEvaluateOnNewDocument", {
        source: jevHealthAtDocumentStart,
      });
    }

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

    await runLocationFlow(ctx, actions);
    await runWeatherFlow(ctx, actions);
    await runGridTieFlow(ctx, actions);
    await runLifecycleFlow(ctx, actions);
    await runJevFlow(ctx);
    await runShareFlow(ctx, actions);
    await runResultsFlow(ctx);
    // A11y needs a completed run (contrast, result-stage keyboard, the two
    // scroll sites) and ends with the card invalidated by its own loadMode
    // change — closing below runs a fresh off-grid run regardless.
    a11ySummary = await runA11yFlow(ctx);
    await runClosingFlow(ctx, actions);
    // The advisor round trip runs last of the product flows (before the
    // deadline suite, which wants a fresh page) because it needs the chat
    // modal's DOM present and leaves a rendered reply behind.
    await runAdvisorFlow(ctx, actions);
    // Last: the silent-worker deadline on a fresh page. Appended after closing
    // so every existing gate keeps its exact order.
    await runDeadlineFlow(ctx, actions);
  } catch (e) {
    gate(
      "smoke run completed",
      false,
      String((e && e.message) || e).slice(0, 300),
    );
  } finally {
    await ctx.close();
    const report = writeA11yControlsReport(a11ySummary, BASE);
    console.log(
      `SMOKE      a11y facet line (${report.facet_line.length} chars):\n` +
        `  ${report.facet_line}`,
    );
  }
  process.exit(gateSummary());
}

main();
