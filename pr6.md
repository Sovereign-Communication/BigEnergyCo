## The unit half was mostly not a gap

Car 6 alleged 6 integration and 202 unit gaps. Read against the code, the unit gaps are largely an artefact of how they were counted: the battery asked which functions have a **direct** test, and a private helper exercised on every call by a public entry point counted as untested.

| named gap | actual coverage |
| --- | --- |
| `engine.js::sizeForTier` (2.35) | direct: `tests/engine.test.mjs:311–345` |
| `simulateOffset` (2.15) | direct: `battery-oversize`, `engine-search-gap` (×3) |
| `paths.js::priceOne` (2.19) | transitive: called by `priceAllPaths`, covered by `comparison.test.mjs` and `quote-text-bridge.mjs` |
| `engine.js::runDischarge` (2.06) | transitive: called three times by `simulate`/`simulateOffset`/`simulateOutage`, whose reserve-release and cold-charge behaviour `usecases.test.mjs` pins by name |
| `bom.js::buildBom` (2.07) | direct: `tests/bom.test.mjs` (LFP, sodium, AGM cases) |
| `frontier.js::sweepSystems` (2.03) | direct: `frontier.test.mjs`, `battery-oversize.test.mjs` |

A second test that re-enters the same public function under a different name would raise the count and not the signal, so those are recorded rather than written. **The other ~196 unit gaps cannot be identified** — the issue points at `audit.db` table `battery_testplan`, which is not in the repository (PR #193 carried `prescriptions.csv`, `context-needs.csv` and the verdict prose only). Same blocker as car 2's 27.

## What actually had no executed test

The input boundary and two ladder controls. `readInputs` had one test that asserted a *source line is absent*; `setLevel` and `syncCutControls` had none — `syncCutControls` appeared only inside an unrelated `doesNotMatch`.

Each is now sliced out of `ui.js` and **executed** in a `vm`, with only module state and collaborators stubbed, so the assertions are about arithmetic and state rather than about stubs:

- every display-currency figure — tariff, export rate, fixed charge — is converted to USD exactly once and left alone when there is no currency;
- bill mode derives kWh/day from the bill and never from a leftover number in the kWh box, and the derivation becomes the new slider anchor;
- an unusable load entry yields `NaN`, which is precisely what makes `run()` refuse it rather than size a system nobody asked for;
- off-grid prefers its own slider, falls back to the numeric box;
- a roof area caps the PV envelope in kW (`floor(area / 6)` panels × 550 W), and an unusable area caps nothing;
- `setLevel` moves the ladder without rendering when there is no payload;
- `syncCutControls` clamps to 1–150, rounds, and writes slider, label and preset select from one value.

`el` gains the escape invariant behind its two dismissed flags: the text argument reaches `textContent`, so markup stays data and nothing in a hostile string becomes an attribute.

## Failing-first proof

Each fix was mutated in place and the suite re-run:

| mutation | test that fails |
| --- | --- |
| drop `t / fx.rate` on the tariff | *converts every display-currency figure to USD once* |
| `renderResults(lastPayload)` unconditionally in `setLevel` | *setLevel renders only when there is a payload* |
| remove the `1..150` clamp | *clamps to the slider's real range* |
| return `area` instead of kW for `pvMaxOverride` | *a roof area caps the PV envelope in kW* |
| `el` writes `textContent` → `innerHTML` | both `shared-dom` tests |

The first attempt at the `setLevel` mutation silently hit a coincidental identical line in another function — which is exactly why the mutations were re-run and the failure inspected rather than assumed.

## Result

- Suite **1,915/1,915** (up 13 from 1,902)
- Test-only diff: no served change, so the asset stamp stays `20261023k`
- `check-chars`, `seo`, `format:check`, `plan:check`, `deploy:check` pass

Two items are dispositioned rather than tested: `pipelineEl` is a one-line `$("loadingPipeline")` accessor whose only test would assert `getElementById` returns what the stub was told to return, and `run` is the orchestrator the browser smoke drives by clicking `btnRunSizing` — a unit test would stub the entire pipeline it exists to sequence.

Plan item: P0.6. Tracker: #201, #194.
