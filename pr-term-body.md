## Plan items

P8.1; Refs #287 Phase 4.

## What changed and why

Translation evidence is deterministic where it can be, and the one semantic instrument available was measured and rejected.

**Lexical anchors (56 checks).** Three term families — battery, bill, off-grid — anchored against eight label keys in all seven shipped locales, wired into `npm run seo`. A locale with no glossary entry fails all eight of its checks rather than passing silently. The negative control found a shipped German truncation: `reserveLabel` ended in `Batteri` while every other German battery label uses `Batterie`.

**Material quantities (12 checks).** The glossary verifies words, not the figures beside them. The check requires every English numeral in `firstRunNote` ("~2 MB") and `runBtn` ("5-yr") to survive as a digit, an Eastern Arabic digit, or the locale's spelled-out form. It found two shipped German omissions, both fixed: the download size and the simulation length were simply absent from the German strings.

**Semantic spot-check (rejected as evidence).** Two variants against pinned `jev-1.14.0`, same 36 samples and 18 controls:

| variant | controls passed | samples ≥ 0.95 |
| --- | --- | --- |
| questionnaire | 1/18 | 4/36 |
| direct pair | 16/18 | 9/36 |

Neither meets its own controls, so neither is cited as gate evidence. The direct-pair failures were the `nl` and `ar` known-good pairs, while both locales' corrupted pairs scored correctly at 0.01–0.02 — instability, not a translation defect. The probe still found the two German omissions above.

The composed `translation` facet line now names `scripts/check-i18n.mjs` (it said `check-i18n`, which the evidence test rejects) and carries both results: "Glossary 56/56 label anchors; lexical only. Figures 12/12 preserved." at 255 characters, inside the 280 transport bound.

## Validation

- Full offline suite: 1,798/1,798 passed.
- `check-chars`, `npm run seo`, `npm run format:check`, `npm run deploy:check`, `npm run plan:check`, and `node scripts/check-facet-evidence.mjs` (21/21 facets) passed locally.
- Negative tests re-inject the German truncation and both dropped figures and require failure; Arabic spelled-out and Eastern Arabic digits pass.

## What this does not claim

Meaning and natural phrasing remain unverified. No native reviewer is on this program and the only automated instrument failed its controls. The recorded path forward — the owner-approved staging proposal in #292 — is in [docs/jev-completion/ISSUE_287_TRANSLATION_PATH.md](https://github.com/Sovereign-Communication/BigEnergyCo/blob/codex/issue287-terminology-20261023/docs/jev-completion/ISSUE_287_TRANSLATION_PATH.md). This PR does not lower any gate.

LoC: +262 / −98 across 26 files (asset-stamp churn included).
