// Closing flow: the off-grid render pipeline, external-integration probes
// (CSP + endpoints), the Leaflet heatmap page, and the final console/page
// error gates (explicit CSP classification).
import { gate, sleep, isCsp } from "./runtime.mjs";
import { RUN_TIMEOUT_MS } from "./actions.mjs";

export async function runClosingFlow(ctx, actions) {
  const { send, evaluate, errors, poll } = ctx;

  // ── Off-grid mode (the other render pipeline) ─────────────────────
  console.log("SMOKE      ── main page: off-grid ──");
  await actions.setInputs("offgrid");
  gate("off-grid result card", await actions.runAndWaitCard());

  // ── External integrations (proves CSP + endpoints, not just silence)
  console.log("SMOKE      ── external integrations ──");
  const workerProbe = ctx.isLocalBase
    ? ""
    : 'await tryFetch("worker", "https://bigenergyco-api.bigenergyco.workers.dev/api/health");';
  const probes = await evaluate(`(async () => {
      const out = {};
      const tryFetch = async (key, url, opts) => {
        try {
          const r = await fetch(url, opts); out[key] = "HTTP " + r.status;
        } catch (e) {
          out[key] = "THREW: " + String((e && e.message) || e).slice(0, 120);
        }
      };
      await tryFetch("fx", "https://open.er-api.com/v6/latest/USD?smoke=1");
      await tryFetch("geocoder", "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=Honolulu");
      ${workerProbe}
      return out;
    })()`);
  gate("FX rates reachable", /^HTTP 200/.test(probes.fx || ""), probes.fx);
  gate(
    "geocoder reachable (any HTTP = not blocked)",
    /^HTTP \d+/.test(probes.geocoder || ""),
    probes.geocoder,
  );
  if (ctx.isLocalBase) {
    // This used to print "SMOKE SKIP" and move on. A skip is a gate that
    // cannot fail, and this one hid the fact that the local server had no
    // /api/chat route at all — which is what kept `web-smoke` permanently
    // red. The local server now mounts the REAL worker on this same origin
    // (scripts/lib/worker-bridge.mjs), so there is nothing left to skip: probe
    // it and let it fail loudly if the worker is not there.
    //
    // Probed from the HARNESS, not the page. The page's /api/health is
    // intercepted by jevHealthAtDocumentStart (browser-smoke.mjs), so an
    // in-page probe would grade the stub and tell us nothing about the
    // worker. Node's fetch is not stubbed, so this is the real endpoint.
    const health = await (async () => {
      try {
        const r = await fetch(new URL("api/health", ctx.base), {
          headers: { "CF-Connecting-IP": "127.0.0.1" },
        });
        const j = await r.json().catch(() => ({}));
        return { status: r.status, service: j.service || "" };
      } catch (e) {
        return {
          status: 0,
          service: String((e && e.message) || e).slice(0, 120),
        };
      }
    })();
    gate(
      "API health reachable (local: real worker, same origin)",
      health.status === 200,
      `status=${health.status} service=${health.service}`,
    );
    // Proves it is the shipped worker and not a hand-written stand-in: the
    // old local mirror answered with service "local static mirror (no API
    // worker here)".
    gate(
      "API health is served by the real worker, not a stub",
      health.service === "BigEnergyCo Cloudflare Worker API",
      `service=${health.service}`,
    );
  } else {
    gate(
      "API health reachable",
      /^HTTP 200/.test(probes.worker || ""),
      probes.worker,
    );
  }
  // NASA is proven end-to-end instead of probed: a bare API ping returns
  // 4xx (which Chrome logs as a console error), so assert the run used
  // live point weather rather than the bundled offline fallback.
  gate(
    "live NASA weather used (no offline fallback)",
    !(await evaluate(`document.body.textContent.includes("OFFLINE MODE")`)),
  );

  // ── Heatmap page (Leaflet CDN + tile CSP) ─────────────────────────
  console.log("SMOKE      ── heatmap page ──");
  await actions.navigate(`${ctx.base}solar-heatmap/?smoke=${Date.now()}`);
  const leaflet = await poll(
    async () => evaluate(`typeof window.L !== "undefined"`),
    30000,
    1000,
  );
  gate("Leaflet loads (script-src)", leaflet);
  const mapInit = await poll(
    async () => evaluate(`!!document.querySelector(".leaflet-container")`),
    30000,
    1000,
  );
  gate("map initializes", mapInit);

  // ── Console/page errors: explicit CSP gate + general gate ─────────
  console.log("SMOKE      ── console / page errors ──");
  const seen = errors.filter((e) => !/favicon\.ico/i.test(e));
  // The local run now GATES the real worker above rather than skipping it, so
  // every remaining browser error is a real finding. Keep this strict: none
  // should be hidden as a harness artifact.
  const csp = seen.filter(isCsp);
  gate("no CSP violations", csp.length === 0, csp.slice(0, 3).join(" | "));
  gate(
    "no other console/page errors",
    seen.length - csp.length === 0,
    seen
      .filter((e) => !isCsp(e))
      .slice(0, 3)
      .join(" | "),
  );
  if (seen.length > 3)
    console.log(
      `SMOKE      ...${seen.length} total error lines (first 3 shown above)`,
    );
}
