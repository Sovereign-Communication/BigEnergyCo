## Plan items

**P0.6 — completion-program evidence**, the plan item that exists for audit evidence and its verdicts (facets: `docs`). No other item is delivered here.

No `LEDGER.jsonl` row: P0.6 is delivered as a program; its definition of done is "the evidence PR merged; tracker and queue issues open with verdicts recorded", which is this PR plus the #202 and #194 comments.

## What changed and why

Car 7 listed 13 storage/randomness suspects, all in `tests/`/`scripts/`. **Twelve are test doubles** making the platform call the test is about — a Map-backed `setItem`, a fake `head.appendChild`, a Cache Storage stand-in, a one-read JSON `fetch`. The "secrets" battery flagged the shape of the call, not anything in the data: the keys are fixed, the values are synthetic, and no token, key or id is produced anywhere in that scaffolding. Two of the thirteen (`runtime.mjs::send`, `advisor-fallbacks::fetch`) were already reworked by #295, and three more (`weather-persistence::put`/`open`) by #297.

**The thirteenth question found the three guards nobody tests.** This is the car-1 shape one layer down: `setSimpleMode`, `persistWizard`, and the country-partition cache all write to storage behind a `try/catch`, so private browsing or a full quota cannot break the flow. All three guards are correct. **Not one had a test**, so nothing would notice if a refactor dropped one — and the storage doubles in the suite are, by construction, the one kind of storage that never throws.

The new file exercises a storage that throws on every operation, the way Safari private mode and `QuotaExceededError` do, and asserts **behaviour**, not just absence of a throw:

- `setSimpleMode(true, throwing)` — does not throw, still returns and records `true`, still notifies observers, and the write was genuinely attempted under `beco-simple-mode-v2` (so the deferred-in-memory design is what is being tested, not a skipped write);
- `persistWizard(wizard, throwing)` — does not throw, the wizard still advanced in memory, and `restoreWizard(throwing)` yields a fresh wizard rather than a partial state;
- `loadCountryCities("AL", fetch, throwing)` — the partition still loads when it cannot be cached;
- `cachedCountryCities("AL", throwing)` — an unreadable partition is `[]`, not a crash.

Each test was verified to fail with its guard stripped and pass with it restored. The failing signature is the real one: `QuotaExceededError: quota exceeded` escaping into the toggle, the wizard and the city search.

No shipped file changes, so no asset-token bump: the stamp stays `20261023g`.

## Definition of done (plan §9)

- [x] Tests added for every change; coverage not lowered — 1,885/1,885 (`npm test`), up 4
- [x] Local preflight: `npm test` · `node scripts/check-chars.mjs` · `npm run seo` · `npm run format:check` · `npm run deploy:check` · `npm run plan:check` — all pass
- [x] No metric regressed; no thresholds touched
- [x] Asset tokens not bumped — test-only diff, and `seo` confirms stamp `20261023g` still matches its commit
- [x] No visual change, so no preview verification
- [x] Rollback: revert the commit; it is one test file
- [x] Tracking: #202 gets all 13 verdicts, #194 the table update
