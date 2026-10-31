// Shared in-page interactions the behavior flows are built from: navigation
// with error capture, the deterministic Jev stub, form input, and the
// explicit-run wait. Every function takes the runtime object it needs —
// no module-level state, so flows stay independently readable.
import { gate, sleep } from "./runtime.mjs";

export const RUN_TIMEOUT_MS = 180000;

const JEV_PASS_BODY = `{
              available: true,
              model: "jev-smoke",
              plausible: 0.9,
              verdict: "reasonable",
              verdictConfidence: 0.9,
              redFlag: 0.2,
              redFlagConfidence: 0.8,
            }`;

export const jevFetchStubSource = (jevBody = JEV_PASS_BODY) => `(() => {
        const original = window.fetch;
        window.fetch = function (url, options) {
          if (String(url).includes("/api/jev")) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(${jevBody}),
            });
          }
          return original.apply(this, arguments);
        };
      })()`;

export function createActions(ctx) {
  const { send, evaluate, errors, ws } = ctx;

  // Navigate with load-event capture. A navigation that never loaded —
  // refused, DNS failure, reset, a transport abort — is reported ONLY here:
  // Chrome logs nothing for it, so without this the gates fail with no
  // transport evidence at all and a retry cannot tell a flake from a
  // regression. Recorded as an error line, so it fails the same gate it
  // always did, with a reason.
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
    if (nav?.errorText)
      errors.push(`navigation: ${nav.errorText} [${url.slice(0, 120)}]`);
    await Promise.race([loaded, sleep(60000)]);
    await sleep(4000); // app boot + explicit sizing run
    await evaluate(jevFetchStubSource()).catch(() => {});
  };

  const chooseHonolulu = async () => {
    await evaluate(
      `(() => { const s = document.getElementById("citySearch"); s.focus(); s.value = "Honolulu"; s.dispatchEvent(new InputEvent("input", { bubbles: true })); return true; })()`,
    );
    const ok = await ctx.poll(
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
    return true;
  };

  const setInputs = (mode) =>
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

  // Click Size My System and resolve once the result card renders.
  const runAndWaitCard = async () => {
    await evaluate(`document.getElementById("btnRunSizing").click()`);
    return ctx.poll(
      async () =>
        evaluate(`document.body.textContent.includes("Total 20-year cost")`),
      RUN_TIMEOUT_MS,
    );
  };

  // Restored inputs never run automatically; click Run explicitly after
  // each reload because sizing consent is per page session.
  // cardUp swallows "Execution context was destroyed": reloading tears down
  // the JS context the evaluate was aimed at — expected here.
  const runAfterReload = async () => {
    const cardUp = async () => {
      try {
        return await evaluate(
          `document.body.textContent.includes("Total 20-year cost")`,
        );
      } catch {
        return false;
      }
    };
    if (!(await ctx.poll(async () => cardUp(), 15000, 500))) {
      try {
        await evaluate(jevFetchStubSource());
        await evaluate(`document.getElementById("btnRunSizing")?.click()`);
      } catch {
        /* context not live yet — the poll below will still see the card */
      }
    }
    return ctx.poll(async () => cardUp(), RUN_TIMEOUT_MS);
  };

  return {
    navigate,
    chooseHonolulu,
    setInputs,
    runAndWaitCard,
    runAfterReload,
  };
}
