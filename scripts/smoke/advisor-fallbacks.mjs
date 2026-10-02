#!/usr/bin/env node
// Prove B1 and B2 the way a visitor triggers them, without a browser.
//
// Why this exists when there are already tests. `tests/cold-start-defects.test.mjs`
// pins the CLIENT half by reading chat.js as source, because chat.js is a
// classic script and cannot be imported under plain Node. That is a real limit,
// and it is the same limit that let B1 ship: nothing ever executed the client's
// send path and watched a token appear in a request body.
//
// This driver closes that gap without a browser and without jsdom (this project
// has zero runtime dependencies, and adding one for a test would be worse than
// the gap). It runs chat.js's real `sendChatMsg()` against a hand-built fake
// DOM and a fake fetch, so the executed path is the shipped path — only the DOM
// and the network are substituted.
//
// It is DEMONSTRATION and REGRESSION evidence in one: it prints what a visitor
// would see for each scenario, so the numbers in a ledger row or a pitch can
// cite an observed run rather than an assertion someone made.
//
// Usage: node scripts/smoke/advisor-fallbacks.mjs [--json]
//
// Exit: 0 = every scenario behaved as specified, 1 = one did not.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// ── a DOM just large enough for chat.js ─────────────────────────────────────

function makeElement(tag) {
  const el = {
    tagName: (tag || "div").toUpperCase(),
    id: "",
    className: "",
    style: { cssText: "", display: "" },
    children: [],
    attrs: {},
    parentNode: null,
    textContent: "",
    innerText: "",
    innerHTML: "",
    value: "",
    checked: false,
    scrollTop: 0,
    scrollHeight: 0,
    clientRects: () => [{}],
    listeners: {},
    setAttribute(k, v) {
      this.attrs[k] = String(v);
    },
    getAttribute(k) {
      return this.attrs[k] ?? null;
    },
    removeAttribute(k) {
      delete this.attrs[k];
    },
    appendChild(c) {
      this.children.push(c);
      // chat.js removes the spinner with `loading.parentNode.removeChild(...)`,
      // so the parent link has to be real or the spinner is never detached.
      c.parentNode = this;
      return c;
    },
    removeChild(c) {
      this.children = this.children.filter((x) => x !== c);
      if (c.parentNode === this) c.parentNode = null;
      return c;
    },
    addEventListener(type, fn) {
      (this.listeners[type] ||= []).push(fn);
    },
    removeEventListener() {},
    click() {
      (this.listeners.click || []).forEach((fn) => fn({ target: this }));
    },
    focus() {},
    scrollIntoView() {},
    contains() {
      return false;
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    set inert(v) {
      this.attrs.inert = v;
    },
  };
  // innerText/textContent mirror each other, as they do in a real element for
  // the paths chat.js reads back.
  Object.defineProperty(el, "innerText", {
    get() {
      return el._text ?? "";
    },
    set(v) {
      el._text = String(v);
    },
  });
  return el;
}

function makeDom() {
  const byId = new Map();
  const chatWindow = makeElement("div");
  const chatInput = makeElement("textarea");
  chatInput.value = "";
  byId.set("chatWindow", chatWindow);
  byId.set("chatInput", chatInput);

  const body = makeElement("body");
  const head = makeElement("head");
  const documentElement = makeElement("html");

  const doc = {
    readyState: "complete",
    body,
    head,
    documentElement,
    title: "favicon",
    createElement: (tag) => makeElement(tag),
    createTextNode: (t) => ({ textContent: t }),
    // A real getElementById searches the live tree, and chat.js depends on
    // that: it looks up #loadingMsg to remove the spinner after a reply. A
    // stub that only knew the two ids it was handed would leave the spinner
    // behind and this driver would report a rendering bug that does not exist.
    getElementById: (id) => {
      if (byId.has(id)) return byId.get(id);
      const stack = [...doc.body.children, ...doc.head.children];
      while (stack.length) {
        const el = stack.shift();
        if (el.id === id) return el;
        stack.push(...el.children);
      }
      return null;
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
  };
  doc.body.appendChild(chatWindow);
  return { doc, chatWindow, chatInput };
}

// ── load the real chat.js into a sandbox ───────────────────────────────────

/**
 * chat.js is a CLASSIC script: it installs window globals and runs top-level
 * setup on load. Running its real source in a vm context with a stub window and
 * document is therefore exactly how the browser runs it — no shim, no rewrite.
 * `AbortSignal`, `fetch` and `console` are the only globals it reaches for.
 */
function loadChatJs({ doc, win }) {
  const src = readFileSync(join(ROOT, "assets/js/chat.js"), "utf8");
  const sandbox = {
    window: win,
    document: doc,
    console,
    setTimeout,
    clearTimeout,
    Promise,
    JSON,
    Math,
    parseFloat,
    parseInt,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    AbortSignal: globalThis.AbortSignal,
    navigator: { serviceWorker: undefined },
    location: { protocol: "https:", hostname: "example.test" },
    MutationObserver: undefined,
    matchMedia: undefined,
    fetch: (...a) => win.fetch(...a),
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: "assets/js/chat.js" });
  return sandbox;
}

// ── scenarios ──────────────────────────────────────────────────────────────

const DEGRADED_LABEL_HINT = /offline|degraded/i;

// The CLIENT-side disclaimer is its own string in chat.js ("verify with a
// licensed electrician or engineer"), distinct from the worker's
// DISCLAIMER_FOOTER ("licensed professional"). Both must appear on a real
// answer; the worker's is already asserted server-side, so this driver checks
// the one the browser actually renders.
const CLIENT_DISCLAIMER = /licensed electrician|licensed professional/i;

/** Send one advisor message and report what the chat window ends up showing. */
async function runScenario({ name, expect, turnstile, respond, siteKey }) {
  const { doc, chatWindow, chatInput } = makeDom();
  const sent = [];

  const win = {
    location: { hostname: "example.test", protocol: "https:" },
    becoLang: "en",
    // chat.js installs top-level listeners on window (service-worker
    // registration, the Escape/Tab handlers' window scope). A real window has
    // them; the stub must too or loading the script throws before anything is
    // under test.
    addEventListener() {},
    removeEventListener() {},
    matchMedia: undefined,
    scrollTo() {},
    fetch: async (url, opts) => {
      sent.push({ url, body: JSON.parse(opts.body) });
      return respond();
    },
  };
  if (siteKey) win.BEC_TURNSTILE_SITE_KEY = siteKey;

  const sandbox = loadChatJs({ doc, win });

  // The Turnstile half: a fake widget API on the window, exactly where the real
  // one installs itself after the Cloudflare script loads.
  if (turnstile) {
    win.turnstile = turnstile;
    win.requestTurnstileToken = async () =>
      turnstile.produce ? turnstile.produce() : null;
  }

  chatInput.value = expect.message;
  await sandbox.sendChatMsg();
  // Let any queued promise chain settle.
  await new Promise((r) => setTimeout(r, 10));

  const rendered = chatWindow.children
    .filter((c) => c.className === "chat-msg bot" && c.id !== "loadingMsg")
    .map((c) => ({
      degraded: c.attrs["data-degraded"] === "true",
      // chat.js writes reply text with textContent and labels with textContent
      // too, so read textContent and fall back to innerText — not the reverse,
      // which would read "" for every message.
      text: c.children
        .map((x) => x.textContent || x.innerText || "")
        .join("\n"),
    }));

  const request = sent[0];
  const observed = {
    scenario: name,
    requestsSent: sent.length,
    tokenSent: !!(request && request.body.turnstileToken),
    tokenValue: request ? (request.body.turnstileToken ?? null) : null,
    degradedRendered: rendered.some((r) => r.degraded),
    labelShown: rendered.some((r) => DEGRADED_LABEL_HINT.test(r.text)),
    firstLine: (rendered[0]?.text || "").split("\n")[0] || "",
    spinnerCleared: !chatWindow.children.some((c) => c.id === "loadingMsg"),
    disclaimerPresent: rendered.some((r) => CLIENT_DISCLAIMER.test(r.text)),
  };
  return observed;
}

const okJson = (body) => async () => ({
  ok: true,
  status: 200,
  json: async () => body,
  headers: new Headers(),
});

const scenarios = [
  {
    name: "no Turnstile configured, advisor healthy",
    expect: { message: "how big a battery do I need?" },
    siteKey: null,
    turnstile: null,
    respond: okJson({
      reply: "For a 30 kWh/day household, start near 40 kWh usable.",
    }),
    assertions: (o) => [
      [
        o.tokenSent === false,
        "no token is sent when no site key is configured",
      ],
      [
        o.degradedRendered === false,
        "a healthy advisor wears no degraded label",
      ],
      [o.disclaimerPresent, "the disclaimer still travels with the answer"],
      [
        o.spinnerCleared,
        "the Thinking spinner is removed once the reply lands",
      ],
    ],
  },
  {
    name: "Turnstile configured, token produced",
    expect: { message: "how big a battery do I need?" },
    siteKey: "0xREALKEY",
    turnstile: { produce: () => "token-abc-123" },
    respond: okJson({ reply: "Start near 40 kWh usable." }),
    assertions: (o) => [
      [o.tokenSent === true, "the client sends turnstileToken"],
      [
        o.tokenValue === "token-abc-123",
        "the token is the one the widget produced",
      ],
      [
        o.degradedRendered === false,
        "a guarded but healthy advisor is not degraded",
      ],
    ],
  },
  {
    name: "Turnstile configured, widget unavailable (blocked script)",
    expect: { message: "how big a battery do I need?" },
    siteKey: "0xREALKEY",
    turnstile: { produce: () => null },
    respond: okJson({ reply: "Start near 40 kWh usable." }),
    assertions: (o) => [
      [
        o.tokenSent === false,
        "an unavailable widget sends no token rather than hanging",
      ],
      [
        o.requestsSent === 1,
        "and the request still goes out — it is non-fatal",
      ],
    ],
  },
  {
    name: "advisor unavailable (B2 fallback)",
    expect: { message: "why is my bill so high?" },
    siteKey: null,
    turnstile: null,
    respond: okJson({
      reply:
        "DEGRADED: I cannot answer this one right now — a service this advisor depends on did not respond.",
      degraded: true,
      reason: "groq_unavailable",
      model: "deterministic-fallback",
    }),
    assertions: (o) => [
      [o.degradedRendered === true, "the fallback is rendered as degraded"],
      [
        o.labelShown,
        "and it carries a visible label, not a silent short answer",
      ],
      [o.disclaimerPresent, "even the fallback carries the disclaimer"],
    ],
  },
];

async function main() {
  const asJson = process.argv.includes("--json");
  const results = [];
  let failed = 0;

  for (const s of scenarios) {
    const observed = await runScenario(s);
    const checks = s.assertions(observed).map(([ok, why]) => ({
      ok,
      why,
    }));
    const bad = checks.filter((c) => !c.ok);
    failed += bad.length;
    results.push({ ...observed, checks });
  }

  if (asJson) {
    console.log(JSON.stringify({ results, failed }, null, 2));
  } else {
    console.log(
      "Advisor client smoke — the shipped sendChatMsg path, fake DOM, no browser\n",
    );
    for (const r of results) {
      console.log(`  ${r.scenario}`);
      console.log(
        `    requests=${r.requestsSent} token=${r.tokenSent ? r.tokenValue : "(none)"} ` +
          `degraded=${r.degradedRendered} label=${r.labelShown} spinner-cleared=${r.spinnerCleared}`,
      );
      console.log(`    first line: ${r.firstLine.slice(0, 88)}`);
      for (const c of r.checks) {
        console.log(`    ${c.ok ? "PASS" : "FAIL"}  ${c.why}`);
      }
      console.log("");
    }
    console.log(
      failed === 0
        ? "  ALL SCENARIOS BEHAVED AS SPECIFIED"
        : `  ${failed} CHECK(S) FAILED`,
    );
  }
  process.exit(failed === 0 ? 0 : 1);
}

const invokedDirectly =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) main();

export { makeDom, loadChatJs, runScenario, scenarios };
