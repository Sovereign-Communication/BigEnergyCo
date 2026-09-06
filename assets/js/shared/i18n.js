// Tiny i18n applier: translates elements carrying data-i18n="key" and flips
// direction for RTL locales. Falls back to English silently. No network,
// no storage beyond the user's own language choice in localStorage.
import { LOCALES } from "./locales.js?v=20260906f";

const LANGS = [
  { id: "auto", label: "Auto" },
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "pt", label: "Português" },
  { id: "fr", label: "Français" },
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

export function applyI18n() {
  const lang = resolveLang();
  const dict = LOCALES[lang];
  document.documentElement.lang = lang;
  document.documentElement.dir = dict && dict.rtl ? "rtl" : "ltr";
  document.querySelectorAll("[data-i18n]").forEach((elNode) => {
    const key = elNode.getAttribute("data-i18n");
    if (!dict || typeof dict[key] !== "string") return; // English is the source markup
    elNode.textContent = dict[key];
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
