> **SUPERSEDED — do not act on this document.**
> Moved to `docs/archive/` by plan item **P0.2**. The governing document is
> [`docs/plan/MASTER_PLAN.md`](../plan/MASTER_PLAN.md), which is hash-pinned by
> `docs/plan/PLAN.lock.json` and changes only through a recorded amendment
> (master plan §16). Where this file and the master plan disagree, **the master
> plan wins**.
>
> **Reason for archiving this file specifically:** Executed in full. All six phases shipped: `jargon-dict.js`, `appliances.js` (extracted out of `ui.js`), `map-provider.js`, `wizard.js`, `tests/persona-matrix.test.mjs`, `tests/jargon-lint.test.mjs`, and `de` added to the language picker. It is a completed work order, not a forward plan.
>
> **Where its content went:** R-CONT-02 (glossary + jargon lint, extended to all locales), R-FLOW-01..07 (the location-first flow it designed), R-DS-02 (Simple/Technical mode), and P5/P6. The 12-persona matrix is subsumed by R-ENG-02's fixture matrix. Its roof-drawing Phase 5 is the one requirement NOT carried — see the carry-forward table in the P0.2 pull request.
>
> Retained for history and for the provenance of decisions already shipped. Line
> references below point at `main` as of the archive, not at the plan's `b60a651`
> baseline.

# Google-Quality Worldwide Usability Overhaul — Execution Plan

**For:** Any AI agent (or human) executing the "if Google released a free off-grid
calculator" upgrade. Written to be executed end-to-end without further design input.
**Status:** Approved direction. Estimates are Lines of Code (LOC), not time.
**Supersedes:** Nothing. Complements `PLAN.md` (historical roadmap) and
`PHASE2_PLAN.md` / `PHASE3_PLAN.md` (shipped phases).

---

## 1. Mission

The average person on any continent — any literacy level, any device, any grid
situation — should be able to open this site and grasp, within seconds, how much
money solar + battery could save them, and reach a trustworthy system size without
ever being blocked by jargon, UI confusion, or a dead end.

**Design thesis (goals, not prescriptions — the executor chooses the means):**

1. **Answer first:** the headline result ("solar could cut your bill by X–Y%")
   must be reachable in ≤ 3 user inputs.
2. **One question at a time:** Location → what you power → what power costs →
   result. Everything else is progressive disclosure.
3. **Plain words by default:** every technical term carries an inline ELI5
   explanation; an opt-in Technical mode restores today's exact spec voice.
4. **Honest uncertainty:** ranges and worst-month caveats in plain language,
   never false precision.
5. **Never a dead end:** every error names what happened and the easiest next step.

## 2. Non-negotiable constraints (from AGENTS.md — verified in force)

- Zero runtime dependencies; 100% client-side vanilla JS + Web Workers. Any map
  or heavy feature must be a strictly optional, lazy-loaded add-on; the core
  calculator must work with it blocked, offline, and removed.
- Permanently free, no accounts, no lead capture, no analytics profile.
- All sizing derives deterministically from NASA POWER data (or its bundled
  offline profiles). Same inputs → same outputs, always.
- Git protocol: never push to `main`. Each phase = descriptively named branch →
  `gh pr create` → CI (Tests, CodeQL, Lint) green → merge. Tests live in
  `tests/*.test.mjs` (`node --test`).
- Never silently weaken an existing `GATE:` test. If physics changes make one
  obsolete, justify the change in the PR body and tighten, not loosen, the claim.

## 3. Executor contract (how to run this)

For each phase, in order:

1. `git switch main && git pull`, then `git switch -c <branch>` (names below).
2. Implement. File names in this plan are **suggestions**; any structure is
   acceptable if the phase's acceptance checks pass.
