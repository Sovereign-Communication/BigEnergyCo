import fs from 'node:fs';
const FILE = 'docs/plan/LEDGER.jsonl';
const row = {
  ts: '2026-10-25',
  kind: 'baseline',
  ref: 'P0.4',
  summary:
    'PR #317 closes the runtime English-leak classes (R-I18N-01): about thirty surfaces that either clobbered already-localized DOM or were never localized at all - mode-switch headings, the results note, the BOM badge, roof-map status copy, manualRoofHint, the monthly-bill intake labels, map-provider hints - now render through their dictionary keys in all seven locales. The staged per-locale strings share rose by 839 bytes (10,117 -> 10,956; file 70,821 -> 76,690) while remaining under the unchanged 25,600-byte absolute limit; this remeasures the deliberate localization without relaxing the plan threshold. The three keys drafted for the engine callout gap (oversizeCheaper, swapsCheaper, swapsNatural) were removed rather than shipped unwired, so this growth is only keys the page actually renders - the same remeasure-without-relaxing move the Dutch locale addition (PR #230) made on this line.',
  evidence: {
    pr: 317,
    sha: '2f955d7abdfeac6200b57fa8a0d5d86eb0b22b48',
    metrics: {
      locale_strings: {
        value: 10956,
        limit: 25600,
        unit: 'bytes',
        status: 'measured',
        locales: 7,
        file_bytes: 76690,
        was: 10117,
        delta: 839,
        note: 'per-locale share of staged assets/js/shared/locales.js, brotli q11',
      },
    },
  },
};
const line = JSON.stringify(row);
JSON.parse(line);
fs.appendFileSync(FILE, line + '\n');
console.log('appended baseline row:', row.evidence.metrics.locale_strings.value, 'bytes');
