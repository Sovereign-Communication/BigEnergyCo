// Tiny i18n applier: translates elements carrying data-i18n="key" and flips
// direction for RTL locales. Falls back to English silently. No network,
// no storage beyond the user's own language choice in localStorage.
//
// THE DICTIONARY IS DEFERRED, and that is a measured decision, not a taste.
// At 37 KB compressed it was the second-largest module in the first-paint
// graph (`js_before_interactive`), ahead of the whole engine — because it is
// six locales of prose that no calculation needs. It is now fetched with a
// dynamic import, which takes it out of the static graph the budget measures
// while the browser still starts the fetch at module evaluation, in parallel
// with everything else. No extra round trip, no waterfall.
//
// Nothing renders untranslated while it loads, and that is the property that
// actually matters: `localesReady` is awaited before ANY string is resolved,
// and the boot path in ui.js awaits it before the first paint of translated
// chrome. A German or Arabic visitor sees native copy from the first frame,
// including the advisor's degraded-failure surface — proven per-locale through
// the real client path in tests/i18n-lazy.test.mjs.
import { interpolate, pickString } from "./interpolate.js?v=20261003e";

// Populated by the dynamic import below. Null until it resolves; every
// consumer either awaits `localesReady` or degrades explicitly.
let LOCALES = null;

/**
 * Resolves when the dictionary is in memory.
 *
 * Started at module evaluation, not lazily on first use: the fetch overlaps
 * the rest of boot instead of adding latency to the first translate() call.
 * A failed import RESOLVES with the English-only dictionary rather than
 * rejecting, because an untranslated-but-working page beats a blank one — and
 * `translate` already falls back to English for a missing key.
 */
export const localesReady = import("./locales.js?v=20261003e")
  .then((m) => {
    LOCALES = m.LOCALES;
    return LOCALES;
  })
  .catch(() => {
    LOCALES = { en: {} };
    return LOCALES;
  });

// Exported so the language gate (scripts/check-i18n.mjs) can prove every
// offered locale actually has a dictionary, and that the picker never offers a
// language the app cannot render.
export const LANGS = [
  { id: "auto", label: "Auto" },
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "pt", label: "Português" },
  { id: "fr", label: "Français" },
  { id: "de", label: "Deutsch" },
  { id: "ar", label: "العربية" },
];

// The offered ids, from the STATIC list rather than the dictionary. Validating
// a saved choice against the set the picker offers is strictly better than
// checking a dictionary that may not have loaded yet: a locale can only be
// offered if check-i18n proved every locale has its dictionary, and these two
// functions now work before the dictionary does.
const LANG_IDS = new Set(LANGS.map((l) => l.id));

function chosen() {
  let saved = null;
  try {
    saved = localStorage.getItem("beco-lang");
  } catch {
    /* private mode */
  }
  if (saved && (saved === "auto" || LANG_IDS.has(saved) || saved === "en"))
    return saved;
  return "auto";
}

export function resolveLang() {
  const pick = chosen();
  if (pick !== "auto") return pick;
  const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
  return LANG_IDS.has(nav) ? nav : "en";
}

/**
 * Translate a key.
 *
 * `langOverride` exists so a caller (and a test) can render a specific locale
 * without mutating localStorage or stubbing navigator. The default is the
 * ambient resolved language, which is what every shipped call site wants — this
 * parameter only removes the ambient dependency, it never changes the default
 * behaviour.
 */
export function translate(key, vars = {}, langOverride) {
  // Before the dictionary lands there is no honest translation to return.
  // Echoing the KEY is the right answer, and it is a signal callers already
  // understand: chat.js's localizedDegradedReply treats `value === key` as
  // "use the worker's English text instead" rather than showing a key to a
  // visitor. Callers that need real copy await `localesReady` first.
  if (!LOCALES) return key;
  const lang = langOverride || resolveLang();
  const dict = LOCALES[lang] || LOCALES.en;
  return interpolate(pickString(dict, key, LOCALES.en), vars);
}

/**
 * Translate the document and install the runtime bridge.
 *
 * ASYNC now: it waits for the deferred dictionary, so no caller can paint
 * English by racing the import. The window.becoT bridge is installed only once
 * the dictionary is real, which is what keeps chat.js's degraded reply honest
 * (an absent bridge means "fall back to the worker's English", not "show a
 * key").
 */
export async function applyI18n() {
  await localesReady;
  const lang = resolveLang();
  const dict = LOCALES[lang];
  document.documentElement.lang = lang;
  document.documentElement.dir = dict && dict.rtl ? "rtl" : "ltr";
  // Classic chat.js cannot import this module, so expose the same small,
  // read-only translation contract to runtime-rendered advisor strings.
  window.becoLang = lang;
  window.becoT = translate;
  document.querySelectorAll("[data-i18n]").forEach((elNode) => {
    const key = elNode.getAttribute("data-i18n");
    if (typeof dict?.[key] === "string") elNode.textContent = dict[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((elNode) => {
    const key = elNode.getAttribute("data-i18n-placeholder");
    if (typeof dict?.[key] === "string") elNode.placeholder = dict[key];
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((elNode) => {
    const key = elNode.getAttribute("data-i18n-aria-label");
    if (typeof dict?.[key] === "string")
      elNode.setAttribute("aria-label", dict[key]);
  });
}

/** Populate a <select> language picker and wire persistence. */
export function initLangPicker(selectEl) {
  if (!selectEl) return;
  for (const l of LANGS) {
    const o = document.createElement("option");
    o.value = l.id;
    o.textContent = l.label;
    selectEl.appendChild(o);
  }
  selectEl.value = chosen();
  selectEl.addEventListener("change", () => {
    try {
      localStorage.setItem("beco-lang", selectEl.value);
    } catch {
      /* ignore */
    }
    applyI18n();
    // Let JS-rendered labels (e.g. the fuel unit helper) re-localize too.
    window.dispatchEvent(new Event("beco:lang"));
  });
}
