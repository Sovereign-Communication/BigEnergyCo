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
async function runFlow({
  probe,
  node,
  isLocalBase,
  baseline = 0,
  nodeIndex = null,
}) {
  const lines = [];
  const calls = [];
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
        // The flow's evaluates are, in order: the endpoint probe, a baseline
        // count of existing bot nodes, then the poll asking for a node beyond
        // that baseline. Distinguishing them by content keeps the stub honest
        // about what the real page is being asked, and `baseline` lets a case
        // model the modal's pre-existing intro node.
        evaluate: async (expr) => {
          const e = String(expr);
          if (e.includes("/api/chat")) {
            calls.push("probe");
            return probe;
          }
          if (!e.includes("chatWindow .chat-msg.bot")) return true;
          // The baseline count is a bare `.length` expression; the poll wraps
          // its lookup in an IIFE. Both mention `.length`, so the IIFE is what
          // tells them apart.
          if (!e.includes("=>")) {
            calls.push("baseline");
            return baseline ?? 0;
          }
          // Emulate the page-side guard the expression carries: a node only
          // counts once it sits beyond the baseline count. `nodeIndex` is
          // where `node` actually sits in the bot list, so a case can model
          // the modal's pre-existing intro rather than assume it away.
          calls.push("node");
          const guard = e.match(/all\.length <= (\d+)/);
          if (guard && nodeIndex !== null && nodeIndex <= Number(guard[1])) {
            return null;
          }
          return node;
        },
        poll: async (fn) => !!(await fn()),
      },
      {
        navigate: async () => {
          calls.push("navigate");
        },
      },
    );
  } finally {
    console.log = originalLog;
  }
  return { lines, calls };
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
  const { lines } = await runFlow({
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
  const { lines } = await runFlow({
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
  const { lines } = await runFlow({
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
  const { lines } = await runFlow({
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
  const { lines } = await runFlow({
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
  const { lines } = await runFlow({
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

// The modal renders its opening intro as a bot node before any request is sent.
// It is long enough to satisfy any length threshold, so a selector that just
// takes "the last .chat-msg.bot" matches the INTRO and reports an answer that
// never arrived. This is not hypothetical: web-smoke caught exactly that when
// the selector was first generalised, reading the intro as a non-degraded
// reply on a surface whose worker has no key and therefore owes a degraded one.
test("the pre-existing intro cannot satisfy the reply wait", async () => {
  const { lines } = await runFlow({
    isLocalBase: true,
    probe: {
      ok: true,
      status: 200,
      chars: 320,
      base: "same-origin",
      degraded: true,
      keys: 6,
    },
    // Node 0 is the intro; node 1 is the only thing on screen and it is still
    // the intro. Nothing has been appended by the advisor yet.
    baseline: 1,
    nodeIndex: 1,
    node: {
      text: "I explain the results from the main sizing tool.",
      degraded: false,
    },
  });
  const names = failed(lines).join(" | ");
  assert.match(names, /renders the advisor's answer as prose/);
});

test("the advisor's answer appended after the intro does satisfy it", async () => {
  const { lines } = await runFlow({
    isLocalBase: true,
    probe: {
      ok: true,
      status: 200,
      chars: 320,
      base: "same-origin",
      degraded: true,
      keys: 6,
    },
    baseline: 1,
    nodeIndex: 2,
    node: {
      text: "You are offline - this is not the live AI advisor. A 3 kWh/day home typically needs 2-3 panels.",
      degraded: true,
    },
  });
  assert.deepEqual(
    failed(lines),
    [],
    `unexpected gate failures:\n${lines.join("\n")}`,
  );
});

// The root cause of the staging failure. `runClosingFlow` leaves the browser on
// `solar-heatmap/`, a page that never loads `assets/js/chat.js` — so the
// endpoint probe ran where `CF_API_URL` does not exist, could not read the
// endpoint this build actually targets, fell back to a relative `/api/chat`,
// and was answered 405 + HTML by Pages. Resolving the base better could not
// have helped, because there was no constant on that page to resolve.
test("the flow navigates onto the app page BEFORE probing the endpoint", async () => {
  const { calls } = await runFlow({
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
      text: "A live completion from the upstream model.",
      degraded: false,
    },
  });
  const nav = calls.indexOf("navigate");
  const probeAt = calls.indexOf("probe");
  assert.ok(nav >= 0, "flow never navigated");
  assert.ok(probeAt >= 0, "flow never probed the endpoint");
  assert.ok(nav < probeAt, `probe ran before navigate: ${calls.join(" -> ")}`);
});
