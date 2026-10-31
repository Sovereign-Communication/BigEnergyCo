## Plan items

P0.3; Q-01 / section 13.3. Refs #287 Phase 3.

## What changed and why

The assessment pack now gives each of its 21 facets an explicit condition for the highest Score level. Validation preserves the text in live questions. The response parser maps each question's actual provider legend back to the existing canonical ordinal; tests exercise that complete request/response path and reject a stale generic proof label.

Ordinal anchors, hard gates, ratchets, and the 95/95/95 release policy are unchanged. Operator packs without optional proof criteria retain their original labels.

## Why this remains draft

A controlled comparison using archived main evidence from `53888bfb` and the same reconstructed state returned pinned model `jev-1.14.0` for every call. Generic labels produced 13 proven facets and specialized labels 10; quality/performance/i18n remained 85 and translation 60. An instruction-only variant produced 9 proven facets and performed worse. Each set was called once; no best-of-many result was selected.

The result does not demonstrate that prompt clarification unblocks the gate. Further prompt tuning stops here while the requested translation evidence work proceeds. The experiment and its scope are recorded in [the assessment report](https://github.com/Sovereign-Communication/BigEnergyCo/blob/codex/issue287-proven-criteria-20261023/docs/jev-completion/ISSUE_287_PROMPT_EXPERIMENT.md) and the append-only ledger. This is not a main check-run or a stability claim.

## Validation

- Full offline suite: 1,793/1,793 passed; focused pack/scope suite: 73/73.
- Character, SEO, formatting, deploy staging, plan pin and 21/21 facet-coverage checks passed locally.
- Tests verify criteria transport, provider-legend parsing, malformed-text rejection, fixed ordinal anchors and operator-pack support.
- Current-head CI remains required before any merge decision.

LoC: +154 / -30 across five files.