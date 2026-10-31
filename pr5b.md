## One real defect, fourteen guard dispositions

Car 5's wiring lane is 15 production functions at `p_broken` 0.30–0.70 — every one below the 0.95 gate, so each is a suspect and the code decides. **One was a contract violation; fourteen are already guarded, and the guard is named rather than asserted.**

### The one: `createMapProviderRegistry` installed a provider before its init

```js
      if (!provider) return null;
      active = provider;                    // ← installed here
      return provider.init(options);        // ← init can reject
```

The optional leaflet CDN being blocked is the concrete case — it is *why* the map is optional. With `active` set first, a rejected init left the provider installed: `drawRectangle`, `drawPolygon` and `onClick` called into a map that was never created, and `drawRectangle` returned the provider's result as though the map existed.

The one shipped caller (the roof-area map in `ui.js`) calls `cleanup()` in its `catch`, so no visitor-visible behaviour changes today. That is not the same as correct: the invariant belongs to the registry, and a second caller would have had to rediscover the compensation. `active = provider` now happens after the await resolves.

**Proof:** `await reg.init()` rejects, then `reg.drawRectangle(...)` returns `{ok:true}` on the unfixed tree and `null` on this one, and the provider sees no call but its own `init`. Reverting the hunk reproduces exactly that.

### The fourteen

| item | verdict |
| --- | --- |
| `run.js::focusFor` | no defect: every caller passes an engine-solved entry; an unknown chemistry falls back to the LFP parameters, and `battNameplateKwh` divides by a constant DoD from `CHEMISTRIES` |
| `run.js::computeFocusSystem` | no defect: null/undefined, `Number.isFinite`, both-zero and off-grid-degenerate guards run before any simulation, and the chemistry override is validated against `CHEMISTRIES` |
| `run.js::pickBest` | no defect and already covered: filters non-solvable and non-finite entries, returns `null` on an empty pool, and guards the sodium-vs-LFP margin against a zero denominator (`tests/consistency.test.mjs:492–502`) |
| `heatmap.js::updateRankings` | no defect: `if (!r) return` for a missing manifest key, and both list fields are rendered through `esc()`; the numeric fields come from the build-generated `heatmap-rankings.json`, which always emits `high`/`low` or `best`/`worst` per combination |
| `ui.js::purchasePaths` | no defect: null, `solvable === false` and non-finite `annualGridSpendUsd` all return `null`, and the cache is keyed on priced identity. The historical negative-saving bug is described *in the comment*, not present |
| `ui.js::billForKwh` | no defect, and the asymmetry with its inverse is deliberate: `kwhForBill` guards `rate <= 0` because dividing by a zero tariff is undefined, while multiplying by zero correctly yields the fixed charge — that is a real bill, not an error |
| `ui.js::populatePrintSheet` | answered on #196: the `innerHTML` sink exists, but every field it interpolates is a literal, a validated number, or one of the seven hash fields whitelisted in `restoreFromShare`; the permissive codec is pinned by `tests/audit-car1-guards.test.mjs` |
| `location-picker.js::setupCitySearch` | answered on #198: generation-stamped at every async landing site, with query-text equality as a second gate; `tests/location-picker.test.mjs` covers the stale-reply race |
| `chat.js::bodyWithToken` | no defect: a token is requested per attempt (never cached — a replayed token is what the server must reject), and every failure returns the tokenless payload, which the worker refuses once `TURNSTILE_SECRET_KEY` is provisioned. Covered by the executed advisor scenarios |
| `worker/turnstile.mjs::verifyTurnstile` | no defect: every path returns an explicit `{ok:false, reason}` — missing token, missing secret, transport throw, unparseable body, `success !== true` — and the contract at the top of the file states that any non-ok result means reject |
| `nasa.js::idbGet` | fixed in #297: the connection is closed on every exit including the missing-store early return, and the record shape (`Float32Array`, equal non-zero lengths) is validated before use |
| `engine.js::sizeForTier` | no defect: `pvMax <= 0 || battMax <= 0` returns `null` before the search, and the required `maxUnmetHoursPerYear` is supplied by the sole caller (`sizeAllTiers` over `RELIABILITY_TIERS`); omitting it fails closed to "no system", never to a system that ignores a constraint |
| `charts.js::$` | no defect: the injected `$` is initialised by `initCharts` inside the same `preloadRunModules().then` that assigns the module reference, so no chart function can be reached before `_$` exists — the call would throw on `_charts` first |
| `chat.js::buildIntakeBrief` | no defect: composed from select-bounded values and `.trim()`ed free text, and the result is sent as the user's own message, which the system prompt already treats as untrusted data — there is no sink between the DOM read and the request body |

## Evidence

- Suite **1,902/1,902** (up 3 from 1,899)
- `check-chars`, `seo`, `format:check`, `plan:check`, `deploy:check` pass; stamp `20261023j → 20261023k`, `sw.js` `beco-v149 → beco-v150` (`map-provider.js` is served)
- The failing-first test is in `tests/audit-car5-wiring.test.mjs`, with positive controls: a successful init still installs and still draws, `cleanup()` disarms, and an unavailable provider is skipped rather than installed

## What this closes

Car 5's **confirmed-broken** half closed in #297 and its **15 ambiguous** production items are now all dispositioned, so the car is closed except for the record. Nothing here touches #292, #253, #156, or car 2's unrecoverable 27.

Plan item: P0.6. Tracker: #200, #194.
