// Advisor round trip: the shipped client against the REAL API worker.
//
// Why this suite exists: `web-smoke` was permanently red because the local
// static server had no `/api/chat` route at all. The advisor gate that
// "exercised" the advisor stubbed `window.fetch` and asserted a modal opened,
// so it never proved the endpoint exists or answers — while the console-error
// gate failed forever on the resulting 404. A gate that can never pass trains
// people to ignore it, which is the same defect class as the verifier that
// could be killed instead of returning a verdict.
//
// The local server now mounts the real worker (scripts/lib/worker-bridge.mjs),
// so this suite makes an actual POST and reads an actual answer. Nothing here
// intercepts `fetch`.
//
// What it does NOT prove, stated rather than hidden: the real Groq model. CI
// has no `GROQ_API_KEY` and must not acquire one (see AGENTS.md's zero-
// dependency rule and the D-21 carve-out), so the worker serves its DEGRADED
// reply. That is deliberate — it is the exact payload the contest demo's
// failure surface returns, it exercises the real routing, validation,
// serialization and i18n key set, and it is deterministic. What it cannot
// cover is a live upstream completion; that is the staging verifier's job, and
// this suite says so in its output rather than implying otherwise.
//
// The localized variants of this reply are covered deterministically by
// tests/worker-i18n.test.mjs and scripts/smoke/advisor-i18n.mjs. This suite
// asserts the shipped browser path end to end, not the six translations, so it
// does not re-run that work.
import { gate } from "./runtime.mjs";

// The endpoint is resolved the way `attemptSend` resolves it — from the shipped
// `CF_API_URL` constant on the page — and NOT by assuming a same-origin
// `/api/chat`. That assumption is what this probe originally made, and it holds
// only on the local server, which mounts the worker at `/api/chat`. On any
// static host it is false: GitHub Pages answers a same-origin POST /api/chat
// with 405 and an HTML body, so `r.json()` throws, `ok` stays false, and the
// gate reports the advisor as dead while the real worker was answering 200.
//
// Reading the client's own constant keeps probe and client in lockstep by
// construction: this can no longer pass against a base the client would refuse
// to use, nor fail against one it would use.
const CHAT_PROBE = `(async () => {
  const out = { ok: false, status: 0, keys: 0, degraded: false, chars: 0, base: "" };
  try {
    const host = window.location.hostname;
    const shipped = (typeof CF_API_URL === "string" ? CF_API_URL : "").trim();
    const base = host === "127.0.0.1" || host === "localhost" ? "" : shipped;
    out.base = base || "same-origin";
    const r = await fetch(base + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "How many panels do I need for a 3 kWh/day home?",
        language: "en",
      }),
    });
    out.status = r.status;
    const j = await r.json();
    out.ok = r.ok && typeof j.reply === "string" && j.reply.length > 0;
    out.chars = (j.reply || "").length;
    out.degraded = j.degraded === true;
    out.keys = j.i18n ? Object.keys(j.i18n).length : 0;
  } catch (e) {
    out.error = String((e && e.message) || e).slice(0, 160);
  }
  return out;
})()`;

