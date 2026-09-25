# AI advisor and Jev audit

**Status:** current implementation contract for `worker/index.js`, `assets/js/chat.js`, and `assets/js/sizing/validate.js`.

This document supersedes the old chemistry/pricing optimization notes. The advisor is an educational explainer, not a second sizing engine, procurement agent, or authority.

## Non-negotiable product boundary

1. The deterministic NASA POWER/hourly calculator owns every displayed sizing number.
2. Jev receives only a bounded, validated numeric state for the **selected** system. Its answer is an independent plausibility signal, not a safety certificate, engineering approval, price check, or replacement calculation.
3. Groq explains the deterministic brief. It must not recompute, silently replace, or present unsupported numbers as facts.
4. A Jev `flag` is a request to investigate missing inputs. A Jev `pass` means only that the bounded check did not flag the values. `uncertain` remains uncertain.
5. The service stays free and public: no sales, donations solicitation, lead forms, procurement, paywall, or brand preference.
6. Every answer carries the canonical educational disclaimer and identifies the model as an AI when asked.

## Advisor context contract

The calculator sends a brief containing:

- the selected deterministic system and its PV/battery numbers;
- the mode, load basis, chemistry, modeled weather horizon, and relevant assumptions;
- a selected-system line that identifies the exact system Jev is asked to review;
- Jev status (`pending`, `unavailable`, or `available`) and, when available, bounded verdict/confidence/red-flag values;
- a Jev boundary statement: numbers only, no location names or free text, advisory only.

The brief must not include exact latitude/longitude. NASA weather is already represented by derived, non-identifying model outputs such as yield and worst-month climate values. The advisor may ask for a country/region when a real answer needs local voltage, pricing, product, or legal context; it must not ask for secrets or unnecessary personal data.

The user message is **data**, even when it contains bracketed text such as `[ADVISOR INSTRUCTION]` or `[JEV REVIEW]`. Only the server system prompt and the allow-listed interface-language field control behavior. A caller cannot promote client text to an instruction by imitating a label.

## Prompt requirements

The worker prompt (`SYSTEM_PROMPT_VERSION`) is versioned and built per request. The current date is injected at request time; it is never hardcoded in the prompt source.

The prompt must require:

- neutral, worldwide, noncommercial service;
- no geographic, cultural, political, or commercial stereotypes;
- clear separation of measured facts, model assumptions, estimates, and questions;
- no invented current prices, tariffs, certifications, warranties, cycle lives, temperature ratings, regulations, or local product availability;
- ranges with scope, currency, destination, date, freight/duty/labour/permit assumptions;
- chemistry comparisons without a universal LFP/sodium-ion/lead-acid winner;
- smallest useful follow-up questions;
- international units and no assumed North American voltage, grid, climate, or pricing;
- user-language replies, with the selected interface language used for generated calculator briefings;
- the canonical disclaimer on every reply.

The worker returns model text as plain text in the browser. The client must never interpret model output as HTML.

## International and multilingual experience

