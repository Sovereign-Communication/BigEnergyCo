# Architecture map

What owns what, as of the run-channel consolidation (#116). Read this before
changing sizing behavior or the smoke harness; update it when the structure
changes.

## Run lifecycle (the part that deadlocks if done wrong)

- `assets/js/sizing/run-coordinator.js` — **single owner** of the full-run
  channel: `createRunChannel()` holds busy / retire-sequence / collapsed
  replacement; `staleRunAction()` and `errorReleasesRunChannel()` are the pure
  policy. Every full-run reply is released through one funnel
  (`flushPendingRun()` → `settle()`); the two historical stale-reply leaks
  (#113 ok path, #114 error path) are structurally closed by that funnel.
- `assets/js/sizing/ui.js` consumes the channel and keeps only what is
  genuinely its own: the consent gate (`runAuthorized`, `precalcDirty`), the
  350 ms debounce (`runTimer`), payload identity (`payloadEpoch`, shared with
  slices), the slice channel (`sliceToken`/`sliceBusy`/`pendingSlice` — a
  simpler machine on purpose), and all DOM feedback.

## Data flow

inputs → `run()` (consent + validation) → channel claim → worker → reply →
`staleRunAction` verdict → render (current) or funnel release + flush
(collapsed). Pre-calc edits call `runChannel.invalidate()` (retire, no
replacement); invalid direct requests call `runChannel.dropPending()`.

## Smoke harness

`scripts/browser-smoke.mjs` is an 85-line sequencer; behavior lives in
`scripts/smoke/`: `runtime.mjs` (launch, CDP wire, error collectors, gate
reporter), `actions.mjs` (navigate, Jev stub, form input), and one module per
product flow (`weather`, `gridtie`, `lifecycle`, `jev`, `share`, `results`,
`closing`). Gates are defined where the behavior lives; the orchestrator only
orders them.

## Tests that guard ownership

- `tests/ui-race.test.mjs` — state-machine behavior (collapse precedence,
  invalidate/dropPending, double-settle inert) + the ui.js wiring pin (no
  loose flags, funnel present).
- `scripts/smoke/lifecycle.js` — the held-response race in a real browser:
  a genuine engine reply held, made stale, released, and the next explicit
  click recovering.

## Known remaining debt (deliberate, not forgotten)

- `ui.js` is still ~9.7k lines: form state, location plumbing, rendering,
  charts, Jev, sliders, sharing, modals. The run channel was the highest-risk
  extraction; each further one should follow the same pattern (policy in a
  pure module, mechanics stay with the DOM, tests first).
- The live Jev provider success path is proven only via the deterministic
  stub (provider rate limits); the endpoint itself is probed separately.
