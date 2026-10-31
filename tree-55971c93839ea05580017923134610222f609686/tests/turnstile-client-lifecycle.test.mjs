// The Turnstile client's two lifecycle bounds, from an external review.
//
// Both defects are the same shape: a promise with no bound, or a promise that
// resolves on the wrong evidence. Neither throws, so neither shows up in a
// console -- the visitor just watches a spinner.
//
// 1. `requestTurnstileToken` resolved ONLY from `callback`,
//    `expired-callback` and `error-callback`. An interactive challenge nobody
//    completes, or one occluded or stalled, fires none of them -- for a very
//    long time. `postTo`'s timeout signal is created AFTER this promise
//    settles, so nothing else bounded the wait: the chat box sat on
//    "Thinking…" indefinitely. That is the exact hung state the send timeout
//    exists to prevent, reached by a different road.
//
// 2. `loadTurnstileScript` treated the PRESENCE of `script[data-bec-turnstile]`
//    as proof the script had loaded. A second send during the load resolved
//    immediately, found `win.turnstile` undefined, sent no token, and drew a
//    403 -- in exactly the window where someone is most likely to double-send.
//
// Each test below fails against the pre-fix module. A fresh copy is imported
// per test (`?v=N`) because the in-flight-load memo is module-level state; a
// shared instance would let one test's memo answer another's question.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_URL = pathToFileURL(
  join(ROOT, "assets", "js", "turnstile-client.js"),
);

let instance = 0;
const freshModule = () => import(`${MODULE_URL.href}?v=${++instance}`);

/**
 * Await a promise, but REFUSE to wait forever.
 *
 * The defect under test is an unbounded wait, so against the pre-fix module the
 * natural failure mode is a hang: the runner sits there with the promise never
 * settling and no verdict at all. A gate that can only tell you by hanging is a
 * bad gate. This turns the hang into a named failure.
 */
function within(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `${label} did not settle within ${ms}ms -- it has no timeout, which is the defect`,
            ),
          ),
        ms,
      ),
    ),
  ]);
}

/**
 * A document just real enough for this module: it records what was appended and
 * hands it back from `querySelectorAll`, so the "is the script already there?"
 * check sees what actually happened rather than a stubbed answer.
 */
function fakeDoc() {
  const appended = [];
  return {
    appended,
    head: {
      appendChild(el) {
        appended.push(el);
        return el;
      },
      removeChild(el) {
        const i = appended.indexOf(el);
        if (i >= 0) appended.splice(i, 1);
        return el;
      },
    },
    body: null,
    documentElement: null,
    createElement: () => ({
      setAttribute() {},
      attrs: {},
      set src(v) {
        this._src = v;
      },
      get src() {
        return this._src;
      },
    }),
    querySelector: () => null,
    querySelectorAll: (sel) =>
      sel === "script[data-bec-turnstile]" ? appended : [],
  };
}

/** Resolve/reject the pending <script> the way a real load does. */
function completeScript(doc, win, err) {
  const el = doc.appended[doc.appended.length - 1];
  if (err) el.onerror();
  else {
    if (!win.turnstile) win.turnstile = fakeApi();
    el.onload();
  }
}

/**
 * An API whose callbacks fire ASYNCHRONOUSLY, which is what the real widget
 * does. A synchronous callback from inside render() would arrive before the
 * module has assigned its widget id, which is a fixture artefact rather than a
 * behaviour worth pinning.
 */
function asyncApi(token) {
  const api = fakeApi();
  api.render = function (container, opts) {
    api.opts = opts;
    setTimeout(() => opts.callback(token), 0);
    return "widget-1";
  };
  return api;
}

function fakeApi(behaviour = {}) {
  const removed = [];
  return {
    removed,
    renderCalls: 0,
    render(container, opts) {
      this.renderCalls++;
      this.opts = opts;
      return "widget-1";
    },
    remove(id) {
      removed.push(id);
    },
    ...behaviour,
  };
}

// ── 1. the challenge promise must END ──────────────────────────────────────

test("a challenge that never calls back still settles, as null", async () => {
  const mod = await freshModule();
  const doc = fakeDoc();
  const win = { BEC_TURNSTILE_SITE_KEY: "site-key-abc" };
  const container = {};
  const api = fakeApi();
  win.turnstile = api;

  // Load resolves immediately; render never invokes any callback.
  const origAppend = doc.head.appendChild;
  doc.head.appendChild = (el) => {
    const r = origAppend(el);
    win.turnstile = api;
    el.onload();
    return r;
  };

  const settled = await within(
    mod.requestTurnstileToken({ doc, win, container, tokenTimeoutMs: 25 }),
    1000,
    "an unanswered challenge",
  );

  assert.equal(settled, null, "an unanswered challenge must resolve null");
  assert.equal(api.renderCalls, 1, "the widget really was rendered");
});

