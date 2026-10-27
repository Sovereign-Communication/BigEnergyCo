// Scratch: reproduce the test's HEALTHY fixture and measure the composed
// translation line against the 280-char clip.
import {
  EXPERIENCE_ACTIONS,
  EXPERIENCE_EMPTY_STATES,
  EXPERIENCE_ERRORS,
  EXPERIENCE_LOCALES,
  LOCALE_PHASES,
  LOCALE_SURFACES,
  composeTranslationFacetLine,
  summariseLocaleSweep,
} from "../scripts/lib/experience-budgets.mjs";
import { LOCALES } from "../assets/js/shared/locales.js";

const goodAction = (id) => {
  const spec = EXPERIENCE_ACTIONS.find((a) => a.id === id);
  return {
    id,
    label: spec.label,
    kind: spec.kind,
    attempted: true,
    acknowledged: true,
    moved: ["status"],
    ms: 90,
    acknowledged_before_result: true,
    status: "a plausible status line",
  };
};
const goodError = (id) => {
  const spec = EXPERIENCE_ERRORS.find((e) => e.id === id);
  return {
    id,
    label: spec.label,
    triggered: true,
    acknowledged: true,
    status: "Something went wrong — enter a figure in that range and try again.",
    next_step: true,
  };
};
const goodEmpty = (id) => {
  const spec = EXPERIENCE_EMPTY_STATES.find((e) => e.id === id);
  return {
    id,
    label: spec.label,
    selector: spec.selector,
    ok: true,
    visible: true,
    controls: 0,
    text: "Enter something and the estimate appears here.",
    invites: true,
    blank_while_visible: false,
    raw_key: false,
  };
};
const i18nSnapshot = (locale) =>
  [
    ["text", LOCALE_SURFACES[0].key],
    ["placeholder", "advisorPlaceholder"],
    ["aria-label", "advisorTitle"],
  ].map(([field, key]) => ({ field, key, value: LOCALES[locale][key] }));
const goodLocalePass = (locale, phase) => ({
  locale,
  phase,
  lang: locale,
  dir: locale === "ar" ? "rtl" : "ltr",
  beco_lang: locale,
  picker: locale,
  ready: true,
  i18n_snapshot: i18nSnapshot(locale),
  surfaces: LOCALE_SURFACES.map((s) => ({
    id: s.id,
    key: s.key,
    exists: true,
    text: LOCALES[locale][s.key],
    visible: true,
    raw_key: false,
  })),
  leaks: [],
});
const HEALTHY = () => ({
  ok: true,
  actions: EXPERIENCE_ACTIONS.map((a) => goodAction(a.id)),
  errors: EXPERIENCE_ERRORS.map((e) => goodError(e.id)),
  empty_states: EXPERIENCE_EMPTY_STATES.map((e) => goodEmpty(e.id)),
  locales: EXPERIENCE_LOCALES.flatMap((l) =>
    LOCALE_PHASES.map((p) => goodLocalePass(l, p)),
  ),
  key_leaks: [],
  at: {
    ran: true,
    violations: [],
    counts: { critical: 0, serious: 0, moderate: 0, minor: 0 },
    incomplete: 0,
  },
});

const reading = HEALTHY();
const line = composeTranslationFacetLine({ experience_reading: reading });
console.log(line);
console.log("length:", line.length);
const s = summariseLocaleSweep(reading);
console.log("sweep:", JSON.stringify(s));
