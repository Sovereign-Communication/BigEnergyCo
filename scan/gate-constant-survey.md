# Gate-constant drift survey — origin/main (0454e74)

Read-only pass. Base: detached worktree `C:/tmp/gate-survey` at `origin/main`
`0454e74`, tree clean before and after. No gate changed, nothing pushed.
Live values measured by `npm run seo` on that tree (exit 0);
`tests/gate-self-audit.test.mjs` and the facet suites read for pin coverage.

Question asked of every number: **what does it count, and can page count,
content growth or reformatting move it without new debt?**

---

## R1 — Eroding budgets, measured at 100% of limit, raisable by a one-line diff

| # | Number | Where | Unit counted | Measured | Pin | Drift mechanism |
|---|--------|-------|--------------|----------|-----|-----------------|
| 1 | `PROSE_CEILING = 422` | `scripts/check-i18n.mjs:405` | occurrences of unkeyed prose blocks per page | **422 / 422** | shape only: `/const PROSE_CEILING = \d+;/` (`tests/i18n-banned-values.test.mjs:414`) | any added unkeyed block, and every page that gains a `data-i18n` hook imports its whole body into the count. b1dc77a: 51 → 422 (+371) of which 341 article-body blocks and 30 UI blocks = **11 distinct strings**. History 39 → 51 (legit, documented) → 422 (erosion, documented in-file). |
| 2 | `RATCHET.inlineStyleAttributes = 633` | `scripts/check-quality.mjs` | occurrences of `style="…"` per page | **633 / 633** | **none** — zero references in `tests/` | copying an existing declaration onto one more page. b1dc77a: 574 → 633 (+59) with the distinct declaration set unchanged: **180 before, 180 after**. |

Both sit at exactly 100% of budget, so the next content commit trips them and the
cheapest fix is another raise. Fix in flight on `fix/gate-ceiling-scope`
(`7b26d00`): article bodies excluded from the UI debt class, debt counted in
distinct strings / distinct declarations, both pinned to measured debt.

## R2 — Constants that decide what counts as debt (loosenable without a red test)

3. `unkeyedProse(..., { minWords = 6 })` and `MIN_PROSE_WORDS = 2`
   (`scripts/lib/gates.mjs`). Raising `minWords` silently exempts more copy from
   the debt class; no test names the number (tests assert fixture behaviour at
   the boundary, so tightening fails and loosening passes). Asymmetric pinning —
   the same shape as R1.
4. `stable_cells_for_comparison: 27` (`scripts/lib/visual-budgets.mjs:95`). An
   evidence count inside a gate structure; the exclusion list IS asserted by
   `tests/visual-budgets.test.mjs` but this field is referenced nowhere in
   `tests/`. If templates/widths/directions change, “27 of 28 cells were stable”
   stops being true and nothing notices (the ratios remain the load-bearing
   evidence).

## R3 — Coverage that grows with the site, or fails to

5. `LIGHTHOUSE_TARGETS` — 14 hand-written page/form-factor pairs, `runs: 3` each
   (`scripts/lib/lighthouse-budgets.mjs`). The a11y and visual matrices derive
   their templates from the staged tree (`templateMatrix`), but Lighthouse’s
   list is hand-written and no test compares it against the derived templates:
   a new page *shape* silently ships unmeasured. Non-blocking anyway at P0.4
   (ratcheted floors + reported-only absolute), so this is a coverage gap, not
   a false pass.
6. a11y matrix bars/caps — read per cell from the newest `baseline` row
   (`readA11yBaseline`, `scripts/lib/quality-matrix.mjs:281`). New cells with no
   declared bar are `unmeasured`, and **`unmeasured` does not block**: only
   audit errors and regressions return 1 (`scripts/check-a11y-matrix.mjs` exit
   logic). Matrix growth ships unmeasured while the gate stays green; absolute
   caps bind only from P5/P8 (plan §3.2).