export async function runAdvisorFlow(ctx, actions) {
  const { evaluate, poll, errors } = ctx;

  // ── The endpoint the shipped client actually posts to answers ──────
  // Asserted in the page so it travels the same CORS path, response headers and
  // failure surface a visitor's request does.
  //
  // Whether the advisor answers LIVE or DEGRADED is a property of the
  // deployment, not of anything observable from the browser: the local/CI worker
  // holds no `GROQ_API_KEY` and MUST serve the degraded reply, while the
  // deployed worker holds one and serves a real completion. Asserting
  // `degraded === true` unconditionally is therefore wrong on every static
  // host — and it was hiding a far worse failure behind it, because a
  // same-origin 405 whose JSON parse throws reports `degraded=false` too.
  //
  // So the strict expectation is applied exactly where it is knowable — the
  // local surface CI controls — and the deployed surface asserts the invariant
  // that holds for both, with the branch taken printed rather than inferred
  // from a silent pass.
  const localSurface = ctx.isLocalBase === true;
  console.log("SMOKE      ── advisor endpoint (client's own base) ──");
  const probe = await evaluate(CHAT_PROBE);
  gate(
    "advisor: /api/chat answers on the endpoint the client uses",
    probe.ok === true,
    `base=${probe.base} status=${probe.status} chars=${probe.chars} error=${probe.error || "none"}`,
  );
  if (localSurface) {
    gate(
      "advisor: the local reply is the labelled degraded one (no key in CI)",
      probe.degraded === true,
      `degraded=${probe.degraded}`,
    );
    gate(
      "advisor: the reply carries i18n keys, not English-only prose",
      probe.keys > 0,
      `i18n keys=${probe.keys}`,
    );
  } else {
    console.log(
      `SMOKE        deployed advisor answered ${
        probe.degraded
          ? "DEGRADED (this deployment holds no key)"
          : "LIVE (this deployment holds a key)"
      } — both are valid answers; see the degraded-label gate below`,
    );
    gate(
      "advisor: a degraded reply carries i18n keys, not English-only prose",
      probe.degraded === false || probe.keys > 0,
      `degraded=${probe.degraded} i18n keys=${probe.keys}`,
    );
  }

  // ── The shipped client, end to end, with nothing stubbed ───────────
  console.log("SMOKE      ── advisor: shipped client round trip ──");
  // Back to the main page first: runClosingFlow leaves the browser on the
  // heatmap, which has no chat DOM, so without this the client round trip
  // graded an empty #chatWindow and reported "no reply" — a failure caused by
  // where the harness was standing, not by the advisor.
  await actions.navigate(`${ctx.base}?smoke=${Date.now()}`);
  await poll(
    async () => await evaluate(`!!document.getElementById("chatInput")`),
    30000,
    500,
  );
  const before = errors.length;

  // Drive the real entry point the buttons call. The modal is already on the
  // page, so this exercises sendChatMsg -> fetch -> renderBotReply without
  // depending on which surface (simple mode, results card) opened it.
  await evaluate(`(() => {
    const input = document.getElementById("chatInput");
    if (!input) return false;
    input.value = "What size battery do I need for a 3 kWh/day home?";
    if (typeof window.sendChatMsg !== "function") return false;
    window.sendChatMsg();
    return true;
  })()`);

  // `poll` resolves to a boolean and discards what the probe returned, so the
  // text and the degraded flag are captured in the closure rather than read off
  // the result.
  //
  // The node is selected GENERICALLY, excluding the loading indicator: the
  // original selector demanded `[data-degraded="true"]`, which only exists when
  // the advisor answered degraded. On a deployment holding a real key the reply
  // is a live completion with no such attribute, the selector matched nothing,
  // and the gate reported `chars=0` — reading as "the client rendered nothing"
  // when in fact it had rendered a correct live answer.
  let rendered = "";
  let renderedDegraded = false;
  const gotReply = await poll(
    async () => {
      const node = await evaluate(
        `(() => {
          const all = document.querySelectorAll('#chatWindow .chat-msg.bot:not(#loadingMsg)');
          const n = all[all.length - 1];
          if (!n) return null;
          return {
            text: (n.textContent || "").trim(),
            degraded: n.getAttribute("data-degraded") === "true",
          };
        })()`,
      );
      rendered = (node && node.text) || "";
      renderedDegraded = !!(node && node.degraded);
      return typeof rendered === "string" && rendered.length > 40;
    },
    30000,
    500,
  );
  gate(
    "advisor: the client renders the advisor's answer as prose",
    gotReply === true,
    `chars=${(rendered || "").length} degraded=${renderedDegraded} text=${(rendered || "").slice(0, 80)}`,
  );
  // The label is the R-CF-10 contract: a visitor must be able to tell an
  // offline advisor from a working one. A DEGRADED reply without it is a
  // failure even though the text arrived. A LIVE reply legitimately carries no
  // such label, so the requirement is keyed to what was actually rendered —
  // which is the node's own attribute, not an assumption about the deployment.
  gate(
    "advisor: a degraded answer carries the offline label",
    gotReply === true &&
      (renderedDegraded === false ||
        /offline|not the live AI|nicht die Live-KI|sin conexi|hors ligne|دون اتصال/i.test(
          rendered || "",
        )),
    `degraded=${renderedDegraded} chars=${(rendered || "").length}`,
  );
  // And it must not be an error string wearing a degraded label. Requires
  // non-empty text: on an empty string this passed vacuously, which is the
  // same "green for the wrong reason" defect this suite exists to remove.
  gate(
    "advisor: the answer is prose, not an API error",
    gotReply === true &&
      !/Chat API error|\bundefined\b|\bnull\b/i.test(rendered || ""),
    `text=${(rendered || "").slice(0, 80)}`,
  );
  // On the local surface the CI worker has no key, so the rendered answer MUST
  // be the degraded one. Keeping this assertion means the surface-aware branch
  // above cannot quietly stop proving the degraded path in CI.
  if (localSurface) {
    gate(
      "advisor: the local client renders the degraded answer, labelled",
      gotReply === true && renderedDegraded === true,
      `degraded=${renderedDegraded} chars=${(rendered || "").length}`,
    );
  }

  const added = errors.slice(before);
  gate(
    "advisor: the round trip added no console/page errors",
    added.length === 0,
    added.slice(0, 2).join(" | "),
  );
}
