// Result-surface flow: slider cooperation, the CSP-wiring contract for
// controls that lost their inline handlers, service-worker registration, the
// incremental re-slice path, accessibility basics, and the Simple-mode
// hide-and-card contract.
import { gate, sleep } from "./runtime.mjs";
import { RUN_TIMEOUT_MS } from "./actions.mjs";

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

const flipSimpleMode = (evaluate, on) =>
  evaluate(`(() => { const t = document.getElementById("simpleModeToggle");
        t.checked = ${on ? "true" : "false"}; t.dispatchEvent(new Event("change", { bubbles: true }));
        return document.documentElement.dataset.displayMode; })()`);

export async function runResultsFlow(ctx) {
  const { send, evaluate, poll } = ctx;

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

      // Establish a non-edge result-stage target so the directionality test
      // cannot accidentally choose the already-selected recommendation.
      cut.value = "60";
      cut.dispatchEvent(new Event("input", { bubbles: true }));
      cut.dispatchEvent(new Event("change", { bubbles: true }));
      await wait(800);

      // Budget → cut: pick a point a step above the current thumb.
      const startCut = +cut.value;
      const hi = +budget.max;
      const target = hi;
      budget.value = String(target);
      budget.dispatchEvent(new Event("input", { bubbles: true }));
      budget.dispatchEvent(new Event("change", { bubbles: true }));
      await wait(400);
      out.budgetPicked = +budget.value;
      out.cutAfterPick = +cut.value;
      out.cutMovedFromStart = +cut.value !== startCut;
      // The form select must agree with the slider, or the next run disagrees.
      const sel = document.getElementById("autoTarget");
      const cutValue = +cut.value;
      out.selectMatches =
        !sel ||
        (sel.value === "cut" + cutValue && [95, 80, 60].includes(cutValue)) ||
        (![95, 80, 60].includes(cutValue) && sel.value === "custom");

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
  gate("nav toggle opens and closes the drawer", navToggle === "ok", navToggle);

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
      } catch {
        return "not-ready";
      }
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
  await flipSimpleMode(evaluate, true);
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
  await flipSimpleMode(evaluate, false);
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
  await flipSimpleMode(evaluate, true);
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
  await flipSimpleMode(evaluate, false);
}
