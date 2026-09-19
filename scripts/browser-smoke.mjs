// Approved real-browser smoke test for the production runbook.
// Zero dependencies: drives the installed Chrome (or Edge fallback) over CDP
// using only Node built-ins (child_process, fetch, WebSocket, os, fs).
//
// Run: node scripts/browser-smoke.mjs [baseUrl]
//   default base: https://freeoffgridcalculator.com/
//   npm run smoke
//
// Coverage (every gate fails the run):
//   main page: hero CTA, auto-location (emulated position), city search +
//   select, tariff, full grid-tie run,
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

import { normalizeBase } from "./lib/base-url.mjs";

// BASE must always end in "/": sub-pages are built as `${BASE}solar-heatmap/`,
// so a slash-less argument like `https://example.com` would otherwise produce
// the invalid host `example.comsolar-heatmap` (Chrome error page → false
// heatmap gate failures). normalizeBase (scripts/lib/base-url.mjs, unit-tested)
// canonicalizes any argv form to a trailing slash.
const BASE = normalizeBase(
  process.argv[2] || "https://freeoffgridcalculator.com/",
);
const DEBUG_PORT = 19222;
const RUN_TIMEOUT_MS = 180000;
// Localhost/base-URL runs are harness-only: a few gates are origin-bound
// (the API worker's CORS allowlist covers production origins), so they are
// classified as warnings instead of failures there. Production runs keep
// full strictness.
const isLocalBase = /^https?:\/\/localhost|^http:\/\/127\.0\.0\.1/.test(BASE);

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
      const nav = await send("Page.navigate", { url });
      // A navigation that never loaded — refused, DNS failure, reset, a
      // transport abort — is reported ONLY here: Chrome logs nothing for it, so
      // without this the gates fail with no transport evidence at all and a
      // retry cannot tell a flake from a regression. Recorded as an error line,
      // so it fails the same gate it always did, with a reason.
      if (nav?.errorText)
        errors.push(`navigation: ${nav.errorText} [${url.slice(0, 120)}]`);
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

    // ── Auto-location (regression gate: Permissions-Policy must allow it;
    // geolocation=() silently disables navigator.geolocation while the
    // type-in autocomplete keeps working as backup) ────────────────────
    console.log("SMOKE      ── auto-location ──");
    let geoGranted = true;
    try {
      await send("Browser.grantPermissions", {
        origin: new URL(BASE).origin,
        permissions: ["geolocation"],
      });
      await send("Emulation.setGeolocationOverride", {
        latitude: 21.31,
        longitude: -157.86,
        accuracy: 100,
      });
    } catch (e) {
      geoGranted = false;
      gate(
        "geolocation emulation granted",
        false,
        String((e && e.message) || e).slice(0, 150),
      );
    }
    if (geoGranted) {
      await evaluate(`document.getElementById("btnGeoLocate").click()`);
      const geoOk = await poll(
        async () => {
          const lat = await evaluate(
            `document.getElementById("latInput")?.value`,
          );
          const note = await evaluate(
            `document.getElementById("locNote")?.textContent || ""`,
          );
          return lat === "21.31" && /precise location/i.test(note);
        },
        60000,
        1000,
      );
      gate("auto-location resolves emulated position", geoOk);
    }

    // ── Structural infeasibility (off-grid + solar-only) ───────────────
    // Reports a reason up top and hides the broken savings-unavailable box.
    console.log("SMOKE      ── infeasible off-grid + solar-only ──");
    // Settle first: a click landing on a disabled Run button (previous run
    // still in flight, e.g. from auto-location) is silently swallowed, and
    // input changes made before the first payload never trigger their quiet
    // run — either way no new run starts and the banner can never appear.
    await poll(
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

    // ── Share link round trip ("send this to someone") ────────────────
    // The serialized state must survive: a fresh page opened at the shared
    // URL restores the inputs and re-runs to visible results.
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
      await navigate(`${BASE}${shareHash}`);
      const restored = await poll(
        async () =>
          evaluate(
            `!document.getElementById("resultsRegion")?.hidden && !!document.getElementById("dailyKwhInput")?.value`,
          ),
        RUN_TIMEOUT_MS,
      );
      const restoredState = await evaluate(
        `(() => ({ kwh: document.getElementById("dailyKwhInput")?.value, results: !document.getElementById("resultsRegion")?.hidden }))()`,
      );
      gate(
        "share link restores inputs + results in a fresh page",
        !!restored,
        JSON.stringify(restoredState),
      );
    }

    // ── Responsiveness gates (performance plan Phase 0) ───────────────
    // The warm-path behaviors that make the tool feel instant must hold on
    // every future change. Timing budgets are generous (CI/staging variance)
    // but strict enough to catch a lost cache fast path.
    console.log("SMOKE      ── responsiveness ──");
    const rerunMs = await evaluate(
      `(async () => {
        const t0 = performance.now();
        document.getElementById("btnRunSizing").click();
        // Resolve when the speed badge is set or the button re-enables.
        await new Promise((resolve) => {
          const t0b = Date.now();
          const tick = () => {
            const note = document.getElementById("speedNote");
            if ((note && note.style.display === "block") ||
                !document.getElementById("btnRunSizing")?.disabled) return resolve();
            if (Date.now() - t0b > 60000) return resolve();
            setTimeout(tick, 50);
          };
          tick();
        });
        return Math.round(performance.now() - t0);
      })()`,
    );
    gate(
      "warm re-run under 2s",
      Number.isFinite(rerunMs) && rerunMs < 2000,
      `${rerunMs} ms (payload-cache fast path)`,
    );
    gate(
      "instant-run badge shown on repeat",
      await evaluate(
        `(() => { const n = document.getElementById("speedNote"); return !!n && n.style.display === "block" && /Instant/i.test(n.textContent); })()`,
      ),
    );
    const preconnects = await evaluate(
      `[...document.querySelectorAll('link[rel="preconnect"]')].map(l => l.href).filter(h => /power\.larc\.nasa\.gov|open\.er-api\.com|nominatim\.openstreetmap\.org/.test(h)).length`,
    );
    gate("preconnect hints present", preconnects >= 3, `${preconnects} hints`);

    // Re-run choreography: loading pipeline appears and completes.
    const pipelineWorks = await evaluate(
      `(async () => {
        const pipe = document.getElementById("loadingPipeline");
        document.getElementById("btnRunSizing").click();
        // On a warm repeat the whole run finishes before we can observe the
        // pipeline; that is fine — instant beats visible.
        for (let i = 0; i < 40; i++) {
          if (pipe && pipe.style.display === "block") return "visible";
          await new Promise(r => setTimeout(r, 50));
        }
        const note = document.getElementById("speedNote");
        return note && note.style.display === "block" ? "instant" : "missing";
      })()`,
    );
    gate(
      "loading pipeline or instant path observed",
      pipelineWorks === "visible" || pipelineWorks === "instant",
      String(pipelineWorks),
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

    // ── Slider cooperation (bill-cut target ⇄ up-front budget) ────────
    // Two controls, one choice. A live report described them overwriting
    // each other, so each direction is asserted here: picking a budget point
    // must move the cut target, and moving the cut target must move the budget
    // thumb onto the resulting recommendation without discarding a budget the
    // visitor pinned themselves.
    console.log("SMOKE      ── slider cooperation ──");
    const cooperation = await evaluate(`(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const budget = document.getElementById("budgetSlider");
      const cut = document.getElementById("cutSlider");
      const budgetRow = document.getElementById("budgetSliderRow");
      const out = {};
      if (!budget || !cut || !budgetRow || budgetRow.style.display === "none")
        return { skip: "no budget slider in this mode" };
      out.range = { min: +budget.min, max: +budget.max };

      // Budget → cut: pick a point a step above the current thumb.
      const startCut = +cut.value;
      const lo = +budget.min;
      const hi = +budget.max;
      const step = Math.max(1, Math.round((hi - lo) / 200));
      const target = Math.min(hi, Math.max(lo, +budget.value + step * 12));
      budget.value = String(target);
      budget.dispatchEvent(new Event("input", { bubbles: true }));
      budget.dispatchEvent(new Event("change", { bubbles: true }));
      await wait(400);
      out.budgetPicked = +budget.value;
      out.cutAfterPick = +cut.value;
      out.cutMovedFromStart = +cut.value !== startCut;
      // The form select must agree with the slider, or the next run disagrees.
      const sel = document.getElementById("autoTarget");
      out.selectMatches =
        !sel || ![100, 80, 60, 40].includes(+cut.value) || sel.value === "cut" + cut.value;

      // Cut → budget: move the cut target and the budget thumb should land on
      // the new recommendation instead of staying on the old system. The
      // recommendation arrives from a background re-slice, so poll for it.
      const beforeCutMove = +budget.value;
      cut.value = String(Math.max(1, Math.min(150, +cut.value + 7)));
      cut.dispatchEvent(new Event("input", { bubbles: true }));
      cut.dispatchEvent(new Event("change", { bubbles: true }));
      for (let i = 0; i < 60; i++) {
        if (+budget.value !== beforeCutMove) break;
        await wait(500);
      }
      out.budgetFollowedCut = +budget.value !== beforeCutMove;
      out.budgetBeforeCutMove = beforeCutMove;
      out.budgetWithinRange = +budget.value >= +budget.min && +budget.value <= +budget.max;
      return out;
    })()`);
    if (cooperation && cooperation.skip) {
      console.log(`SMOKE       ${cooperation.skip}`);
    } else {
      gate(
        "budget pick moves the bill-cut target",
        cooperation.cutMovedFromStart === true,
        JSON.stringify(cooperation),
      );
      gate(
        "bill-cut target and the form select agree",
        cooperation.selectMatches === true,
      );
      gate(
        "bill-cut move carries the budget thumb to the new system",
        cooperation.budgetFollowedCut === true,
      );
      gate(
        "budget thumb stays inside the curve's span",
        cooperation.budgetWithinRange === true,
      );
    }

    // ── Controls that CSP no longer lets the markup wire ──────────────
    // script-src dropped 'unsafe-inline', so every control that used to
    // carry an on* attribute must now be bound from an external module. Two
    // gates: the debugger confirms a real click listener is attached, and the
    // click has the user-visible effect the removed attribute used to cause.
    console.log("SMOKE      ── controls without inline handlers ──");
    const DELEGATED_IDS = [
      "btnNavToggle",
      "btnLegalTerms1",
      "btnLegalTerms2",
      "btnLegalTerms3",
      "btnCloseSizing",
      "btnSendChat",
      "btnCloseLegal",
      "btnCloseSystemSheet",
    ];
    const unbound = [];
    for (const id of DELEGATED_IDS) {
      const ref = await send("Runtime.evaluate", {
        expression: `document.getElementById(${JSON.stringify(id)})`,
        returnByValue: false,
      });
      const objectId = ref?.result?.objectId;
      if (!objectId) {
        unbound.push(`${id} (not in the DOM)`);
        continue;
      }
      const found = await send("DOMDebugger.getEventListeners", {
        objectId,
        depth: 1,
      });
      if (!(found?.listeners || []).some((l) => l.type === "click"))
        unbound.push(id);
      await send("Runtime.releaseObject", { objectId });
    }
    gate(
      "every control has a real click listener",
      unbound.length === 0,
      unbound.join(", "),
    );

    const navToggle = await evaluate(`(() => {
      const btn = document.getElementById("btnNavToggle");
      const drawer = document.getElementById("mobileNavDrawer");
      btn.click();
      const opened = drawer.classList.contains("open") && btn.getAttribute("aria-expanded") === "true";
      btn.click();
      const closed = !drawer.classList.contains("open") && btn.getAttribute("aria-expanded") === "false";
      return opened && closed ? "ok" : "opened=" + opened + " closed=" + closed;
    })()`);
    gate(
      "nav toggle opens and closes the drawer",
      navToggle === "ok",
      navToggle,
    );

    const modals = await evaluate(`(() => {
      const visible = (id) => document.getElementById(id).style.display === "flex";
      const links = ["btnLegalTerms1", "btnLegalTerms2", "btnLegalTerms3"];
      const opens = links.filter((id) => {
        document.getElementById("btnCloseLegal").click();
        document.getElementById(id).click();
        return visible("legalModal");
      });
      document.getElementById("btnCloseLegal").click();
      const legalClosed = !visible("legalModal");
      document.getElementById("sizingModal").style.display = "flex";
      document.getElementById("btnCloseSizing").click();
      const sizingClosed = !visible("sizingModal");
      document.getElementById("systemModal").style.display = "flex";
      document.getElementById("btnCloseSystemSheet").click();
      const systemClosed = !visible("systemModal");
      return { opens: opens.length, legalClosed, sizingClosed, systemClosed };
    })()`);
    gate(
      "all three terms links open the legal modal",
      modals.opens === 3,
      `${modals.opens}/3`,
    );
    gate(
      "close controls hide every modal",
      modals.legalClosed && modals.sizingClosed && modals.systemClosed,
      JSON.stringify(modals),
    );
    gate(
      "chat send stays bound after its on* attribute was removed",
      await evaluate(
        `!document.getElementById("btnSendChat").hasAttribute("onclick") && typeof window.sendChatMsg === "function"`,
      ),
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

    // ── Simple mode: hide-and-card contract on the real surface ─────
    console.log("SMOKE      ── main page: simple mode ──");
    await evaluate(
      `(() => { const t = document.getElementById("simpleModeToggle");
        t.checked = true; t.dispatchEvent(new Event("change", { bubbles: true }));
        return document.documentElement.dataset.displayMode; })()`,
    );
    gate(
      "simple mode: root attribute set",
      (await evaluate(`document.documentElement.dataset.displayMode`)) ===
        "simple",
    );
    gate(
      "simple mode: plain-language card renders",
      await evaluate(
        `!!document.querySelector("#simpleResultsWrap .simple-results-card")`,
      ),
    );
    // Behavioral, not existential: the click must open the chat modal AND
    // compose the advisor POST. fetch is intercepted so no network call ever
    // leaves the page (a real request would 404 on bare static servers and
    // hit the production advisor endpoint on deployed surfaces). An earlier
    // version asserted `typeof b.onclick === "function"` — always false for
    // addEventListener wiring, and shadowed by a trailing `|| !!b` anyway —
    // so the gate passed on mere existence. See the #82 precedent.
    gate(
      "simple mode: AI advisor button opens the chat modal and sends the brief",
      await evaluate(
        `(() => {
          const b = document.getElementById("btnSimpleAdvisor");
          const m = document.getElementById("sizingModal");
          if (!b || b.textContent.length === 0 || !m) return false;
          const of = window.fetch;
          let sent = false;
          window.fetch = function (u, o) {
            if (String(u).indexOf("/api/chat") !== -1) {
              sent = true;
              return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ reply: "smoke-stub" }); } });
            }
            return of.apply(this, arguments);
          };
          let opened = false;
          try {
            b.click();
            opened = m.style.display === "flex";
          } finally {
            window.fetch = of;
            m.style.display = "none";
          }
          return opened && sent;
        })()`,
      ),
    );
    gate(
      "simple mode: dense panels hidden (computed)",
      await evaluate(
        `["resultLadder","moneyBar","bomPanel"]
          .every((id) => getComputedStyle(document.getElementById(id)).display === "none")`,
      ),
    );
    gate(
      "simple mode: charts + matrix stay visible (full functionality)",
      await evaluate(
        `["frontierWrap","cumCostChartWrap","tierResults"]
          .every((id) => getComputedStyle(document.getElementById(id)).display !== "none")`,
      ),
    );
    gate(
      "simple mode: card has no NaN/undefined figures",
      await evaluate(
        `!/[Nn]aNa|undefined/.test(document.getElementById("simpleResultsWrap").textContent)`,
      ),
    );
    await evaluate(
      `(() => { const t = document.getElementById("simpleModeToggle");
        t.checked = false; t.dispatchEvent(new Event("change", { bubbles: true }));
        return true; })()`,
    );
    gate(
      "simple mode: toggle off restores regular view",
      (await evaluate(`document.documentElement.dataset.displayMode`)) ===
        "technical" &&
        (await evaluate(
          `getComputedStyle(document.getElementById("resultLadder")).display !== "none"`,
        )),
    );
    // Re-run while simple mode is ON: the fresh payload must flow into the
    // simple card too (renderResults -> renderSimpleResults), not just the
    // stale card from the earlier toggle.
    await evaluate(
      `(() => { const t = document.getElementById("simpleModeToggle");
        t.checked = true; t.dispatchEvent(new Event("change", { bubbles: true }));
        return true; })()`,
    );
    const simpleRerun = await evaluate(
      `(async () => {
        document.getElementById("btnRunSizing").click();
        await new Promise((resolve) => {
          const t0 = Date.now();
          const tick = () => {
            const note = document.getElementById("speedNote");
            if ((note && note.style.display === "block") ||
                !document.getElementById("btnRunSizing")?.disabled) return resolve();
            if (Date.now() - t0 > 60000) return resolve();
            setTimeout(tick, 50);
          };
          tick();
        });
        const card = document.querySelector("#simpleResultsWrap .simple-results-card");
        return { visible: !!card, heroes: card ? card.querySelectorAll("dl > div").length : 0 };
      })()`,
    );
    gate(
      "simple mode: fresh run refreshes the card",
      simpleRerun.visible && simpleRerun.heroes > 0,
      JSON.stringify(simpleRerun),
    );
    await evaluate(
      `(() => { const t = document.getElementById("simpleModeToggle");
        t.checked = false; t.dispatchEvent(new Event("change", { bubbles: true }));
        return true; })()`,
    );

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
      /^HTTP 200/.test(probes.worker || "") || isLocalBase,
      probes.worker ||
        (isLocalBase
          ? "skipped: API worker CORS allowlist excludes localhost (production-only check)"
          : ""),
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
    // The API worker's CORS allowlist covers the production origins only, so
    // on a localhost run the health probe throws a CORS console error that is
    // an artifact of the harness origin, not the page. Production runs keep
    // the full strictness.
    const localArtifacts = isLocalBase
      ? (e) =>
          /bigenergyco-api\.bigenergyco\.workers\.dev/.test(e) &&
          (/CORS policy/i.test(e) || /net::ERR_FAILED/i.test(e))
      : () => false;
    const relevant = seen.filter((e) => !localArtifacts(e));
    const csp = relevant.filter(isCsp);
    gate("no CSP violations", csp.length === 0, csp.slice(0, 3).join(" | "));
    gate(
      "no other console/page errors",
      relevant.length - csp.length === 0,
      relevant
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
