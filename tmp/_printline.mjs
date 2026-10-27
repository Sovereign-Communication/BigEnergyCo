import {
  EXPERIENCE_ACTIONS,
  EXPERIENCE_EMPTY_STATES,
  EXPERIENCE_ERRORS,
  EXPERIENCE_LOCALES,
  LOCALE_PHASES,
  LOCALE_SURFACES,
  composeTranslationFacetLine,
} from '../scripts/lib/experience-budgets.mjs';
import { LOCALES } from '../assets/js/shared/locales.js';

function goodAction(id) {
  const spec = EXPERIENCE_ACTIONS.find((a) => a.id === id);
  return {
    id,
    label: spec.label,
    kind: spec.kind,
    attempted: true,
    acknowledged: true,
    moved: ['status'],
    ms: 90,
    acknowledged_before_result: true,
    status: 'a plausible status line',
  };
}

function goodError(id) {
  const spec = EXPERIENCE_ERRORS.find((e) => e.id === id);
  return {
    id,
    label: spec.label,
    triggered: true,
    acknowledged: true,
    status: 'Something went wrong — enter a figure in that range and try again.',
    next_step: true,
  };
}

function goodEmpty(id) {
  const spec = EXPERIENCE_EMPTY_STATES.find((e) => e.id === id);
  return {
    id,
    label: spec.label,
    selector: spec.selector,
    ok: true,
    visible: true,
    controls: 0,
    text: 'Enter something and the estimate appears here.',
    invites: true,
    blank_while_visible: false,
    raw_key: false,
  };
}

const i18nSnapshot = (locale) =>
  [
    ['text', LOCALE_SURFACES[0].key],
    ['placeholder', 'advisorPlaceholder'],
    ['aria-label', 'advisorTitle'],
  ].map(([field, key]) => ({ field, key, value: LOCALES[locale][key] }));

function goodLocalePass(locale, phase) {
  return {
    locale,
    phase,
    lang: locale,
    dir: locale === 'ar' ? 'rtl' : 'ltr',
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
  };
}

const healthy = {
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
};

const full = {
  experience_reading: healthy,
  translation_terminology: { checked: 56, passed: 56 },
  translation_suggestion: { passed: true },
};
for (const [name, report] of [
  ['bare', { experience_reading: healthy }],
  ['full', full],
]) {
  const line = composeTranslationFacetLine(report);
  console.log(name, line.length, JSON.stringify(line));
}
