// The deterministic degraded advisor reply (B2 / R-CF-10).
//
// Extracted from worker/index.js, which was mixing six concerns and had ~90
// lines of product copy sitting in the middle of the router. It lives here
// beside turnstile.mjs / share-cache.mjs / evidence.mjs, which is where every
// other worker concern already has a home. Behaviour is unchanged: same text,
// same shape, same determinism.
//
// WHY IT EXISTS. The advisor depends on two third parties (Groq for the words,
// TypeSafe/Jev for the truthfulness score). Either can rate-limit, time out, or
// be down at the exact moment someone asks a question. Before this existed,
// that presented as a dead chat box.
//
// So the failure has a fixed, pre-written, DETERMINISTIC shape: no template
// filled from live state, no random numbers, no second upstream to fail. A
// degradation the visitor can see is honest; a blank box is not.
//
// ── LANGUAGE, and the honest limit of this module ──────────────────────────
// A Worker has no access to assets/js/shared/locales.js — that is client-side
// chrome, it is never shipped to the edge, and importing it here would put a
// 1,900-line dictionary in the worker's bundle for no server-side benefit.
//
// So this module emits the reply in TWO forms, and says so rather than letting
// it happen by accident:
//
//   reply  the canonical English text. Always present. What a curl, a script,
//          or any non-browser client reads, and what the client falls back to.
//   i18n   the key set the CLIENT resolves through assets/js/shared/locales.js
//          in the visitor's own language. Absent on nothing — it is on every
//          degraded response.
//
// A browser visitor gets the translated text; an API consumer gets English.
// The one string that CANNOT be localized is DEGRADED_LABEL, because it is the
// machine-readable marker the server sets and the client keys its visible
// badge off; it travels as `label` for machines and is re-rendered through
// `advisorDegradedLabel` for humans. That split is deliberate and is pinned by
// tests/worker-i18n.test.mjs.

/**
 * Machine-readable degradation marker. Deliberately a stable ASCII token, not
 * a sentence: it is compared by tests, read by clients, and never displayed
 * directly — the human-facing label is `advisorDegradedLabel` in the locales.
 */
export const DEGRADED_LABEL = "DEGRADED";

/** The stable model name a degraded reply reports. Also asserted by tests. */
export const FALLBACK_MODEL = "deterministic-fallback";

/**
 * Which locale key explains each failure reason. The reason strings
 * themselves are English (a Worker cannot see the dictionary), so the key is
 * the contract the client resolves; `FALLBACK_REASON_TEXT` remains as the
 * English text for non-browser consumers.
 */
export const FALLBACK_REASON_KEY = {
  groq_unavailable: "advisorDegradedWhyUnavailable",
  groq_error: "advisorDegradedWhyError",
  key_missing: "advisorDegradedWhyNoKey",
};

/** English text for each reason — what a non-browser consumer reads. */
export const FALLBACK_REASON_TEXT = {
  groq_unavailable:
    "the language model that writes these answers did not respond",
  groq_error: "the language model that writes these answers returned an error",
  key_missing:
    "this deployment has no language-model key configured, so the advisor is offline by design",
};

const GENERIC_REASON_TEXT = "a service this advisor depends on did not respond";
const GENERIC_REASON_KEY = "advisorDegradedWhyGeneric";

/**
 * Whether the visitor is talking about a system they already sized.
 *
 * Only used to pick which half of the fallback to show, and it is a
 * conservative keyword test on the visitor's OWN text - never on anything the
 * model produced. `buildIntakeBrief()` in assets/js/chat.js opens with
 * "Please size an off-grid battery system for me", which is the phrase the
 * calculator-generated brief always contains.
 */
export function mentionsSystem(message) {
  const t = String(message || "").toLowerCase();
  return (
    /\bsystem\b/.test(t) ||
    /\bpanel/.test(t) ||
    /\bbatter/.test(t) ||
    /\bkwh\b/.test(t) ||
    /\bkwp\b/.test(t) ||
    /\bsolar\b/.test(t)
  );
}

/**
 * Build the degraded reply.
 *
 * Returns BOTH the canonical English text and the i18n key set. `ensureDisclaimer`
 * is injected rather than imported so this module has no dependency on the
 * router — the caller passes the same function the live-reply path uses, so the
 * footer on a degraded reply is byte-identical to the footer on a live one.
 */
export function buildDegradedReply(
  reason,
  opts = {},
  ensureDisclaimer = (s) => s,
) {
  const lang = typeof opts.language === "string" ? opts.language : "en";
  const hasSystem = !!(opts.hasSystem && String(opts.hasSystem).trim());
  const why = FALLBACK_REASON_TEXT[reason] || GENERIC_REASON_TEXT;
  const whyKey = FALLBACK_REASON_KEY[reason] || GENERIC_REASON_KEY;

  const lines = [
    `${DEGRADED_LABEL}: I cannot answer this one right now — ${why}.`,
    "",
    "Nothing above is wrong, and your sizing is unaffected: every number on",
    "this site is computed in your own browser from open weather and price",
    "data, so it works with no server and no connection at all. This advisor",
    "is the only part that needs the network, and it is the only part that",
    "can go quiet.",
    "",
  ];

  if (hasSystem) {
    lines.push(
      "Your sizing result on this page stands as calculated. Take those",
      "numbers to a licensed electrician or engineer before you buy or build",
      "anything.",
      "",
    );
  } else {
    lines.push(
      "For a specific question about battery sizing, the calculator above",
      "sizes a system from your bill or your daily kWh, your location's sun",
      "and temperature, and your target autonomy — no account needed.",
      "",
    );
  }

  lines.push(
    "Try this question again in a minute; the free upstream quota is shared",
    "and often frees up quickly.",
  );

  return {
    reply: ensureDisclaimer(lines.join("\n")),
    degraded: true,
    reason,
    model: FALLBACK_MODEL,
    label: DEGRADED_LABEL,
    language: lang,
    // The client resolves these through assets/js/shared/locales.js. `why` is
    // a KEY here, not text, so the client substitutes the reason in its own
    // language rather than showing an English clause inside a translated
    // sentence.
    i18n: {
      label: "advisorDegradedLabel",
      line: "advisorDegradedLine",
      why: whyKey,
      reassure: "advisorDegradedReassure",
      body: hasSystem ? "advisorDegradedSystem" : "advisorDegradedGeneral",
      retry: "advisorDegradedRetry",
    },
  };
}
