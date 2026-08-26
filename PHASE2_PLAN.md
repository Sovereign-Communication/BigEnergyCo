# PHASE 2 PLAN — Deterministic Sizing Core + 5-Year Hourly Simulation

**Created:** 2026-08-22, after the P0 hardening pass.
**Goal:** Turn BigEnergyCo from "cost widget + AI chat" into a tool that actually answers *"what
system do I need, and can I live off-grid here?"* — computed by testable code, explained by the LLM.

## Status (2026-08-23) — Phase 2A/2B shipped, then MONEY + COHESION + GRID-TIE + WORLDWIDE (all live)

**2026-08-26 value-pass shipped:** options matrix + true "best pick" ladder
(`payload.matrix` / `payload.best` / `payload.focus`, contract **6**), hardware
BOM module (`assets/js/sizing/bom.js`: panel count/area, system voltage,
series/parallel layouts DIY+retail, inverter class from load peak, controller
amps, fuse/breaker sizes, cable gauge) with CSV export + print integration,
generator-fuel price helper (fuel price → effective $/kWh), footprint lines on
every card, and trust polish (mojibake glyphs fixed, dead advisor-nav code
removed, modal Esc + focus, aria-live status/chat, real `<button>` elements).

| Item | State |
|---|---|
| `assets/js/sizing/engine.js` — derate chain, e1kw series, load models, hourly SOC simulator, tier search | ✅ done, tested |
| `assets/js/sizing/nasa.js` — POWER client, ≤2-yr chunking, localStorage cache, city presets | ✅ done |
| `assets/js/sizing/sizing-worker.js` + `ui.js` + `#sizing` section in index.html | ✅ done |
| **`assets/js/sizing/money.js`** — payback vs grid spend, battery-replacement cadence, LCOE (25-yr horizon) | ✅ shipped 2026-08-23 |
| **Money UI** — payback per tier/target, ¢/kWh vs grid, swap counts, share links (`#s=`), printable one-pager | ✅ shipped |
| **Grid-tie mode** — no-export offset sim (`simulateOffset`), 60/80/95% bill-cut targets (`sizeForBillCut`, monotone binary search on PV), bill-after + payback-out-of-savings | ✅ shipped |
| **Worldwide** — sodium default (+ pricing premium), lead-acid back with TRUE TCO (rate+cold capacity scale, swap counts), user currency field, i18n scaffold (es/pt/fr/ar, RTL) | ✅ shipped |
| **Cohesion** — single-source content module + freenet sync markers, scoped storage comparison (no more hardcoded $ figures), sizer-first CTAs, canonical tag | ✅ shipped |
| **All-options matrix + best pick** — 3 chemistries × 3 tiers/targets from already-computed searches; ladder UI (Best pick / Compare batteries / All options) | ✅ shipped 2026-08-26 |
| **Hardware list (`bom.js`)** — panels+voltage+bank layout+inverter+controller+fuses+cable; CSV download; print-sheet table; live panel-wattage input | ✅ shipped 2026-08-26 |
| **Generator fuel helper** — petrol/diesel price/L → $/kWh (documented L-per-kWh assumptions); feeds existing tariff math | ✅ shipped 2026-08-26 |
| Sheet replication gate (`scripts/validate-against-sheet.mjs`, ±5%) | ⏳ awaiting owner's sheet CSV export |
| Bundled offline climate profiles (PWA/Freenet engine) | ⏳ next |
| Aging fade inside the search objective (currently replacement-count only) | ⏳ v3 |
| Full dynamic-string i18n (results text beyond static chrome) | ⏳ incremental |

**Live-data checks:** `scripts/validate-modes.mjs` runs BOTH modes against real NASA POWER data.
Honolulu 10 kWh/day @ $0.42: tier100 = 8 kW+13 kWh (payback 1.3–4.4 yr); cut60 = 1.8 kW+2 kWh
(payback ~5–18 mo). Oslo proves honest "no practical off-grid solution" at 60°N for 10 kWh/day.

**Verified API contract** (probed 2026-08-22, POWER Hourly API v2.9.9): `ALLSKY_SFC_SW_DWN` returns
**W/m² per hour** (not kWh/m²), timestamps `YYYYMMDDHH` in **Local Solar Time**, fill value −999,
GeoJSON envelope, ~0.31 MB/yr/site, full year fetch ≈1 s. One-year probe at 19.5,-155: 2,088 kWh/m²/yr
GHI, zero gaps.

---

## 0. The product question, stated precisely

A visitor wants one of three systems, depending on their backup tolerance:

| Tier | Audience | Definition | Sizing driver |
|---|---|---|---|
| **A — 100%** | No generator, no grid, ever | Zero unmet load hours across the entire 5-year simulation | Worst multi-day cloudy stretch in 5 years |
| **B — 99%** | Has a generator, refuses to run it often | Loss-of-load ≤ 87.6 h/year averaged over 5 years (~1% of 8760) | Second-worst year behavior; still sized near worst-case |
| **C — 95%** | Happy to run a generator now and then | Loss-of-load ≤ 438 h/year (~5%) | Typical bad stretches; generator covers the tail |

The tool's headline output becomes: **"For X kWh/day at your location: Tier A needs ~P kW PV +
~B kWh battery; Tier B ~…; Tier C ~… — and here's what each costs."**

This is honest, computable, and exactly what nobody else shows in one view.

---

## 1. Data layer — 5 years of hourly weather

**Source: NASA POWER API** (free, global, no key, public domain).
Endpoint: `https://power.larc.nasa.gov/api/temporal/hourly/point`

Parameters per location:

| Param | Meaning | Use |
|---|---|---|
| `ALLSKY_SFC_SW_DWN` | All-sky shortwave down irradiance, kWh/m² per hour | The sun. `E(h) = irradiance(h)` for a 1 kW STC array before derates |
| `CLRSKY_SFC_SW_DWN` | Same, clear-sky | Sanity check / future panel-tilt modeling |
| `T2M` | Air temp at 2 m | Cell temperature derate |
| `WS2M` | Wind speed at 2 m | Cell temperature model refinement |

Request `years=5` (rolling window ending last complete year), format JSON/CSV.
Cache aggressively: round lat/long to **2 decimals** (~1.1 km) → cache key. Irradiance doesn't
change hour to hour or neighbor to neighbor. Cache in Cloudflare KV (site-wide, shared, free tier
sufficient) + browser `localStorage` after first fetch.

**The 1 kW-array translation (formalizing the Google Sheets method):**
`E1kW(h) [Wh] = ALLSKY_SFC_SW_DWN(h) [kWh/m²] × 1000 × η_sys`
where `η_sys = η_snow × η_soil × η_wire × η_mppt × η_temp(h)` and
`η_temp(h) = 1 + γ × (Tcell(h) − 25°C)`, `γ ≈ −0.0034/°C` for mono-PERC,
`Tcell(h) ≈ T2M(h) + (NOCT − 20) × G(h)/800`, NOCT ≈ 45°C.
Everything downstream just multiplies: `PV_W × E1kW(h)` is the DC energy that hour. This keeps
the user's sheet methodology exactly, adds only documented, visible derates.

**Fallback when offline/API-down:** bundle pre-computed **monthly worst-week E1kW profiles** for
~40 climate-representative sites; ship as static JSON. The calculator must produce an answer with
zero network calls (Freenet requirement).

---

## 2. Load model

Three input paths (PLAN.md already specifies these; they feed the simulator):

1. **Daily kWh** — flat 24 h profile (default).
2. **Monthly bill + tariff** → kWh/day.
3. **Appliance builder** — watts × hours × count, with a preset library (fridge, freezer, well
   pump, lights, TV/laptop, router, washing machine, tools, AC/heat options). Output: shaped
   24 h profile with morning/evening peaks — peaks drive inverter sizing, totals drive battery.

Optional seasonal multiplier for cooling/heating-heavy loads (summer/winter factor).

---

## 3. Battery model (deliberately simple, documented)

State of charge, hourly timestep, one full iteration = 5 years ≈ 43,800 steps:

```
charge(h):  avail_pv_ac = PV_W × E1kW(h) / 1000 × η_inv
            to_battery  = min(avail_pv_ac − load(h), max_charge_rate_kw)
            SOC'        = min(SOC + to_battery × η_charge / cap_kWh_usable, 1.0)
discharge:  if avail_pv_ac < load(h):
            draw        = min((load(h) − avail_pv_ac) / η_inv / η_discharge,
                              (SOC × cap_kWh_usable), max_discharge_kw)
            SOC'       −= draw × η_discharge / cap_kWh_usable
unmet(h)   = load(h) − served(h)      # counts toward LOLE; Tier A requires Σ unmet == 0
```

- `η_charge × η_discharge ≈ 0.92` (LFP round trip), split as √ each side.
- DoD handling: usable capacity already excludes reserve floor (default 90% usable for LFP,
  50% lead-acid, 100%-ish sodium-ion per manufacturer).