7. Byte-budget ratchet baseline — `readByteBudgetBaseline`
   (`scripts/lib/byte-budgets.mjs:74`). The limits are plan §3.1 verbatim
   (“do not edit: relax a limit in the plan, through an amendment”); the
   *ratchet bar* is the newest ledger `baseline` row, and `gate-run` rows
   correctly cannot set it. Residual: a new `baseline` row re-declares the bar
   with no plan amendment and no test tying it to one.

## R4 — Time budgets (drift axis is wall clock, not content)

8. `scripts/lib/budgets.mjs` chain — `VERIFY_BUDGET_MS 15m + BUDGET_SLACK_MS 2m
   ≤ PROMOTE_TIMEOUT_MS 20m ≤ JOB_TIMEOUT_MINUTES 25m`, `SMOKE_ATTEMPT_TIMEOUT_MS
   15m`, `FETCH_TIMEOUT_MS 30s`, `VERIFY_RETRY_DELAY_MS 5s`. **Sound**: the
   relation AND the workflow’s `timeout-minutes` literal are pinned by
   `tests/ci-resilience.test.mjs`; the env override is compression-only
   (`budgetFromEnv` clamps to the declared budget); the zero-backoff trap is
   explicitly rejected. Raising one number without the others fails a test —
   the pattern the rest of the suite should copy.
9. `PERFORMANCE_BUDGETS` — cold 15000 / warm re-run 2000 / preview 200 /
   confirm 20000 / warm reload 20000 ms, warm NASA pulls 0. Every value carries
   the reading that set it plus a `why`; `gate-self-audit` asserts the record is
   real and that relaxing a budget removes its regression. Residual: the
   multiplier is a judgement; the `why` field is the only guard.
10. Operational timeouts — `RUN_TIMEOUT_MS 180s`, `JEV_TIMEOUT_MS 15s`, a11y
    driver step timeouts 20/30/90 s, visual 30 s, smoke `SMOKE_RUN_DEADLINE_MS
    100` (a deliberate test shim, not a budget). No debt semantics; raising them
    hides slowness only inside gates that are already manual.

## R5 — Floors with slack (cannot drift-fail; certify non-emptiness only)

11. `pages.length > 50` (83 ship), `CITY_CATALOG.length >= 60`,
    `partitions.length > 200` (220 ship), `LOCALE_KEYS.length > 100` (323 ship),
    `files.length > 100`, `wrappers.length >= 5`. Sound by intent (a silent
    empty tree must fail) but strictly weaker than a pin: nothing certifies the
    content counts themselves.

## Sound — explicitly not a problem

- **Zero-tolerance zeros**: `web_fonts: 0`, `warm_window_nasa_max: 0`,
  `warm_reload_nasa_max: 0`, cross-browser bar “0 console errors, 0 CSP
  violations (absolute, not a ratchet)”, CSP `unsafe-inline: 0`, inline script 0.
- **Plan/external verbatim**: `BYTE_BUDGET_LIMITS` (plan §3.1), `PIXEL_THRESHOLD
  = 0.001` (Q-09, `>` semantics documented), `LIGHTHOUSE_ABSOLUTE`
  99/100/100/100 (Q-02; non-blocking at P0.4 for a **measured** reason — the
  composite is bimodal across 21 runs, so a floor would be a coin flip),
  `LIGHTHOUSE_SPEED_CEILINGS` (Q-03, reported), SEO `TITLE_MAX 60` /
  `DESCRIPTION_MIN 70` / `DESCRIPTION_MAX 155` (external constraint),
  HSTS `>= 31536000` s, `HORIZON_YEARS 20`.
- **Derived budgets with recorded raises**: jev `COMPLETE_STATE_BASE_CHARS` is
  now derived (`6000 + axes x 300`) after being raised 1200 → 3000 → 6000 with
  reasons in-file, so adding an axis raises the budget instead of evicting a
  facet; `COMPLETE_FACET_CLIP 280` is guarded by “an over-long facet line is a
  NAMED problem, not a trim” (self-audit); `COMPLETE_MIN_SCORE 99.0` is the
  mission’s bar.
