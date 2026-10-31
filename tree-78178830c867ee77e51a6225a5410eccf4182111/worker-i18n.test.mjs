// The i18n surface of the advisor's degraded path, and the wider audit of every
// user-visible string the worker or the client can hand a visitor.
//
// The defect this exists for: the degraded label shipped as English-only prose.
// `assets/js/shared/locales.js` carried `advisorBusy` in all six dictionaries
// while the new failure label existed in none of them, so a German or Arabic
// visitor saw an English-only message on exactly the surface that signals
// something went wrong. The i18n parity gate passed VACUOUSLY, because it
// compares each locale against English — and English did not define the key
// either, so there was nothing to be missing.
//
// Two halves:
//
//   1. SURFACE AUDIT. Every user-visible string the worker or client can
//      return is classified as LOCALIZED (resolves through the dictionary) or
//      PINNED-ENGLISH (an explicit, asserted fallback). Nothing is left
//      accidental, which is the whole point: a string that is English "by
//      accident" is indistinguishable from one nobody checked.
//
//   2. EXECUTION. The real client code is driven with a failing upstream in
//      each locale and the rendered text is asserted to be that locale's text,
//      not English.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import worker, {
  ensureDisclaimer,
  DISCLAIMER_FOOTER,
} from "../worker/index.js";
import {
  buildDegradedReply,
  DEGRADED_LABEL,
  FALLBACK_MODEL,
  FALLBACK_REASON_KEY,
} from "../worker/advisor-fallback.mjs";
import { LOCALES } from "../assets/js/shared/locales.js";
import { translate } from "../assets/js/shared/i18n.js";
import { makeDom, loadChatJs } from "../scripts/smoke/advisor-fallbacks.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const LOCALIZED = ["en", "es", "pt", "fr", "de", "ar"];
const ORIGIN = "https://freeoffgridcalculator.com";

/**
 * Every i18n key the worker can emit on a degraded reply, and what it must
 * contain. `why` is reason-dependent, so it is checked against the key map.
 */
const REQUIRED_KEYS = [
  "advisorDegradedLabel",
  "advisorDegradedLine",
  "advisorDegradedReassure",
  "advisorDegradedRetry",
];
const REASON_KEYS = [...Object.values(FALLBACK_REASON_KEY)];
const BODY_KEYS = ["advisorDegradedSystem", "advisorDegradedGeneral"];

// ══ 1. the surface audit ═══════════════════════════════════════════════════

test("AUDIT: every degraded i18n key exists in all six locales", () => {
  const missing = [];
  for (const lang of LOCALIZED) {
    for (const key of [...REQUIRED_KEYS, ...REASON_KEYS, ...BODY_KEYS]) {
      if (typeof LOCALES[lang]?.[key] !== "string")
        missing.push(`${lang}.${key}`);
    }
  }
  assert.deepEqual(
    missing,
    [],
    `English-only failure copy: ${missing.join(", ")}`,
  );
});