- Low-temp charge block: if `T2M < 0°C` and chemistry = LFP without heating → charging disabled
  that hour (this *shows* users why cold-climate LFP needs heating, instead of telling them).
- Aging (v2): count equivalent full cycles → linear fade to 80% at rated cycles; simulate at
  end-of-life capacity so sizing survives aging.

---

## 4. Search & output

For a given location + daily kWh + chemistry + reliability tier:

- **Grid search / coordinate descent** over `(PV_kW, batt_kWh)` on a coarse lattice (PV 0.5 kW
  steps 0.5–30; batt 1 kWh steps 1–200), refine ±1 step around best. Each sim point = 43.8k
  iterations — trivially fast in WASM-free plain JS (<50 ms per point; full search <10 s, run in
  a Web Worker so the UI never blocks).
- **Cost function:** `cost = PV_kW × $/W_panels+BOS + batt_kWh × $/kWh_installed` with editable,
  dated default unit costs (three scope presets: ex-factory cells / landed DIY / retail turnkey —
  reusing the P0-reconciled price scopes).
- **Outputs per tier:** minimum viable `(PV, batt)`, expected unmet hours/year, longest
  autonomous stretch survived, worst calendar week chart (SOC line + irradiance bars),
  days-of-autonomy implied, inverter kW from load profile peak (+surge guidance),
  charge controller amps = `PV_W / battery_V × 1.25`.
- **"Show the arithmetic" panel:** every constant (`γ`, NOCT, RTE, DoD, derates, tariff) listed
  with its value and source. Non-negotiable trust feature.
- **Shareable result:** encode inputs + result in URL hash; printable one-pager for installers.

---

## 5. Validation gates (before anything ships)

1. **Replicate the Google Sheet.** For one tropical site (e.g., Pahoa, HI) and one continental
   site, feed the same NASA POWER years used in the sheet and require simulator annual energy
   within **±5%** of the sheet's 1 kW-array totals.
2. **Unit tests:** SOC math (round-trip loss conservation), cold-charge block, DoD clamp, LOLE
   counting, worst-week extraction. Pure functions only — no DOM, no network.
3. **Sanity bounds:** Hawaii 100%-tier results should land in the range experienced builders
   report (roughly 1.3–1.8× PV oversize vs annual-average sizing). If it doesn't, the derate
   chain is wrong, not the world.
4. **Cross-check annual yield** against PVGIS for 3 sites (±7%).

---

## 6. UI integration

- New section above today's cost comparison: **"Size My System"** — location picker (map drop +
  city search), load path selector, chemistry, tier radio (100 / 99 / 95%), Run button.
- Results: three tier cards side-by-side (the tier comparison IS the pitch), SOC chart for the
  selected tier, cost table using the existing scoped-price framework, disclaimer attached.
- AI advisor integration (**this fulfills "the LLM must never produce a number"**): after a run,
  the chat prompt auto-includes the computed result set; the model explains, caveats, and answers
  follow-ups about *these* numbers instead of inventing its own.
- Freenet/offline build gets the same engine via bundled monthly profiles (§1 fallback).

---

## 7. Remaining P1/P2 backlog (folded into this phase)

| Item | Notes |
|---|---|
| Streaming advisor responses | Workers support SSE streaming; perceived latency win |
| Advisor temperature 0.7 → 0.3–0.4 | Numeric-advice quality |
| A11y pass | `<button>` not `<div>`, focus trap + Esc on modals, `aria-live` chat, ≥16px inputs |
| Monitoring | CF Cron hitting `/api/health` + Pages; Groq quota alert email |
| LICENSE file (MIT) | PLAN.md §4 item; liability posture improves |
| CI | `node --check worker/index.js`, pytest/vitest on calc core, link checker on blog |
| Content single-sourcing | Prices/disclaimers/chemistry data into one JSON consumed by both pages |
| i18n + currency + units | Top ~10 languages; user-entered tariff stays |
| Blog: decision-stage posts | "Is off-grid worth it", winter sizing, hybrid-generator, code pointers by country |
| Canonical tag on index.html | Blog already has one |

## 8. Sequence

1. **Week 1:** Calc-core module (pure JS) + unit tests; appliance builder; NASA POWER fetch+cache.
2. **Week 2:** Hourly simulator + tier search; validate vs Sheets (gates §5); results UI.
3. **Week 3:** Advisor grounding, shareable links/print, a11y pass, monitoring, CI, LICENSE.
4. **Week 4+:** i18n, bundled offline profiles, aging model v2, content single-sourcing.
