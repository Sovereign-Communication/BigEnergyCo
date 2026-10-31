// One locale dictionary is loaded on demand. The picker remains available
// before it arrives, while callers that render copy await localesReady.
import { directionForLocale } from "./direction.js?v=20261015d";
import { interpolate, pickString } from "./interpolate.js?v=20261015d";

const LOCALE_VERSION = "20261015d";
const localePromises = new Map();
const localeCache = new Map();
let activeLang = null;
let activeDictionary = null;
let activeFormattingLocale = null;

export const LANGS = [
  { id: "auto", labelKey: "languageAuto" },
  { id: "en", labelKey: "languageEnglish" },
  { id: "es", labelKey: "languageSpanish" },
  { id: "pt", labelKey: "languagePortuguese" },
  { id: "fr", labelKey: "languageFrench" },
  { id: "de", labelKey: "languageGerman" },
  { id: "ar", labelKey: "languageArabic" },
];

const LANG_IDS = new Set(
  LANGS.map(({ id }) => id).filter((id) => id !== "auto"),
);

function chosen() {
  try {
    const saved = localStorage.getItem("beco-lang");
    return saved === "auto" || LANG_IDS.has(saved) ? saved : "auto";
  } catch {
    return "auto";
  }
}

function browserLanguage() {
  return navigator.languages?.[0] || navigator.language || "en";
}

export function resolveLang() {
  const pick = chosen();
  if (pick !== "auto") return pick;
  let language = "en";
  try {
    language = new Intl.Locale(browserLanguage()).language.toLowerCase();
  } catch {
    language = browserLanguage().slice(0, 2).toLowerCase();
  }
  return LANG_IDS.has(language) ? language : "en";
}

function directionLocale() {
  const pick = chosen();
  return pick === "auto" ? browserLanguage() : pick;
}

function formattingLocale() {
  return activeFormattingLocale || directionLocale();
}

/** Load and memoize only the selected locale's JSON file. */
export function loadLocale(lang) {
  const locale = LANG_IDS.has(lang) ? lang : "en";
  if (localeCache.has(locale)) return Promise.resolve(localeCache.get(locale));
  if (!localePromises.has(locale)) {
    const url = `../../i18n/${locale}.json?v=${LOCALE_VERSION}`;
    const pending = import(url, { with: { type: "json" } }).then((module) => {
      localeCache.set(locale, module.default);
      return module.default;
    });
    localePromises.set(locale, pending);
  }
  return localePromises.get(locale);
}

async function activateLocale(lang) {
  try {
    activeDictionary = await loadLocale(lang);
    activeLang = lang;
    activeFormattingLocale = directionLocale();
  } catch {
    activeLang = lang;
    activeFormattingLocale = directionLocale();
    try {
      activeDictionary = await loadLocale("en");
    } catch {
      activeDictionary = {};
    }
  }
  return activeDictionary;
}

export const localesReady = activateLocale(resolveLang());

/** Translate a key with named placeholders, using the active dictionary. */
export function translate(key, vars = {}, langOverride) {
  const lang = langOverride || activeLang || resolveLang();
  const dict =
    localeCache.get(lang) || (lang === activeLang ? activeDictionary : null);
  const english =
    localeCache.get("en") || (activeLang === "en" ? activeDictionary : null);
  return interpolate(pickString(dict, key, english), vars);
}

