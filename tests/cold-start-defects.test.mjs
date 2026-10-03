// The five Cold Start defects (docs/contest/COLD-START-PLAN.md §4), pinned.
//
// Each test here corresponds to a defect that was real in shipped code, and
// each is written so the ORIGINAL defect fails it. That matters more than the
// test count: a test that would still pass against the broken tree is a
// comment, not a gate.
//
//   B1  assets/js/chat.js sent no `turnstileToken`, so the moment
//       TURNSTILE_SECRET_KEY was provisioned the live advisor 403'd with no
//       client recovery.
//   B2  An upstream failure returned 502/503 and the visitor saw a dead chat
//       box (the judge's largest unflagged risk).
//   B3  worker/turnstile.mjs and the showcase doc sold a "verified-electrician
//       lead funnel", contradicting D-18 and §14.
//   B4  The same doc told operators to enable Bot Fight Mode, re-creating
//       this repo's own open finding F-44.
//   B5  cf-provision-check.mjs omitted TYPESAFE_API_KEY, so the gate read
//       green on a worker whose Jev call could never work.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import worker, {
  buildDegradedReply,
  mentionsSystem,
  ensureDisclaimer,
  DEGRADED_LABEL,
  resetRateLimitsForTest,
  setGroqBusyBackoffMs,
  GROQ_BUSY_BACKOFF_MS,
} from "../worker/index.js";
import {
  checkProvisioning,
  REQUIRED_SECRETS,
} from "../scripts/cf-provision-check.mjs";
import * as turnstileClient from "../assets/js/turnstile-client.js";
import {
  cspAllowsHost,
  headersFor,
  parseCsp,
  parseHeadersFile,
} from "../scripts/lib/gates.mjs";
import { runScenario, scenarios } from "../scripts/smoke/advisor-fallbacks.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const chatSrc = read("assets/js/chat.js");
const docSrc = read("docs/cloudflare-showcase.md");

const ORIGIN = "https://freeoffgridcalculator.com";

