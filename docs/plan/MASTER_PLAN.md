# Master Plan v1: a world-class free solar and battery calculator

| Field      | Value                                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Status     | Active. **Immutable**: hash-pinned by `docs/plan/PLAN.lock.json`, enforced by `npm run plan:check` in the required `test` CI job.             |
| Adopted    | On the merge of the pull request that adds this file (the ledger's `adopted` row records the date and SHA).                                   |
| Owner      | @Treystu (sole approver of amendments).                                                                                                       |
| Amending   | Only through an entry in `docs/plan/AMENDMENTS.md` (§16). Status never lives in this file.                                                    |
| Progress   | The append-only `docs/plan/LEDGER.jsonl` (evidence), plus the pinned GitHub issue titled "Master plan tracker" (live checklist).              |
| Supersedes | Every other plan or roadmap document in the repo (§15, item P0.2). If one contradicts this plan, this plan wins.                              |
| Product    | `https://freeoffgridcalculator.com/` (production, Cloudflare Pages), staging on GitHub Pages, API on the Cloudflare Worker `worker/index.js`. |

## 0. How to read this plan

- **MUST / MUST NOT / SHOULD / MAY** follow RFC 2119. Anything without one of these words is explanation.
- **IDs are stable and never reused.** `U-` marks an owner requirement, `D-` a locked decision, `Q-` a quality-bar metric, `F-` an audit finding, `R-` a product requirement, `P<n>.<m>` a delivery work item, `V-` a fact that must be verified before it ships, `K-` a risk, and `O-` an owner-only action.
- Every `F-` maps to at least one `R-`, every `R-` to a `P` item, and every `P` item to a verification (§7, §13). Appendix A traces every owner requirement to where it is satisfied.
- Facts about the current codebase cite `file:line` as of commit `b60a651`, the base this plan was written against. Line numbers drift, but the finding does not.
- This plan specifies **what** must be true and **how it will be proven**. It leaves implementation freedom only where the outcome and its test are fully specified.

## 1. Mission and outcome

**Mission.** Anyone, anywhere, on any phone and in their own language, gets a truthful, sourced answer to one question within a minute: _what would it cost me to cut my electricity bill (or back up my home, go off-grid, or power my gear on the move), how much of a typical installer's price is markup I can avoid, and when do I come out ahead?_ Every household that acts on the answer reduces its load on the grid. That frees grid capacity for industry and balancing, and that is the point of the project (U-13).

**Definition of done for the program (the "v1.0 world-class" exit, P10).** All of the following hold on the production build at the same commit:

1. Every quality-bar metric in §3 meets its threshold, and that is recorded in the ledger with artifacts.
2. The live Jev complete gate scores ≥ 99.0 overall, **every facet is at `proven`**, and every hard gate is green (Q-01).
3. Every finding in §5 is closed by a merged PR whose ledger row cites the proving test or measurement.
4. The owner signs off in the ledger (`kind: "phase-done"`, `ref: "P10"`).

## 2. Locked decisions (owner interview, 2026-09-25)

These answers are binding. Changing one requires an amendment (§16).

| ID   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-01 | **Four purchase paths** are compared for every fixed installation: (1) **Turnkey installer, cash**; (2) **Lease / PPA** (third-party-owned, monthly payments); (3) **Self-purchase + licensed electrician** (you buy the equipment; an electrician installs and connects it); (4) **DIY mounting + electrician connection and inspection** (you mount panels and racking; a licensed electrician does all electrical work, the connection, and the inspection).                                                                                                                                                                     |
| D-02 | **Two centerpiece charts, in this order:** (1) the **frontier**: X = total 20-year spend on the system, Y = the use case's outcome (bill-cut % for bill-cut), one line per path; (2) the **timeline**: cumulative money out of pocket, years 0–20, one line per path plus "stay on the grid", with break-even markers.                                                                                                                                                                                                                                                                                                              |
| D-03 | **Live Jev is a merge gate.** The planning session had no Jev key, so every phase PR merges only with a recorded live Jev run (§13.3). Until the CI secret exists (O-01), the owner runs it locally and attaches the report.                                                                                                                                                                                                                                                                                                                                                                                                        |
| D-04 | **Audit-driven scope.** Change only what a finding (§5) requires. Keep whatever already meets the bar. No change for its own sake.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D-05 | **Never name firms.** No page, label, chart, dataset field or blog post names an installer, lessor, PPA provider or financier. Paths use generic labels. Interpretation for other companies: hardware brands are not named in UI copy (the bill of materials lists generic specs, with no store or affiliate links). A dataset publisher (a statistics office, a national lab, a price index, or a retail catalog used as a price sample) MAY be named **only as the cited publisher** on the Sources page, because a citation without a publisher cannot be checked. Company earnings filings are not used as user-facing sources. |
| D-06 | **Tracking.** This plan merges to `main`. A pinned tracking issue carries the live checklist. Every phase PR links both.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| D-07 | **Immutability.** The plan is hash-pinned and changes only through an append-only amendment log that the owner approves (§16).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D-08 | **Visual direction: Google-grade neutral.** Informed by Material 3 but brand-neutral: system font stack, one accent colour, answer-first typography, light and dark themes, WCAG 2.2 AA or better, fast on low-end phones.                                                                                                                                                                                                                                                                                                                                                                                                          |
| D-09 | **Legacy plan documents** move to `docs/archive/` with a "Superseded by docs/plan/MASTER_PLAN.md" banner (P0.2).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D-10 | **Legality.** All four paths are always computed for every fixed-installation use case (bill-cut, time-of-use, backup, off-grid); portable power has its own two paths (§6.3), because D-01 scopes the four paths to fixed installations. Each is flagged per country as _Allowed_, _Allowed, but loses incentive X_, _Not permitted for grid connection_, or _Unverified: check locally_, with a cited source. A lost incentive is priced into that path.                                                                                                                                                                          |
| D-11 | **AI advisor (Groq) stays** with its current models. It opens after a sizing has run and answers questions about the visitor's computed system. **Jev scores every reply for truthfulness and accuracy**, and both scores appear at the bottom of each reply next to its timestamp.                                                                                                                                                                                                                                                                                                                                                 |
| D-12 | **Jev on sizing: verify, then reveal; never edit.** Deterministic invariants run first. Jev then reviews the result before it is revealed, within a hard time budget. A flag triggers deterministic cross-checks and a visible notice. A pass is used internally and is not shown anywhere on the page. Jev never changes a number.                                                                                                                                                                                                                                                                                                 |
| D-13 | **Jev cost and provider.** The canonical direct price is **US$0.00042 per 1,000,000 tokens** (TypeSafe direct). **OpenRouter is removed as a Jev path everywhere**, in both the runtime and the gates. There is no monthly spend cap; the existing abuse rate limits stay.                                                                                                                                                                                                                                                                                                                                                          |
| D-14 | **Languages.** First, bring the six current locales (`en es pt fr de ar`) to parity at the 99 bar. Then expand, continuously, to **every language the reference machine-translation system supports (200+)**. Each language is hard-gated to the same bar (Jev ≥ 99 plus mechanical parity).                                                                                                                                                                                                                                                                                                                                        |
| D-15 | **Translation production.** AI agents translate, the Jev gate plus mechanical checks judge, and every page carries a "Suggest a translation fix" link that opens a prefilled GitHub issue (no data collection).                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D-16 | **Use cases.** Bill-cut is primary. The others are time-of-use battery-only savings, emergency backup of essential loads, an emergency reserve held inside any battery, a full off-grid home, and portable/mobile power. All of them live in **one unified tool with one logical flow**.                                                                                                                                                                                                                                                                                                                                            |
| D-17 | **Flow order.** Location first ("Use my location") → infer everything knowable and have the visitor **confirm** it (price per kWh, currency and so on) → choose a use case → enter bill, budget and target bill-cut → optionally customise → "Size my system".                                                                                                                                                                                                                                                                                                                                                                      |
| D-18 | **Measurement.** Cloudflare Web Analytics (cookieless) plus Google Search Console. No trackers, no ads, no lead capture.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| D-19 | **Name and domain.** Keep `freeoffgridcalculator.com` and the product name. The H1, title and meta lead with the job, e.g. "Cut your electricity bill, back up your home, or go off-grid — free solar & battery calculator", localised.                                                                                                                                                                                                                                                                                                                                                                                             |
| D-20 | **Horizon.** 20 years, for every use case and every path. Replacements that fall within the horizon are included.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

The standing rules in `AGENTS.md` bind every item in this plan: PRs only, tests for every change, permanently free, zero runtime dependencies, physics and determinism first, and an educational ELI5 mission.

## 3. The quality bar: "Google-quality", made measurable

The owner asked for **99/100 on every aspect**. A metric scored out of 100 must reach ≥ 99. Anything else must meet the numeric threshold below. **Every threshold below is enforced on the schedule in §3.2** (regression-blocking first, absolute from a named phase). Thresholds are deliberately **stricter than Google's own "good" lines** (for example, Core Web Vitals "good" is LCP ≤ 2.5 s, INP ≤ 200 ms and CLS ≤ 0.1 at p75).

| ID   | Aspect               | Metric and threshold                                                                                                                                                                                                                                                                                                                                                                                                       | How it is measured                                                                          |
| ---- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Q-01 | Jev completeness     | **Phase PRs:** scoped gate ≥ 99.0 on the item's facets, and no facet below its last ledger level. **Program exit:** overall ≥ 99.0, every facet `proven`, all hard gates green.                                                                                                                                                                                                                                            | `scripts/validate-jev-complete.mjs` (live), §13.3                                           |
| Q-02 | Lighthouse           | Every page template, mobile **and** desktop, median of 3 runs on the staged build: Performance ≥ 99; Accessibility, Best Practices and SEO all = 100.                                                                                                                                                                                                                                                                      | CI `quality-lab` job (P0.4)                                                                 |
| Q-03 | Speed (lab)          | LCP ≤ 1.8 s mobile / ≤ 1.0 s desktop; CLS ≤ 0.02; TBT ≤ 100 ms. Every step transition and the result render take ≤ 100 ms of main-thread time under 4× CPU throttle.                                                                                                                                                                                                                                                       | Lighthouse, plus Playwright event timing                                                    |
| Q-04 | Speed (field)        | Once enough data exists, p75 LCP ≤ 2.0 s, INP ≤ 150 ms, CLS ≤ 0.05, per country with data.                                                                                                                                                                                                                                                                                                                                 | Search Console CWV report, Cloudflare Web Analytics                                         |
| Q-05 | Byte budgets         | See §3.1, per template.                                                                                                                                                                                                                                                                                                                                                                                                    | CI budget test on the staged, compressed build                                              |
| Q-06 | Time to answer       | ≤ 3 interactions on the default path (Use my location → Looks right → Size my system). Median ≤ 20 s from load to result on an emulated mid-tier phone (Slow 4G, 4× CPU), scripted input, human think-time excluded. Engine p95 ≤ 1.5 s at 4× CPU for bill-cut with cached weather.                                                                                                                                        | Playwright scenario suite                                                                   |
| Q-07 | Accessibility        | axe-core: **0 violations** (WCAG 2.2 A/AA plus best-practice rules) on every template × state × theme × text direction. Keyboard-only completion of every flow. 320 px reflow and 200 % zoom with no loss. Forced-colors mode. Reduced motion. Touch targets ≥ 44×44 CSS px. Underlined text links. Every chart has a text summary and a data table. A screen-reader pass (NVDA + Chrome, VoiceOver + Safari) is recorded. | Playwright + axe in CI; the screen-reader pass is recorded per phase that changes UI (O-06) |
| Q-08 | Cross-browser        | Chromium, Firefox and WebKit at 320 / 390 / 768 / 1440 px widths. 0 console errors, 0 CSP violations.                                                                                                                                                                                                                                                                                                                      | Playwright in CI                                                                            |
| Q-09 | Visual quality       | 0 unapproved visual diffs (> 0.1 % pixels) across the snapshot matrix (template × width × theme × direction). 0 raw colour, spacing or font values outside the token file.                                                                                                                                                                                                                                                 | Visual-regression job, token lint                                                           |
| Q-10 | Truth and provenance | 100 % of displayed assumptions resolve to a registry entry with source, grade and date. 0 past-due `review_by` dates at release. 0 invariant failures across the fixture matrix (§6.8, §6.9).                                                                                                                                                                                                                              | `data:check`, invariants suite                                                              |
| Q-11 | Physics accuracy     | Annual AC yield within ±5 % of NREL PVWatts (current version) for the 12 reference sites (Appendix B), same system spec.                                                                                                                                                                                                                                                                                                   | Manual validator, recorded in the ledger (needs network)                                    |
| Q-12 | Comprehension        | For every shipped locale, an automated reader (Jev) given **only** the rendered accessibility-tree text of a results page answers three questions correctly: the bill-cut %, the installer-vs-self-purchase gap, and the break-even year. Required score: 100 %.                                                                                                                                                           | Comprehension probe (P6.9)                                                                  |
| Q-13 | Internationalisation | Per locale: 100 % key and placeholder parity, 0 English leakage outside an allowlist, all numbers, currency, dates and plurals via `Intl`, glyph coverage with no tofu, RTL snapshots for RTL scripts, Jev translation-quality facet `proven`.                                                                                                                                                                             | `check-i18n` (extended), visual job, Jev                                                    |
| Q-14 | Resilience           | Every external dependency's failure is tested and degrades with a label, never a blank or broken UI: NASA POWER, FX, geocoder, Groq, Jev, analytics, fonts, map tiles.                                                                                                                                                                                                                                                     | Fault-injection smoke flows                                                                 |
| Q-15 | Privacy and security | 0 cookies. Coordinates rounded to 0.01° before any egress (V-10 may coarsen this). No `unsafe-inline` in `script-src`. 0 CodeQL alerts. Secret scan clean. npm ecosystem covered by Dependabot.                                                                                                                                                                                                                            | CI plus CSP test                                                                            |
| Q-16 | Test depth           | Coverage ≥ 90 % lines, ≥ 85 % branches, ≥ 90 % functions on the engine, economics, registry and invariant modules (baseline 67.46 / 78.35 / 60.00). Raised by a ratchet at every phase and never lowered.                                                                                                                                                                                                                  | `npm run coverage` (scope widened in P3)                                                    |
| Q-17 | Search and reach     | 0 Search Console indexing errors on submitted sitemaps. 0 hreflang errors. 0 structured-data errors. Every shipped locale has indexable, localised URLs.                                                                                                                                                                                                                                                                   | Search Console (O-04), `npm run seo` (extended)                                             |
| Q-18 | Advisor truthfulness | Every reply carries Jev truthfulness and accuracy scores plus a timestamp. On the advisor eval set (≥ 50 questions per use case, 6 locales): median truthfulness ≥ 99, median accuracy ≥ 99, and **0** unmatched numbers from the deterministic numeric cross-check.                                                                                                                                                       | `scripts/validate-advisor.mjs` (P7, manual live validator)                                  |

### 3.1 Byte and request budgets (brotli-compressed, staged build)

| Budget                                                                                   | Limit    |
| ---------------------------------------------------------------------------------------- | -------- |
| Home document (HTML, inline critical CSS, JSON-LD)                                       | ≤ 30 KB  |
| All CSS                                                                                  | ≤ 20 KB  |
| JavaScript executed before step 1 is interactive                                         | ≤ 35 KB  |
| JavaScript to the first result (UI, worker, engine, economics, charts)                   | ≤ 200 KB |
| Strings for one locale                                                                   | ≤ 25 KB  |
| Registry data for one country                                                            | ≤ 6 KB   |
| Requests before first interaction                                                        | ≤ 10     |
| Web fonts for scripts that system fonts cover                                            | 0 bytes  |
| Web fonts per lazily loaded script subset (only where system fonts lack coverage, §6.10) | ≤ 60 KB  |
| Heatmap initial payload                                                                  | ≤ 300 KB |

P0.4 measures the compressed baseline. If a limit proves physically unreachable, measured evidence plus an amendment may relax it. Nothing else may.

### 3.2 Gate enforcement: ratchet first, absolute later

Every gate starts in P0 as **regression-blocking**: no PR may make a metric worse than its last ledger baseline. Each gate becomes **absolute-blocking** in the phase that delivers the capability it measures:

| Gate                                   | Blocks on regression from | Blocks on absolute threshold from                                                                                                  |
| -------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Plan pin, tests, SEO, prettier, CodeQL | already                   | already                                                                                                                            |
| Jev scoped gate (Q-01)                 | P0.3                      | P0.3 (on the phase's own facets; P0.1 and P0.2 are exempt, and "P0.3" means all five sub-PRs (a)–(e); see the §9 rule 6 bootstrap) |
| Lighthouse, axe, cross-browser         | P0                        | P5 for templates in the new shell; P8 for everything                                                                               |
| Visual regression                      | P5                        | P5                                                                                                                                 |
| Byte budgets                           | P0                        | P6 for `/next/`; P8 for all                                                                                                        |
| Registry provenance (Q-10)             | P2                        | P2                                                                                                                                 |
| Coverage                               | now (ratchet)             | P3 (engine and economics ≥ 90/85/90)                                                                                               |
| Advisor truthfulness (Q-18)            | P7                        | P7                                                                                                                                 |
| i18n quality (Q-13)                    | P0                        | P8 for the 6 locales; each new language at its launch                                                                              |
| Program exit (Q-01 full)               | n/a                       | P10                                                                                                                                |

## 4. Baseline: current state, measured 2026-09-25 at `b60a651`

Measured in the planning session. The sandbox's TLS proxy blocked live NASA, FX and CDN calls, so browser measurements reflect the offline-fallback path. P0.4 re-measures everything on CI with real network access.

| Area                  | Measurement                                                                                                                                                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tests                 | `npm test`: 739 / 739 pass (~148 s) at `b60a651`. Later counts are recorded in the ledger, not predicted here. `check-chars`, `npm run seo`, prettier and `deploy:check` all pass.                                                                         |
| Coverage              | 67.46 % lines / 78.35 % branches / 60.00 % functions across 5 modules (floor 66 / 76 / 60).                                                                                                                                                                |
| Jev complete gate     | `--local-only` without an evidence file: 20 / 100 (by design, since unrecorded runs count as failures). Target constant 95 (`scripts/lib/jev-complete.mjs:27`). Price constant `42.0` (`scripts/validate-jev-complete.mjs:47`). OpenRouter backup present. |
| Lighthouse (home)     | Mobile 93 / 100 / 96 / 100 (LCP 1.8 s, CLS 0.128, TBT 120 ms, TTI 7.9 s). Desktop 98 / 100 / 96 / 100.                                                                                                                                                     |
| Lighthouse (city)     | `solar-calculator/phoenix/`: 100 / 100 / 100 / 100 on mobile and desktop.                                                                                                                                                                                  |
| axe (home, 390 px)    | 0 violations. Needs review: 118 contrast nodes on gradients, 8 links distinguished by colour only.                                                                                                                                                         |
| Weight                | Home: 38 requests, ~900 KB uncompressed (748 KB JS in 32 requests, 118 KB HTML, 34 KB CSS). `index.html` 120,839 B; `ui.js` 284,247 B; `locales.js` 153,460 B (all 6 languages in one file); `heatmap-grid.json` 6,988,683 B.                              |
| Flow                  | 4 interactions to the first answer (search, type, pick, run), ~1.9 s on the offline profile. 31 form controls on the home page.                                                                                                                            |
| Coverage of the world | 220 per-country place files and 66 city pages, but tariffs come from ~40 lat/lon boxes plus 50 US states and DC (`assets/js/sizing/pricing.js:229-599` for the boxes and `605-657` for the states). 24 currencies. 6 locales, with `ar` the only RTL one.  |
| Content               | 10 blog posts, an about page, a heatmap and a 404 page.                                                                                                                                                                                                    |
| CI                    | Required checks: `test`, `web-smoke`, `coverage`, `analyze`, plus a CodeQL alert rule. No Lighthouse, axe, visual regression, cross-browser or npm Dependabot.                                                                                             |

## 5. Audit findings (the gap register)

Severity: **S1** means truth, legal, safety or privacy: a visitor could be misled or harmed. **S2** means it blocks the world-class experience. **S3** means quality debt. "Closed by" names the requirements (§6) that close each finding.

### 5.1 Truth, economics and data

| ID   | Sev | Finding (evidence)                                                                                                                                                                                            | Closed by            |
| ---- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| F-01 | S1  | The turnkey "quote" is the site's own DIY hardware estimate × 10 (low) / × 5 (high), with no source, date or country basis. It is shown as a market range (`assets/js/sizing/ui.js:4701-4760`).               | R-PATH-01, R-DATA-01 |
| F-02 | S1  | Electrician hookup is a flat "$1,500–$3,000" in every country (`ui.js:4742,4744,4760`), which contradicts the region-scaled labour model in `money.js:65-70` and `pricing.js` `laborF`.                       | R-PATH-03, R-DATA-01 |
| F-03 | S1  | Permit, inspection and interconnection fees are not modelled at all.                                                                                                                                          | R-PATH-03            |
| F-04 | S1  | Incentives, tax credits and rebates are not modelled, and nothing on screen says so.                                                                                                                          | R-PATH-05, R-DATA-01 |
| F-05 | S1  | Lease/PPA and financing are not modelled.                                                                                                                                                                     | R-PATH-02            |
| F-06 | S1  | The tariff is flat for 20 years with no escalation and no disclosure of that assumption (`money.js`, no `escalat` anywhere).                                                                                  | R-PATH-06            |
| F-07 | S1  | Tariffs come from ~40 hand-drawn boxes plus US states, with no per-value source or date. Outside every box, a global fallback of 0.28 USD/kWh applies (`pricing.js:190-194, 229-732`).                        | R-DATA-01..04        |
| F-08 | S2  | Hardware price sources appear only in code comments (`pricing.js:5-74`). It is unverified whether any of them reach the visitor.                                                                              | R-DATA-05            |
| F-09 | S2  | The place database covers 220 countries, but the price model has ~40 regions, and the visitor is not told which regime was applied.                                                                           | R-FLOW-02, R-DATA-02 |
| F-10 | S2  | When the FX refresh fails, the as-of date is silently blank and there is no stale-rate notice.                                                                                                                | R-DATA-06            |
| F-11 | S2  | Export credit is a per-hour clip-and-credit with no monthly or annual netting ("banking") or true-up (`engine.js:870-908`, with `billCutFraction` at `engine.js:749-763` consuming the whole-horizon totals). | R-UC-01              |

### 5.2 Use cases

| ID   | Sev | Finding                                                                                                                                                                | Closed by |
| ---- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| F-12 | S2  | The time-of-use model is one fixed 16:00–21:00 window with a single rate for peak and off-peak (`engine.js:725-729`). The user cannot enter local peak hours or rates. | R-UC-02   |
| F-13 | S2  | There is no backup mode for essential loads, no outage simulation, no essential-load catalogue (fridge, CPAP, router) and no "hours of backup" output.                 | R-UC-03   |
| F-14 | S2  | There is no reserve % held back from daily cycling (only `startSoc`).                                                                                                  | R-UC-04   |
| F-15 | S2  | Off-grid days of autonomy are computed only in the UI (`ui.js:4356,4610,4800`). The generator is a footnote cost that never takes part in sizing.                      | R-UC-05   |
| F-16 | S2  | There is no portable/mobile use case (RV, van, boat, camping, power station).                                                                                          | R-UC-06   |
| F-17 | S2  | Three overlapping vocabularies (the goal buttons, `mode`, and `hardwareConfig`) describe what the visitor sees as a single choice.                                     | R-FLOW-03 |

### 5.3 Experience and visual

| ID   | Sev | Finding                                                                                                                                                                                                                                                                                   | Closed by            |
| ---- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| F-18 | S2  | The hero shows no number. The first answer sits below the goal buttons, the mode toggle, the location picker and a long form.                                                                                                                                                             | R-FLOW-01, R-RES-01  |
| F-19 | S2  | 31 controls, with engineering terms in visible labels ("MPPT", "ToU", "LFP", "SOC", "nameplate", "clipped surplus").                                                                                                                                                                      | R-FLOW-05, R-CONT-02 |
| F-20 | S2  | The bill-cut slider and the budget slider fight each other; `budget-span.js` exists only to patch that.                                                                                                                                                                                   | R-FLOW-04            |
| F-21 | S2  | The installer-vs-DIY comparison (the site's key message) is buried several screens below the first answer.                                                                                                                                                                                | R-RES-01, R-RES-02   |
| F-22 | S2  | Desktop results are a ~490 px column about 11,000 px tall at 1440 px width, and the desktop form has an empty gradient panel.                                                                                                                                                             | R-DS-04              |
| F-23 | S3  | Result rows collapse labels into values ("Footprint~7 × 550 W…"). Rows wrap badly on mobile. The comparison table overflows with no affordance.                                                                                                                                           | R-DS-03, R-DS-04     |
| F-24 | S3  | Money is shown to full precision ("$1,623.00–$5,779.00").                                                                                                                                                                                                                                 | R-CONT-03            |
| F-25 | S2  | There is no light theme: light and dark renders are identical.                                                                                                                                                                                                                            | R-DS-01              |
| F-26 | S3  | The mobile navigation panel is translucent, so the hero text shows through it.                                                                                                                                                                                                            | R-DS-03              |
| F-27 | S3  | City pages use different chrome (an inline nav, their own inline `<style>`). The 404 page has dead space, a weak call to action and no favicon link.                                                                                                                                      | R-DS-05              |
| F-28 | S1  | The heatmap loads Leaflet from `unpkg.com` with no guard (`solar-heatmap/index.html:121,811`). If that CDN fails, the map and its stat cards are blank with no message.                                                                                                                   | R-OFF-02             |
| F-29 | S3  | Inline links are distinguished by colour alone (axe `link-in-text-block`).                                                                                                                                                                                                                | R-DS-03              |
| F-30 | S3  | The cumulative-cost chart legend is dense at mobile width. The cumulative-cost and state-of-charge charts are drawn on `<canvas>` (`#cumCostCanvas`, `#socCanvas`) with no data-table equivalent. The frontier chart is already SVG with a table (`frontier-chart.js`, `#frontierTable`). | R-CHART-03           |

### 5.4 Performance and architecture

| ID   | Sev | Finding                                                                                                                                  | Closed by            |
| ---- | --- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| F-31 | S2  | 32 JS requests and 748 KB of eager JS. Simulated mobile TTI is 7.9 s. Mobile CLS is 0.128.                                               | R-PERF-01..03        |
| F-32 | S3  | `ui.js` is a 284 KB monolith. `index.html` (120 KB) carries every advanced control. `locales.js` ships all 6 languages to every visitor. | R-PERF-02, R-I18N-02 |
| F-33 | S3  | The 7 MB heatmap grid loads in one piece.                                                                                                | R-PERF-04            |

### 5.5 AI, privacy and governance

| ID   | Sev | Finding                                                                                                                                                                                                                                                                                                                                        | Closed by            |
| ---- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| F-34 | S1  | Advisor replies are not verified. There is no per-reply timestamp. Sizing context is embedded as bracketed text inside the user message (`assets/js/chat.js:511-614`, where `buildIntakeBrief` writes `[ADVISOR INSTRUCTION: …]` blocks into the chat input; `worker/index.js:503-694`).                                                       | R-AI-01..06          |
| F-35 | S2  | The visible Jev badge and the advisor are two AI trust surfaces that can be confused (`worker/index.js:765`).                                                                                                                                                                                                                                  | R-AI-07, D-12        |
| F-36 | S1  | Full-precision coordinates go to NASA POWER (`assets/js/sizing/nasa.js:115`) and Nominatim (`assets/js/sizing/cities.js:311`). Rounding exists only for cache keys.                                                                                                                                                                            | R-PRIV-01            |
| F-37 | S2  | The Jev gate targets 95, not 99. Its price constant is 42.0, not 0.00042 (D-13). The OpenRouter fallback is live in `worker/index.js:36-37,224-263` and `scripts/validate-jev-complete.mjs:50`. 13 of 16 facets (the `jev`-authority axes) default to `mixed` without a live call (`scripts/lib/jev-complete.mjs:335-358`). No CI job runs it. | P0.3                 |
| F-38 | S2  | CI has no Lighthouse, axe, visual regression, cross-browser, RTL-visual, real-device or npm dependency gate.                                                                                                                                                                                                                                   | P0.4                 |
| F-39 | S3  | Coverage floor is 66 / 76 / 60 on only 5 modules.                                                                                                                                                                                                                                                                                              | Q-16, P3.8           |
| F-40 | S2  | Twelve legacy plan and audit documents at the repo root give conflicting guidance to contributors and agents.                                                                                                                                                                                                                                  | P0.2                 |
| F-41 | S2  | The planning session was **denied read access** to `GOOGLE_QUALITY_PLAN.md` and `docs/INDEX.md`, so their contents are not yet reflected in this plan.                                                                                                                                                                                         | P0.2 (carry-forward) |
| F-42 | S2  | 6 locales only. The i18n gate hard-codes "only `ar` is RTL" (`scripts/check-i18n.mjs:17`). Numbers are formatted by hand in places.                                                                                                                                                                                                            | R-I18N-01..08        |
| F-43 | S3  | Location defaults are overridden only by retyping fields. There is no explicit "confirm what we inferred" step: `location-picker.js:318-333` applies the inferred area prices directly, and `ui.js` `tariffTouched` (`ui.js:1772,1846`) only protects a manual edit.                                                                           | R-FLOW-02            |

## 6. Target end state: the product specification

### 6.1 Information architecture

| Page (template)                    | Purpose                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `/` and `/{lang}/`                 | The tool: the unified flow (§6.2) and results (§6.6), plus a short "how it works", FAQ and trust strip.                                    |
| `/{lang}/methodology/`             | How every number is computed: formulas (§6.4), invariants, the Jev role, limits. Linked from every result.                                 |
| `/{lang}/sources/`                 | Every registry source (publisher, title, year, licence, grade, review date) and every value we use, per country. Published as a `Dataset`. |
| `/{lang}/solar-cost/{country}/`    | Per-country page: the four-path price gap, tariffs, export rules and legality, with sources. Generated from the registry.                  |
| `/{lang}/solar-calculator/{city}/` | Existing city pages, regenerated in the new shell with a worked example from the new economics.                                            |
| `/solar-heatmap/`                  | The existing heatmap, hardened (R-OFF-02, R-PERF-04).                                                                                      |
| `/blog/…`, `/about/`, `/404.html`  | Kept. Re-shelled and audited for D-05 and for accuracy.                                                                                    |
| `/design/`                         | Living style guide (noindex). The visual-regression target.                                                                                |
| `/next/`                           | Temporary preview of the new app (noindex, not in the sitemap) until the swap in P8.                                                       |

### 6.2 The unified flow (D-16, D-17)

**Step 1: "Where will your system be?"** (R-FLOW-01)

- A primary button, **Use my location** (browser geolocation). A place search box (the 220-country catalogue, with Nominatim as fallback) and "enter coordinates" are secondary options.
- Coordinates are rounded to 0.01° **on the device** before any network call (R-PRIV-01). Weather prefetch starts the moment a location is known, which hides NASA latency behind Step 2.
- If geolocation is denied or times out after 10 s, focus moves to search with a one-line explanation. Nothing is blocked.

**Step 2: "Here's what we found for {place}. Does it look right?"** (R-FLOW-02)

- A confirmation card with one row per inferred fact. Each row shows value, unit and currency, plus a source chip giving the grade (§6.8) and year:
  - electricity price per kWh (with peak and off-peak rates where the registry has a time-of-use schedule)
  - fixed monthly charge
  - export compensation: regime and rate
  - currency
  - sun (kWh per kWp per year, from NASA POWER)
  - typical household use
  - the incentives we found
  - a legality summary for the 4 paths
- One question sits under the card: **"Can you install on this property?"** (I own it / I rent: landlord approval needed / I rent: no). "No" pre-selects portable power and the plug-in power station, and marks every fixed-installation path "needs the property owner's permission".
- Every row has **Looks right** (the default) or **Edit**. Rows graded C or D, or carrying no data, are highlighted: "We couldn't verify this for your area. Please check your bill." The primary button is **Continue**. One tap accepts everything.
- The visitor always sees which regime applied: country, sub-national region where we have one, and the data year (closes F-09).

**Step 3: "What do you want to do?"** (R-FLOW-03)

- Six plain-language tiles in one vocabulary. The first is pre-selected:
  1. **Cut my electricity bill** (grid-tied solar, battery optional)
  2. **Save with a battery on time-of-use rates**
  3. **Keep essentials running in a power cut** (backup)
  4. **Go fully off-grid**
  5. **Portable power** (RV, van, boat, camping)
  6. Two toggles inside tiles 1 and 2 (off-grid already measures whole-home independence, so it has neither): **Keep a backup reserve in my battery** (`reservePct`) and **Also keep essentials running in a power cut**, which runs the R-UC-03 outage simulator on the same sized system and adds outage coverage % to that result
- The internal representation is a single `useCase` enum plus optional `reservePct` and `backupEssentials` modifiers. The legacy `mode` × `hardwareConfig` pair is derived from it inside the engine adapter and never shown to the visitor (closes F-17).

**Step 4: "Your numbers"** (R-FLOW-04). These inputs depend on the use case (§6.3). For bill-cut:

- **Monthly bill**, prefilled with the typical local bill, as a number field with a paired slider. The visitor may instead switch to entering kWh per month.
- **Budget** (optional): a number field in local currency.
- **Target bill-cut** (optional): a percentage.
- Budget and target are **independent optional constraints, not linked sliders**. The engine answers both questions: "within your budget you can cut X %" and "to cut Y % you need about Z". Both points are marked on the frontier. This removes the slider fight (F-20) and `budget-span.js`.

**Step 5: "Customize (optional)"** (R-FLOW-05)

- Collapsed by default. It holds panel wattage, battery chemistry (plain names with glossary tooltips), roof-space limit, tariff escalation, export-rate override, "show amounts in today's money" (real terms), currency override and which paths to show.
- Every advanced control has a plain-language label, and the jargon lives in the glossary (closes F-19).

**R-FLOW-07: input validation and non-viable places.** Inline validation blocks "Size my system" for impossible inputs (a bill ≤ 0 or under the fixed charge, a negative budget, a target outside 0–200 %), with a one-line fix per field. A place whose yield is below the registry's minimum viable kWh/kWp/yr shows an explicit, honest empty state ("Solar is unlikely to pay back here, and here is why") instead of a chart.

**Action: "Size my system"** → deterministic run → invariants → Jev verify (≤ 3 s budget, §6.7) → reveal results (§6.6).

**Returning visitors and shared links.** State is restored from the share URL, which uses a versioned codec whose v1 links still decode (R-FLOW-06). A saved preference (theme, language, last location) lives in `localStorage` behind `try/catch` and is never required for anything to work.

**Dependency graph.** Every arrow must hold. Tests assert that a change upstream invalidates exactly its dependents.

```
location ─┬─> registry(country, region) ─┬─> tariff, fixed charge, export regime, currency, incentives, legality
          │                              └─> path price benchmarks, labour, permits, lease norms
          └─> weather (NASA POWER, cached; offline profile fallback) ─> climate derates
useCase + inputs (+ reservePct) ─> load profile ─┐
weather + load + tariff model + reservePct ──────┴─> engine simulation over a size ladder
size ladder × path cost models ─> per-path frontier + timeline + recommended system
results ─> invariants ─> Jev verify ─> reveal ─> advisor context (facts object)
```

### 6.3 The use-case matrix (R-UC-01..06)

| Use case                                | Visitor inputs after Step 2                                                                                                                                              | Outcome metric (frontier Y)                                                                                                                                                                                    | Paths shown                                                                                                                                                                                                                | Extra outputs                                                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bill cut** (default)                  | Monthly bill (or kWh); optional budget; optional target %                                                                                                                | **Bill-cut %** over 20 years: 1 − Σ residual bill / Σ baseline bill, with escalation, degradation and fixed charges. It can exceed 100 % when export credit exceeds the bill; that is labelled "earns credit". | All 4                                                                                                                                                                                                                      | Break-even year per path; 20-year net savings; footprint (panel count, roof m²); bill of materials; reserve trade-off if the toggle is on                  |
| **Time-of-use battery-only**            | Peak and off-peak rates, and peak hours (prefilled from the registry where known, otherwise asked); daily kWh                                                            | Bill-cut %                                                                                                                                                                                                     | Turnkey, self-purchase + electrician, DIY + inspection. Lease is flagged "rarely offered" unless the registry says otherwise.                                                                                              | Cycles per year and battery life. An honest verdict when the peak/off-peak spread is below the cost per stored kWh: "a battery alone won't pay back here". |
| **Backup (essentials)**                 | Essential loads from a catalogue (fridge, freezer, lights, router, phones, CPAP, well pump, medical device), target outage length (hours or days), solar recharge yes/no | **Outage coverage %**: the share of simulated outage start-hours across the weather record in which the essentials run for the full target duration                                                            | Turnkey installed (transfer switch or critical-loads panel), self-purchase + electrician, DIY + inspection, **plug-in power station** (no electrician, essentials plugged in directly). Lease is flagged "rarely offered". | Hours of backup at P10 and P50 (the 10th and 50th percentile outage start), the worst month, and a generator comparison with fuel cost                     |
| **Reserve** (modifier on the first two) | Reserve % held back (default 20 %)                                                                                                                                       | The parent use case's metric                                                                                                                                                                                   | Same as the parent                                                                                                                                                                                                         | The trade-off, stated plainly: "keeping 20 % in reserve costs you N % of bill savings and covers H hours of essentials"                                    |
| **Off-grid home**                       | Daily kWh or an appliance list; whether a generator is allowed                                                                                                           | **Grid independence %**: the share of hours the load is met without the generator. When no generator is allowed, the share of hours the load is met at all.                                                    | Turnkey off-grid installer, self-purchase + electrician, DIY + inspection. Lease flagged.                                                                                                                                  | Days of autonomy, computed in the engine. Generator hours and fuel per year. Worst month.                                                                  |
| **Portable / mobile**                   | Devices and hours per day, trip length, and charging sources (solar panel, vehicle, shore power)                                                                         | **Runtime coverage %**: the share of days in the location's weather year on which the devices are fully powered                                                                                                | **Pre-built power station** (retail) and **DIY kit** (components). The electrician and lease paths are not applicable and the UI explains why.                                                                             | Weight and volume, recharge time, and replacements over 20 years                                                                                           |

Engine requirements behind the matrix:

- **R-UC-01**: Export compensation models the regime from the registry: net metering with a banking period (monthly or annual true-up), net billing (an export rate below the retail rate), a feed-in tariff, or zero export. At each true-up boundary, unused credit is resolved exactly as the registry's regime says: carried forward, paid out at the registry's `true_up_rate` (default 0), or forfeited. The resolution is cited and priced into the residual bill. Fixtures cover each regime and each resolution.
- **R-UC-02**: Time-of-use schedules are data (weekday/weekend windows and rates, seasonal where known). The battery charges when energy is cheapest and discharges against the most expensive windows, deterministically. The hard-coded 16–21 window (`engine.js:725-726`) becomes the documented default only when the registry has no schedule.
- **R-UC-03**: An outage simulator runs the hourly state-of-charge model starting an outage at every hour of the weather record (vectorised) and reports the coverage distribution. The essential-load catalogue lives in `appliances.js` (extended) with sourced wattages.
- **R-UC-04**: `reservePct` is a hard state-of-charge floor for daily cycling. It is released only during a simulated outage.
- **R-UC-05**: Generator-assisted off-grid sizing: the engine includes the generator in the reliability search when it is allowed, and computes days of autonomy in the engine.
- **R-UC-06**: The portable model uses a device-load profile, the trip days (sampled from the location's weather year) and charging sources. It needs no roof, no grid and no tariff.

### 6.4 The four-path economics (R-PATH-01..10)

All amounts are in the visitor's display currency, converted from each registry value's source currency and year (§6.8). The horizon is years 1–20, and the install happens at year 0. Amounts are **nominal by default**. Two toggles change the view, never the default: "today's money" deflates by the registry inflation rate, and "account for the cost of money" (R-PATH-10) discounts cash flows at the registry's per-country real discount rate (NPV), so year-0 cash purchases and pay-as-you-go leases compare fairly. R-PATH-10 is an interpretation added in audit, not an owner request; an amendment may drop it if it clutters the two centerpiece charts (D-02). `S` is a physical system (PV kWp, usable battery kWh, inverter kW). `E_y` is its year-y energy: `E_1 = E_sim × (1 − d_1)` and `E_y = E_1 × (1 − d_ann)^(y−1)`, where `E_sim` is the simulated first-year energy and `d_1` (first-year) and `d_ann` (annual) come from the registry, defaulting to the cited PVWatts defaults when unknown. **Vintage normalisation (R-PATH-09):** every registry value is moved from its own `year` to the calculation's base year using its category's cited index (prices: that category's price trend where sourced, otherwise the registry inflation rate) before currency conversion, so values of different vintage are never combined raw. The physics for a given `S` is **shared by every path**; only the money differs.

| Path                                        | Year-0 cost                                                                                                                                                                                     | Recurring (years 1–20)                                                                                                                                                                                                                                                                                                                                                                                               | Incentives                                                                                         |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Turnkey, cash** (R-PATH-01)               | `TK_pv × Wp + TK_batt × kWh`, from **country installed-price benchmarks** (these already include hardware, labour, permits and margin). There is no multiplier on DIY cost.                     | O&M; inverter replacement in the year from the registry (typically after 10–15 years); battery replacement from the engine's cycle-life model                                                                                                                                                                                                                                                                        | Those the registry marks eligible for the installer path                                           |
| **Lease / PPA** (R-PATH-02)                 | 0, or the registry's typical down payment                                                                                                                                                       | PPA: `rate₀ × E_y × (1+esc)^(y−1)`, where `rate₀` = the registry's typical discount against the utility rate. Lease: `pmt₀ × 12 × (1+esc)^(y−1)`. `esc` comes from the registry (typical 0–3.9 %; V-02). No O&M or replacement. If the registry term ends within 20 years, the registry's typical end-of-term choice is modelled (buyout at `buyout_pct` of installed cost, renewal or removal), stated on the card. | None (they go to the owner of the system). This is disclosed.                                      |
| **Self-purchase + electrician** (R-PATH-03) | `HW(S)` (landed retail hardware, registry) + `rate_elec × hours(S)` (the labour model: a base plus per-kWp and per-kWh terms, registry) + permit + inspection + interconnection fees (registry) | O&M, inverter replacement, battery replacement                                                                                                                                                                                                                                                                                                                                                                       | Only those the registry marks eligible for this path; lost incentives appear as a line item (D-10) |
| **DIY mounting + electrician** (R-PATH-04)  | `HW(S)` + `rate_elec × hours_connect(S)` (electrical work only) + permit + inspection + interconnection fees + a tools and safety-equipment allowance                                           | As self-purchase                                                                                                                                                                                                                                                                                                                                                                                                     | As self-purchase, adjusted by legality flags                                                       |

- **R-PATH-05 (incentives)**: incentives are registry entries: type (upfront rebate, tax credit, performance payment), amount formula, caps, the eligible paths, validity dates and source. A country with no verified entry shows "No incentives included; check local programs". Silence is not allowed.
- **R-PATH-06 (escalation)**: `tariff_y = tariff₀ × (1+g)^(y−1)`. `g` is the registry's per-country historical residential escalation (source and window shown), editable, and defaults to 0 % with an explicit label when no source exists. Export rates escalate by their own `g_export`, which defaults to 0.
- **R-PATH-07 (definitions)**. These definitions are exact and shared by the charts, the cards, the advisor facts and the tests:
  - **20-year system spend** (frontier X) = year-0 cost − incentives + Σ recurring system costs (O&M, replacements and lease payments; grid bills are **excluded**).
  - **Baseline bills** = Σ bills with no system. **Residual bills** = Σ bills with the system (fixed charges included, export credit applied).
  - **Bill-cut %** = 1 − residual / baseline.
  - **20-year net** = baseline − residual − system spend.
  - **Break-even year** = the first year in which cumulative (system spend + residual bills) ≤ cumulative baseline bills. When that never happens within 20 years, the result says "not within 20 years".
  - **Installer premium** = turnkey year-0 cost − self-purchase year-0 cost, for the same `S`. **Lease premium** = lease 20-year spend − self-purchase 20-year spend.
- **R-PATH-08 (uncertainty)**: every registry value carries a low/mid/high triple. Cards and headlines show the mid value with its range, and charts plot the mid values. The P10.2 review checks that no headline claims more precision than its lowest-grade input supports (§6.8 grade rules).

**The recommended system** (an interpretation added in planning, not an owner request; it follows the owner's focus on the self-purchase gap and may be changed by amendment). The recommended system is the `S` that maximises the 20-year net for **self-purchase + electrician**, subject to the visitor's budget and target, the roof limit and legality. It is then **priced identically across all four paths** so that the path cards compare like with like. Each frontier line is the Pareto envelope of its own path across the size ladder, and the recommended `S` is marked on every line.

### 6.5 Charts (R-CHART-01..05)

- **R-CHART-01: the frontier, "What your budget buys".** X is the 20-year system spend (local currency, 2–3 significant figures). Y is the outcome metric (§6.3). There is one line per shown path, plus markers for the visitor's budget, the visitor's target, the recommended system and each path's maximum 20-year net. Lines are **labelled directly** at their ends (no legend needed) and carry distinct dash patterns and point shapes, so the chart does not rely on colour.
- **R-CHART-02: the timeline, "When you come out ahead".** X is years 0–20. Y is cumulative money out of pocket (system spend + residual bills). There is one line per path plus "stay on the grid", break-even markers, and a year-20 bracket labelled "installer premium" between the turnkey and self-purchase lines.
- **R-CHART-03: accessibility.** The charts are inline SVG, not canvas. Each has `role="img"` with a one-sentence summary (the same sentence the comprehension probe reads), a visible **Show as table** toggle rendering a real `<table>`, keyboard-focusable points with tooltips, and contrast of ≥ 3:1 for marks and ≥ 4.5:1 for text in both themes.
- **R-CHART-04: palette.** One validated categorical palette for the up-to-five series (four paths plus the grid), checked for colour-vision deficiency and contrast in light and dark, stored as tokens (§6.10).
- **R-CHART-05: mobile.** Legible at 320 px: ≤ 5 series (the backup use case, which adds the plug-in power station, shows lease only in the cards, never as a chart line), tick labels ≥ 12 px, and no overlapping direct labels (collision-avoidance tested).

Under the "today's money" or "account for the cost of money" toggles (§6.4), both charts plot the deflated or discounted equivalents of exactly the same definitions, and the axis titles say which view is on.

The state-of-charge chart stays as a secondary "How your battery behaves" view, converted to SVG with a table.

### 6.6 Results composition (R-RES-01..08), in reading order

1. **R-RES-01: headline answer.** One sentence plus three large numbers. Template (localised): "Cut your bill by **62 %**. Buying it yourself and hiring an electrician costs about **$8,200**. A typical installer charges about **$21,500**, so you keep about **$13,300**. It pays back in **year 6**." Ranges are one tap away. A source line gives the data grades and year. Everything is visible without scrolling on a 390 × 844 screen.
2. **R-RES-02: four path cards.** For each path: year-0 cost, 20-year spend, bill-cut %, break-even year, legality flag and "what's included". The cards are a 4-up grid on desktop and a swipeable row on mobile, with explicit pagination dots and scroll affordance.
3. **R-RES-03:** the frontier chart.
4. **R-RES-04:** the timeline chart.
5. **R-RES-05: your system in plain words.** Panels (count, kWp, roof m²), battery (kWh, chemistry in plain words), inverter, footprint, and an ELI5 of each part. The bill of materials uses generic specs (D-05) and offers CSV download.
6. **R-RES-06: use-case block.** Backup hours, the reserve trade-off, off-grid autonomy and generator use, or portable runtime. When the essentials toggle is on for bill-cut or time-of-use, outage coverage % appears as a secondary stat beside the headline; it is never plotted on the frontier or timeline axes.
7. **R-RES-07: how to do it.** A country-specific checklist: get two or three quotes, find a licensed electrician, the permit and interconnection steps, the safety rules for DIY mounting (fall protection; the electrician does every electrical termination), and where DIY is not permitted (D-10). No lead forms and no company names.
8. **R-RES-08: ask the advisor** (§6.7), **Assumptions & sources** (every number used, with its registry entry, grade and date; editing any assumption re-runs the sizing), then share / print / CSV.

On desktop (≥ 1024 px) the layout is two columns: a sticky summary column holding the headline and path selector, and a content column. The maximum content width is 1200 px, and there are no empty decorative panels.

### 6.7 AI: Jev verification and the advisor (R-AI-01..08)

**Sizing verification (D-12).**

- **R-AI-01: invariants first**, as a shared pure module, `assets/js/sizing/invariants.js`:
  - energy balance closes: PV = self-consumed + exported + clipped + losses, within 0.1 %
  - state of charge stays within its limits, and the reserve floor is honoured
  - costs are monotone in size
  - break-even is consistent with the cumulative series
  - the path ordering is sane (the DIY hardware basis ≤ the self-purchase total; turnkey is within the registry's market band)
  - bill-cut > 100 % happens only with export credit
  - there are no NaN or Infinity values
  - currency round-trips are consistent

  Any failure means **no reveal**. The visitor sees "We found an inconsistency in this estimate", the numbers that were verified, and a prefilled GitHub-issue link. CI runs the invariants over the full fixture matrix.

- **R-AI-02: Jev review.** `POST /api/jev` v2 takes a **strictly typed numeric state**: use case, recommended `S`, per-path year-0 cost, 20-year spend, bill-cut % and break-even, a frontier summary, and the data grades used. There is no free text, so nothing can be injected. New questions cover `paths_ordering_plausible`, `gap_plausible` (the turnkey/self-purchase ratio against cited market bands) and `payback_consistent`.
  - The worker's Jev timeout is ≤ 2.5 s. The client waits ≤ 3 s, then reveals with the note "AI check still running", and updates in place if a flag arrives.
  - Results are cached by `hash(engineVersion, registryVersion, inputs)` in IndexedDB. Every city-page preset and default scenario is pre-verified at build time (`assets/data/jev-preverified.json`).
- **R-AI-03: verdict handling.** A **pass** shows nothing (D-12: used internally, not shown). The verdict, time and model are kept in the result's CSV/print export metadata for audit. A **flag** triggers a deterministic re-check (a re-run with the alternate weather source where available, and a registry bounds re-validation). If the re-check clears it, the result is revealed with a note. If not, the flag's reason is shown as a notice on the affected numbers. **Unavailable** is a muted note. Jev **never** changes a number.

**Advisor (D-11).**

- **R-AI-04: grounding.** The advisor opens only after a sizing. The client sends a **typed `facts` object**, built from the results and validated server-side against a schema (numbers, enums, and short strings from a fixed vocabulary), alongside the question. It no longer embeds bracketed text in the message. A static methodology excerpt is attached server-side. The Groq models stay as they are (D-11).
- **R-AI-05: per-reply verification**, in the worker, in this order:
  1. A deterministic numeric cross-check: every number-with-unit in the draft must match a fact within display rounding.
  2. A Jev call with `{facts, question, draft}`, returning truthfulness (0–100), accuracy (0–100) and the flagged claims.
  3. If truthfulness < 95, accuracy < 99, or any number is unmatched: **one** regeneration with the flags as feedback, then re-verify.
  4. If the re-verified reply still fails any threshold, the reply text is **withheld**. The visitor sees "The advisor couldn't produce an answer that passed the check", the two scores and the flagged claims, and can rephrase. Truth outranks a reply.
  5. Return `{reply, model, continuations, respondedAt (ISO-8601 UTC), verification: {available, truthfulness, accuracy, numericCheck: {checked, unmatched}, regenerated, jevModel}}`.
- **R-AI-06: display.** Under each reply sits a footer line, localised, e.g. "14:32 · Jev check: truthfulness 99/100 · accuracy 100/100". It is shown in a warning style below the thresholds, and reads "Jev check unavailable" when Jev could not run. A tooltip explains: "Jev is an independent AI checker that compares this answer with your calculated results. It is not an engineer's review." The p95 advisor latency, including verification, is ≤ 10 s, with the stages "Thinking… / Checking answer…".
- **R-AI-07: one trust vocabulary.** Only two phrases exist: "Jev check" (advisor reply footers) and "flagged" (sizing notices). Words like "verified", "safe", "certified" or "accurate" are never used for AI checks. A lint enforces this in the locale sources.
- **R-AI-08: Jev plumbing.** A single exported constant `JEV_PRICE_USD_PER_MILLION_TOKENS = 0.00042` (D-13) is imported by the worker and the gate script and pinned by a test. OpenRouter code, keys, tests and docs are removed from every Jev path. The worker logs token counts only (never content), and a cost roll-up is recorded monthly in the ledger.

**Advisor privacy.** The question and the facts go to Groq and TypeSafe. This is disclosed in the chat header and on the privacy section of `/about/`. The worker never logs bodies.

### 6.8 Data registry and provenance (R-DATA-01..08)

- **R-DATA-01: the registry.** `assets/data/registry/` contains `sources.json` and one JSON file per country, `countries/{ISO-3166-1}.json`, with sub-national regions nested where data exists (US states, CA provinces, AU states, IN states, BR states, EU NUTS-1 where Eurostat provides them). Every numeric value is `{lo, mid, hi, unit, currency, year, source, grade, retrieved, review_by, note?}`. `scripts/build-registry.mjs` validates the schema and emits compact per-country bundles (≤ 6 KB brotli).
- **R-DATA-02: coverage.** Every one of the 249 ISO 3166-1 codes has currency, tariff, fixed charge, export regime, legality flags for the 4 paths, turnkey benchmark, hardware landed factor, electrician rate, permit fees, lease availability with term and `buyout_pct`, inflation rate, real discount rate, and PV degradation (`d_1`, `d_ann`). **"Unknown" is a permitted value.** Unknown triggers the Step-2 "check your bill" prompt, or a wide grade-D band from a published derivation formula. Unknown values are never silently guessed.
- **R-DATA-03: grades**, shown to visitors in plain words:
  - **A**: official statistics, a regulator or a national lab ("Official data")
  - **B**: industry reports and price indices ("Industry report")
  - **C**: retail catalogues, installer aggregators and consumer advisories ("Market sample")
  - **D**: our own derivation, with the formula on the methodology page ("Our estimate")

  A headline built on a C or D input shows its range by default.

- **R-DATA-04: licensing.** Values are embedded only when the source's licence permits redistribution. Otherwise the source is linked and the visitor confirms the value (for example, CC BY-NC-ND material is **not embedded**). Each source records its licence.
- **R-DATA-05: visibility.** The sources behind every number in a result are listed in Assumptions & sources, and every value links to `/sources/#entry`.
- **R-DATA-06: FX.** A build-time snapshot, refreshed at runtime from a source whose terms permit client use (V-07), with ECB reference rates as the authority where it covers the currency. The as-of date and source are always shown. After 7 days the snapshot is labelled "Rates may be out of date". The snapshot covers every currency the registry uses.
- **R-DATA-07: freshness.** `review_by` is ≤ 12 months for prices and ≤ 6 months for policy (export rules, incentives, legality). The weekly scheduled workflow fails and opens an issue listing past-due entries. PRs that touch the registry fail on a past-due entry they touch.
- **R-DATA-08: seed sources.** Appendix C lists the sources found in planning. **Each must be re-verified at the primary source in P2** before its values are embedded. Planning-time figures are leads, not data.

### 6.9 Engine, fixtures and physics (R-ENG-01..05)

- **R-ENG-01:** `engine.js` is kept. It is extended only through R-UC-01..06, each with unit tests and golden fixtures.
- **R-ENG-02: fixture matrix.** 12 reference sites (Appendix B) × 6 use cases × the applicable paths × 3 bill levels, run offline from committed weather profiles. Golden outputs are committed. Any change needs an explicit golden update, reviewed in the PR.
- **R-ENG-03:** PVWatts cross-check (Q-11) via the manual validator `scripts/validate-pvwatts.mjs` (needs network and a key; registered in `gate-registry.mjs`).
- **R-ENG-04: determinism.** Same inputs, same registry version and same weather give byte-identical results. A test runs every fixture twice and in the worker vs the main thread.
- **R-ENG-05: versioning.** Engine and registry versions are shown in Assumptions & sources, embedded in share links and in Jev cache keys.

### 6.10 Design system and localisation-ready UI (R-DS-01..07, R-I18N-01..08)

- **R-DS-01: tokens** in one file (`assets/css/tokens.css`):
  - colour for light and dark, driven by `prefers-color-scheme` plus a manual toggle
  - one accent colour, plus semantic success/warning/danger/info
  - the chart palette (R-CHART-04)
  - a type scale of 12/14/16/20/24/32/40 px on the system font stack
  - a 4-px spacing grid, radii, two elevations, and motion ≤ 200 ms (off under reduced motion)
- **R-DS-02: components**, all built from the tokens, with keyboard support and visible focus: Button, Choice tile, Number field with unit or currency, Slider always paired with a number field, Card, Stat, Notice, Details/drawer, Responsive table (stacks under 600 px), Chart frame, Header with nav (a hamburger under 720 px, **opaque** panel), Footer, Searchable language picker (for 200+ languages), Skeleton loader.
- **R-DS-03: hygiene.** Label and value never touch (F-23); text links are underlined (F-29); the nav panel is opaque (F-26); tap targets are ≥ 44 px.
- **R-DS-04: layout.** Mobile-first. Two-column results at ≥ 1024 px. A maximum width of 1200 px. No decorative empty panels (F-22).
- **R-DS-05: one shared shell** (header, footer, nav, language picker, theme) for **every** template: home, city, country, blog, about, heatmap, 404, methodology and sources. There are no per-page inline style systems (F-27).
- **R-DS-06:** `/design/` renders every component in every state. It is the visual-regression reference.
- **R-DS-07: token lint.** Outside the token file, no hex or rgb colours, raw pixel spacing or font families.
- **R-I18N-01:** en is the source locale. Messages use named placeholders. Plurals go through `Intl.PluralRules`. Numbers, currency, percentages and dates go through `Intl.NumberFormat` / `Intl.DateTimeFormat` with the active locale. Hand-built number strings in the UI are lint errors.
- **R-I18N-02:** one lazily loaded file per locale, `assets/i18n/{bcp47}.json` (≤ 25 KB brotli). `locales.js` is retired at the swap.
- **R-I18N-03:** text direction comes from a CLDR-derived script-direction table, not a hard-coded locale list. That covers ar, he, fa, ur, ps, sd, dv, yi, ug, ckb and others. Layout uses CSS logical properties only.
- **R-I18N-04: fonts.** The system stack first. For scripts that common devices lack (the list is determined by a glyph-coverage test in Chromium and WebKit), a self-hosted Noto subset loads for that locale only, with `font-display: swap` and ≤ 60 KB per subset.
- **R-I18N-05: locale gates**:
  - key and placeholder parity
  - no English leakage (outside an allowlist of units and brand)
  - an overflow check at 320 px (visual)
  - glyph coverage
  - a back-translation semantic check plus the Jev translation-quality facet `proven`
  - the comprehension probe (Q-12)
- **R-I18N-06:** "Suggest a translation fix" on every page opens a prefilled GitHub issue with the locale, page and key. Nothing is collected (D-15).
- **R-I18N-07: target language set.** The union of languages listed by Google Cloud Translation's published supported-language list, pinned at P11 kickoff into `assets/i18n/languages.json` with the retrieval date (V-08). It is refreshed yearly by amendment. Order of work: speakers × energy-access need, in waves of ≤ 20.
- **R-I18N-08:** localised URLs (`/{lang}/…`) with reciprocal `hreflang` plus `x-default`. Country and city pages are generated only in the languages relevant to that country plus English, which keeps the file count under the host limit (V-05).

### 6.11 Performance architecture (R-PERF-01..05)

- **R-PERF-01:** the document ships step 1 plus the critical CSS inline. Everything else loads lazily: the engine and economics load in a Web Worker as soon as a location exists, charts load at reveal, the advisor when opened, the locale on demand, and weather profiles only when offline.
- **R-PERF-02:** no build step and no bundler, as long as the §3.1 budgets hold with native ES modules plus `modulepreload`. If P6 measurements prove otherwise, an amendment may add a **build-time-only** bundler (it stays a devDependency; zero runtime dependencies is preserved).
- **R-PERF-03:** reserved space for every async region (CLS ≤ 0.02). Skeletons instead of spinners. Nothing shifts the headline after reveal.
- **R-PERF-04:** the heatmap grid is split into regional chunks and loaded as the viewport needs them. Leaflet is self-hosted.
- **R-PERF-05:** the service worker precaches the shell, the current locale, the visitor's country registry and the engine. Versioning follows the existing `CACHE_VERSION` and asset-token rules (`docs/DEPLOY_RUNBOOK.md`).

### 6.12 Resilience and offline (R-OFF-01..03)

- **R-OFF-01: failure behaviour per dependency.** Each row is covered by a smoke flow with fault injection:

  | Dependency  | On failure                                        |
  | ----------- | ------------------------------------------------- |
  | NASA POWER  | offline typical-year profile, labelled            |
  | FX          | snapshot, labelled                                |
  | Geocoder    | local catalogue                                   |
  | Groq        | "Advisor unavailable"                             |
  | Jev         | "check unavailable"; never blocks longer than 3 s |
  | Analytics   | ignored                                           |
  | Font subset | system fallback                                   |
  | Map tiles   | message, and the stats still render               |

- **R-OFF-02:** no third-party CDN on any page. All libraries are self-hosted, and missing globals are guarded with a visible message (F-28).
- **R-OFF-03:** after the first visit, the full flow works offline for the last-used country (Playwright offline test).

### 6.13 Privacy, security and measurement (R-PRIV-01..05)

- **R-PRIV-01:** coordinates are rounded to 0.01° on the device before any egress to NASA, Nominatim, the worker or analytics (F-36). The rounding happens in one helper, which a test asserts for every outbound URL builder.
- **R-PRIV-02:** zero cookies. `localStorage` holds preferences only. The advisor stores nothing server-side.
- **R-PRIV-03:** CSP with no `unsafe-inline` in `script-src` (hashes where needed). `connect-src` lists exactly the live dependencies. OpenRouter is not present.
- **R-PRIV-04:** npm Dependabot. CodeQL stays required. The secret scan stays.
- **R-PRIV-05:** Cloudflare Web Analytics (cookieless) and Search Console (D-18). The completion rate is measured only if Cloudflare Web Analytics records the results view without new identifiers (V-06); otherwise it is not measured.

### 6.14 Search and worldwide reach (R-SEO-01..06)

- **R-SEO-01:** titles, H1s and meta lead with the job (D-19), are unique per page and locale, and stay ≤ 60 / ≤ 155 characters.
- **R-SEO-02:** structured data:
  - `WebApplication` (free, `offers.price` 0)
  - `BreadcrumbList`
  - `Dataset` for `/sources/` and the country pages, with licence and temporal coverage
  - `FAQPage` markup only where it helps users, since rich results are not expected
  - 0 validator errors
- **R-SEO-03:** per-country cost pages (§6.1) answer "how much does solar cost in {country}", with the four-path gap and sources. That is the highest-intent query class worldwide.
- **R-SEO-04:** a sitemap index with per-locale sitemaps; canonical tags; `hreflang` clusters; no duplicate content across locales; `llms.txt` updated.
- **R-SEO-05:** people-first and E-E-A-T signals: methodology, a named maker on `/about/`, sources, dates, a public data changelog and a visible "last reviewed" date on every data page.
- **R-SEO-06:** Search Console property verification, sitemap submission and a monthly ledger row (clicks and impressions by country and language, indexing errors, field CWV) (O-04).

### 6.15 Content and copy (R-CONT-01..05)

- **R-CONT-01:** the voice is plain, second person and in short sentences (target: a reading grade of ≤ 8 in English). Numbers come before adjectives. No hype, no fear, no sales language (AGENTS.md).
- **R-CONT-02:** the glossary (`jargon-dict.js`, extended) covers every technical term. The visible labels themselves are plain words (F-19). The existing `tests/jargon-lint.test.mjs` is extended to all locales.
- **R-CONT-03:** number display: headlines use 2–3 significant figures; currency has no decimals at or above 100 units; percentages are whole numbers. Full precision appears only in tables and CSV (F-24).
- **R-CONT-04: legal and safety.** `LIABILITY.md` is reflected in concise on-page terms. The DIY path carries the safety block of R-RES-07. The site never suggests unlicensed electrical work.
- **R-CONT-05:** the blog is audited against D-05, the new economics and sources. Stale figures are fixed or removed, and each post shows "last reviewed".

## 7. Module disposition (keep, change, replace, delete)

This table is the whole refactor. Anything not listed is kept as-is.

| Module / file                                                                                                                                                                                            | Disposition                                                                                                    | Why                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `assets/js/sizing/engine.js`                                                                                                                                                                             | **Keep and extend** (R-UC-01..06)                                                                              | Tested and deterministic |
| `nasa.js`, `profiles.js`, `climate.js`, `rescale.js`, `tilt-harvest.js`, `lead-acid.js`, `fuel-units.js`, `bom.js`, `parts-csv.js`, `validate.js`, `run-coordinator.js`, `sizing-worker.js`, `cities.js` | **Keep**. `nasa.js` and `cities.js` gain R-PRIV-01; `validate.js` moves under the R-AI-01/03 contract.         | Work and are tested      |
| `run.js`                                                                                                                                                                                                 | **Change**: orchestrates `useCase` × paths; split below 40 KB per module                                       | New flow and economics   |
| `money.js`                                                                                                                                                                                               | **Change**: escalation, paths, incentives, lease (R-PATH)                                                      | F-04..F-06               |
| `pricing.js`                                                                                                                                                                                             | **Replace** its data with the registry. Its exported function names stay as adapters while any caller remains. | F-01, F-02, F-07         |
| `frontier.js`                                                                                                                                                                                            | **Change**: per-path cost, per-use-case outcome                                                                | D-02                     |
| `charts.js` (canvas state-of-charge and cumulative-cost charts)                                                                                                                                          | **Replace** with SVG plus a data table, sharing primitives with `frontier-chart.js`                            | F-30, R-CHART            |
| `frontier-chart.js` (already SVG with a table)                                                                                                                                                           | **Change**: per-path lines, direct labels, the budget and target markers (R-CHART-01)                          | D-02                     |
| `appliances.js`                                                                                                                                                                                          | **Extend**: essential loads and portable devices                                                               | F-13, F-16               |
| `share-codec.js`                                                                                                                                                                                         | **Change**: v2 state, and v1 still decodes                                                                     | R-FLOW-06                |
| `wizard.js`, `location-picker.js`, `map-provider.js`                                                                                                                                                     | **Change** for Step 1 and Step 2. `locateMe` is kept.                                                          | D-17                     |
| `ui.js` (284 KB), `budget-span.js`                                                                                                                                                                       | **Delete at the swap (P8)**, replaced by `assets/js/app/*` modules of ≤ 40 KB each                             | F-20, F-32               |
| `assets/js/shared/locales.js`, `i18n.js`                                                                                                                                                                 | **Replace** with per-locale files; `i18n.js` is rewritten on `Intl`                                            | F-42                     |
| `assets/js/chat.js`, `worker/index.js`                                                                                                                                                                   | **Change**: R-AI-04..08; OpenRouter removed                                                                    | F-34, F-37               |
| `index.html`, `assets/site.css`                                                                                                                                                                          | **Replace**: new shell and tokens                                                                              | F-18, F-25, F-31         |
| `scripts/build-city-pages.mjs`                                                                                                                                                                           | **Change**: new shell, registry and economics                                                                  | F-27                     |
| `solar-heatmap/`                                                                                                                                                                                         | **Change**: self-hosted Leaflet, chunked data, shared shell                                                    | F-28, F-33               |
| `scripts/lib/jev-complete.mjs`, its pack, and `scripts/validate-jev-complete.mjs`                                                                                                                        | **Change**: P0.3                                                                                               | F-37                     |
| Root plan and audit docs                                                                                                                                                                                 | **Archive** (P0.2)                                                                                             | F-40                     |

**Tests of deleted code** (AGENTS.md: never delete regression tests). At the swap, every test bound to the deleted UI is either **ported** (the same invariant against the new UI) or **retired with a named reason**. A test may be retired only when a decision (D-xx) removed the behaviour it guarded (for example, the two-slider fight). Retirements are recorded in `scripts/lib/gate-registry.mjs`'s `RETIRED` pattern (or a sibling list for tests) and need owner approval in that PR.

## 8. Delivery phases

**Principles.** Simple first, then build. Every PR is small (target ≤ 400 changed lines, excluding data, generated files and goldens), covers one requirement cluster, writes its tests first, and keeps `main` releasable. No half-built UI reaches visitors: the new app grows at `/next/` and swaps in once, at P8. Truth fixes (P1) go live immediately.

**Dependencies.**

```
P0 ──> P1 (live truth fixes)
P0 ──> P2 (registry) ──> P3 (economics) ──> P4 (use-case engines)
P0 ──> P5 (design system + shell + i18n infra)            │
P3 + P5 ──> P6 slice 1 (bill-cut at /next/) ──> P6 slices 2–5 (need P4)
P6 slice 1 ──> P7 (advisor 2.0)
P6 (all) + P7 ──> P8 (swap to /, 6-locale parity) ──> P9 (reach) ──> P10 (exit gate) ──> P11 (continuous)
```

### P0: Governance, baseline and gates (no visitor-visible change)

| Item | Work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Exit evidence                                               |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| P0.1 | **Adopt this plan**: plan, lock, amendment log, ledger, `check-plan-pin` in CI, `docs/plan/**` made PR-only in the push guards, PR template, CODEOWNERS for `docs/plan/`, AGENTS.md precedence note, tracking issue. The adoption PR's last commit writes the final `--print-sha` hash into `PLAN.lock.json` (genesis = current), so its own `plan:check` passes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | The adoption PR merged; `adopted` ledger row                |
| P0.2 | **Archive and carry forward.** Move the legacy root plans (`GOOGLE_QUALITY_PLAN.md`, `PLAN.md`, `PHASE2_PLAN.md`, `PHASE3_PLAN.md`, `ROADMAP_10_PHASES.md`, `SEO_MASTER_PLAN.md`, `LAUNCH_AUDIT.md`, `IMPLEMENTATION_COMPLETE.md`, `GROQ_*.md`, `CYCLE_LIFE_CORRECTION_SUMMARY.md`) to `docs/archive/` with a superseded banner. Keep reference docs that are not plans (`BATTERY_CYCLE_LIFE_REFERENCE_2026.md`, `LIABILITY.md`) and fix every link to the moved files (README, runbook, `gate-registry.mjs`, `validate-against-sheet.mjs`, `docs/INDEX.md`). **Carry-forward review:** read every archived doc, including the two the planning session could not read (F-41), list every requirement that is not covered here, and either map it to an existing R-id or propose an amendment.                                                                                                                                                                                                                                                              | A carry-forward table in the PR; any amendment PRs opened   |
| P0.3 | **Jev gate to spec (D-03, D-13)**, as one PR per bullet:<br>(a) `JEV_PRICE_USD_PER_MILLION_TOKENS = 0.00042` in one module imported by the worker and the gate, with a test (R-AI-08).<br>(b) Remove OpenRouter from `worker/index.js`, `validate-jev-complete.mjs`, `.env.example`, the tests and the docs.<br>(c) `COMPLETE_MIN_SCORE = 99`; the program-exit rule "every facet `proven`"; a **scoped mode** (`--scope P<n>.<m>`) that judges only that item's facets against its exit criteria and fails if any facet drops below its last ledger level.<br>(d) New pack facets: `provenance`, `comparison` (four-path clarity), `usecases`, `privacy`, `translation`.<br>(e) A CI job `jev-complete` that `needs: [test, web-smoke, coverage]`, writes the evidence JSON from their real results (no hand-typed evidence), runs live with the `TYPESAFE_API_KEY` secret, and uploads the report. It becomes a **required check** once O-01 is done. The model version is pinned in the report. A provider error may be re-run once; a judgment may not. | Tests; a green live run on the P0.3 PR itself               |
| P0.4 | **Measurement gates (ratchet mode).** A `quality-lab` CI job on the staged build: Lighthouse (mobile and desktop, median of 3), axe via Playwright on the template × state × theme × direction matrix, cross-browser smoke (Chromium, Firefox, WebKit), a compressed byte and request budget check (§3.1), and visual-regression scaffolding. Playwright, axe-core and Lighthouse are pinned devDependencies (no runtime dependency). npm Dependabot (R-PRIV-04). Record the baseline in the ledger. The `/next/` noindex tag is removed in the lab build only, so SEO can be audited.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | A `baseline` ledger row with every Q-metric's current value |
| P0.5 | **Owner setup** (O-01..O-05): the Jev secret, Cloudflare Web Analytics, Search Console, pinning the tracking issue, a ruleset requiring code-owner review on `docs/plan/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | A ledger `note` row per action                              |

### P1: Truth and safety fixes on the live site (small PRs, shipped immediately)

| Item | Work                                                                                                                                                                                                                                                                                    | Closes                     |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| P1.1 | Remove the ×10 / ×5 turnkey multiplier. Show turnkey from **cited benchmarks** for the countries with A/B data in Appendix C (after verification, V-01). Elsewhere, show "No published installer benchmark for {country}" plus a grade-D band with its formula on the methodology page. | F-01                       |
| P1.2 | Replace the flat $1,500–$3,000 hookup with the region-scaled electrician labour, labelled.                                                                                                                                                                                              | F-02                       |
| P1.3 | Round coordinates before NASA and Nominatim calls (R-PRIV-01).                                                                                                                                                                                                                          | F-36                       |
| P1.4 | A stale-FX notice, with the source and as-of date always shown.                                                                                                                                                                                                                         | F-10                       |
| P1.5 | Heatmap: self-host Leaflet, guard the global, and show a message on failure (R-OFF-02); split the grid into regional chunks (R-PERF-04).                                                                                                                                                | F-28                       |
| P1.6 | Disclose the assumptions still missing on screen: "No incentives included", "Electricity prices assumed flat for 20 years", and "Export credited hourly". This lasts until P3 replaces them.                                                                                            | F-04, F-06, F-11 (interim) |

### P2: Data registry and provenance

| Item | Work                                                                                                                                                                                                                 |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2.1 | Registry schema, `scripts/build-registry.mjs`, `data:check` (schema, grades, licences, `review_by`), and tests (R-DATA-01, R-DATA-03, R-DATA-04). Wired into `npm run seo` and the weekly scheduled job (R-DATA-07). |
| P2.2 | Verify the Appendix C seeds at their primary sources (R-DATA-08; V-01..V-04, V-09) and populate A/B data for the top markets by solar need and traffic.                                                              |
| P2.3 | Populate all 249 ISO codes: currency and tariff for every one; everything else with verified data or an explicit `unknown` (R-DATA-02).                                                                              |
| P2.4 | Per-country legality flags and incentives (D-10, R-PATH-05), policy `review_by` ≤ 6 months.                                                                                                                          |
| P2.5 | An FX snapshot plus the runtime refresh contract (R-DATA-06, V-07).                                                                                                                                                  |
| P2.6 | Point the live site's `pricing.js` adapters at the registry. The existing UI now shows registry-backed numbers and their sources (R-DATA-05).                                                                        |
| P2.7 | `/sources/` and `/methodology/` pages (in the existing chrome for now; re-shelled in P5), with `Dataset` JSON-LD.                                                                                                    |

**Exit:** Q-10 absolute; every live number has a registry entry; a ledger row.

### P3: Economics engine (pure functions, no UI)

| Item | Work                                                                                                                                                                                                                       |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P3.1 | `paths.js`: the four path cost models (R-PATH-01..04), plus tests.                                                                                                                                                         |
| P3.2 | Incentives, escalation, O&M and replacements in `money.js` (R-PATH-05, R-PATH-06), vintage normalisation (R-PATH-09) and the NPV view (R-PATH-10), plus tests.                                                             |
| P3.3 | Lease/PPA model (R-PATH-02), plus tests.                                                                                                                                                                                   |
| P3.4 | Exact shared definitions (R-PATH-07) and uncertainty triples (R-PATH-08), plus property tests.                                                                                                                             |
| P3.5 | Generalised frontier (per path × per outcome metric) and timeline series; the recommended-system rule (§6.4).                                                                                                              |
| P3.6 | `invariants.js` (R-AI-01) run over the full fixture matrix in CI.                                                                                                                                                          |
| P3.7 | Engine kept and extended only through R-UC items (R-ENG-01); engine and registry versions stamped (R-ENG-05); fixture matrix and goldens (R-ENG-02); determinism tests (R-ENG-04); the PVWatts validator (R-ENG-03, Q-11). |
| P3.8 | Widen the coverage scope to `paths`, `money`, `frontier`, `invariants` and the registry loader; enforce ≥ 90 / 85 / 90 (Q-16).                                                                                             |

### P4: Use-case engines (one PR per use case, each with fixtures)

| Item | Work                                                                                        |
| ---- | ------------------------------------------------------------------------------------------- |
| P4.1 | Export regimes with banking and true-up (R-UC-01).                                          |
| P4.2 | Time-of-use schedules as data (R-UC-02).                                                    |
| P4.3 | Reserve floor (R-UC-04).                                                                    |
| P4.4 | Outage simulator and essential-load catalogue (R-UC-03).                                    |
| P4.5 | Generator-assisted off-grid sizing, with days of autonomy computed in the engine (R-UC-05). |
| P4.6 | Portable model (R-UC-06).                                                                   |

### P5: Design system, shared shell and i18n infrastructure (runs in parallel with P2–P4)

| Item | Work                                                                                                                                                                                                                                                                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P5.1 | Tokens, light and dark, the chart palette validated for colour-vision deficiency and contrast (R-DS-01, R-CHART-04), and the token lint (R-DS-07).                                                                                                                                    |
| P5.2 | Components (R-DS-02), hygiene and layout rules (R-DS-03, R-DS-04), and `/design/` (R-DS-06), with visual baselines (Q-09 absolute from here).                                                                                                                                         |
| P5.3 | The shared shell on about, 404, blog, city, heatmap, sources and methodology (R-DS-05), with a cookie and CSP audit: zero cookies, no `unsafe-inline`, and `connect-src` limited to live dependencies (R-PRIV-02, R-PRIV-03). Lighthouse and axe become absolute for these templates. |
| P5.4 | i18n runtime: per-locale files, `Intl` formatting, the script-direction table, logical CSS and glyph-coverage tests (R-I18N-01..04), and the per-locale gates (R-I18N-05). The 6 existing locales are migrated with no loss (parity test).                                            |
| P5.5 | The translation-fix link (R-I18N-06).                                                                                                                                                                                                                                                 |

### P6: The new app at `/next/` (vertical slices)

| Item | Work                                                                                                                                                                                                                                                                                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P6.1 | **Slice 1, bill-cut end to end.** Steps 1–5 (R-FLOW-01..05) with validation (R-FLOW-07), the lazy-loading architecture and layout stability (R-PERF-01..03), copy rules (R-CONT-01..04), results R-RES-01..08 for bill-cut, the frontier and timeline (R-CHART-01..05), verify-then-reveal (R-AI-01..03), share v2 (R-FLOW-06), print and CSV. Budgets absolute for `/next/`. |
| P6.2 | Slice 2: time-of-use battery-only, plus the reserve toggle.                                                                                                                                                                                                                                                                                                                   |
| P6.3 | Slice 3: backup (essentials).                                                                                                                                                                                                                                                                                                                                                 |
| P6.4 | Slice 4: off-grid home.                                                                                                                                                                                                                                                                                                                                                       |
| P6.5 | Slice 5: portable.                                                                                                                                                                                                                                                                                                                                                            |
| P6.6 | Resilience fault-injection flows (R-OFF-01, Q-14) and offline (R-OFF-03).                                                                                                                                                                                                                                                                                                     |
| P6.7 | **Parity checklist**: every capability of the legacy app (chemistry choice, AGM reference, the state-of-charge view, bill of materials and parts CSV, roof-area cap, wiring and MPPT overrides, generator fuel, the climate-aware toggle, simple mode) is either present in `/next/` or retired with a D-reference. The list is committed and reviewed.                       |
| P6.8 | Scenario suite for Q-06 (interactions and time to answer).                                                                                                                                                                                                                                                                                                                    |
| P6.9 | The comprehension probe (Q-12), on `en` first, then on all 6 locales.                                                                                                                                                                                                                                                                                                         |

### P7: Advisor 2.0

| Item | Work                                                                                                                                                                                   |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P7.1 | The typed `facts` object and its server-side schema (R-AI-04).                                                                                                                         |
| P7.2 | Per-reply verification pipeline, `respondedAt`, and the single regeneration (R-AI-05).                                                                                                 |
| P7.3 | Footer, tooltip, and the trust-vocabulary lint (R-AI-06, R-AI-07).                                                                                                                     |
| P7.4 | Eval set (≥ 50 questions per use case, 6 locales) plus `scripts/validate-advisor.mjs`, a manual live validator registered in `gate-registry.mjs` and documented in the runbook (Q-18). |

### P8: The swap (the single visitor-visible switchover)

| Item | Work                                                                                                                                                                                           |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P8.1 | **Pre-swap gate**: all 6 locales at parity on `/next/` (Q-13, including the Jev translation facet `proven` for each); Q-02..Q-09 absolute on `/next/`; the parity checklist complete; P7 done. |
| P8.2 | Swap `/next/` → `/`. Legacy share links decode. The old URLs redirect. `/next/` redirects to `/`.                                                                                              |
| P8.3 | Delete the legacy UI (`ui.js`, `budget-span.js`, `locales.js`, the canvas charts in `charts.js`), with every bound test ported or retired as §7 requires.                                      |
| P8.4 | Budgets absolute site-wide. The service-worker precache is updated (R-PERF-05). A release following `docs/DEPLOY_RUNBOOK.md`.                                                                  |
| P8.5 | A 7-day watch: error-free smoke runs on production, the field CWV trend and the advisor verification stats. A rollback per the runbook if any Q-metric regresses in production.                |

### P9: Reach

| Item | Work                                                                                                 |
| ---- | ---------------------------------------------------------------------------------------------------- |
| P9.1 | Localised URLs and hreflang for the 6 locales (R-I18N-08, R-SEO-04).                                 |
| P9.2 | Per-country cost pages from the registry (R-SEO-03).                                                 |
| P9.3 | City pages regenerated on the new economics and shell.                                               |
| P9.4 | Titles, H1s and meta (R-SEO-01), structured data (R-SEO-02) and E-E-A-T surfaces (R-SEO-05).         |
| P9.5 | Blog audit (R-CONT-05).                                                                              |
| P9.6 | Search Console and Cloudflare Web Analytics live, with the monthly reach rows (R-SEO-06, R-PRIV-05). |

### P10: Program exit gate, "v1.0 world-class"

| Item  | Work                                                                                                                                                                                           |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P10.1 | A full live Jev complete gate: ≥ 99.0 overall, every facet `proven` (Q-01 full).                                                                                                               |
| P10.2 | A full quality-bar sweep with artifacts: Q-02..Q-18 on production. Screen-reader passes (O-06). A PVWatts cross-check (Q-11). An advisor eval (Q-18). Includes the R-PATH-08 precision review. |
| P10.3 | Every finding (F-01..F-43) is closed, with its proving PR and test cited in the ledger.                                                                                                        |
| P10.4 | Owner sign-off, recorded as a `phase-done` ledger row for P10.                                                                                                                                 |

### P11: Continuous (after P10)

| Item  | Work                                                                                                                                                                                                                                                                         |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P11.1 | Language waves up to the full R-I18N-07 set, each wave ≤ 20 languages. Each language launches only at the P8.1 locale bar (mechanical parity plus Jev ≥ 99 plus the comprehension probe). A language that later fails is unpublished until it is fixed, never left degraded. |
| P11.2 | Data freshness: the weekly `review_by` sweep, with an annual policy review per country.                                                                                                                                                                                      |
| P11.3 | Scheduled live Jev and quality-lab runs against production (weekly), with regressions opened as issues.                                                                                                                                                                      |
| P11.4 | A monthly reach and field-CWV ledger row.                                                                                                                                                                                                                                    |

**Size estimate** (for sequencing, not a promise): P0 ~6 PRs, P1 ~6, P2 ~6 plus an open-ended per-region queue (K-10), P3 ~8, P4 ~6, P5 ~8, P6 ~12, P7 ~4, P8 ~5, P9 ~6, P10 ~2; P11 is ongoing.

## 9. The per-PR definition of done

Every phase PR MUST:

1. Name its plan items and requirement IDs in the title or body, and link this plan and the tracking issue. `.github/pull_request_template.md` carries this checklist.
2. Add or update tests for every change (AGENTS.md). Coverage never drops (Q-16).
3. Pass the local preflight: `npm test`, `node scripts/check-chars.mjs`, `npm run seo`, `npx --yes prettier@3.9.6 --check .`, `npm run deploy:check`, `npm run plan:check`, plus every gate added by P0.4 as it lands.
4. Be green in CI on every required check (`test`, `web-smoke`, `coverage`, `analyze`, plus `quality-lab` and `jev-complete` once they are required).
5. Not regress any metric against its latest ledger baseline (§3.2), and meet every absolute threshold its phase has switched on.
6. Attach the scoped live Jev report (Q-01). Before O-01, the owner runs it locally and attaches it. **Bootstrap:** P0.1 (adoption) and P0.2 (archive) carry no Jev report, because the scoped mode does not exist yet. P0.3 is judged by its own head's fixed gate (the new constants, no OpenRouter, the scoped mode) and MUST merge before any P1 or later PR. Here "P0.3" means the complete set: all five sub-PRs (a)–(e) merged, and each is judged by the gate as it stands at its own head. Every PR after P0.3 follows this rule with no exception.
7. Append a ledger row (`item-done`) with the PR number, the head SHA, the gate outcomes and the Jev score.
8. Follow the release rules when shipping (`CACHE_VERSION` and asset-token bumps; `docs/DEPLOY_RUNBOOK.md`).
9. Tick the item in the tracking issue.

## 10. Owner-only actions

| ID   | Action                                                                                                                                                            | Needed by       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| O-01 | Add `TYPESAFE_API_KEY` as a GitHub Actions secret and as a Worker secret. Make `jev-complete` a required check (`scripts/lib/ruleset.mjs`, `npm run protect`).    | P0.3            |
| O-02 | Enable Cloudflare Web Analytics (cookieless) for the production domain.                                                                                           | P9.6            |
| O-03 | Pin the "Master plan tracker" issue.                                                                                                                              | P0.1            |
| O-04 | Verify Search Console for `freeoffgridcalculator.com` and grant read access for the monthly report.                                                               | P9.6            |
| O-05 | Enable "require review from Code Owners" in the `main` ruleset, so `docs/plan/` changes need @Treystu.                                                            | P0.5            |
| O-06 | Run the NVDA + Chrome and VoiceOver + Safari passes, or delegate them to a named person, for each UI phase; record them in the ledger.                            | P5, P6, P8, P10 |
| O-07 | Approve each amendment (§16) and each test retirement (§7).                                                                                                       | Ongoing         |
| O-08 | Optionally let future sessions clone the sibling `harness` repo (the planning session's classifier denied it) so that the Jev pack can be compared with upstream. | Optional        |

## 11. Facts to verify before they ship (the planning session could not confirm these)

| ID   | Fact                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Verify at                                      | Blocks      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ----------- |
| V-01 | Turnkey benchmarks per country (Appendix C). The US spread between marketplace quotes (~$2.5/W) and industry averages (~$3.4/W) must be shown as a range, not a single number.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | The primary publications                       | P1.1, P2.2  |
| V-02 | Typical lease/PPA escalator range (planning found 0–3.9 %, with 2.9 % "typical" only from secondary sources).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Primary contract disclosures or regulator data | P3.3        |
| V-03 | The status of the US federal residential clean-energy credit (IRC §25D) for 2026 installs. Trade press reports it was terminated for expenditures after 2025-12-31.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | irs.gov                                        | P2.4        |
| V-04 | Export rules that are changing: the Dutch net metering (salderingsregeling) end date of 2027-01-01, California NEM 3.0, Pakistan's buyback cut, the Rajasthan (India) repricing, and Brazil's "Fio B" schedule.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Government and regulator sources               | P2.4        |
| V-05 | The Cloudflare Pages per-deployment file-count limit for this account's plan (it bounds localised pages).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Cloudflare docs and account                    | P9.1, P11.1 |
| V-06 | Whether Cloudflare Web Analytics can count an in-page results view without new identifiers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Cloudflare docs                                | P9.6        |
| V-07 | The terms of the runtime FX source (currently `open.er-api.com`) and the ECB coverage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Provider terms                                 | P2.5        |
| V-08 | Google Cloud Translation's supported-language list on the P11 kickoff date.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Google Cloud docs                              | P11.1       |
| V-09 | The licences of Ember, GlobalPetrolPrices (CC BY-NC-ND 3.0 per planning research, so not embeddable), Eurostat, EIA, OpenEI URDB and ECB.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | The license pages                              | P2.2        |
| V-10 | The NASA POWER grid resolution, to confirm that 0.01° rounding loses no accuracy (and whether coarser rounding is safe).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | NASA POWER docs                                | P1.3        |
| V-11 | The numbers behind the Jev pricing. The owner reports ~2 billion tokens consumed for US$0.07. At the canonical US$0.00042 per million tokens, 2 billion tokens (2,000 million) would cost ~US$0.84, about 12× the reported US$0.07 (which implies ~US$0.000035 per million), so the two figures do not reconcile. The canonical constant stands (D-13); the monthly cost roll-up (R-AI-08) records the provider-billed amount next to the computed one, so a discrepancy becomes visible. P0.3 exits only after one week of live gate traffic has been reconciled against TypeSafe's billed amount (no cap is added, per D-13). This reconciliation is a P0 ledger close-out item; it does not block P1 PRs, which need only P0.3's merge (§9 rule 6). | TypeSafe billing                               | P0.3        |

## 12. Risks

| ID   | Risk                                                                                       | Mitigation                                                                                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K-01 | Live Jev judgments are non-deterministic, which makes the merge gate flaky.                | Pinned model version, structured score questions, the scoped mode, one re-run for provider errors only, and every report archived. A judgment that differs on re-run is investigated, not averaged. |
| K-02 | Registry data is sparse for much of the world, which risks false precision.                | Honest `unknown`, grade-D bands with published formulas, the "check your bill" prompt, and ranges shown by default for C/D inputs.                                                                  |
| K-03 | The long `/next/` build delays visible value.                                              | P1 and P2.6 ship the truth fixes live first. Slices are small. P8 is a single, gated switchover.                                                                                                    |
| K-04 | 200+ languages exceed the host's file limit and translation quality.                       | R-I18N-08 page scoping, V-05, per-language gates, unpublishing on failure (P11.1).                                                                                                                  |
| K-05 | The advisor adds latency, and Jev adds more.                                               | A p95 ≤ 10 s budget, staged status text, one regeneration at most, and a visible "unavailable" state that never blocks.                                                                             |
| K-06 | Budgets that are too strict for a rich app.                                                | Lazy loading by design (R-PERF-01). Evidence-based amendment only (§3.1).                                                                                                                           |
| K-07 | Legal exposure from legality flags or DIY guidance.                                        | Cited flags only, "Unverified: check locally" as the default, the safety block, "educational estimates" terms, and never naming firms (D-05).                                                       |
| K-08 | Parallel sessions editing `main` (release stamps and so on) cause conflicts.               | Small PRs, the plan PR touches only its own files plus minimal wiring, and merge conflicts are resolved by merging the base (never by rewriting history).                                           |
| K-10 | Filling the registry for 249 countries takes far more work than a fixed PR count suggests. | P2.3 runs as an open-ended queue batched per region (one region per PR), and the A/B top markets come first; nothing else waits on full coverage because `unknown` is a valid, honest value.        |
| K-09 | A gate that nobody runs (the orphan problem).                                              | Every new validator is wired into CI or registered in `MANUAL_VALIDATORS` with a runbook entry; `tests/gate-net.test.mjs` enforces this.                                                            |

## 13. Verification machinery

### 13.1 Existing gates (kept)

`npm test` (the `tests/*.test.mjs` suite), `npm run seo` (JSON-LD, characters, SEO, quality, i18n, headers, country sync, asset tokens), prettier, the secret scan, `deploy:check`, `verify:flow`, `web-smoke` (the zero-dependency CDP browser smoke), `coverage`, CodeQL, the main-branch direct-push audit, and the weekly and daily scheduled sweeps.

### 13.2 New gates (built in P0 unless noted)

| Gate                                            | Job / command                                     | Phase  |
| ----------------------------------------------- | ------------------------------------------------- | ------ |
| Plan pin                                        | `npm run plan:check` in the `test` job            | P0.1   |
| Lighthouse, axe, cross-browser, budgets, visual | `quality-lab` job                                 | P0.4   |
| Live Jev (scoped / full)                        | `jev-complete` job                                | P0.3   |
| Registry provenance and freshness               | `data:check` in `npm run seo` plus the weekly job | P2.1   |
| Invariants and golden fixtures                  | `npm test`                                        | P3     |
| Token lint, trust-vocabulary lint, jargon lint  | `npm test`                                        | P5, P7 |
| Comprehension probe                             | manual live validator, then a scheduled job       | P6.9   |
| Advisor eval                                    | `scripts/validate-advisor.mjs` (manual)           | P7.4   |
| PVWatts cross-check                             | `scripts/validate-pvwatts.mjs` (manual)           | P3.7   |

### 13.3 Jev protocol

- The provider is **TypeSafe direct only** (D-13), authenticated with `TYPESAFE_API_KEY`, `HARNESS_JEV_KEY` or `JEV_API_KEY` (the existing key lookup, minus OpenRouter).
- **Scoped** (every phase PR): `node scripts/validate-jev-complete.mjs --scope P<n>.<m> --evidence <ci-evidence.json> --out <report.json>` must exit 0, meaning a scoped score ≥ 99.0 and no facet below its previous ledger level.
- **Full** (P10 and weekly in P11): the same command without `--scope`. It must reach ≥ 99.0 with every facet `proven`.
- Evidence is produced by CI from real job outcomes. A hand-written evidence file is never accepted as proof on its own.
- Every report is attached as a CI artifact, and its score is copied into the ledger row.

### 13.4 Ledger format (`docs/plan/LEDGER.jsonl`, append-only)

One JSON object per line: `{"ts": "YYYY-MM-DD[THH:MM:SSZ]", "kind": "adopted|baseline|phase-start|item-done|phase-done|gate-run|amendment|note", "ref": "<P-item, F-id or PR>", "summary": "<one line>", "evidence": {…optional: pr, sha, gates, jev, metrics}}`. `scripts/check-plan-pin.mjs` validates the shape and, on PRs, that the file only grows.

## 14. Non-goals

- No accounts, lead forms, quotes marketplace, affiliate links, ads, paywalls or sales (AGENTS.md).
- No runtime dependencies. A build-time bundler only by amendment (R-PERF-02).
- No satellite roof analysis. The roof limit is an optional input.
- No loan or financing calculator in v1. It may come later by amendment; lease/PPA is covered.
- No naming of firms (D-05).
- No domain or name change (D-19).

## 15. Superseded documents

When P0.2 lands, these move to `docs/archive/` and are superseded by this plan: `GOOGLE_QUALITY_PLAN.md`, `PLAN.md`, `PHASE2_PLAN.md`, `PHASE3_PLAN.md`, `ROADMAP_10_PHASES.md`, `SEO_MASTER_PLAN.md`, `LAUNCH_AUDIT.md`, `IMPLEMENTATION_COMPLETE.md`, `GROQ_AUDIT_AND_OPTIMIZATION.md`, `GROQ_IMPLEMENTATION_GUIDE.md`, `GROQ_ROADMAP_VISUAL.md` and `CYCLE_LIFE_CORRECTION_SUMMARY.md`. Until then, AGENTS.md states that this plan takes precedence. `docs/DOMAIN_MIGRATION_PLAN.md` stays active for the domain cutover mechanics and is consistent with D-19.

## 16. Amending this plan

1. Open a PR that edits `docs/plan/MASTER_PLAN.md` and **appends** an entry to `docs/plan/AMENDMENTS.md` in this form:

   ```
   ## A-NNN: <title>
   - Date: YYYY-MM-DD
   - Approved-by: @Treystu
   - Plan-SHA256-before: <hash before, from `node scripts/check-plan-pin.mjs --print-sha` on the base>
   - Plan-SHA256-after: <hash after, from the same command on the head>
   - Sections: <§ and IDs changed>
   - Rationale: <the evidence that forced the change>
   ```

2. Set `current_sha256` in `docs/plan/PLAN.lock.json` to the new hash. `genesis_sha256` never changes.
3. CI (`npm run plan:check --base`) verifies the hash chain and checks that the amendment log and ledger only grow. Code-owner review (O-05) requires @Treystu.
4. IDs are never renumbered or reused. Retired items are marked "withdrawn by A-NNN" in the amended text.

Status, progress, dates and scores never go into this file. They belong in the ledger and the tracking issue, so bookkeeping never requires an amendment.

## Appendix A: owner requirements traceability

| ID   | Owner requirement (from the 2026-09-25 request and interview)                                                       | Satisfied by                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| U-01 | "Google Quality" and better: a full redesign, the most perfect user experience worldwide                            | §3, §6, P5–P8, P10                                       |
| U-02 | Worldwide audience capture, the most usefulness and ease of use                                                     | §6.2, §6.10, §6.14, P9, P11                              |
| U-03 | Convey the gap between typical installer prices and "self-purchase, electrician wires it"                           | D-01, D-05, §6.4, R-RES-01/02, R-CHART-02                |
| U-04 | Clear payback curves: 20-year total spend vs bill-cut %                                                             | D-02, R-PATH-07, R-CHART-01/02                           |
| U-05 | A comprehensive, ground-up plan with Google as the quality bar                                                      | this document                                            |
| U-06 | Jev completion analysis as the bar, 99/100 for every aspect                                                         | Q-01, §3, §13.3, P0.3, P10.1                             |
| U-07 | Interview to clarify before writing                                                                                 | §2 (D-01..D-20)                                          |
| U-08 | Cheap subagents for research                                                                                        | §4 and §5 were gathered that way (process)               |
| U-09 | The plan audited by subagents to ≥ 99.9/100 before it is committed                                                  | Recorded in the adoption PR and the ledger `adopted` row |
| U-10 | A master tracking PR with every requirement and check                                                               | P0.1, D-06, the adoption PR body                         |
| U-11 | An immutable plan driving a refactor only as needed                                                                 | D-04, D-07, §7, §16, `check-plan-pin`                    |
| U-12 | Simple first, working perfectly, then built up slowly and verified                                                  | §8 principles, slices, §3.2 ratchet, §9                  |
| U-13 | Mission: independence from grid dependence, freeing grid capacity                                                   | §1                                                       |
| U-14 | Every use case (off-grid, portable, backup, ToU battery, emergency reserve) in one cohesive, location-first flow    | D-16, D-17, §6.2, §6.3, P4, P6                           |
| U-15 | Jev checks sizing before reveal; the advisor evaluates the system; Jev scores shown per reply next to the timestamp | D-11, D-12, §6.7, P6.1, P7                               |
| U-16 | Jev direct at $0.00042 per million tokens is canonical; OpenRouter disabled for Jev                                 | D-13, R-AI-08, P0.3                                      |
| U-17 | Every language MT supports, gated to the six-perfect bar and hard-gated by Jev                                      | D-14, R-I18N-05/07, P8.1, P11.1                          |

## Appendix B: reference sites for fixtures, PVWatts checks and the comprehension probe

Phoenix US, Berlin DE, London GB, Madrid ES, Sydney AU, Tokyo JP, Delhi IN, São Paulo BR, Mexico City MX, Lagos NG, Nairobi KE, Manila PH. Karachi PK and Johannesburg ZA are added as i18n and data probes. Each site has a committed offline weather profile and golden outputs per use case.

## Appendix C: seed sources found in planning. Leads to verify, not data.

Grades are provisional until P2.2 verifies each source at its origin. Figures found in planning are deliberately omitted here so that no unverified number can be copied into the product.

| Topic                      | Seed source (publisher)                                                                                                                                                                                           | Provisional grade |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| US installed prices        | LBNL "Tracking the Sun"; SEIA / Wood Mackenzie "US Solar Market Insight"; EnergySage marketplace report                                                                                                           | A; B; B           |
| UK installed prices        | MCS Installation Database                                                                                                                                                                                         | A                 |
| Germany installed prices   | Fraunhofer ISE "Recent Facts about Photovoltaics in Germany"                                                                                                                                                      | A                 |
| France installed prices    | IEA PVPS National Survey Report, France                                                                                                                                                                           | A                 |
| Other IEA PVPS members     | IEA PVPS National Survey Reports (JP, MX, others)                                                                                                                                                                 | A                 |
| Australia installed prices | Solar Choice price indices                                                                                                                                                                                        | B                 |
| India benchmark            | MNRE benchmark-cost notification (a subsidy reference price, not a market price)                                                                                                                                  | A (with note)     |
| Module prices              | pvXchange price index; InfoLink                                                                                                                                                                                   | B                 |
| Battery prices             | BloombergNEF lithium-ion battery price survey (cells and packs, not installed systems)                                                                                                                            | B                 |
| Electrician wages (US)     | BLS Occupational Employment and Wage Statistics                                                                                                                                                                   | A                 |
| Permitting (US)            | NREL / SolarAPP+ program data                                                                                                                                                                                     | A                 |
| Tariffs                    | Eurostat `nrg_pc_204`; US EIA; OpenEI URDB; national regulators                                                                                                                                                   | A                 |
| Export rules and legality  | Clean Energy Regulator (AU); Ofgem / MCS (UK); VDE / grid operators (DE); business.gov.nl (NL); METI (JP); ANEEL / Lei 14.300 (BR); DOE (PH); EPRA (KE); state DISCOM orders (IN); NEPRA / ECC (PK); CPUC (US-CA) | A                 |
| FX                         | European Central Bank euro reference rates                                                                                                                                                                        | A                 |
| Countries lacking A/B data | National regulators and statistics offices, searched per country in P2.3; otherwise `unknown` or grade D                                                                                                          | n/a               |
