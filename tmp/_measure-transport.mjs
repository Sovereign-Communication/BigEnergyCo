import {
  composeExperienceFacetLine,
  composeTranslationFacetLine,
} from '../scripts/lib/experience-budgets.mjs';
import {
  EXPERIENCE_ACTIONS,
  EXPERIENCE_EMPTY_STATES,
  EXPERIENCE_ERRORS,
  EXPERIENCE_LOCALES,
  LOCALE_PHASES,
  LOCALE_SURFACES,
} from '../scripts/smoke/experience.mjs';
import { LOCALES } from '../assets/js/shared/locales.js';

const reading = {
  ok: true,
  actions: EXPERIENCE_ACTIONS.map((a) => ({
    id: a.id,
    label: a.label,
    kind: a.kind,
    attempted: true,
    acknowledged: true,
    ms: 90,
    acknowledged_before_result: true,
  })),
  errors: EXPERIENCE_ERRORS.map((e) => ({
    id: e.id,
    label: e.label,
    triggered: true,
    status: 'Something failed — enter a figure in that range and try again.',
    next_step: true,
  })),
  empty_states: EXPERIENCE_EMPTY_STATES.map((e) => ({
    id: e.id,
    label: e.label,
    selector: e.selector,
    ok: true,
    visible: true,
    controls: 0,
    text: 'Enter something and the estimate appears here.',
    invites: true,
    blank_while_visible: false,
    raw_key: false,
  })),
  key_leaks: [],
  locales: EXPERIENCE_LOCALES.flatMap((locale) =>
    LOCALE_PHASES.map((phase) => ({
      locale,
      phase,
      lang: locale,
      dir: locale === 'ar' ? 'rtl' : 'ltr',
      ready: true,
      surfaces: LOCALE_SURFACES.map((s) => ({
        id: s.id,
        key: s.key,
        exists: true,
        text: LOCALES[locale][s.key],
        visible: true,
        raw_key: false,
      })),
      leaks: [],
    })),
  ),
};

const exp = composeExperienceFacetLine({ experience_reading: reading });
const tra = composeTranslationFacetLine({ experience_reading: reading });
console.log('experience', exp ? exp.length : null);
console.log('translation', tra ? tra.length : null);
