## The three that were real

Car 2 (#197) is 51 must-fix items — functions the security battery scored below 0.5 for fail-closed behaviour. Each sits at prescription confidence 0.04–0.86, i.e. below the 0.95 gate, so each is a suspect and the code is what settles it. Nine of the eleven production items turned out to be already-guarded or obsolete; three items across the car were real, and all three are the same shape: **a boundary that accepted whatever arrived.**

### `worker/index.js` — an unreadable body escaped as a bare 500

`callGroq` appears three times, each wrapped in `.catch(() => null)` because a transport throw from `env.fetch` would otherwise escape `handleChat` as a Worker exception: a 500 with no CORS headers, which the browser shows as an opaque network failure with the chat box stuck on "Thinking…". The guards cover the fetch and stop there. `await groqRes.json()` two lines later is the *other* way an upstream can throw — a truncated generation, a proxy page, a captive portal that answers 200 — and it had no guard at all, with no `try` around `handleChat` and none around `fetch()`.

```js
    const data = await groqRes.json();     // SyntaxError escapes the handler
```

It now ships the text already streamed if there is any, else the same degraded reply every other upstream failure gets. Reverting just this hunk reproduces the original: `SyntaxError: Unexpected token '<' in JSON` at `handleChat (worker/index.js:835)`.

### `assets/js/sizing/cities.js` — a blank coordinate became 0,0

`Number("")`, `Number("   ")` and `Number(null)` are all **0**, and 0,0 is a finite, in-range coordinate. So a country partition row or a geocoder response with a blank `lat` resolved to a perfectly plausible place in the Gulf of Guinea, passed `Number.isFinite` and the ±90/±180 bounds, and sized a system for coordinates nobody chose. An *absent* one became `NaN`, which reached the coordinate boxes and the wizard. Both parsers now reject blank/absent/unparseable before the range check; a genuine 0 survives, because the equator and the prime meridian are real places. `lookupCityOnline` additionally returns `null` when it cannot place its own result, so the picker says "No match found" instead of resolving it.

This is one layer down from `setCoords`, which is where the prescription pointed. `setCoords` is guarded three times downstream — `renderSunPath` clamps to a default latitude, `estimateTariff` falls back to "global average" for non-finite input, and `run()` refuses to send a non-finite or out-of-range coordinate — so the prescribed crash does not happen. The bad state still had to come from somewhere, and it came from here.

### `scripts/smoke/privacy.mjs` — precision was measured as magnitude

```js
if (Number.isFinite(value) && Math.abs(value) > 0.01 * 100)   // 0.01 * 100 === 1
```

The comment above it says "anything finer than the rounding we ship is a finding", and the code compares the coordinate's **magnitude** with 1. Every correctly rounded request outside ±1° — including `latitude=51.51`, the shipped two-decimal form — was reported as a leak, and a metre-accurate fix in Nairobi (`latitude=0.512345`) was invisible because 0.51 < 1. The `COORD` regex also matched `lat(?:itude)?` only, so a four-decimal **longitude** beside a clean latitude was never examined, and it reported the clean latitude instead.

Precision is now counted against `COORD_DECIMALS` — the constant the browser rounds with, so the measurement cannot drift from the product — on both axes, anchored to a real `?`/`&` parameter so `translate=` and `flat=` are not read as coordinates.

## Evidence

Nine tests in `tests/audit-car2-boundaries.test.mjs`. Each fix was reverted in place and the suite re-run, then restored:

| fix | failure on the unfixed tree |
| --- | --- |
| worker body read | `SyntaxError: Unexpected token '<' in JSON: <html>captive portal</html>` thrown out of `handleChat` |
| city coordinates | `parseCityRows` returns `["Blank", "Accra", "Quito"]`; the geocoder returns `{lat: 0, lon: 0}` for `lat: ""` |
| privacy precision | all four correctly rounded URLs reported; `latitude=0.512345` reported as `[]`; `longitude=-157.8597` reported as the clean `21.31` |

- Suite **1,899/1,899** (up 9 from 1,890)
- `check-chars`, `seo`, `format:check`, `plan:check`, `deploy:check` all pass; stamp `20261023h → 20261023i`, `sw.js` `beco-v147 → beco-v148` (`cities.js` is served)

## The other 48

Dispositioned on #197 with the code that decides them: the seven production items already killed as false positives in the confirm-or-kill pass (`purchasePaths`, `applyGenRate`, `runSizingUncached`, `band`, `monthName`, `location-picker.js::el`, `nasa.js::buildUrl`), the eight reclassified as fallback defaults and closed by car 4 (#299), `mergeReSlice` pinned by car 1 (#296), and the tooling entries that are test doubles or fixtures (`put`/`delete`, `stubPowerFetch` ×2, `doc.head.appendChild`, `stub`, `fetch` ×2), the smoke runners (`runLifecycleFlow`, `runPrivacyFlow`, `runVerifier`), and two gate helpers read against their callers (`applyPolicy` mirrors the platform's own `_headers` application; `aimsOutsideSite` stringifies its input, so the crash the prescription imagined is impossible).

Plan item: P0.6. Tracker: #197, #194.
