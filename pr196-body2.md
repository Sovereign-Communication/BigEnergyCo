## Plan items

**P0.6 — completion-program evidence**, the plan item that exists for exactly this: audit evidence and its verdicts. P0.6 states that audit evidence PRs name it so the `jev-complete` gate scopes them (facets: `docs`). No other item is delivered here and no threshold moves.

No `LEDGER.jsonl` row: P0.6 is delivered as a program, and its own definition of done is "the evidence PR merged; tracker and queue issues open with verdicts recorded" — this PR plus the #196 and #194 comments are that record, not an `item-done` row.
## What this is

Car 1's confirm-or-kill round left **three** items clearing the 0.95 gate outright, so they were never revisited:

| item | prescription | verdict |
| --- | --- | --- |
| `mergeReSlice` (0.98) | validate-guard, pinpoint `multiple-sites` | **real, already fixed in #171** — no test existed |
| `populatePrintSheet` (0.96) | escape-output, pinpoint `footprintText` | **does not reproduce**: no untrusted text reaches the sink |
| `clearCompactCache` (0.95) | validate-guard, pinpoint `idbDelete` | **function no longer exists** |

So this PR changes no shipped code. It adds the evidence that makes each verdict checkable, which is what the car's acceptance asked for ("each hardened with a regression test, or dispositioned with a reason recorded here").

### `mergeReSlice` — the guard is real and now pinned

The old guard was `if (!p || !result) return;`, so a truthy primitive from the worker (a string message, a number) reached `"agmReference" in result` and threw `TypeError: Cannot use 'in' operator to search for 'agmReference' in text`. #171 changed it to `!result || typeof result !== "object"`. Nothing tested it, which is how a guard gets re-opened by a refactor.

The test **executes** the shipped function: it is sliced out of `ui.js` and run in a `vm` context whose only real state is the payload, with every module helper stubbed. Four hostile primitives (including a symbol) must be ignored without mutating the payload, a real `{cells, customCut}` slice must still merge, and the guard must sit before both `in` probes. Reverting the line to the pre-#171 form fails the suite with exactly the crash above.

### `populatePrintSheet` — the sink is real, the path is closed

The sheet is assembled with `innerHTML`, so the prescription is not wrong that the sink exists. The test answers it field by field instead of dismissing it:

- the one string field the sheet interpolates (`basis`) is assigned only literals in `readInputs`, never a form value or the hash;
- every hash-originated string field is whitelisted in `restoreFromShare` before it can set a control — chemistry via `CHEM_KEYS`, use case via `useCase()`, plus tier, cut target, hardware, focus chemistry and the selection-key pattern. The test enumerates all seven, so removing one fails the suite;
- the share codec is **deliberately permissive**: `parseShareHash` only bounds `la`/`lo`/`kw` and spreads the rest, which the test proves by round-tripping `ch: "<img src=x onerror=alert(1)>"` through the real codec and getting it back verbatim. That is what makes the whitelists load-bearing rather than decorative.

Every other value in the sheet is a number, a formatter, a module literal, or an engine-supplied label.

### `clearCompactCache` — gone, not broken

`grep` finds no definition anywhere in `assets/`; `git log -S` shows it removed in `43f5378b`. Its job — dropping a compact series whose year window is stale — now happens inline at the single call site, and `idbDelete` guards for a missing object store and swallows its own errors, so the call is safe fire-and-forget. Nothing to fix and nothing to test.

## Definition of done (plan §9)

- [x] Tests added for every change; coverage not lowered — 1,879/1,879 (`npm test`), up 6
- [x] Local preflight: `npm test` · `node scripts/check-chars.mjs` · `npm run seo` · `npm run format:check` · `npm run deploy:check` · `npm run plan:check` — all pass
- [x] No metric regressed; no thresholds or gate code touched
- [x] Asset tokens **not** bumped: the only added file is a test, which is not served. Stamp stays `20261023f`
- [x] No visual change, so no preview verification
- [x] Rollback: revert the commit; it is a single test file
- [x] Tracking: #196 gets this measurement, #194 the table update
