// Tiny i18n applier: translates elements carrying data-i18n="key" and flips
// direction for RTL locales. Falls back to English silently. No network,
// no storage beyond the user's own language choice in localStorage.
import { LOCALES } from "./locales.js?v=20260921f";
import { interpolate, pickString } from "./interpolate.js?v=20260921f";

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

function chosen() {
  let saved = null;
  try {
    saved = localStorage.getItem("beco-lang");
  } catch {
    /* private mode */
  }
  if (saved && (saved === "auto" || LOCALES[saved] || saved === "en"))
    return saved;
  return "auto";
}

export function resolveLang() {
  const pick = chosen();
  if (pick !== "auto") return pick;
  const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
  return LOCALES[nav] ? nav : "en";
}

export function translate(key, vars = {}) {
  const lang = resolveLang();
  const dict = LOCALES[lang] || LOCALES.en;
  return interpolate(pickString(dict, key, LOCALES.en), vars);
}

export function applyI18n() {
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
