import scriptDirections from "../../i18n/script-directions.json" with {
  type: "json",
};

const rightToLeftScripts = new Set(scriptDirections.rtlScripts);

/** Resolve paragraph direction from the locale's likely script. */
export function directionForLocale(locale) {
  try {
    const script = new Intl.Locale(locale).maximize().script;
    return rightToLeftScripts.has(script) ? "rtl" : "ltr";
  } catch {
    return "ltr";
  }
}
