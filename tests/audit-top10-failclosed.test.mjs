// Car 2 (#197), top 10 by blast radius: the five functions no earlier car
// dispositioned. Each is answered against the shipped code, and where the
// answer is "already guarded" the guard gets a test that fails if someone
// removes it — the rule cars 1 and 2 were judged on
// (tests/audit-car1-guards.test.mjs, tests/audit-car2-boundaries.test.mjs).
//
// Verdicts, in blast-radius order:
//
//   applyI18n (i18n.js)         FAIL-CLOSED HARDENED. The dictionary-import
//                               failure path set lang/dir from a dictionary
//                               that was not there, so an English page claimed
//                               lang="es" and sent screen readers down Spanish
//                               rules for English words. It now claims nothing
//                               without a dictionary; the write guards that
//                               never paint a raw key are unchanged.
//   handleWorkerRequest         FAIL-CLOSED BY DESIGN. Every failure is loud:
//     (worker-bridge.mjs)       an oversize body gets the bridge's own 413 and
//                               the worker never sees it; a worker throw
//                               propagates to serve-static's catch, which logs
//                               the cause and answers 500. No path returns a
//                               Response it did not receive.
//   fetchHourlyCached           FAIL-OPEN BY DESIGN, CORRECT. Every degraded
//     (nasa.js)                 layer is explicit (shape gate, window gate,
//                               corrupt-entry deletion) and a dead network
//                               rejects upward to fetchWeatherWithFallback,
//                               whose fallback names the offline source in the
//                               meta. Never a partial or invented series.
//   refreshSelectionOutputs     RENDER-ONLY, GUARDED (ui.js, test below runs
//                               the shipped function). A missing payload
//                               renders nothing; every downstream read is
//                               guarded; a throw skips the refresh and leaves
//                               the last truthful render — it cannot invent
//                               numbers from state that does not exist.
//   reset (location-picker.js)  FAIL-CLOSED BY DESIGN (test lives in
//                               tests/location-picker.test.mjs, which owns the
//                               picker's harness): it bumps the lookup
//                               generation and cancels the auto-resolve timer,
//                               so a pending resolution can never repaint a
//                               box that was reset. Coordinates are owned by
//                               onPick's caller and deliberately untouched.
//
// Scope: P0.6. No product threshold moves; one behavior change, on the
// dictionary-failure path only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { EventEmitter } from "node:events";

import { handleWorkerRequest } from "../scripts/lib/worker-bridge.mjs";
import { fetchHourlyCached } from "../assets/js/sizing/nasa.js";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

// ── applyI18n: the dictionary-failure path ────────────────────────────────
//
// The shipped function closes over LOCALES, so it is sliced out of the module
// and run in a context that supplies exactly those bindings — the same
// technique car 1 used for mergeReSlice. Nothing else in i18n.js is exercised.

const APPLY_SRC = (() => {
  const src = read("../assets/js/shared/i18n.js");
  const from = src.indexOf("async function applyI18n()");
  assert.notEqual(from, -1, "applyI18n must exist in i18n.js");
  const to = src.indexOf("export function initLangPicker", from);
  assert.notEqual(to, -1, "initLangPicker must follow applyI18n");
  return src.slice(from, to);
})();

function i18nNode(key, initial) {
  const attrs = { "data-i18n": key };
  return {
    textContent: initial,
    getAttribute: (name) => attrs[name] ?? null,
  };
}

function applySandbox({ locales, lang, elements = [] }) {
  const document = {
    documentElement: {},
    querySelectorAll(selector) {
      return selector === "[data-i18n]" ? elements : [];
    },
  };
  const sandbox = {
    localesReady: Promise.resolve(),
    resolveLang: () => lang,
    LOCALES: locales,
    document,
    window: {},
    translate: (key) => key,
  };
  vm.runInNewContext(
    `${APPLY_SRC}\nglobalThis.__applyI18n = applyI18n;`,
    sandbox,
  );
  return { sandbox, document };
}

test("top10 applyI18n: without a dictionary the page claims no language and paints no key", async () => {
  const node = i18nNode("advisorTitle", "English chrome");
  // Exactly what a failed locales.js import leaves behind (i18n.js's catch):
  // an English-only stub, with a visitor who asked for Spanish.
  const { sandbox, document } = applySandbox({
    locales: { en: {} },
    lang: "es",
    elements: [node],
  });

  await sandbox.__applyI18n();

  assert.equal(
    document.documentElement.lang,
    undefined,
    'an English page must not claim lang="es"',
  );
  assert.equal(
    document.documentElement.dir,
    undefined,
    "direction is a claim too: nothing is known without the dictionary",
  );
  assert.equal(
    node.textContent,
    "English chrome",
    "a missing key must never be painted — the server's text stands",
  );
});