3. **Verification loop** — run, fix, repeat until green (max 5 iterations;
   if still failing, STOP, mark the phase BLOCKED with the exact error, and
   move on to phases that don't depend on it):

   ```powershell
   npm test                          # full offline suite incl. new tests
   node scripts/check-chars.mjs      # UTF-8 integrity
   npm run seo                       # JSON-LD, sitemap, tokens, city-page sync
   npx prettier --check .            # style
   npm run deploy:check              # staging build validation
   npm run smoke                     # browser smoke
   ```

4. If asset files changed, run `npm run tokens` so cache-busting tokens and the
   `seo` check stay consistent.
5. Commit with a conventional message, push the branch, `gh pr create` against
   `main`, and merge only after CI passes.

**Global definition of done (after Phase 6):** all six PRs merged; on `main`,
every command in step 3 exits 0; the persona matrix passes for all 12 personas;
jargon lint passes; a phone-viewport smoke run completes a full sizing flow in
Simple mode without an unexplained technical term.

## 4. Ground truth (verified in this repo — do not re-derive, build on it)

- **Tests are fully offline.** `assets/js/sizing/nasa.js#synthesizeFromProfile`
  expands the bundled 12×24 monthly matrices in `assets/js/sizing/profiles.js`
  (`OFFLINE_PROFILES`, ≥ 60 city presets) into 8760 hourly records. Existing
  tests (`tests/offline.test.mjs`, `tests/worldwide.test.mjs`) drive the real
  engine (`buildE1kw`, `expandProfile`, `simulate`, `runSizing` from `run.js`)
  on synthesized years. **Persona tests must use this path — no network.**
- **Engine facts** (`assets/js/sizing/engine.js`): `DERATES_DEFAULT` soiling is
  a flat 0.97; `coldCapacityScale()` derates lead-acid only (`coldPctPerC` on
  AGM only); LFP has `chargeMinC: 0` (no charging below 0 °C without heating)
  and Na-ion `chargeMinC: -20`, but **neither has a thermal capacity/charging
  model**; there is no worst-month/seasonal analysis (5-year average only).
- **i18n** (`assets/js/shared/locales.js` + `shared/i18n.js`): keys silently
  fall back to English; `ar` flips RTL. New strings must ship in `en` at minimum.
  Note: `i18n.js` `LANGS` currently lists `auto, en, es, pt, fr, ar` — **`de`
  must be added there when Phase 6 German strings land**, or the picker won't
  show it.
- **Appliance library is DOM-embedded**: `const APPLIANCES` at
  `assets/js/sizing/ui.js:201` is not exported and `ui.js` references `window`,
  so Node tests cannot enumerate it. Phase 1 includes extracting it to an
  exported `assets/js/sizing/appliances.js` module.
- **Offline city presets** (`profiles.js`, 66 verified): the personas map to
  these **existing** presets — Lagos, Accra, Delhi, Madrid (not Barcelona),
  Mexico City (not Oaxaca), São Paulo (no Manaus), Tokyo (no Sapporo/Hokkaido),
  Perth, Johannesburg, Suva, Berlin. Extending the preset catalog is possible
  later via `scripts/build-offline-profiles.mjs` but is **not** required by
  this plan — climate signal differences (e.g., Barcelona vs. Madrid) are not
  what these personas test.
- **CSP** (`_headers`): `script-src` already allows `https://unpkg.com`;
  `img-src` allows `https://*.basemaps.cartocdn.com`; `connect-src` allows
  `nominatim.openstreetmap.org` and `power.larc.nasa.gov`. **Phase 5 must use
  only these hosts** (Leaflet via unpkg, Carto raster tiles) or deliberately
  amend `_headers` with rationale in the PR.
- 69 generated city pages under `solar-calculator/<city>/`; `npm run seo`
  (via `scripts/build-city-pages.mjs` + checks) guards copy/SEO consistency.
  Result-page copy changes must not break these.

## 5. Phases

Execute sequentially; Phase 4 and Phase 5 are independent and may swap order.
LOC estimates are net-new/changed lines, ±30%.

### Phase 1 — Worldwide persona test harness (no UI change)

**Branch:** `feat/personas` · **Est. ~480 LOC** (appliance extraction ~80,
registry ~220, tests ~180)

**Goal:** Encode "the average consumer on each continent" as 12 executable
personas that become the regression gate for every later phase.

First, unblock Node-side enumeration: extract the appliance library from
`ui.js:201` into an exported `assets/js/sizing/appliances.js` (ui.js imports
it back; zero behavior change — verified by the existing suite).

Create `tests/personas.mjs`: a registry of 12 personas, each with id, region,
story, **named `OFFLINE_PROFILES` preset** (existing ones only — see §4),
appliance set (names that must exist in the now-exported appliance library),
daily kWh, tariff + currency, coverage goal (off-grid tier or bill-cut target),
chemistry preference, and loose outcome bounds (see Risk R1). Personas:

1. **Amara** — Lagos (urban apartment, 6–8 h/day load-shedding, ~3 kWh/day)
2. **Chandra** — Delhi, rural-proxy (monsoon + well-pump surge, ~8 kWh/day)
3. **Kofi** — Accra (health clinic, humidity, vaccine fridge, ~4 kWh/day)
4. **Sofia** — Madrid (grid-tie with feed-in tariff, ~15 kWh/day)
5. **Javier** — Mexico City, mountain-proxy (autonomy-critical, winter, ~6 kWh/day)
6. **Maria** — São Paulo, Amazon-proxy (isolation, worst-rain-season, ~12 kWh/day)
7. **Ping** — Jakarta, verified preset (irrigation pump, humidity, ~5 kWh/day)
8. **Yuki** — Tokyo, winter-darkness-proxy — LFP charge limit (snow cabin, ~10 kWh/day)
9. **Amelia** — Perth (outback dust, 50 °C heat, stock pump, ~7 kWh/day)
10. **Oluwaseun** — Johannesburg (load-shedding + winter rationing, ~8 kWh/day)
11. **Kai** — Suva (island resort, cyclone risk, generator backup, ~6 kWh/day)
12. **Eva** — Berlin (apartment, feed-in + self-consumption, ~12 kWh/day)

Create `tests/persona-matrix.test.mjs` (house style, `GATE:`-prefixed where it
guards a principle). Per persona: two identical runs → identical outputs
(determinism); outputs within the loose bounds; payback finite when tariff > 0;
every persona appliance exists in the library (this test drives Phase 2 presets);
energy conservation (served + unmet = load) holds.

**Acceptance:** `npm test` green, fully offline. Bounds that fail on first run
are **recorded, reviewed for plausibility, then frozen** (R1) — never deleted.

### Phase 2 — ELI5 copy layer + Simple/Technical mode

**Branch:** `feat/eli5-copy` · **Est. ~740 LOC** (dictionary ~280, locales ~90,
ui.js ~120, html/css ~80, lint test ~110, appliance presets ~60)

**Goal:** No user anywhere is blocked by jargon; no expert is dumbed down to.

- New `assets/js/shared/jargon-dict.js`: plain-language short + long explanation
  for every user-visible term — kWh, Wh, kW, DoD, Ah, inverter, MPPT, autonomy,
  round-trip efficiency, cycle life, usable capacity, soiling, derates, NOCT,
  temperature coefficient, system voltage, string, BMS, LCOE, payback period,
  tariff, unmet hours, reliability tiers, grid-tie/off-grid. House style of
  `locales.js` (silent English fallback).
- `locales.js`: Simple-mode variants of result/status strings; narrative results
  ("a 5 kW array — about 25 panels — catches enough sun to…").
- `sizing/ui.js`: Simple mode **on by default**, persisted in `localStorage`;
  jargon labels render via the dictionary; tooltips become tap-friendly
  (click/tap-to-open, keyboard accessible); 1–2 sentence ELI5 per battery
  chemistry and per reliability tier in results. Technical mode restores
  today's exact labels.
- Add region-relevant appliance presets (water pump, freezer, fans, iron,
  phone charging, workshop tools — as demanded by Phase 1's library test).
- New `tests/jargon-lint.test.mjs`: fails if a banned technical term appears
  bare in user-visible sinks (rendered `index.html` text and `locales.js`
  values) without a registered ELI5 entry; dictionary completeness checked.
  Allowlist: the dictionary's own explanations, `data-eli5` attribute values,
  code comments (R2).

**Acceptance:** full sizing run in Simple mode on a phone viewport shows no
unexplained term; Technical mode is a visual no-op vs. `main` for spec labels;
all checks green.

### Phase 3 — One-question-at-a-time flow + accessibility hardening

**Branch:** `feat/wizard-a11y` · **Est. ~830 LOC** (wizard ~260, ui wiring ~140,
html ~70, css ~110, chart a11y ~50, error states ~60, tests ~140)

**Goal:** The 3-input path to the headline answer; Google-grade a11y and
error states. (Design approach suggested, not mandated: a small step state
machine replacing the dense form as the default entry, with the full form one
tap away for experts.)

- Location (existing city picker + 📍) → load (appliances / bill / kWh) →
  tariff (skippable for pure off-grid) → auto-run.
- Honest states: NASA-timeout toast ("using typical-year mode — results will
  be close"), empty-appliance guidance, "no tariff → payback hidden" banner,
  friendly infeasible-budget verdicts (never a null result).
- Accessibility: skip-to-content link, labels on every input, aria-labels on
  icon buttons, modal focus trap and focus return, touch targets ≥ 48 px,
  muted-text contrast ≥ 5.5:1, visible focus rings, verified at 320 px width,
  `frontier-chart.js` SVG gets `<title>`/`<desc>` and an accessible legend.
- New `tests/wizard.test.mjs`: step transitions, persistence, skip paths,
  error states; extend `tests/i18n.test.mjs` for new strings.

**Acceptance:** keyboard-only full run possible; all Phase 1 personas still
green; checks green including `npm run smoke`.

### Phase 4 — Precision: climate-aware physics + honest uncertainty

**Branch:** `feat/precision-climate` · **Est. ~470 LOC** (engine ~140, run/ui
~120, locales ~40, tests ~170)

**Goal:** The math a layperson can feel: their dust, their heat, their worst
month — presented as honest ranges.

In `sizing/engine.js` (constants exported to the arithmetic panel, as the file
already does):

- Climate-inferred soiling (desert ≈ 0.91, arid ≈ 0.93, tropical ≈ 0.95,
  maritime ≈ 0.96, temperate 0.97) derived **deterministically** from the
  hourly temperature series the engine already receives; user-override in
  advanced mode. No network, no new data files.
- Thermal model for LFP and Na-ion: capacity and charge-limit derating from
  site temperatures (LFP: no charging below 0 °C without heating → plain-language
  winter warning; Na-ion: cold-capable, loss below ≈ −15 °C). Extends — never
  alters — the deliberately-set 80 % DoD / 85 % window values from commit
  dda e32a lineage.
- Worst-month module: lowest-GHI 30-day window in the year, re-simulated,
  surfaced as a plain-language caveat ("covers 99 % of the year; in the worst
  month expect the backup to run 3–4 times").
- User-adjustable wiring/MPPT derates (advanced mode) with ELI5.

Extend `tests/engine.test.mjs` + persona matrix: soiling by climate, thermal by
temperature, worst-month detection; **all existing gates must stay green**
(R3). Phase 1 personas in extreme climates (Yuki, Amelia, Chandra) must size
correctly more conservatively.

**Acceptance:** results show ranges, not false precision; derate breakdown
visible in the arithmetic panel; checks green.

### Phase 5 — Optional map: "confirm your roof/yard"

**Branch:** `feat/map-optional` · **Est. ~420 LOC** (provider ~160, ui ~110,
html ~40, tests ~110)

**Goal:** GPS coordinate → zoom → user confirms/redraws their roof or yard →
approximate installable area caps the PV size. Hyper-individual, and strictly
optional.

- New `sizing/map-provider.js`: provider registry (`available()/init()/cleanup()`).
  Ship one provider: **Leaflet loaded lazily from unpkg + Carto raster tiles** —
  both hosts are already CSP-allowed (see §4). Do **not** couple to any
  unverified external repo (including "Gods Eye View"); the interface exists so
  a satellite/3D provider can be swapped in later without UI changes.
- Flow: after location is set, an optional card ("Draw your roof on a map?")
  → tap loads the provider script **only then** (core bundle unchanged) →
  drag a rectangle → area in m² → ~6 m²/panel → caps PV size with an ELI5
  note. Fallback always present: manual rough roof area with equivalence hints
  ("30 m² ≈ 7 panels").
- Privacy: coordinates go only to the tile server and NASA POWER (matching
  current behavior); add a one-line disclosure; nothing stored.
- New `tests/map-feature.test.mjs`: with no provider available the site behaves
  exactly as before (sizing identical); area→PV-cap math; cleanup on close.

**Acceptance:** with network blocked, `npm run smoke` and the full suite are
unaffected; with map enabled, the cap flows into sizing deterministically.

### Phase 6 — i18n expansion + final QA

**Branch: `chore/i18n-eli5`** · **Est. ~570 LOC** (translations ~450, tests ~60,
polish ~60)

**Goal:** The ELI5 layer speaks the top world languages; everything verified.

- Translate the jargon dictionary + wizard copy for **es, pt, fr, de**; `ar`
  reuses the existing RTL path (dictionary only). Missing keys fall back to
  English silently; a leaked key name is a test failure. Add `de` to the
  `LANGS` array in `shared/i18n.js` so the picker exposes German.
- Re-run the persona matrix per locale; final full verification on `main` after
  merge (the §3 global definition of done), including a phone-viewport smoke.

## 6. Risk register (sanity-check of the plan)

| #   | Risk                                                              | Mitigation (built into the phases)                                                                                                                                                                                           |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Persona bounds are guesses → flaky tests                          | Snapshot-then-freeze: first run **records** actuals; bounds reviewed for plausibility, then frozen as gates. Loose outer bounds (e.g., 0 < PV < 50 kW) hard-assert; tight bounds are documented expectations until reviewed. |
| R2  | Jargon lint false-positives (terms inside their own explanations) | Lint only user-visible sinks; explicit allowlist for dictionary values, `data-eli5` attributes, comments.                                                                                                                    |
| R3  | Physics changes break existing gates                              | Full `npm test` every iteration; a changed `GATE:` requires PR-body justification and must tighten, never loosen, the claim.                                                                                                 |
| R4  | CSP blocks map tiles/scripts                                      | Use only pre-allowed hosts (unpkg, basemaps.cartocdn.com) or amend `_headers` deliberately with rationale.                                                                                                                   |
| R5  | Stale cache tokens / service worker serving old assets            | `npm run tokens` after asset changes; `npm run seo` enforces; `sw.js` behavior covered by `tests/offline.test.mjs` + smoke.                                                                                                  |
| R6  | Suite runtime grows past usefulness                               | Personas run on synthesized typical-years only (no network, no 5-yr fetch in tests). Full `npm test` should stay ≈ its current runtime; if it doubles, profile and split.                                                    |
| R7  | i18n scope creep                                                  | Only dictionary + wizard strings in 5 locales; silent fallback makes partial coverage safe; leaked keys are the failure mode, missing keys are not.                                                                          |
| R8  | Executor blocks on one phase                                      | Blocked protocol in §3: 2 failed fix attempts → mark BLOCKED with exact error → continue with non-dependent phases → report.                                                                                                 |

## 7. Confidence statement

Estimated total ≈ **3,500 LOC ±30 %** across 6 PRs. Every claim in §4 was
verified against the current tree (city-preset coverage, appliance-library
embedding, CSP strings, engine constants all checked directly); an independent
skeptical review pass found three defects (missing city presets, unexported
APPLIANCES, `de` absent from `LANGS`), all three of which are now incorporated
into §4 and the phases. Every phase's acceptance is a runnable command, not an
opinion; every named risk has a built-in mitigation. The two largest residual
unknowns — persona bound plausibility (R1) and translation quality (R7) —
degrade gracefully and are reviewable artifacts, not blockers.

**Out of scope (reject re-proposals):** full site translation beyond the five
locales; any runtime dependency on external map/3D repos; backend/accounts/
analytics; paywalls or lead capture in any form.
