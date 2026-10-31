## Plan items

No plan item and no requirement ID are delivered here: this closes two defects from the Jev audit car 3 suspect list (#198), which is hygiene outside the plan's item set. No `LEDGER.jsonl` row, because the ledger records plan-item delivery.

## What changed and why

Car 3 listed four `unhandled-guard` / `listener-cleanup` suspects at 0.54–0.57 p(real) and required each one to be answered with a specific question. Two of the four were real, both in the same shape — a promise path with no owner.

**`sendChatMsg` (assets/js/chat.js, shipped code).** Question asked: *can a message send actually race with incoming state updates, or is the flagged shared state effectively single-threaded here?* The concurrency is not with incoming state; it is send-with-send. Two sends in flight shared the single `#loadingMsg` node, so the first reply removed the second's spinner, and the two answers could render in whatever order they settled. The refusal also cleared the input, so a message typed mid-flight was swallowed. There is now one send in flight at a time, the guard sits **before** the input is read and cleared (typed text survives), and the flag is released on both terminal paths so the chat cannot lock up.

**`send` (scripts/smoke/runtime.mjs, tooling).** Question asked: *is there a promise path here with no catch that fails a smoke run?* Yes, at teardown. `close()` closed the socket while requests were still pending; each one waited out its full 30s timer and only then rejected, long after the caller had moved on, which Node reports as an unhandled rejection — a smoke run that dies with a bare stack instead of naming the stage it was on. The uncleared per-request timers also kept the process alive after the run had finished. `close()` and a dropped socket now drain the wire through one exported helper (`rejectPending`), and every settled request clears its timer.

The other two suspects in car 3 are **not** changed; they are answered on #198 with the reasons (the interceptor already releases under `finally` and restores `onmessage`; the city search already discards a lookup whose query was superseded, with a regression test).

## Evidence

- `EXECUTED: a second send while a reply is pending does not interleave` runs the **shipped** `sendChatMsg()` twice against a fake DOM and a held fetch. It asserts one request on the wire, the typed text still in the input, exactly one spinner, no half-sent turn in `chatHistory`, and that the guard **releases**: the queued message sends once the first reply lands. Checked against the unfixed tree — it fails there (`the refused text stays in the box instead of being swallowed`), so this is a real regression guard, not a description of current behaviour.
- `CDP WIRE: teardown rejects every in-flight request exactly once` drives `rejectPending` with fake timers: three pending requests settled, one reason on each, three timers cleared, and a second close is a no-op. `CDP WIRE: close() and a dropped socket both drain the wire` pins the wiring, including that the drain happens **before** `ws?.close()`.

## Definition of done (plan §9)

- [x] Tests added/updated for every change; coverage not lowered — 1,873/1,873 (`npm test`), up from 1,871
- [x] Local preflight: `npm test` · `node scripts/check-chars.mjs` · `npm run seo` · `npm run format:check` · `npm run deploy:check` · `npm run plan:check` — all pass
- [x] No metric regressed vs the latest ledger baseline; no phase thresholds touched
- [ ] Scoped live Jev report — not run for this PR; it is a defect fix with tests, and `jev-complete` cannot pass on any revision for reasons documented on #292
- [x] `docs/plan/LEDGER.jsonl` — n/a, no plan item delivered (see above)
- [x] Release rules followed: asset tokens bumped `20261023e → 20261023f` (`sw.js` `beco-v144 → beco-v145`), because `chat.js` is a served asset and the staging verifier compares byte-for-byte
- [ ] Preview deployment visually verified — no visual change; the fix is a request guard
- [x] Rollback plan: revert this commit; there is no data, binding or deployment state in it
- [x] Tracking issue: #198 gets the per-item answers, #194 the program-level note
