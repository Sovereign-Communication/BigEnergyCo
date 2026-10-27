import fs from 'node:fs';
const FILE = 'docs/plan/LEDGER.jsonl';
const row = {
  ts: '2026-10-25',
  kind: 'note',
  ref: 'P0.3',
  summary:
    "The translation and resilience facet lines are recomposed to speak to the judge's rubric dimensions, and the runtime English-leak classes a dictionary can reach are closed (branch fix/i18n-leaks-and-facet-evidence, base 9e805cf5). THE LEAK SURFACE, MEASURED BEFORE FIXING: three classes. Class 1 - JS that clobbered already-localized DOM: the mode-switch headings, the results note, the BOM badge and the roof-map status copy could boot localized and finish English. Class 2 - JS surfaces that were never localized at all: manualRoofHint, the monthly-bill intake labels and the map-provider hints. Class 3 - static unkeyed prose in shipped HTML, already tracked by check-i18n.mjs's falling unkeyed ceiling (371/485) and not claimed here. Classes 1 and 2 are closed: ~30 call sites across ui.js, chat.js, sizing/map-provider.js and index.html wired through each module's own chatText/t() convention, so check-i18n.mjs's key-render rule now holds every key that reaches a visitor. THE NAMED GAP, deliberately not pressed into service: the callout sentences the sizing engine composes as strings - engine.js/rescale.js including the oversizeCallout prose-parsing pair and the naturally-outlasts variant, plus the charts.js cumulative-savings callout the 2026-10-14 row already named - stay English in all seven locales. The engine runs inside the Web Worker, which cannot carry the seven-locale dictionary; closing this is the codes-to-keys migration (the engine returns scenario codes and numbers, the page composes the localized copy) across ~6 callout variants - a P5-sized change, not a minimal close. The three keys drafted for it (oversizeCheaper, swapsCheaper, swapsNatural) were REMOVED again rather than left unwired: check-i18n.mjs refuses keys no shipped code renders, and an unwired key is a claim the page cannot keep. The full gap record is the named-gap section added to docs/jev-completion/TRANSLATION_MEANING_BACKREAD_2026-10-24.md; the translation facet line's gaps clause carries its shortest honest name (engine) under the 280-char clip and tests/experience-facet.test.mjs pins the clause so the name cannot silently drop. THE TRANSLATION LINE now names every rubric dimension with the gate or record that measures it - parity and placeholders (check-i18n.mjs), leakage and raw-key counts (the JS/DOM dictionary match from the sweep), Intl number/currency/date with per-locale plurals, text direction and glyphs (check-chars.mjs), phrasing (the 2026-10-24 AI back-read with its 23 fixes), the glossary and quantity anchors, and the suggest-a-fix link - and ends on what is NOT closed: native-speaker review above all, F-42, engine. THE RESILIENCE LINE now names the rubric's transient-failure classification dimension (the injected modes ARE the taxonomy - connect, abort, refuse, 5xx, malformed body - asserted to degrade alike) and the measured recovery half of stuck-run handling (the explicit retry posts a fresh run and releases the button), instead of naming only the deadline. THE DEFECT THE RECOMPOSITION TURNED UP, AND HOW IT CLOSED: the record's whole-transport budget had 9 characters of headroom and the first honest translation line was 33 characters longer than the shape it replaced, so the line's growth cut the tail note (the PR #248 chart back-read record) out of the judge's transport whole - an evidence line that spends a recorded note's bytes is the same failure class as one that under-reports. Closed by compressing the line, not the record: every rubric dimension kept, the fixture-shaped line lands at 240 characters with the record's headroom restored to 6, and scripts/lib/jev-complete.mjs is byte-untouched - COMPLETE_FACET_CLIP is still 280 and the transport budget is still 6000 + 300/axis. The pressure is named here because it will recur: the record's 8 notes ride 5,644 characters against the 6,000-char base (the three facet-provenance notes are 4,037 of them), so the next honest line's room must come from note curation or an explicit budget raise, never silently from a note tail. TWO FIXTURES BROUGHT BACK TO THE CONTRACT BY THE GATES: manualRoofHint's t() call echoed a raw key in an unbooted context (translate echoes the key until the deferred dictionary lands, by documented design), so it now follows the chatText dictionary-first-English-fallback contract and tests/map-feature.test.mjs holds the unbooted path; and the roof-cap note's 6 m2-per-panel assumption pin followed the copy into the dictionary, now asserting every shipped locale names the assumption rather than scanning one English literal in ui.js source. RELEASE: asset stamp 20261025a -> 20261025b and sw.js beco-v165 -> beco-v166 across 19 graph files, so returning visitors receive the locale changes (bump-asset-tokens check (d) refuses the release otherwise). GATES ON THE COMMITTED TREE: npm test 1955/1955, npm run seo green (i18n key-render, unkeyed ceiling, evidence freshness, asset-token content check at 20261025b), npm run format:check clean (814 files), npm run deploy:check clean, check-chars clean. NOT DONE HERE AND NOT CLAIMED: native-speaker review; the engine copy; the unkeyed HTML ceiling; the jev ordinal move, which only a post-merge scoped run records.",
  evidence: {
    branch: 'fix/i18n-leaks-and-facet-evidence',
    base: '9e805cf5',
    plan_items: ['P0.3'],
    requirement: 'R-I18N-01',
    defects: ['F-42'],
    named_gap: 'engine-emitted callout prose (engine.js/rescale.js/charts.js), English in all 7 locales; codes-to-keys migration is P5-sized; keys oversizeCheaper/swapsCheaper/swapsNatural removed as unwired',
    leak_classes_closed: ['JS clobbering localized DOM', 'never-localized JS surfaces'],
    sites_localized: 30,
    transport: {
      clip_unchanged: 280,
      gate_files_unchanged: ['scripts/lib/jev-complete.mjs'],
      fixture_line_chars: 240,
      record_headroom_restored: 6,
    },
    asset_stamp: '20261025a -> 20261025b',
    sw_cache: 'beco-v165 -> beco-v166',
    gates: {
      npm_test: '1955/1955',
      seo: 'green',
      format_check: 'clean (814 files)',
      deploy_check: 'clean',
      check_chars: 'clean',
    },
  },
};
const line = JSON.stringify(row);
JSON.parse(line);
fs.appendFileSync(FILE, line + '\n');
console.log('appended', line.length, 'chars');
