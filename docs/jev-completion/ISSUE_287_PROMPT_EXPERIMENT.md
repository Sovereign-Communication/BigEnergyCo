# Issue #287 Phase 3: proof-criteria experiment

This is a bounded prompt experiment, not a passing main gate or a stability claim.

- Source evidence: main `53888bfbd30d22d17a4639e136abf8df9b35fcb1`, Actions run `39914620664`, archived `jev-evidence.json` and `jev-report.json`.
- Both variants used the same reconstructed state, SHA-256 `f5a3c599bdbfb00b1aec843a052216f4fca1adcfb9b0519c57598dc156327de7`.
- All three calls returned the accepted pinned model `jev-1.14.0`. Each question set was called once; no best-of-many result was selected.

| Facet       | Generic labels      | Facet-specific top label |
| ----------- | ------------------- | ------------------------ |
| Quality     | 85, confidence 0.39 | 85, confidence 0.44      |
| Performance | 85, confidence 0.48 | 85, confidence 0.43      |
| i18n        | 85, confidence 0.63 | 85, confidence 0.52      |
| Translation | 60, confidence 0.60 | 60, confidence 0.59      |

The generic-label call had 13 proven facets; the specialized top-label call had 10. Correctness, docs and provenance changed ordinal. An alternate shape that put the same proof definitions in instructions while retaining generic labels had 9 proven facets, performance 60 and translation 35.

The evidence does not show that prompt clarification alone unblocks the gate. Further prompt iterations stop here; the translation evidence work and unapproved B1 proposal remain separate paths. The criteria PR stays draft pending assessment of its changed measurement behavior. No threshold, confidence bar or ratchet baseline is changed by this experiment.

The wire test must use the actual per-facet legend returned for each Score question and map it back to the canonical ordinal. A generic highest-level legend from the old pack cannot stand in for a specialized criterion. This is covered by the provider-legend round-trip regression test.

Only a successful `jev-complete` check-run on the exact merged main SHA, followed by three consecutive green content merges, can satisfy the mission's stability condition.