test("the widget is removed on the timeout path, not left as a focus trap", async () => {
  const mod = await freshModule();
  const doc = fakeDoc();
  const win = { BEC_TURNSTILE_SITE_KEY: "site-key-abc" };
  const api = fakeApi();
  const origAppend = doc.head.appendChild;
  doc.head.appendChild = (el) => {
    const r = origAppend(el);
    win.turnstile = api;
    el.onload();
    return r;
  };

  await within(
    mod.requestTurnstileToken({ doc, win, container: {}, tokenTimeoutMs: 25 }),
    1000,
    "an unanswered challenge",
  );

  // A leftover iframe in the modal is a keyboard trap, so removal is not
  // best-effort on this path -- it is the whole reason finish() exists.
  assert.deepEqual(
    api.removed,
    ["widget-1"],
    "an abandoned widget must be torn down",
  );
});

test("a completed challenge still returns its token, and the timer is cleared", async () => {
  // The bound must not cost the normal path anything, and it must not leave a
  // pending timer that fires long after the promise is done.
  const mod = await freshModule();
  const doc = fakeDoc();
  const win = { BEC_TURNSTILE_SITE_KEY: "site-key-abc" };
  const api = asyncApi("a-real-token");
  const origAppend = doc.head.appendChild;
  doc.head.appendChild = (el) => {
    const r = origAppend(el);
    win.turnstile = api;
    el.onload();
    return r;
  };

  const token = await within(
    mod.requestTurnstileToken({ doc, win, container: {}, tokenTimeoutMs: 25 }),
    1000,
    "a completed challenge",
  );
  assert.equal(token, "a-real-token");

  // The widget is torn down exactly once: the token path, not a later expiry.
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(api.removed, ["widget-1"], "exactly one teardown");
});

test("no site key means no widget and no wait at all", async () => {
  const mod = await freshModule();
  const doc = fakeDoc();
  const win = {};
  assert.equal(
    await mod.requestTurnstileToken({ doc, win, container: {} }),
    null,
  );
  assert.equal(doc.appended.length, 0, "nothing may be injected unconfigured");
});

// ── 2. the script load must be shared, and a failure must not be cached ────

test("two sends during the load wait for it instead of giving up on it", async () => {
  const mod = await freshModule();
  const doc = fakeDoc();
  const win = { BEC_TURNSTILE_SITE_KEY: "site-key-abc" };
  const api = asyncApi("tok");
  win.turnstile = api;
  // Deliberately do NOT fire onload here: both sends land inside the window
  // where the script exists but has not loaded.
  doc.head.appendChild = (el) => {
    doc.appended.push(el);
    return el;
  };

  let aSettled = false;
  let bSettled = false;
  const a = mod
    .requestTurnstileToken({ doc, win, container: {}, tokenTimeoutMs: 500 })
    .then((v) => ((aSettled = true), v));
  const b = mod
    .requestTurnstileToken({ doc, win, container: {}, tokenTimeoutMs: 500 })
    .then((v) => ((bSettled = true), v));

  await new Promise((r) => setTimeout(r, 20));
  assert.equal(
    bSettled,
    false,
    "the second send must still be waiting for the script, not resolve null",
  );
  assert.equal(aSettled, false);

  assert.equal(doc.appended.length, 1, "one <script>, not two");

  completeScript(doc, win);
  const [ta, tb] = await Promise.all([a, b]);
  assert.equal(tb, "tok", "both sends get the token once the script lands");
  assert.ok(["tok", null].includes(ta));
});

test("a failed script load leaves nothing behind, so the next send retries", async () => {
  // Two things had to be undone for a retry to actually happen, and fixing
  // only one of them is the trap. The memo must be cleared AND the dead
  // <script> must go, because the idempotence check reads the TAG, not the
  // memo. With only the memo cleared, the retry found the corpse, resolved
  // instantly with no API, and sent no token — the same 403.
  const mod = await freshModule();
  const doc = fakeDoc();
  const win = { BEC_TURNSTILE_SITE_KEY: "site-key-abc" };

  const first = mod.requestTurnstileToken({
    doc,
    win,
    container: {},
    tokenTimeoutMs: 500,
  });
  completeScript(doc, win, true);
  assert.equal(await first, null, "a blocked script degrades to no token");
  assert.equal(
    doc.appended.length,
    0,
    "a script that never loaded must not count as injected",
  );

  const second = mod.requestTurnstileToken({
    doc,
    win,
    container: {},
    tokenTimeoutMs: 500,
  });
  assert.equal(doc.appended.length, 1, "the retry must inject a fresh tag");
  win.turnstile = asyncApi("tok-2");
  doc.appended[doc.appended.length - 1].onload();
  assert.equal(await second, "tok-2");
});

// ── the fix is present in the source, stated as an invariant ───────────────

test("the module carries no unbounded wait on the challenge", () => {
  // Cheap structural pin. The behaviour tests above are the real proof, but a
  // future edit that removes the bound should fail a check even if the fake
  // document stops resembling reality.
  const src = readFileSync(MODULE_URL, "utf8").replace(/\r\n/g, "\n");
  assert.match(src, /TOKEN_WAIT_MS/);
  const body = src.slice(src.indexOf("return new Promise(function (resolve)"));
  assert.match(
    body.slice(0, 1400),
    /timer = setTimeout\([\s\S]{0,120}finish\(null\)/,
    "the timeout must be armed around the render, not merely declared",
  );
});
