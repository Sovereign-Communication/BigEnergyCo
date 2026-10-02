// The advisor round trip in `scripts/smoke/advisor.js`.
//
// Why this needs pinning: the flow asserted two things that are true ONLY on the
// local surface, and `verify-staging` runs this same suite against the deployed
// GitHub Pages URL. Both assumptions broke there at once, and the way they broke
// is the interesting part — the flow reported a dead advisor while the real
// worker was answering HTTP 200 with a correct reply:
//
//   1. The probe fetched the RELATIVE path `/api/chat`. That is true only on the
//      local server, which mounts the worker there. On a static host GitHub
//      Pages answers a same-origin POST /api/chat with 405 and an HTML body, so
//      `r.json()` threw and the gate read `ok=false`.
//   2. The gate then required `degraded === true`, because the CI worker holds
//      no `GROQ_API_KEY`. The deployed worker holds one and returns a live
//      completion with no `degraded` field at all.
//   3. The rendered-node selector demanded `[data-degraded="true"]`, which
//      `renderBotReply` only sets for a degraded reply. A live reply matched
//      nothing, so the gate reported `chars=0` — "the client rendered nothing"
//      when it had in fact rendered a correct answer.
//
// So the fix is not "relax the gate". It is to resolve the endpoint the way the
// shipped client resolves it, and to key the degraded-specific expectations to
// the surface (`ctx.isLocalBase`) and to what was actually rendered — while
// keeping the degraded path strictly proven on the local surface, where CI can
// know there is no key. The negative cases below exist so the relaxed branches
// cannot quietly become vacuous.
import { test } from "node:test";
import assert from "node:assert/strict";

import { runAdvisorFlow } from "../scripts/smoke/advisor.js";

// Drives the real flow with a stubbed browser context and returns the gate lines
// it printed. `gate()` keeps a module-level failure counter, so the assertions
// read the emitted lines rather than any return value.
async function runFlow({ probe, node, isLocalBase }) {
  const lines = [];
  const originalLog = console.log;
  console.log = (...a) => lines.push(a.join(" "));
  try {
    await runAdvisorFlow(
      {
        base: isLocalBase
          ? "http://127.0.0.1:7510"
          : "https://example.pages.dev",
        isLocalBase,
        errors: [],
        // The flow's first evaluate is the endpoint probe; the ones inside
        // `poll` ask for the rendered node. Distinguishing them by content
        // keeps the stub honest about what the real page is being asked.
        evaluate: async (expr) => {
          if (typeof expr === "string" && expr.includes("/api/chat"))
            return probe;
          if (
            typeof expr === "string" &&
            expr.includes("chatWindow .chat-msg.bot")
          ) {
            return node;
          }
          return true;
        },
        poll: async (fn) => !!(await fn()),
      },
      { navigate: async () => {} },
    );
  } finally {
    console.log = originalLog;
  }
  return lines;
}

const failed = (lines) =>
  lines.filter((l) => l.startsWith("SMOKE FAIL")).map((l) => l.trim());
const gateNames = (lines) =>
  lines
    .filter((l) => l.startsWith("SMOKE OK") || l.startsWith("SMOKE FAIL"))
    .map((l) =>
      l
        .replace(/^SMOKE (OK|FAIL)\s*/, "")
        .split(" — ")[0]
        .trim(),
    );

test("the deployed surface passes when the advisor answers LIVE", async () => {
  // The exact shape production returns: a real completion, no `degraded`, no
  // `i18n` object, and therefore no `data-degraded` attribute on the node.
  const lines = await runFlow({
    isLocalBase: false,
    probe: {
      ok: true,
      status: 200,
      chars: 395,
      base: "https://bigenergyco-api.bigenergyco.workers.dev",
      degraded: false,
      keys: 0,
    },
    node: {
      text: "A typical 300 W panel produces about 1.2-1.5 kWh per day, so a 3 kWh/day home usually needs roughly 2-3 such panels.",
      degraded: false,
    },
  });
  assert.deepEqual(
    failed(lines),
    [],
    `unexpected gate failures:\n${lines.join("\n")}`,
  );
});

test("the deployed surface still fails when the endpoint is genuinely dead", async () => {
  // A 405 whose body is HTML is what the relative probe actually saw on Pages.
  const lines = await runFlow({
    isLocalBase: false,
    probe: {
      ok: false,
      status: 405,
      chars: 0,
      base: "same-origin",
      error: "Unexpected token '<', \"<html>\"",
      degraded: false,
      keys: 0,
    },
    node: null,
  });
  const names = failed(lines).join(" | ");
  assert.match(names, /answers on the endpoint the client uses/);
});

test("the local surface still proves the degraded path", async () => {
  const lines = await runFlow({
    isLocalBase: true,
    probe: {
      ok: true,
      status: 200,
      chars: 320,
      base: "same-origin",
      degraded: true,
      keys: 6,
    },
    node: {
      text: "You are offline - this is not the live AI advisor. Here is what the physics says about your system instead.",
      degraded: true,
    },
  });
  assert.deepEqual(
    failed(lines),
    [],
    `unexpected gate failures:\n${lines.join("\n")}`,
  );
  const names = gateNames(lines).join(" | ");
  assert.match(names, /local reply is the labelled degraded one/);
  assert.match(names, /local client renders the degraded answer, labelled/);
});

test("a degraded answer with no offline label still fails (R-CF-10 is not weakened)", async () => {
  const lines = await runFlow({
    isLocalBase: true,
    probe: {
      ok: true,
      status: 200,
      chars: 320,
      base: "same-origin",
      degraded: true,
      keys: 6,
    },
    // Rendered, but unlabelled — the exact failure the label exists to catch.
    // The text deliberately avoids every keyword the label gate looks for
    // (offline / not the live AI / nicht die Live-KI / sin conexi / hors ligne),
    // because text containing "offline" would satisfy the gate by accident.
    node: {
      text: "The advisor engine is temporarily unavailable. Here is a deterministic answer about panels.",
      degraded: true,
    },
  });
  const names = failed(lines).join(" | ");
  assert.match(names, /degraded answer carries the offline label/);
});

test("a live reply carrying no label is NOT failed for lacking one", async () => {
  const lines = await runFlow({
    isLocalBase: false,
    probe: {
      ok: true,
      status: 200,
      chars: 395,
      base: "https://api.example.dev",
      degraded: false,
      keys: 0,
    },
    node: {
      text: "A live completion from the upstream model with no offline label.",
      degraded: false,
    },
  });
  assert.deepEqual(failed(lines), []);
});

test("an API error string is still failed on the deployed surface", async () => {
  const lines = await runFlow({
    isLocalBase: false,
    probe: {
      ok: true,
      status: 200,
      chars: 20,
      base: "https://api.example.dev",
      degraded: false,
      keys: 0,
    },
    node: { text: "Chat API error: undefined", degraded: false },
  });
  const names = failed(lines).join(" | ");
  assert.match(names, /renders the advisor's answer as prose/);
});
