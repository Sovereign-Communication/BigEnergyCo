## Plan items

**P0.6 — completion-program evidence** (facets: `docs`). No other item is delivered here; no threshold or gate code moves.

No `LEDGER.jsonl` row: P0.6's definition of done is "the evidence PR merged; tracker and queue issues open with verdicts recorded", which is this PR plus the #199 and #194 comments.

## What changed and why

Car 4 carried 42 error-discipline and URL/sink suspects. Reading each against the current tree resolved **three into real defects**, and the rest into classes the thread records with the code that decides them.

### 1. Both staging gates could not report a failed spawn — only crash

`scripts/smoke-local.mjs` and `scripts/check-privacy-browser.mjs` each ran their children through the same local helper: `new Promise(ok => child.on("exit", …))`. **`spawn` does not emit `exit` when the executable is missing or the cwd does not exist — it emits `error`**, and an EventEmitter `error` with no listener is a thrown exception. So a gate that could not start its own child died with a raw spawn trace *before* its `finally` ran: the static server stayed open and `_pages_smoke/` / `_pages_privacy/` stayed on disk, which is exactly the state that makes the next run untrustworthy. The operator got a Node stack instead of `SMOKE FAIL …`.

`scripts/lib/run-child.mjs` now resolves a non-zero code on that path (and on a synchronous spawn throw), so the caller's own FAIL message and its cleanup both run. Both gates share it. Three tests: a missing executable resolves 1, a real child returns its own status (3 and 0), and a signalled child never counts as green.

### 2. `laborMidPerKwh(null)` threw inside the cost model

A default parameter covers `undefined` only, so a payload carrying `laborPerKwh: null` reached `null[0]` and threw a `TypeError` — a missing range taking down the money panel rather than defaulting. An unusable range is now a missing range: the installed default applies unless both ends are finite.

### 3. `paretoFront(undefined)` and `paretoFront([null])` threw

`[...points]` on `undefined` is a `TypeError`, and a `null` point threw on `.capexUsd`. An unpriced point also sorted among priced ones. Now: a non-array or empty input is `[]`, a point needs a **finite cost and a finite outcome** to be placed, and the rest are dropped. An unknown price is not a cheap price, so dropping is the honest default.

All five tests were verified against the unfixed tree — `TypeError: Cannot read properties of null (reading '0')`, `TypeError: points is not iterable`, and a crashed child-run test — and pass after the fix.

### Dispositions for the rest (details on #199)

- **Already guarded**: `textWidth` (returns 0 for a non-finite size), `findWorstStreak` (returns 0 for a short or absent series; NaN entries cannot beat an `Infinity` seed), `swapSchedule` (`isFinite` guard), `relativeLuminance` (its only caller null-checks both colours), `isBoundLimited` (killed at 0.44 upstream).
- **Caller-clamped, so unreachable**: `pvLadder`/`battLadder` are fed `Math.min(60|40, …)` and never a non-finite max; `flatProfile` and `siteMemoKey` receive validated numbers. A "safe default" in these helpers would invent an envelope or a load, which is a product decision, not a bug fix — so they are left alone and the clamp is cited.
- **Obsolete**: `monthName` and `fmtDelta` no longer exist in the tree.
- **URL/sink noise**: all 31 Scope-B items are `fetch`/`navigate`/`appendChild` calls whose URL is either a constant, built from validated numbers, or a base URL already constrained by `normalizeBase` and the origin gate. The two gates helpers named (`resolveHref`, `aimsOutsideSite`) already carry the tests in `tests/script-hardening.test.mjs`.

## Definition of done (plan §9)

- [x] Tests added for every change; coverage not lowered — 1,890/1,890 (`npm test`), up 5
- [x] Local preflight: `npm test` · `node scripts/check-chars.mjs` · `npm run seo` · `npm run format:check` · `npm run deploy:check` · `npm run plan:check` — all pass
- [x] No metric regressed; no gate threshold touched
- [x] Release rules followed: `money.js` and `frontier.js` are served assets, so tokens moved `20261023g → 20261023h` (`sw.js` `beco-v146 → beco-v147`) and `seo` confirms the stamp commit
- [ ] Preview deployment visually verified — no visual change; both fixes are error paths
- [x] Rollback: revert this commit; the gates and the cost model fall back to their previous behaviour
- [x] Tracking: #199 gets every verdict, #194 the table update
