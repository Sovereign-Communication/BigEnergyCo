// Approved real-browser smoke test for the production runbook.
// Zero dependencies: drives the installed Chrome (or Edge fallback) over CDP
// using only Node built-ins (child_process, fetch, WebSocket, os, fs).
//
// Run: node scripts/browser-smoke.mjs [baseUrl]
//   default base: https://bigenergyco.pages.dev/
//   npm run smoke
//
// Coverage (every gate fails the run):
//   main page: hero CTA, city search + select, tariff, full grid-tie run,
//     result card, savings chart + caption, slider re-slice (the custom-cut
//     path), off-grid mode run, explicit no-CSP-violations gate,
//     external-integration probes (FX, NASA, geocoder, API health),
//     no console/page errors.
//   heatmap page: Leaflet loads (script-src), map initializes, tiles allowed,
//     no console/page errors.
// Exit 0 = pass, 1 = fail (prints every failed gate).
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = (process.argv[2] || "https://bigenergyco.pages.dev/").replace(
  /\/$/,
  "/",
);
const DEBUG_PORT = 19222;
const RUN_TIMEOUT_MS = 180000;

const CHROME_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];
const EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/microsoft-edge",
];

let failures = 0;
const gate = (name, ok, extra = "") => {
  console.log(
    `${ok ? "SMOKE OK    " : "SMOKE FAIL  "}${name}${extra ? " — " + extra : ""}`,
  );
  if (!ok) failures++;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isCsp = (e) =>
  /Content Security Policy|Refused to (connect|load)|violates .* directive/i.test(
    e,
  );

async function main() {
  const exe = [...CHROME_PATHS, ...EDGE_PATHS].find((p) => existsSync(p));
  if (!exe) {
    console.error("SMOKE FAIL  no Chrome/Edge binary found");
    process.exit(1);
  }
  console.log(`SMOKE      browser: ${exe}`);
  console.log(`SMOKE      base: ${BASE}`);
  const profile = mkdtempSync(join(tmpdir(), "beco-smoke-"));
  const browser = spawn(
    exe,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--no-first-run",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  const errors = [];
  let ws = null;
  // Shared CDP helpers (initialized after connect).
  let send, evaluate;
  const poll = async (fn, timeoutMs, stepMs = 2000) => {
    const start = Date.now();
    for (;;) {
      if (await fn()) return true;
      if (Date.now() - start > timeoutMs) return false;
      await sleep(stepMs);
    }
  };
  try {
    let targets = null;
    for (let i = 0; i < 100; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
        if (r.ok) {
          targets = await r.json();
          break;
        }
      } catch {
        /* not up yet */
      }
      await sleep(300);
    }
    if (!targets) throw new Error("DevTools endpoint never came up");
    const page = targets.find((t) => t.type === "page");
    if (!page?.webSocketDebuggerUrl) throw new Error("no page target");

    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });
    let nextId = 1;
    const pending = new Map();
    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error)));
        else res(msg.result);
      } else if (msg.method === "Runtime.exceptionThrown") {
        errors.push(
          `page exception: ${msg.params?.exceptionDetails?.text || JSON.stringify(msg.params).slice(0, 300)}`,
        );
      } else if (
        msg.method === "Runtime.consoleAPICalled" &&
        msg.params?.type === "error"
      ) {
        errors.push(
          `console.error: ${(msg.params.args || [])
            .map((a) => a.value ?? a.description ?? "")
            .join(" ")
            .slice(0, 300)}`,
        );
      } else if (
        msg.method === "Log.entryAdded" &&
        msg.params?.entry?.level === "error"
      ) {
        const url = msg.params.entry.url
          ? ` [${msg.params.entry.url.slice(0, 120)}]`
          : "";
        errors.push(
          `log.error: ${(msg.params.entry.text || "").slice(0, 300)}${url}`,
        );
      }
    };
    send = (method, params = {}) =>
      new Promise((res, rej) => {
        const id = nextId++;
        pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params }));
        setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id);
            rej(new Error(`CDP timeout: ${method}`));
          }
        }, 30000);
      });
    evaluate = async (expression) => {
      const r = await send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (r?.exceptionDetails)
        throw new Error(
          `page eval threw: ${JSON.stringify(r.exceptionDetails).slice(0, 300)}`,
        );
      return r?.result?.value;
    };
    const navigate = async (url) => {
      const loaded = new Promise((res) => {
        const prev = ws.onmessage;
        ws.onmessage = (ev) => {
          prev(ev);
          try {
            if (JSON.parse(ev.data).method === "Page.loadEventFired") {
              ws.onmessage = prev;
              res();
            }
          } catch {
            /* noop */
          }
        };
      });
      await send("Page.navigate", { url });
      await Promise.race([loaded, sleep(60000)]);
      await sleep(4000); // app boot + auto-run
    };
    const chooseHonolulu = async () => {
      await evaluate(
        `(() => { const s = document.getElementById("citySearch"); s.focus(); s.value = "Honolulu"; s.dispatchEvent(new InputEvent("input", { bubbles: true })); return true; })()`,
      );
      const ok = await poll(
        async () =>
          (await evaluate(
            `document.querySelectorAll('#citySuggestions [role="option"]').length`,
          )) > 0,
        15000,
        500,
      );
      gate("city suggestions for Honolulu", ok);
      if (!ok) return false;
      await evaluate(
        `document.querySelector('#citySuggestions [role="option"]').click()`,
      );
      await sleep(3000); // suggestion click triggers a full run
      return true;
    };
    const setInputs = async (mode) =>
      evaluate(`(() => {
      document.getElementById("loadMode").value = "kwh";
      document.getElementById("loadMode").dispatchEvent(new Event("change", { bubbles: true }));
      const k = document.getElementById("dailyKwhInput"); k.value = "10";
      k.dispatchEvent(new Event("input", { bubbles: true })); k.dispatchEvent(new Event("change", { bubbles: true }));
      document.getElementById("systemGoal").value = "${mode}";
      document.getElementById("systemGoal").dispatchEvent(new Event("change", { bubbles: true }));
      const t = document.getElementById("customRateVal");
      if (!(parseFloat(t.value) > 0)) { t.value = "0.42"; t.dispatchEvent(new Event("input", { bubbles: true })); }
      return parseFloat(document.getElementById("customRateVal").value);
    })()`);
    const runAndWaitCard = async () => {
      await evaluate(`document.getElementById("btnRunSizing").click()`);
      return poll(
        async () =>
          evaluate(`document.body.textContent.includes("Total 20-year cost")`),
        RUN_TIMEOUT_MS,
      );
    };

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Log.enable");

    // ── Main page: grid-tie (the runbook flow, verbatim) ──────────────
    console.log("SMOKE      ── main page: grid-tie ──");
    await navigate(`${BASE}?smoke=${Date.now()}`);
    gate(
      "hero CTA present",
      await evaluate(
        `document.body.textContent.includes("Start a Free Estimate")`,
      ),
    );
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
    if (!(await chooseHonolulu()))
      throw new Error("city select failed; aborting run");
    const tariff = await setInputs("gridtie");
    gate(
      "positive grid price",
      Number.isFinite(tariff) && tariff > 0,
      `$${tariff}/kWh`,
    );
    gate("result card has Total 20-year cost", await runAndWaitCard());
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

    // ── Accessibility basics (main page, post-render) ─────────────────
    const a11y = await evaluate(`(() => {
      const imgs = [...document.images].filter((i) => !i.alt && i.getAttribute("aria-hidden") !== "true");
      const btns = [...document.querySelectorAll("button")].filter((b) =>
        !(b.textContent || "").trim() && !b.getAttribute("aria-label") && !(b.value || "").trim());
      // Visible headings only: #printSheet carries its own h1 for the
      // print stylesheet (display:none on screen, and vice versa in print),
      // so exactly one h1 is exposed in each mode by design.
      const visibleH1 = [...document.querySelectorAll("h1")].filter((h) => h.offsetParent !== null).length;
      return { lang: document.documentElement.lang || null, badImgs: imgs.length, badBtns: btns.length,
        h1: visibleH1 };
    })()`);
    gate("html lang set", !!a11y.lang, a11y.lang);
    gate("single visible h1", a11y.h1 === 1, `${a11y.h1} found`);
    gate("images have alt text", a11y.badImgs === 0, `${a11y.badImgs} missing`);
    gate(
      "buttons have accessible names",
      a11y.badBtns === 0,
      `${a11y.badBtns} missing`,
    );

    // ── Service worker (offline story) ────────────────────────────────
    const swReady = await evaluate(`(async () => {
      if (!("serviceWorker" in navigator)) return "unsupported";
      try {
        await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 25000)),
        ]);
        return "ready";
      } catch { return "not-ready"; }
    })()`);
    gate("service worker registered", swReady === "ready", swReady);

    // ── Custom-cut slider re-slice (the incremental engine path) ──────
    console.log("SMOKE      ── bill-cut slider re-slice ──");
    const sliderShown = await evaluate(
      `(() => { const r = document.getElementById("cutSliderRow"); return r && getComputedStyle(r).display !== "none"; })()`,
    );
    if (sliderShown) {
      await evaluate(
        `(() => { const s = document.getElementById("cutSlider"); s.value = "82"; s.dispatchEvent(new Event("input", { bubbles: true })); s.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`,
      );
      const relabeled = await poll(
        async () =>
          (
            await evaluate(
              `document.getElementById("cutSliderVal")?.textContent || ""`,
            )
          ).includes("82"),
        30000,
        1000,
      );
      gate("slider re-labels to 82%", relabeled);
      const stillCard = await poll(
        async () =>
          (await evaluate(`document.body.textContent`)).includes(
            "Total 20-year cost",
          ),
        120000,
      );
      gate("card survives slider re-slice", stillCard);
    } else {
      gate(
        "cut slider visible after run",
        false,
        "row hidden — cannot exercise incremental path",
      );
    }

    // ── Off-grid mode (the other render pipeline) ─────────────────────
    console.log("SMOKE      ── main page: off-grid ──");
    await setInputs("offgrid");
    gate("off-grid result card", await runAndWaitCard());

    // ── External integrations (proves CSP + endpoints, not just silence)
    console.log("SMOKE      ── external integrations ──");
    const probes = await evaluate(`(async () => {
      const out = {};
      const tryFetch = async (key, url, opts) => {
        try { const r = await fetch(url, opts); out[key] = "HTTP " + r.status; }
        catch (e) { out[key] = "THREW: " + String(e && e.message || e).slice(0, 120); }
      };
      await tryFetch("fx", "https://open.er-api.com/v6/latest/USD?smoke=1");
      await tryFetch("geocoder", "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=Honolulu");
      await tryFetch("worker", "https://bigenergyco-api.bigenergyco.workers.dev/api/health");
      return out;
    })()`);
    gate("FX rates reachable", /^HTTP 200/.test(probes.fx || ""), probes.fx);
    gate(
      "geocoder reachable (any HTTP = not blocked)",
      /^HTTP \d+/.test(probes.geocoder || ""),
      probes.geocoder,
    );
    gate(
      "API health reachable",
      /^HTTP 200/.test(probes.worker || ""),
      probes.worker,
    );
    // NASA is proven end-to-end instead of probed: a bare API ping returns
    // 4xx (which Chrome logs as a console error), so assert the run used
    // live point weather rather than the bundled offline fallback.
    gate(
      "live NASA weather used (no offline fallback)",
      !(await evaluate(`document.body.textContent.includes("OFFLINE MODE")`)),
    );

    // ── Heatmap page (Leaflet CDN + tile CSP) ─────────────────────────
    console.log("SMOKE      ── heatmap page ──");
    await navigate(`${BASE}solar-heatmap/?smoke=${Date.now()}`);
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
  } catch (e) {
    gate(
      "smoke run completed",
      false,
      String((e && e.message) || e).slice(0, 300),
    );
  } finally {
    try {
      ws?.close();
    } catch {
      /* noop */
    }
    try {
      browser.kill();
    } catch {
      /* noop */
    }
    await sleep(1000);
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      /* noop */
    }
  }
  console.log(
    failures
      ? `\n${failures} SMOKE GATE(S) FAILED`
      : "\nALL SMOKE GATES PASSED",
  );
  process.exit(failures ? 1 : 0);
}

main();
