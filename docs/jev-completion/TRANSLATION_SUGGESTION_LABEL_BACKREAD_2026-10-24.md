# Translation suggestion label back-read — 2026-10-24

## Scope

Reviewed the English source label, “Suggest a translation fix,” against the seven values of `suggestTranslationFix` in `LOCALES`. The back-read considered the visible CTA’s purpose: it opens a prefilled issue draft so the visitor can propose a correction; it does not directly edit the page or send a request.

| Locale         | Shipped label                         | Back-read                                 | Review                                                                            |
| -------------- | ------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------- |
| English        | Suggest a translation fix             | Suggest a translation fix                 | Source                                                                            |
| Spanish        | Sugerir una corrección de traducción  | Suggest a correction to the translation   | Meaning and wording preserved                                                     |
| Portuguese     | Sugerir uma correção de tradução      | Suggest a translation correction          | Meaning and wording preserved                                                     |
| French         | Suggérer une correction de traduction | Suggest a correction to the translation   | Meaning and wording preserved                                                     |
| German         | Übersetzungskorrektur vorschlagen     | Suggest a translation correction          | Meaning preserved; concise compound is understandable as a CTA                    |
| Dutch (before) | Vertaling verbeteren                  | Improve the translation                   | Natural, but it omits the proposal/suggestion action and can imply direct editing |
| Dutch (after)  | Een vertaalcorrectie voorstellen      | Propose a translation correction          | Preserves the suggestion action and is natural CTA wording                        |
| Arabic         | اقتراح تحسين الترجمة                  | Suggest an improvement to the translation | Meaning and wording preserved                                                     |

The Dutch wording was the only supported defect in this changed copy. `tests/translation-suggestion.test.mjs` now pins the reviewed CTA values so the corrected label cannot silently regress.

## Review limit

This review covers only the new suggestion CTA, not all translated page prose. It is a reviewer back-read, not native-speaker validation; broader translated-prose and native-speaker review remain open. The i18n and browser checks establish key/placeholder parity and rendered dictionary values, not semantic correctness.