const postChat = (body, env = {}, headers = {}) =>
  worker.fetch(
    new Request("https://api.test/api/chat", {
      method: "POST",
      headers: {
        Origin: ORIGIN,
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    }),
    env,
  );

// A Groq that answers, so the only variable under test is the failure path.
const groqOk = async () => ({
  ok: true,
  status: 200,
  json: async () => ({
    choices: [
      { message: { content: "A real answer." }, finish_reason: "stop" },
    ],
  }),
});

/** Strip comments + collapse whitespace: chat.js is a classic script and the
 *  user-facing strings are built as `"a " + "b"`, so raw-source regexes match
 *  explanations of a fix as if the fix were absent. Same two-way pin
 *  tests/advisor-mode-copy.test.mjs uses. */
const executable = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ")
    .replace(/\s+/g, " ");

// ══ B1 — the client must send the token ═══════════════════════════════════

test("B1: the advisor POST carries turnstileToken when a token is produced", () => {
  const exec = executable(chatSrc);
  assert.match(
    exec,
    /turnstileToken/,
    "the client must name turnstileToken in the request body",
  );
  assert.match(
    exec,
    /body\.turnstileToken\s*=\s*token/,
    "the token must actually be placed on the body, not merely referenced",
  );
  // The property has to sit on the object that is POSTed, which is built in
  // sendChatMsg — pin that the assignment is inside that function.
  const fn = chatSrc.slice(
    chatSrc.indexOf("function sendChatMsg"),
    chatSrc.indexOf("// Per-mode memory"),
  );
  assert.match(
    executable(fn),
    /turnstileToken/,
    "the token assignment must live in the function that sends the chat",
  );
});

test("B1: the Turnstile client resolves a real site key and refuses the placeholder", () => {
  const meta = (content) => ({
    querySelector: (sel) =>
      sel === 'meta[name="bec-turnstile-site-key"]' && content != null
        ? { getAttribute: () => content }
        : null,
  });
  const win = {};
  assert.equal(
    turnstileClient.resolveTurnstileSiteKey(meta("0x4AAAAkey"), win),
    "0x4AAAAkey",
    "a real site key must resolve from the meta tag",
  );
  assert.equal(
    turnstileClient.resolveTurnstileSiteKey(meta("0x4AAAAkey"), {
      BEC_TURNSTILE_SITE_KEY: "0xWINNERY",
    }),
    "0xWINNERY",
    "window must win over the meta tag",
  );
  assert.equal(
    turnstileClient.resolveTurnstileSiteKey(
      meta("REPLACE_WITH_TURNSTILE_SITE_KEY"),
      win,
    ),
    null,
    "the wrangler placeholder must never reach the widget",
  );
  assert.equal(turnstileClient.resolveTurnstileSiteKey(meta(null), win), null);
  assert.equal(turnstileClient.resolveTurnstileSiteKey(null, win), null);
});

test("B1: no site key means no widget and no token, and the widget is explicit", async () => {
  // Non-fatal is the requirement: an unconfigured deployment must still send.
  assert.equal(
    await turnstileClient.requestTurnstileToken({ doc: null, win: {} }),
    null,
  );
  assert.equal(
    await turnstileClient.requestTurnstileToken({
      doc: { querySelector: () => null },
      win: {},
      container: {},
    }),
    null,
  );
  assert.match(
    turnstileClient.TURNSTILE_SCRIPT_SRC,
    /render=explicit/,
    "an implicit widget would render without consent to the request path",
  );
});

/** A fake document whose injected script fires onload/onerror on the next tick. */
function makeDoc({ failScript = false } = {}) {
  const doc = {
    appended: [],
    createElement: () => {
      const el = {
        attrs: {},
        setAttribute(k, v) {
          this.attrs[k] = v;
        },
      };
      el.onload = null;
      el.onerror = null;
      // Fire asynchronously like a real script tag: the loader must not assume
      // onload has already run by the time it returns.
      setTimeout(() => {
        if (failScript) el.onerror && el.onerror();
        else el.onload && el.onload();
      }, 0);
      return el;
    },
    appendChild: (el) => {
      doc.appended.push(el);
      return el;
    },
    querySelectorAll: (sel) =>
      sel === "script[data-bec-turnstile]"
        ? doc.appended.filter((e) => e.attrs && e.attrs["data-bec-turnstile"])
        : [],
    querySelector: () => null,
    head: {
      appendChild: (el) => {
        doc.appended.push(el);
        return el;
      },
    },
  };
  return doc;
}

test("B1: a rendered widget resolves a token and is removed afterwards", async () => {
  let rendered = null;
  let removed = null;
  const win = {
    turnstile: {
      render: (container, opts) => {
        rendered = { container, opts };
        return "widget-1";
      },
      remove: (id) => {
        removed = id;
      },
    },
  };
  const container = {};
  const p = turnstileClient.requestTurnstileToken({
    doc: makeDoc(),
    win,
    container,
    siteKey: "0xREALKEY",
  });
  // render() only happens once the script has loaded, which is a tick away.
  await tick();
  assert.ok(rendered, "render() must be called");
  assert.equal(rendered.container, container);
  assert.equal(rendered.opts.sitekey, "0xREALKEY");
  rendered.opts.callback("token-abc");
  assert.equal(await p, "token-abc");
  assert.equal(
    removed,
    "widget-1",
    "a spent widget must not linger as an iframe",
  );
});

test("B1: an expired or errored widget resolves null instead of hanging", async () => {
  for (const hook of ["expired-callback", "error-callback"]) {
    let opts = null;
    const win = {
      turnstile: {
        render: (_c, o) => {
          opts = o;
          return "w";
        },
        remove: () => {},
      },
    };
    const p = turnstileClient.requestTurnstileToken({
      doc: makeDoc(),
      win,
      container: {},
      siteKey: "0xREALKEY",
    });
    await tick();
    opts[hook]();
    assert.equal(await p, null, `${hook} must resolve null`);
  }
});

test("B1: a blocked or failed Turnstile script is non-fatal", async () => {
  const doc = makeDoc({ failScript: true });
  const win = {
    turnstile: {
      render: () => "w",
      remove: () => {},
    },
  };
  assert.equal(
    await turnstileClient.requestTurnstileToken({
      doc,
      win,
      container: {},
      siteKey: "0xREALKEY",
    }),
    null,
    "a widget that cannot load must degrade, never reject into a dead send",
  );
});

test("B1: the loader injects the script once, never twice", async () => {
  const doc = makeDoc();
  await turnstileClient.loadTurnstileScript(doc, {}, "cb");
  const first = doc.appended.length;
  await turnstileClient.loadTurnstileScript(doc, {}, "cb");
  assert.equal(
    doc.appended.length,
    first,
    "a second advisor question must not stack scripts",
  );
  assert.equal(first, 1);
});

test("B1: the worker still fails CLOSED on a bad token (the server half holds)", async () => {
  const env = {
    TURNSTILE_SECRET_KEY: "s3cr3t",
    GROQ_API_KEY: "g",
    fetch: async () => ({ json: async () => ({ success: false }) }),
  };
  const res = await postChat({ message: "hi", turnstileToken: "bad" }, env);
  assert.equal(
    res.status,
    403,
    "client integration must not weaken the server gate",
  );
  const body = await res.json();
  assert.equal(body.reason, "invalid_token");
  assert.equal(
    body.degraded,
    undefined,
    "a rejected challenge is not a degraded ANSWER",
  );
});

// ══ B2 — the degraded advisor reply ═══════════════════════════════════════

test("B2: no Groq key yields a labelled deterministic reply, not a 500", async () => {
  resetRateLimitsForTest();
  const res = await postChat({ message: "size me a system" }, {});
  assert.equal(res.status, 200, "an unprovisioned advisor must still answer");
  const body = await res.json();
  assert.equal(body.degraded, true);
  assert.equal(body.reason, "key_missing");
  assert.equal(body.label, DEGRADED_LABEL);
  assert.equal(body.model, "deterministic-fallback");
  assert.match(body.reply, new RegExp(DEGRADED_LABEL));
});

test("B2: a busy provider (429 twice) answers with the labelled fallback", async () => {
  resetRateLimitsForTest();
  let calls = 0;
  const busy = async () => {
    calls++;
    return {
      ok: false,
      status: 429,
      json: async () => ({ error: { message: "Rate limit reached" } }),
    };
  };
  const env = { GROQ_API_KEY: "g", fetch: busy };
  // The one backoff is a real sleep in production. Compress it here so the
  // test measures the RESPONSE, not the wall clock; the production default is
  // asserted separately below.
  setGroqBusyBackoffMs(1);
  try {
    const res = await postChat({ message: "why is my bill high?" }, env);
    assert.equal(res.status, 200, "busy must not present as a dead chat box");
    const body = await res.json();
    assert.equal(body.degraded, true);
    assert.equal(body.reason, "groq_unavailable");
    assert.equal(
      res.headers.get("Retry-After"),
      null,
      "no retry ladder on the degraded path",
    );
    assert.equal(calls, 2, "one retry, then the labelled fallback");
  } finally {
    setGroqBusyBackoffMs(15000);
  }
});

test("B2: the production busy backoff is still 15s, not the test's 1ms", () => {
  // Guards the compression above from leaking into shipped behaviour. Asserted
  // on the exported default, deliberately WITHOUT sleeping: a test that proves
  // a duration by waiting it out is the 15-second test this one replaces.
  setGroqBusyBackoffMs(undefined);
  assert.equal(
    GROQ_BUSY_BACKOFF_MS,
    15000,
    "a nonsense value must fall back to the default, not to a zero backoff",
  );
  setGroqBusyBackoffMs(-5);
  assert.equal(GROQ_BUSY_BACKOFF_MS, 15000);
  setGroqBusyBackoffMs(15000);
  assert.equal(
    GROQ_BUSY_BACKOFF_MS,
    15000,
    "a real 429 must be waited out once, not abandoned instantly",
  );
});

test("B2: an upstream error (5xx) answers with the labelled fallback", async () => {
  resetRateLimitsForTest();
  const dead = async () => ({ ok: false, status: 502, json: async () => ({}) });
  const env = { GROQ_API_KEY: "g", fetch: dead };
  const res = await postChat({ message: "hello" }, env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.degraded, true);
  assert.equal(body.reason, "groq_error");
});

test("B2: a thrown fetch (network down) answers with the labelled fallback", async () => {
  resetRateLimitsForTest();
  const env = {
    GROQ_API_KEY: "g",
    fetch: async () => {
      throw new Error("ECONNRESET");
    },
  };
  const res = await postChat({ message: "hello" }, env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.degraded, true);
  assert.equal(body.reason, "groq_unavailable");
});

test("B2: a healthy provider is NOT degraded", async () => {
  resetRateLimitsForTest();
  const res = await postChat(
    { message: "hello" },
    { GROQ_API_KEY: "g", fetch: groqOk },
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(
    body.degraded,
    undefined,
    "a working advisor must not wear a degraded label",
  );
  assert.match(body.reply, /A real answer\./);
});

test("B2: the fallback is deterministic and always carries the disclaimer", () => {
  // ensureDisclaimer is now INJECTED: advisor-fallback.mjs must not depend on
  // the router. The worker passes the same function the live-reply path uses,
  // and tests/worker-i18n.test.mjs pins that a real HTTP response still
  // carries the footer.
  const a = buildDegradedReply(
    "groq_unavailable",
    { hasSystem: true },
    ensureDisclaimer,
  );
  const b = buildDegradedReply(
    "groq_unavailable",
    { hasSystem: true },
    ensureDisclaimer,
  );
  assert.equal(a.reply, b.reply, "the same reason must produce the same text");
  assert.equal(
    ensureDisclaimer(a.reply),
    a.reply,
    "the footer must already be present",
  );
  assert.match(a.reply, /licensed professional/);
  assert.ok(
    a.reply.length > 120,
    "a fallback must be a real answer, not a stub",
  );
});

test("B2: the fallback names the actual failure and never guesses a number", () => {
  const missing = buildDegradedReply("key_missing", {}, ensureDisclaimer);
  assert.match(missing.reply, /no language-model key configured/);
  const unknown = buildDegradedReply("something_new", {}, ensureDisclaimer);
  assert.match(unknown.reply, /did not respond/);
  // No fabricated sizing: a degraded reply must not invent kWh, dollars or
  // panels, because the whole product is that its numbers are real.
  assert.doesNotMatch(
    unknown.reply,
    /\d+(\.\d+)?\s*(kWh|kWp|W|\$)/,
    "a degraded reply must never state a number it cannot stand behind",
  );
});

test("B2: hasSystem picks a system-aware fallback without touching model output", () => {
  assert.equal(
    mentionsSystem("Please size an off-grid battery system for me."),
    true,
  );
  assert.equal(mentionsSystem("why is my bill so high?"), false);
  const sized = buildDegradedReply(
    "groq_unavailable",
    { hasSystem: true },
    ensureDisclaimer,
  );
  const general = buildDegradedReply(
    "groq_unavailable",
    { hasSystem: false },
    ensureDisclaimer,
  );
  assert.notEqual(sized.reply, general.reply);
  assert.match(sized.reply, /sizing result on this page stands as calculated/);
  assert.match(
    general.reply,
    /sizes a system from your bill or your daily kWh/,
  );
});

test("B2: the client renders the degraded label visibly", () => {
  const exec = executable(chatSrc);
  assert.match(
    exec,
    /localizedDegradedReply\(data\)\s*\|\|\s*data\.reply/,
    "the reply must be rendered in the visitor's language, falling back to the worker's English text",
  );
  assert.match(
    exec,
    /!!\(data && data\.degraded\)/,
    "the reply must be rendered with its degraded state",
  );
  assert.match(
    exec,
    /data-degraded/,
    "the message must carry a machine-readable marker",
  );
  assert.match(
    exec,
    /advisorDegradedLabel/,
    "the label copy must be translatable, not hardcoded only",
  );
});

// ══ B3 — no lead funnel ═══════════════════════════════════════════════════

// The claim itself. These phrases assert a revenue funnel that does not exist
// and that the master plan's §14 forbids, and §1.2 of the contest plan means
// Cloudflare reads this repo.
const FUNNEL_CLAIM =
  /lead funnel|lead quality|verified-electrician|paying electricians|top of a .{0,30}funnel/i;

test("B3: no shipped source or doc sells a lead funnel", () => {
  const offenders = [];
  const files = [
    "worker/turnstile.mjs",
    "worker/index.js",
    "docs/cloudflare-showcase.md",
    "assets/js/chat.js",
    "assets/js/turnstile-client.js",
  ];
  // Checked over the WHOLE file, comments included. B3 lived in a comment block,
  // so an executable-only check would have passed straight over the defect.
  for (const f of files) {
    if (FUNNEL_CLAIM.test(read(f))) offenders.push(f);
  }
  assert.deepEqual(
    offenders,
    [],
    `lead-funnel framing contradicts D-18 and §14: ${offenders.join(", ")}`,
  );
});

test("B3: 'lead capture' may only appear as something the project refuses", () => {
  const files = [
    "worker/turnstile.mjs",
    "worker/index.js",
    "docs/cloudflare-showcase.md",
    "assets/js/chat.js",
  ];
  const offenders = [];
  for (const f of files) {
    for (const line of read(f).split("\n")) {
      if (!/lead capture/i.test(line)) continue;
      // A sentence that rules it out is the opposite of the defect; one that
      // offers it is the defect. Requires an explicit negation in the line.
      const refuses =
        /\b(no|not|never|forbid|rules out|rules? out)\b/i.test(line) ||
        /\bwithout\b/i.test(line);
      if (!refuses) offenders.push(`${f}: ${line.trim()}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `lead capture must only be named as forbidden: ${offenders.join(" | ")}`,
  );
});

test("B3: the Turnstile rationale keeps the real reason (abuse + paid tokens)", () => {
  // The rationale IS the comment header, so read the comments here - and note
  // the check that matters most is the one above: this file must not claim a
  // funnel while keeping a cost argument.
  const src = read("worker/turnstile.mjs");
  assert.match(src, /Groq/, "the genuine cost argument must survive");
  assert.match(
    src,
    /free and permanently public|no accounts/,
    "the posture must be stated",
  );
  assert.match(src, /uptime|cost/i, "the real stakes are uptime and cost");
});

// ══ B4 — no Bot Fight Mode ════════════════════════════════════════════════

test("B4: the showcase doc must not instruct enabling Bot Fight Mode", () => {
  const instructions = docSrc
    .split("\n")
    .filter((l) => /Bot Fight Mode/i.test(l))
    .join("\n");
  assert.doesNotMatch(
    instructions,
    /Bot Fight Mode:\s*\**On/i,
    "enabling Bot Fight Mode re-creates F-44; the doc must not tell operators to",
  );
  assert.match(
    docSrc,
    /Verified Bots:\s*\**Allow/i,
    "the correct control must be named: allow verified bots",
  );
});

test("B4: the doc cites the finding it would otherwise re-create", () => {
  assert.match(docSrc, /F-44/, "the reasoning must cite F-44");
  assert.match(
    docSrc,
    /R-SEO-07/,
    "and the requirement that governs it, R-SEO-07",
  );
  assert.match(docSrc, /O-09/, "and the owner action that closes it, O-09");
});

test("B4: a bot-management rule exists and is about verified bots, not challenges", () => {
  const m = docSrc.match(/### Rule 3[\s\S]*?(?=\n## |\n### Managed)/);
  assert.ok(m, "Rule 3 must exist in the WAF section");
  assert.match(m[0], /Bot Fight Mode:\s*\**Off/i);
  assert.match(m[0], /Verified Bots/);
});

// ══ B5 — the provision check must know every required secret ═════════════

test("B5: cf-provision-check requires TYPESAFE_API_KEY", () => {
  const names = REQUIRED_SECRETS.map((s) => s.name);
  assert.ok(
    names.includes("TYPESAFE_API_KEY"),
    "PR #172 Phase 3 sets TYPESAFE_API_KEY; the gate omitted it, so it read green without it",
  );
  assert.ok(names.includes("GROQ_API_KEY"));
  assert.ok(names.includes("TURNSTILE_SECRET_KEY"));
  assert.ok(names.includes("EVIDENCE_UPLOAD_TOKEN"));
  // Every entry must carry actionable instructions, not just a name.
  for (const s of REQUIRED_SECRETS) {
    assert.match(
      s.step,
      /wrangler secret put/,
      `${s.name} needs its wrangler command`,
    );
  }
});

test("B5: provision check rejects empty and structurally incomplete configs", () => {
  for (const invalid of ["null", "[]", "true", "invalid JSON"]) {
    assert.equal(checkProvisioning(invalid).length, 5);
  }
  assert.deepEqual(
    checkProvisioning("{}").map((item) => item.key),
    [
      "worker.name",
      "SHARE_KV",
      "USAGE_DB",
      "EVIDENCE_BUCKET",
      "TURNSTILE_SITE_KEY",
    ],
  );
  assert.deepEqual(
    checkProvisioning(
      JSON.stringify({
        name: "bigenergyco-api-showcase",
        kv_namespaces: [
          { binding: "SHARE_KV", id: "352d6d3f9d634f729a31a0b2a7dc0176" },
        ],
      }),
    ).map((item) => item.key),
    ["USAGE_DB", "EVIDENCE_BUCKET", "TURNSTILE_SITE_KEY"],
  );
  assert.ok(
    checkProvisioning(
      '{"name":"bigenergyco-api","vars":{"TURNSTILE_SITE_KEY":"REPLACE_WITH_TURNSTILE_SITE_KEY"}}',
    ).length > 0,
    "production worker names and placeholders must not pass",
  );
  const placeholderConfig = {
    name: "bigenergyco-api-showcase",
    kv_namespaces: [
      { binding: "SHARE_KV", id: "REPLACE_WITH_KV_NAMESPACE_ID" },
    ],
    d1_databases: [
      { binding: "USAGE_DB", database_id: "REPLACE_WITH_D1_DATABASE_ID" },
    ],
    r2_buckets: [{ binding: "EVIDENCE_BUCKET", bucket_name: "bucket" }],
    vars: { TURNSTILE_SITE_KEY: "REPLACE_WITH_TURNSTILE_SITE_KEY" },
  };
  assert.deepEqual(
    checkProvisioning(JSON.stringify(placeholderConfig)).map(
      (item) => item.key,
    ),
    ["SHARE_KV", "USAGE_DB", "TURNSTILE_SITE_KEY"],
    "the previous KV, D1, and Turnstile placeholders must remain blocked",
  );
  assert.ok(
    checkProvisioning('{"name":"bigenergyco-api-showcase"}').some(
      (item) => item.key === "SHARE_KV",
    ),
    "an omitted binding must name its provisioning step",
  );
});

test("B5: provision check accepts a fully provisioned showcase configuration", () => {
  const complete = {
    name: "bigenergyco-api-showcase",
    kv_namespaces: [
      { binding: "SHARE_KV", id: "352d6d3f9d634f729a31a0b2a7dc0176" },
    ],
    d1_databases: [
      {
        binding: "USAGE_DB",
        database_id: "b99aa7ea-bd4d-43ad-b312-37d0fc2608e8",
      },
    ],
    r2_buckets: [
      {
        binding: "EVIDENCE_BUCKET",
        bucket_name: "bigenergyco-evidence-showcase",
      },
    ],
    vars: { TURNSTILE_SITE_KEY: "0x4AAAAAAvalidExampleSiteKey" },
  };
  assert.deepEqual(checkProvisioning(JSON.stringify(complete)), []);
});

// ══ the shipped client path, executed ═════════════════════════════════════
//
// The B1 assertions above pin chat.js as SOURCE, because it is a classic script
// and cannot be imported. That is exactly the limit that let B1 ship: nothing
// executed the client's send path and watched a token appear in a request body.
// These run the real sendChatMsg() in a vm against a fake DOM, so the executed
// path is the shipped path and only the DOM and network are substituted.

test("EXECUTED: the shipped send path puts a real token in the request body", async () => {
  const o = await runScenario(scenarios[1]);
  assert.equal(
    o.tokenSent,
    true,
    "the widget's token must reach the POST body",
  );
  assert.equal(
    o.tokenValue,
    "token-abc-123",
    "and it must be the widget's own token",
  );
  assert.equal(o.requestsSent, 1);
});

test("EXECUTED: an unconfigured deployment sends no token and still gets a reply", async () => {
  // This is the regression that matters most day to day: the showcase runs
  // WITHOUT a site key until someone provisions one, and the advisor must be
  // fully usable in that state. B1's fix must not have broken the default.
  const o = await runScenario(scenarios[0]);
  assert.equal(o.tokenSent, false);
  assert.equal(
    o.degradedRendered,
    false,
    "a working advisor must not be labelled degraded",
  );
  assert.equal(o.disclaimerPresent, true);
  assert.equal(o.spinnerCleared, true, "the Thinking spinner must be removed");
  assert.match(
    o.firstLine,
    /30 kWh\/day/,
    "and the reply text is actually rendered",
  );
});

test("EXECUTED: a blocked Turnstile script degrades instead of hanging", async () => {
  const o = await runScenario(scenarios[2]);
  assert.equal(o.tokenSent, false);
  assert.equal(
    o.requestsSent,
    1,
    "the advisor must still be reachable when the challenge cannot render",
  );
  assert.equal(
    o.spinnerCleared,
    true,
    "and it must not leave the spinner up forever",
  );
});

test("EXECUTED: the degraded fallback renders with its visible label", async () => {
  const o = await runScenario(scenarios[3]);
  assert.equal(o.degradedRendered, true);
  assert.equal(o.labelShown, true, "the label must be rendered, not only sent");
  assert.equal(o.disclaimerPresent, true);
  assert.match(o.firstLine, /^DEGRADED/, "the message itself is labelled too");
});

test("EXECUTED: every advisor scenario behaves as specified", async () => {
  // Runs the driver's own assertions as a test, so a scenario added to the
  // smoke is covered the moment it is written rather than only when someone
  // remembers to run the script.
  for (const s of scenarios) {
    const o = await runScenario(s);
    for (const [ok, why] of s.assertions(o)) {
      assert.ok(ok, `${s.name}: ${why}`);
    }
  }
});

// ══ B1 under the site's real CSP ══════════════════════════════════════════
//
// B1 was reported fixed and was not: the widget script is loaded from
// challenges.cloudflare.com, and `_headers` script-src did not allow that host,
// so the browser blocked the widget. The unit tests passed because they assert
// the client SENDS a token, never that the page can LOAD one. A test that
// cannot see the deployment's security policy is a test with a hole in it.
//
// So the client half and the policy half are pinned against each other here,
// using the same parsers the gate uses.

test("CSP: the shipped policy allows exactly what the Turnstile widget needs", () => {
  const rules = parseHeadersFile(readFileSync(join(ROOT, "_headers"), "utf8"));
  const csp = parseCsp(
    headersFor("/", rules).get("content-security-policy") || "",
  );
  const { host, directives } = turnstileClient.TURNSTILE_CSP_REQUIREMENTS;
  for (const directive of directives) {
    assert.ok(
      cspAllowsHost(csp[directive] || [], host),
      `_headers ${directive} must allow ${host} or the widget cannot load; got [${(csp[directive] || []).join(" ")}]`,
    );
  }
});

test("CSP: frame-src is declared, so the widget iframe is not blocked", () => {
  // frame-src falls back to default-src 'self' when absent, which blocks EVERY
  // cross-origin frame. That is a silent failure: the script loads, the widget
  // renders nothing, and nothing in the console names the policy.
  const rules = parseHeadersFile(readFileSync(join(ROOT, "_headers"), "utf8"));
  const csp = parseCsp(
    headersFor("/", rules).get("content-security-policy") || "",
  );
  assert.ok(csp["frame-src"], "frame-src must be declared explicitly");
  assert.ok(
    cspAllowsHost(
      csp["frame-src"],
      turnstileClient.TURNSTILE_CSP_REQUIREMENTS.host,
    ),
    "frame-src must allow the Turnstile origin",
  );
});

test("CSP: the widget's script host is the one the client actually loads", () => {
  // Ties the constant the loader uses to the constant the policy is checked
  // against, so changing one without the other is a test failure rather than a
  // blocked widget in a demo.
  //
  // Compared as strings, not as a RegExp built from the host. Escaping a host
  // into a pattern by hand is incomplete sanitization by construction — the
  // dots get escaped and nothing else does, so the assertion is only as correct
  // as that one replace() (CodeQL: js/incomplete-sanitization, high). A
  // hostnames are a fixed, known-shape literal here, so string comparison
  // states the same intent with nothing to sanitize and nothing to get wrong.
  const host = turnstileClient.TURNSTILE_CSP_REQUIREMENTS.host;
  const src = turnstileClient.TURNSTILE_SCRIPT_SRC;
  assert.ok(
    src.startsWith(`https://${host}/`),
    `TURNSTILE_SCRIPT_SRC must load from https://${host}/, got ${src}`,
  );
});

test("CSP: the policy was not widened beyond what the widget needs", () => {
  // The fix must be the two documented directives on one host, not a blanket
  // relaxation. A wildcard or 'unsafe-*' added to get the widget working would
  // be a security regression traded for a convenience.
  const rules = parseHeadersFile(readFileSync(join(ROOT, "_headers"), "utf8"));
  const csp = parseCsp(
    headersFor("/", rules).get("content-security-policy") || "",
  );
  assert.equal(
    csp["script-src"].includes("*"),
    false,
    "script-src must stay closed",
  );
  assert.equal(csp["script-src"].includes("'unsafe-inline'"), false);
  assert.equal(
    csp["frame-src"].includes("*"),
    false,
    "frame-src must name the origin, not the whole web",
  );
});

test("GATE: the headers gate itself derives hosts from the shipped asset set", () => {
  // The gate is only as good as its discovery. It used to classify a ".js" URL
  // as "any directive will do", so a script served from a connect-src-only host
  // passed the gate while the browser blocked it - verified before this change.
  const src = readFileSync(join(ROOT, "scripts/check-headers.mjs"), "utf8");
  assert.match(
    src,
    /EXT_DIRECTIVE/,
    "extensions must map to their governing directive",
  );
  assert.match(
    src,
    /frame-src/,
    "frame-src must be part of the registry's directive set",
  );
  assert.match(
    src,
    /untracked shipped asset/,
    "an untracked new asset must be caught before it is committed",
  );
});

// ── helpers ────────────────────────────────────────────────────────────────

/** Let queued microtasks and one timer tick run. */
const tick = () => new Promise((r) => setTimeout(r, 0));