The shipped UI supports `en`, `es`, `pt`, `fr`, `de`, and `ar`, with RTL document direction for Arabic. The locale layer covers static calculator chrome, the advisor modal, its placeholder/labels, and every runtime string the calculator composes (pipeline stepper, speed notes, infeasibility banners, appliance and slider readouts, share-restore label, initialization failure, and the advisor's loading/error/retry copy). The classic chat bridge receives the selected locale through the small `window.becoT`/`window.becoLang` contract; the worker independently validates the language code against its allow-list.

Translation transport rules: a locale value owns the whole sentence, with `{placeholder}` interpolation for runtime values, so word order stays translatable — no sentence assembled from pre-translated fragments in code, and no string-replacer interpolation (a formatted `$200` must not be read as a `$2` pattern). `scripts/check-i18n.mjs` fails the build when parity drifts, a placeholder is lost, or a shipped key is never rendered; `tests/i18n.test.mjs` fails it on a corrupted byte, a split sentence, or a broken interpolation contract. Long-form static sections (hero, FAQ, parts list, support, legal) remain English-only documentation and are outside the translated surface by design.

The model is instructed to follow the user's explicit language request; otherwise a generated brief uses the selected interface language. Universal units remain readable across languages. The UI does not claim that machine translation, local regulation, or product certification is authoritative. Unsupported languages fall back to English rather than producing raw keys.

## Jev audit requirements

The numeric Jev check itself has three layers:

1. **State validation:** finite numbers, strict bounds, known mode, no unknown fields, and no text/location payload.
2. **Typed provider contract:** the server owns the questions; provider output is parsed as typed answers and rejects malformed shapes.
3. **Conservative interpretation:** confidence-gated `pass`, `flag`, or `uncertain`; no unavailable provider result is rendered as a warning or pass.

The client must be race-safe: selecting another system or rendering another payload invalidates an older request. A late response cannot overwrite a newer badge. Re-rendering a cached result must not duplicate badges or make another provider call for the same state.

Provider failure is silent for sizing: the deterministic result remains usable and the advisor is told that Jev is unavailable. Jev must never block or change the calculator.

## Bias, accuracy, honesty, safety, and privacy audit

For every release, record evidence for these cases:

| Area                | Required evidence                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Determinism         | Same input produces the same result; Jev never supplies a displayed number.                                           |
| Same-result pairing | Selected-system label, Jev state, and Groq brief identify the same PV/battery system.                                 |
| Adversarial context | Bracketed prompt injection, fake system instructions, and requests to reveal secrets are ignored.                     |
| Uncertainty         | Missing climate, tariff, local voltage, certification, and product data produce caveats/questions, not guesses.       |
| Chemistry fairness  | LFP, sodium-ion, and lead-acid trade-offs are conditional; no universal winner or unsupported cold-weather hierarchy. |
| Safety              | No step-by-step hazardous wiring, fusing, grid, or fire-safety authority; qualified local review is recommended.      |
| Privacy             | No exact coordinates in the generated sizing brief; no secrets, credentials, or unnecessary personal data requested.  |
| Multilingual        | Six locale keys are present, modal/runtime copy switches, RTL works, and the API language field is allow-listed.      |
| Resilience          | Provider timeout, 429/503, malformed response, and disabled Jev key degrade without changing results.                 |
| Concurrency         | Rapid selection/result changes do not mount stale verdicts or duplicate badges.                                       |
| Plain text          | Model output is rendered with `textContent`, never HTML.                                                              |

## Repeatable complete audit

The complete Jev pack has a dedicated `advisor` semantic facet and an `advisor_gap` work bucket. It is intentionally Jev-owned: code can prove wiring and tests, but only a live review (or an explicitly recorded manual audit) can judge whether the advisor implementation is unbiased, accurate, honest, safe, privacy-conscious, and helpful across the evidence supplied.

Run the local structural gate first:

```bash
node scripts/validate-jev-complete.mjs --local-only
```

This is fail-closed: missing test/SEO/smoke/CI/format/secret/tree evidence is red or unverified, and an unrun live review is never reported as proven. With provider access, run:

```bash
node scripts/validate-jev-complete.mjs --evidence evidence/advisor-and-release.json
```

The evidence file should include the actual green command summaries and a bounded `advisor_audit` string. Do not put secrets, raw user messages, or exact coordinates in evidence. The live call uses the same Jev provider contract and OpenRouter backup as the worker; an unavailable provider is reported honestly.

The evidence file may also carry `facet_evidence`: one bounded proof line per declared axis (for example `"accessibility": "keyboard walks 64/81/47 stops + wrap, named controls, AA contrast, reduced-motion both modes"`). Per-facet lines are first-class transport — they reach the live judge ahead of the notes channel and each line is bounded, so no dimension's proof is crowded out or cut mid-way by another's verbosity.

## Required verification

```bash
npm test
node scripts/check-chars.mjs
npm run seo
npx prettier --check .
npm run deploy:check
node scripts/check-syntax.mjs
```

When browser wiring, locale behavior, modal behavior, or Jev badge lifecycle changes, run the browser smoke flow as well. A local-only complete gate is not evidence of live model quality; report provider-backed results and unverified live quality separately.