test("top10 applyI18n: with a dictionary the claim and the write both still happen", async () => {
  const node = i18nNode("advisorTitle", "Advisor");
  const { sandbox, document } = applySandbox({
    locales: {
      en: {},
      es: { advisorTitle: "Asesor" },
      ar: { advisorTitle: "\u0645\u0633\u062a\u0634\u0627\u0631", rtl: true },
    },
    lang: "es",
    elements: [node],
  });

  await sandbox.__applyI18n();

  assert.equal(document.documentElement.lang, "es");
  assert.equal(document.documentElement.dir, "ltr");
  assert.equal(node.textContent, "Asesor");

  const rtl = applySandbox({
    locales: {
      en: {},
      es: { advisorTitle: "Asesor" },
      ar: { advisorTitle: "\u0645\u0633\u062a\u0634\u0627\u0631", rtl: true },
    },
    lang: "ar",
    elements: [],
  });
  await rtl.sandbox.__applyI18n();
  assert.equal(rtl.document.documentElement.lang, "ar");
  assert.equal(
    rtl.document.documentElement.dir,
    "rtl",
    "the guard must not flatten a real RTL locale",
  );
});

// ── handleWorkerRequest: loud on every failure ────────────────────────────

function fakeReq({ method = "GET", url = "/api/health", headers = {} } = {}) {
  const req = new EventEmitter();
  Object.assign(req, { method, url, headers, destroyed: false });
  req.destroy = () => {
    req.destroyed = true;
  };
  return req;
}

function fakeRes() {
  return {
    status: null,
    headers: null,
    body: null,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    },
  };
}

test("top10 handleWorkerRequest: an oversize body is the bridge's own 413, and the worker never sees it", async () => {
  const seen = [];
  const worker = {
    fetch: async (request) => {
      seen.push(request);
      return new Response("ok");
    },
  };
  const req = fakeReq({ method: "POST", url: "/api/chat" });
  const res = fakeRes();

  const pending = handleWorkerRequest(worker, req, res, { maxBodyBytes: 8 });
  req.emit("data", Buffer.alloc(64)); // over the cap: destroy + tooLarge
  const out = await pending;

  assert.equal(out, null, "a refused body produces no response object");
  assert.equal(res.status, 413, "the client is told, in the worker's absence");
  assert.match(String(res.body), /too large/i);
  assert.equal(
    req.destroyed,
    true,
    "the read stops instead of buffering a flood",
  );
  assert.equal(
    seen.length,
    0,
    "the worker must never be handed a body the bridge refused",
  );
});

test("top10 handleWorkerRequest: a worker that throws propagates instead of inventing a response", async () => {
  const boom = new Error("bridge must not invent a response");
  const worker = {
    fetch: async () => {
      throw boom;
    },
  };
  const req = fakeReq();
  const res = fakeRes();

  await assert.rejects(
    () => handleWorkerRequest(worker, req, res, {}),
    (err) => err === boom,
    "the cause reaches serve-static's catch, which logs it and answers 500",
  );
  assert.equal(
    res.status,
    null,
    "no response may be written for a request the worker never answered",
  );
  assert.equal(res.body, null);
});

// ── fetchHourlyCached: the failure belongs to the caller's fallback ───────

test("top10 fetchHourlyCached: a dead network rejects upward — no empty or partial series", async () => {
  const boom = new Error("network down");
  const failing = {
    impl: async () => {
      throw boom;
    },
  };

  await assert.rejects(
    fetchHourlyCached(
      {
        latitude: 21.31,
        longitude: -157.86,
        years: 2,
        fetchImpl: failing.impl,
      },
      null,
    ),
    (err) => err === boom,
    "the rejection must reach fetchWeatherWithFallback, which owns the honest offline story",
  );
});

// ── refreshSelectionOutputs: missing state renders nothing ────────────────

const REFRESH_SRC = (() => {
  const src = read("../assets/js/sizing/ui.js");
  const from = src.indexOf("async function refreshSelectionOutputs(p)");
  assert.notEqual(from, -1, "refreshSelectionOutputs must exist in ui.js");
  const to = src.indexOf("function updateShareHash(p, inp)", from);
  assert.notEqual(
    to,
    -1,
    "updateShareHash must follow refreshSelectionOutputs",
  );
  return src.slice(from, to);
})();

test("top10 refreshSelectionOutputs: a payload that does not exist renders nothing", async () => {
  const loads = [];
  const sandbox = {
    preloadRunModules: () => {
      loads.push("preload");
    },
  };
  vm.runInNewContext(
    `${REFRESH_SRC}\nglobalThis.__refresh = refreshSelectionOutputs;`,
    sandbox,
  );

  const out = await sandbox.__refresh(undefined);

  assert.equal(out, undefined);
  assert.deepEqual(
    loads,
    [],
    "without a payload the renderers must not even be loaded — a refresh that \
cannot happen must not half-happen",
  );
});