- **Instrument floors that make an unmeasured run fail**: `adjustments_required:
  3`, `min_intercepted_per_mode: 1`, `fixture_shortens_exactly_one_timer: 1`,
  `fixture_swallows_exactly_one_message: 1`; and the recognition ceiling
  `max_acknowledgement_ms: 2000` (a stated expectation, not a widening knob);
  `TIMEOUT_GRAPH` / `BUDGET_FITS` are read from the shipped modules rather than
  retyped, so the graph cannot drift from the code.
- **Rules, not budgets**: `AXE_TAGS`, `STATES`, `SHAPES`, `WIDTHS`, `DIRECTIONS`,
  `NOT_PROSE`, `EVIDENCE_VERSION`, the plan-pin hash, asset-token stamps — growth
  breaks them loudly, which is the point.

## Low severity, worth naming

- `PROSE_OVERRIDE` (`scripts/check-evidence-freshness.mjs:47`) and
  `PROVENANCE_OVERRIDE` (`scripts/check-provenance.mjs:44`) point a gate at a
  different record. Documented as fixture affordances for mutation checks — but
  this is the exact shape the repo rejects elsewhere (“a gate anyone can loosen
  without touching the file”). CI does not set them; nothing asserts it isn’t.
- `LIGHTHOUSE_FLOOR_SLACK = 1`: floors set 1 point below the observed minimum.
  A documented convention, not drift.

---

## Verdict — what the suite still cannot certify

**A. That `origin/main` is green.** Measured at `0454e74`: `npm test` is
1660/1662. `tests/formatting.test.mjs` fails on
`.github/workflows/cf-pages-deploy.yml`, and prettier@3.9.6 rejects that file in
**both** LF and CRLF forms (it is stored LF), so the failure is
platform-independent — the CI step `npm run format:check` is red at main. The
second failure, `tests/deploy-blobs.test.mjs:192`, is a line-ending artifact:
`stageFromIndex` stages the index blob (LF) while the test compares against the
working-tree bytes, which are CRLF on any checkout with `text=auto`/autocrlf
conversion (reproduced here with a canonical CRLF worktree); it would pass where
the worktree matches the blob. It reproduces identically at `origin/main` and is
not caused by any change in flight.

**B. That a raised number is justified.** Numbers with a real pin: the
byte-budget time relation, the ledger-declared matrix baselines, the visual
exclusion list, the plan hash, and the “must equal measured debt” pins that
exist only on the in-flight branch. The two live ceilings at 100% are the
counterexamples in production; most others can be raised one line at a time
with CI green.

**C. That a browser-gate reading is true on any given PR.** a11y matrix,
cross-browser, visual, Lighthouse and the performance/resilience/experience
smokes are manual by decision; `validate-quality-evidence.mjs` asserts schema,
thresholds and a freshness window on committed evidence, and deliberately
*prints* rather than judges the `code_sha` relation.

**D. That coverage keeps up with the site.** New matrix cells are `unmeasured`
and non-blocking (6); Lighthouse targets are hand-written (5); the byte-budget
metric set is ledger-declared (7).

**E. That the absolute bars are met.** a11y caps and Lighthouse absolutes are
non-blocking until P5/P8 by plan §3.2; Q-02’s 99/100/100/100 and Q-03’s speed
ceilings are reported, not enforced.

**F. Live/prod truth.** F-44 (bot interstitial) blocks indexing probes;
`validate-live`, `validate-against-sheet` and `validate-jev-complete` are
manual/network/key-gated per `scripts/lib/gate-registry.mjs`.

## Recommended pattern (no change made in this pass)

The repo already contains three working anti-drift mechanisms: a pin that ties
the constant to the measured debt (visual exclusion list; the branch’s two new
pins), plan-verbatim values that move only through an amendment, and
relation-pinned time budgets whose parts must move together. Apply the first to
every number that counts occurrences or copies and sits at or near its limit;
prefer distinct-value units; and give coverage lists (Lighthouse targets) a test
against the derived template set so a new page shape cannot ship unmeasured.