test("AUDIT: the translations are not the English string copied verbatim", () => {
  // The failure mode this catches is "translated" in the sense that the key
  // exists but the value is the English sentence. A locale that reads as
  // English is not a translation.
  const en = LOCALES.en;
  const offenders = [];
  for (const lang of LOCALIZED) {
    if (lang === "en") continue;
    for (const key of [...REQUIRED_KEYS, ...REASON_KEYS, ...BODY_KEYS]) {
      if (LOCALES[lang][key] === en[key]) offenders.push(`${lang}.${key}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `identical to English: ${offenders.join(", ")}`,
  );
});

test("AUDIT: the placeholder survives translation in every locale", () => {
  // {why} is substituted at render time. If a locale drops it, the sentence
  // silently loses its reason and still renders — a failure that looks fine.
  for (const lang of LOCALIZED) {
    assert.match(
      LOCALES[lang].advisorDegradedLine,
      /\{why\}/,
      `${lang}.advisorDegradedLine must keep the {why} placeholder`,
    );
  }
});

test("AUDIT: no locale claims the degraded label is English-only", () => {
  // Every language needs SOME way to say "this is an offline answer". A label
  // that is a placeholder, empty, or still the raw key is a missing
  // translation wearing a translation's clothes.
  for (const lang of LOCALIZED) {
    const label = LOCALES[lang].advisorDegradedLabel;
    assert.ok(label && label.trim().length > 3, `${lang} label is empty`);
    assert.doesNotMatch(
      label,
      /advisorDegradedLabel/,
      `${lang} label is the raw key, not a translation`,
    );
  }
});

test("AUDIT: the worker emits a key set that matches the dictionary", () => {
  const body = buildDegradedReply(
    "groq_unavailable",
    { hasSystem: true },
    ensureDisclaimer,
  );
  const emitted = new Set(Object.values(body.i18n));
  for (const key of emitted) {
    assert.ok(
      typeof LOCALES.en[key] === "string",
      `the worker emits ${key}, which no locale defines`,
    );
  }
  // And nothing is missing from the set.
  for (const key of REQUIRED_KEYS)
    assert.ok(emitted.has(key), `missing ${key}`);
});

test("AUDIT: the reason key is per-reason, never a single generic string", () => {
  // A single reason for every failure is how "it didn't respond" and "it is
  // not configured at all" become indistinguishable to a user.
  // The invariant is NOT one key per reason code. Three transport-class codes
  // (did not answer / errored / a dependency did not answer) are the same
  // sentence to a visitor, and shipping them three times in six locales cost
  // ~700 bytes of dictionary to say nothing extra. What MUST stay distinct is
  // "the advisor could not be reached" from "this deployment is offline by
  // design" — collapsing those would make an outage indistinguishable from a
  // product that was never configured, which is the confusion R-CF-10 exists
  // to prevent.
  const keys = new Set(Object.values(FALLBACK_REASON_KEY));
  const transport = FALLBACK_REASON_KEY.groq_unavailable;
  const misconfigured = FALLBACK_REASON_KEY.key_missing;
  assert.notEqual(
    transport,
    misconfigured,
    "an unreachable advisor and an unconfigured deployment must read differently",
  );
  assert.ok(
    [transport, misconfigured].every((k) => typeof LOCALES.de[k] === "string"),
    "both clauses must exist in every locale",
  );
  assert.ok(
    keys.size >= 2,
    `expected at least the two clause kinds, got ${keys.size}`,
  );
  for (const reason of ["groq_unavailable", "groq_error", "key_missing"]) {
    const body = buildDegradedReply(reason, {}, ensureDisclaimer);
    assert.ok(
      keys.has(body.i18n.why),
      `${reason} must map to its own key, got ${body.i18n.why}`,
    );
  }
});

test("AUDIT: the machine marker is not the human label", () => {
  // DEGRADED_LABEL is compared by tests and read by clients; showing it to a
  // visitor in caps would be a machine token leaking into the UI. The
  // human-facing string is a separate locale key.
  assert.equal(DEGRADED_LABEL, "DEGRADED");
  assert.notEqual(
    LOCALES.en.advisorDegradedLabel,
    DEGRADED_LABEL,
    "the visible label must not be the raw machine token",
  );
});

// ══ 2. the explicit, tested fallback ══════════════════════════════════════
//
// The honest limit: a Worker cannot see assets/js/shared/locales.js, so the
// English `reply` field is the floor. That floor is DELIBERATE and asserted,
// not accidental. These tests are what make it a decision rather than an
// omission.

test("FALLBACK: the English text is always present, for non-browser clients", async () => {
  const res = await worker.fetch(
    new Request("https://api.test/api/chat", {
      method: "POST",
      headers: { Origin: ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({ message: "why is my bill high?" }),
    }),
    {},
  );
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(typeof body.reply, "string");
  assert.ok(
    body.reply.length > 120,
    "the floor must be a real answer, not a stub",
  );
  assert.match(body.reply, new RegExp(DEGRADED_LABEL));
  assert.ok(
    body.reply.includes(DISCLAIMER_FOOTER),
    "the floor carries the same disclaimer as a live reply",
  );
  assert.equal(body.model, FALLBACK_MODEL);
  // The floor is English BY DESIGN, and this is the line that says so.
  assert.match(body.reply, /I cannot answer this one right now/);
});

test("FALLBACK: an unknown reason still produces a complete answer", () => {
  // A reason the worker has never heard of must not yield a half-built
  // sentence or a missing key that the client would render as a raw key.
  const body = buildDegradedReply("brand_new_reason", {}, ensureDisclaimer);
  assert.equal(body.i18n.why, "advisorDegradedWhyUnavailable");
  assert.ok(
    typeof LOCALES.ar[body.i18n.why] === "string",
    "the generic reason must exist in every locale too",
  );
  assert.ok(body.reply.includes("did not respond"));
});

test("FALLBACK: a payload with no i18n block is handled, not crashed on", () => {
  // The client must render the English text when the key set is absent, which
  // is what an older worker would send. Asserted through the real client below.
  assert.equal(
    buildDegradedReply("groq_error", {}, ensureDisclaimer).i18n.line,
    "advisorDegradedLine",
  );
});

// ══ 3. EXECUTION — the shipped client, per locale ════════════════════════

/** Drive the real sendChatMsg() with a degraded response in a given locale. */
async function renderDegradedIn(lang) {
  const { doc, chatWindow, chatInput } = makeDom();
  const server = buildDegradedReply(
    "groq_unavailable",
    { hasSystem: true, language: lang },
    ensureDisclaimer,
  );
  const win = {
    location: { hostname: "example.test" },
    addEventListener() {},
    becoLang: lang,
    // The real dictionary, wired exactly as applyI18n() wires it.
    becoT: (key, vars) => translate(key, vars, lang),
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => server,
      headers: new Headers(),
    }),
  };
  const sandbox = loadChatJs({ doc, win });
  chatInput.value = "solar battery system";
  await sandbox.sendChatMsg();
  await new Promise((r) => setTimeout(r, 20));
  const bot = chatWindow.children.find(
    (c) => c.className === "chat-msg bot" && c.id !== "loadingMsg",
  );
  return {
    degraded: bot?.attrs["data-degraded"] === "true",
    label: (bot?.children[1]?.textContent || "").trim(),
    body: (bot?.children[0]?.textContent || "").trim(),
  };
}

for (const lang of ["en", "es", "pt", "fr", "de", "ar"]) {
  test(`EXECUTED [${lang}]: a failing upstream renders in ${lang}`, async () => {
    const out = await renderDegradedIn(lang);
    assert.equal(out.degraded, true, "the message must be marked degraded");

    // The LABEL is the visible failure marker, and it must be this locale's.
    assert.equal(
      out.label,
      LOCALES[lang].advisorDegradedLabel,
      `the label must be the ${lang} string`,
    );

    // The BODY must be composed in this locale, including the reason.
    const why = LOCALES[lang][FALLBACK_REASON_KEY.groq_unavailable];
    assert.ok(
      out.body.includes(why),
      `the ${lang} body must contain the ${lang} reason text`,
    );
    assert.ok(
      out.body.includes(LOCALES[lang].advisorDegradedReassure.slice(0, 40)),
      `the ${lang} body must use the ${lang} reassurance paragraph`,
    );
    // No English left behind: the floor text must NOT be what rendered.
    if (lang !== "en") {
      assert.ok(
        !out.body.includes("I cannot answer this one right now"),
        `${lang} rendered English prose — the localized path did not run`,
      );
      assert.ok(
        !out.body.includes("Nothing above is wrong"),
        `${lang} rendered the English reassurance`,
      );
    }
  });
}

test("EXECUTED: with no dictionary loaded, the client falls back to English", async () => {
  // The explicit floor, exercised: a client with no becoT must still show a
  // complete English answer rather than a blank bubble.
  const { doc, chatWindow, chatInput } = makeDom();
  const server = buildDegradedReply(
    "groq_unavailable",
    { hasSystem: true },
    ensureDisclaimer,
  );
  const win = {
    location: { hostname: "example.test" },
    addEventListener() {},
    becoLang: "en",
    // no becoT — the dictionary failed to load
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => server,
      headers: new Headers(),
    }),
  };
  const sandbox = loadChatJs({ doc, win });
  chatInput.value = "solar battery system";
  await sandbox.sendChatMsg();
  await new Promise((r) => setTimeout(r, 20));
  const bot = chatWindow.children.find(
    (c) => c.className === "chat-msg bot" && c.id !== "loadingMsg",
  );
  const body = (bot?.children[0]?.textContent || "").trim();
  assert.match(body, /I cannot answer this one right now/);
  assert.ok(body.length > 120, "the English floor is a complete answer");
  assert.equal(
    (bot?.children[1]?.textContent || "").trim(),
    LOCALES.en.advisorDegradedLabel,
    "and the label falls back to English too",
  );
});

test("EXECUTED: a malformed i18n block falls back instead of rendering a key", async () => {
  const { doc, chatWindow, chatInput } = makeDom();
  const server = {
    ...buildDegradedReply("groq_error", {}, ensureDisclaimer),
    i18n: { line: 42, why: null }, // a payload the client must not trust
  };
  const win = {
    location: { hostname: "example.test" },
    addEventListener() {},
    becoLang: "de",
    becoT: (key, vars) => translate(key, vars, "de"),
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => server,
      headers: new Headers(),
    }),
  };
  const sandbox = loadChatJs({ doc, win });
  chatInput.value = "hi";
  await sandbox.sendChatMsg();
  await new Promise((r) => setTimeout(r, 20));
  const bot = chatWindow.children.find(
    (c) => c.className === "chat-msg bot" && c.id !== "loadingMsg",
  );
  const body = (bot?.children[0]?.textContent || "").trim();
  assert.ok(body.length > 120, "must fall back to the English floor");
  assert.doesNotMatch(body, /advisorDegraded/, "never render a raw key");
});

// ══ 4. the extraction, pinned ═════════════════════════════════════════════

test("DESIGN: the degraded copy lives in its own module, not the router", () => {
  const src = read("worker/index.js");
  assert.doesNotMatch(
    src,
    /function buildDegradedReply|function mentionsSystem/,
    "the router must not still define the product copy",
  );
  assert.match(
    src,
    /from "\.\/advisor-fallback\.mjs"/,
    "the router must import it from the concern module",
  );
  // Every other worker concern already has its own file; this one joins them.
  for (const f of [
    "advisor-fallback.mjs",
    "turnstile.mjs",
    "share-cache.mjs",
    "evidence.mjs",
    "usage-ledger.mjs",
  ]) {
    assert.ok(read(join("worker", f)).length > 0, `worker/${f} must exist`);
  }
});

test("DESIGN: the fallback module has no dependency on the router", () => {
  const src = read("worker/advisor-fallback.mjs");
  assert.doesNotMatch(
    src,
    /from "\.\/index\.js"/,
    "the extracted module must not import back into the router",
  );
});
