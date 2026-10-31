## Why the score is 96.79 (target 99)
**Scoped gate (P9.7): 97/99 — 2 points short.** Short of proven: `docs` (confident — solid with minor gaps), `quality` (confident — solid with minor gaps). Ratchet: met.
- `docs`: confident — solid with minor gaps (ordinal 85, live)
  - _why:_ the live judge rated this "confident — solid with minor gaps" (ordinal 85) — short of proven
  - _what the judge saw:_ "measured this session: ARCHITECTURE was corrected where it still described a removed fallback, the twelve superseded plans were archived with a per-file reason, and a gate now fails any live doc whose relative link rots. docs/INDEX.md leads with the governing plan"
- `quality`: confident — solid with minor gaps (ordinal 85, live)
  - _why:_ the live judge rated this "confident — solid with minor gaps" (ordinal 85) — short of proven
  - _what the judge saw:_ "For this P9.7 infrastructure-only change: judge gate correctness, tests, representative fixtures, and whether content criteria activate only for governed pages or sources. Do not grade infrastructure files as published copy."
### 1. ⭐ PRIMARY `perf_gap` — Performance gap _(work type: playtest)_
- **Focus:** Run the playtest pass on the real surface: measure the slow interaction, confirm warm-cache paths issue zero redundant network pulls, and make subsequent adjustments instant.
