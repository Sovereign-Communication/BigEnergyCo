## Scope

Phase 2 performance target for issue #287, under P0.4. This makes the existing hard playtest ceilings visible beside each reading in the Jev-facing performance evidence. It does not change any budget or release threshold.

## Changes

- Report cold run, warm repeat, drag preview, and confirm timing as measured value <= current blocking ceiling.
- Report adjustment count and paired warm/reload NASA counts, including the confirm timing when it matches the drag timing.
- Keep Lighthouse's noisy performance spread and the ratcheted category summary within the 280-character transport limit.
- Add regression coverage for each displayed reading/ceiling pair and the equal drag/confirm case.

## Validation

- `npm test`: 1777/1777
- Focused Jev/performance/Lighthouse tests: 148/148
- `node scripts/check-chars.mjs`: pass
- `npm run seo`: pass
- `npm run format:check`: pass
- `npm run deploy:check`: pass
- `npm run plan:check`: pass
- Prettier 3.9.6 and `git diff --check`: pass