/** Locale-aware formatting helpers shared by UI rendering paths. */
export function formatNumber(value, options = {}, locale = formattingLocale()) {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatCurrency(
  value,
  currency,
  options = {},
  locale = formattingLocale(),
) {
  return new Intl.NumberFormat(locale, {
    ...options,
    style: "currency",
    currency,
  }).format(value);
}

export function formatPercent(
  value,
  options = {},
  locale = formattingLocale(),
) {
  return new Intl.NumberFormat(locale, {
    ...options,
    style: "percent",
  }).format(value);
}

export function formatDate(value, options = {}, locale = formattingLocale()) {
  return new Intl.DateTimeFormat(locale, options).format(value);
}

export function pluralCategory(value, locale = formattingLocale()) {
  return new Intl.PluralRules(locale).select(value);
}

/** Format a count with locale-specific plural unit copy. */
export function formatUnitCount(count, unit, locale = formattingLocale()) {
  let language = "en";
  try {
    language = new Intl.Locale(locale).language;
  } catch {
    language = "en";
  }
  if (!LANG_IDS.has(language)) language = "en";
  const category = pluralCategory(count, locale);
  return translate(
    "timeCount",
    {
      count: formatNumber(count, {}, locale),
      unit: translate(`timeUnit${unit}_${category}`, {}, language),
    },
    language,
  );
}

function setLocalizedContent(node, value) {
  const slots = [...node.querySelectorAll("[data-i18n-slot]")].filter(
    (slot) =>
      slot.matches("[data-i18n]") || slot.closest("[data-i18n]") === node,
  );
  if (!slots.length) {
    node.textContent = value;
    return;
  }

  const slotsByName = new Map(
    slots.map((slot) => [slot.getAttribute("data-i18n-slot"), slot]),
  );
  const matches = [...value.matchAll(/\{([A-Za-z][\w-]*)\}/g)];
  const names = matches.map((match) => match[1]);
  if (
    names.length !== slots.length ||
    new Set(names).size !== names.length ||
    names.some((name) => !slotsByName.has(name))
  ) {
    console.error(
      "Invalid localized content slots for",
      node.getAttribute("data-i18n"),
    );
    return;
  }

  const fragment = document.createDocumentFragment();
  let cursor = 0;
  for (const match of matches) {
    fragment.append(document.createTextNode(value.slice(cursor, match.index)));
    fragment.append(slotsByName.get(match[1]));
    cursor = match.index + match[0].length;
  }
  fragment.append(document.createTextNode(value.slice(cursor)));
  node.replaceChildren(fragment);
}

/** Apply the current dictionary and script-based direction to the document. */
export async function applyI18n() {
  const lang = resolveLang();
  await activateLocale(lang);
  const dict = activeDictionary;
  document.documentElement.lang = lang;
  document.documentElement.dir = directionForLocale(directionLocale());
  window.becoLang = lang;
  window.becoT = translate;
  window.becoFormatNumber = formatNumber;
  window.becoFormatCurrency = formatCurrency;

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    if (typeof dict?.[key] === "string") setLocalizedContent(node, dict[key]);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    const key = node.getAttribute("data-i18n-placeholder");
    if (typeof dict?.[key] === "string") node.placeholder = dict[key];
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    const key = node.getAttribute("data-i18n-aria-label");
    if (typeof dict?.[key] === "string")
      node.setAttribute("aria-label", dict[key]);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((node) => {
    const key = node.getAttribute("data-i18n-title");
    if (typeof dict?.[key] === "string") node.setAttribute("title", dict[key]);
  });
  document.querySelectorAll("[data-i18n-currency-value]").forEach((node) => {
    const amount = Number(node.getAttribute("data-i18n-currency-value"));
    if (Number.isFinite(amount))
      node.textContent = formatCurrency(amount, "USD", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
  });
  document.querySelectorAll("[data-i18n-date-value]").forEach((node) => {
    const value = node.getAttribute("data-i18n-date-value");
    const date = new Date(`${value}T12:00:00Z`);
    if (value && Number.isFinite(date.getTime()))
      node.textContent = formatDate(date, {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
  });
}

/** Populate the picker and rerender only after the selected locale is ready. */
export function initLangPicker(selectEl) {
  if (!selectEl) return;
  for (const locale of LANGS) {
    const option = document.createElement("option");
    option.value = locale.id;
    option.dataset.i18n = locale.labelKey;
    option.textContent = translate(locale.labelKey);
    selectEl.appendChild(option);
  }
  selectEl.value = chosen();
  selectEl.addEventListener("change", () => {
    try {
      localStorage.setItem("beco-lang", selectEl.value);
    } catch {
      /* ignore */
    }
    void applyI18n().then(() => window.dispatchEvent(new Event("beco:lang")));
  });
}
