## Plan items

**P0.6 — completion-program evidence**, the plan item that exists for audit evidence and its verdicts (facets: `docs`). Audit evidence PRs name it so the `jev-complete` gate can scope them. No other item is delivered here.

No `LEDGER.jsonl` row: P0.6 is delivered as a program and its definition of done is "the evidence PR merged; tracker and queue issues open with verdicts recorded", which is this PR plus the #200 and #194 comments.

## What changed and why

Car 5's wiring-noise battery resolved a 1,527-function queue to **four confirmed** items, all in `tests/`: `hangingFetch` (0.86), `sleep` (0.74), `tx.objectStore` (0.71), `open` (0.71). Three are fixtures whose prescription is meaningless — a stub whose job is to hang, a `noSleep` double that already returns a promise, and a `caches.open` mock. **One was pointing at something real, one line away from where it pointed.**

### The defect: every cold fetch leaked an open IndexedDB connection

`idbPut` and `idbDelete` awaited the transaction as if it were a request:

```js
await idbReq(tx.complete !== undefined ? tx.complete : tx);
```

`IDBTransaction` is not a request. It has no `complete` property and never fires `onsuccess` — it announces completion through `oncomplete`. So in a browser the left side was always `undefined`, `idbReq(tx)` set handlers the transaction will never call, and the promise stayed **pending forever**. The write itself landed (`put` is queued synchronously, and both call sites are fire-and-forget `.catch()`), so nothing user-visible broke; what broke was the `db.close()` after the await, which never ran. One open connection leaked per cold fetch, and a browser that runs out of connections refuses the next upgrade.

Two more leaks sat in the same three functions: `idbGet`, `idbPut` and `idbDelete` all returned early when the object store was missing — before their `db.close()` — and `idbDelete`'s handle was `const`-scoped inside the `try`, so a `finally` could not have closed it anyway.

The fix: a `txDone(tx)` promise built on `oncomplete`/`onerror`/`onabort`, and one `finally { db.close() }` per function, so every exit closes — success, early return, and failure alike. Behaviour is otherwise identical: still best-effort, still fire-and-forget, still `fromCache` on restore.

### Why the tests could not see it

The IndexedDB double in `tests/weather-persistence.test.mjs` exposed `complete: Promise.resolve()`, which `idbReq` waits on just as fruitlessly. **The double agreed with the bug**, so 9 green tests certified a code path that never completed. It now models the platform: no `complete` property, `oncomplete` fired on the microtask after the write. That change alone is what makes the defect visible, which is the part worth remembering.

Three tests count connections, because `idbOpen()` opens a fresh request every call and opens-minus-closes is the only witness to a leak:

- `a compact write closes the connection it opened` — cold fetch, then `closes() === opens()`;
- `a storeless database is closed, not abandoned on the early return`;
- the existing stale-window test now also asserts `closes() === opens()`, which covers `idbDelete`.

All three fail on the unfixed tree with `every opened connection must be closed, or the browser leaks one per fetch`; all three pass with the fix.

## Definition of done (plan §9)

- [x] Tests added for every change; coverage not lowered — 1,881/1,881 (`npm test`), up 2 plus one strengthened
- [x] Local preflight: `npm test` · `node scripts/check-chars.mjs` · `npm run seo` · `npm run format:check` · `npm run deploy:check` · `npm run plan:check` — all pass
- [x] No metric regressed; no gate thresholds touched
- [x] Release rules followed: `nasa.js` is a served asset, so tokens moved `20261023f → 20261023g` (`sw.js` `beco-v145 → beco-v146`) and `seo` confirms the stamp commit
- [ ] Preview deployment visually verified — no visual change; the fix is connection lifetime
- [x] Rollback: revert this commit; the cache falls back to Cache Storage and localStorage exactly as before
- [x] Tracking: #200 gets the four verdicts, #194 the table update
