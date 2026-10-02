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

const CHAT_PROBE = `(async () => {
  const out = { ok: false, status: 0, keys: [], degraded: false, chars: 0 };
  try {
    const r = await fetch("/api/chat", {
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

  // ── The endpoint exists and is the real worker ─────────────────────
  // Asserted in the page so it travels the same origin, CORS path and
  // response headers a visitor's request does.
  console.log("SMOKE      ── advisor endpoint (real worker) ──");
  const probe = await evaluate(CHAT_PROBE);
  gate(
    "advisor: /api/chat answers on this origin",
    probe.ok === true,
    `status=${probe.status} chars=${probe.chars} error=${probe.error || "none"}`,
  );
  gate(
    "advisor: the reply is the labelled degraded one (no key in CI)",
    probe.degraded === true,
    `degraded=${probe.degraded}`,
  );
  gate(
    "advisor: the reply carries i18n keys, not English-only prose",
    probe.keys > 0,
    `i18n keys=${probe.keys}`,
  );

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
  // text is captured in the closure rather than read off the result.
  let rendered = "";
  const gotReply = await poll(
    async () => {
      rendered = await evaluate(
        `(() => {
          const n = document.querySelector('#chatWindow .chat-msg.bot[data-degraded="true"]');
          return n ? (n.textContent || "").trim() : "";
        })()`,
      );
      return typeof rendered === "string" && rendered.length > 40;
    },
    30000,
    500,
  );
  gate(
    "advisor: the client renders a labelled degraded answer",
    gotReply === true,
    `chars=${(rendered || "").length} text=${(rendered || "").slice(0, 80)}`,
  );
  // The label is the R-CF-10 contract: a visitor must be able to tell an
  // offline advisor from a working one. A reply without it is a failure even
  // though the text arrived.
  gate(
    "advisor: the rendered answer carries the offline label",
    await evaluate(
      `(() => {
        const n = document.querySelector('#chatWindow .chat-msg.bot[data-degraded="true"]');
        if (!n) return false;
        const t = (n.textContent || "") + " " + (n.innerHTML || "");
        return /offline|not the live AI|nicht die Live-KI|sin conexi|hors ligne|دون اتصال/i.test(t);
      })()`,
    ),
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

  const added = errors.slice(before);
  gate(
    "advisor: the round trip added no console/page errors",
    added.length === 0,
    added.slice(0, 2).join(" | "),
  );
}
