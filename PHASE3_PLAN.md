# PHASE 3 PLAN — The Plausibility Frontier

**Created:** 2026-08-29. Implements roadmap phase 3 (bill-cut explorer) and pulls
forward the parts of phases 11 and 12 (comprehension, trust) that depend on it.

**The problem, stated precisely.** Every view in the tool today answers *one*
question: "what does this target cost?" You pick 80% from a dropdown and get a
card. But the question a visitor actually arrives with is a shape, not a point:
*how far can I get, and what does each further step cost?* Nothing on the site
answered that, so nothing on the site said whether a goal was easy, expensive,
or impossible where the visitor lives — the single thing the north star promises.

**The answer.** Sweep every panel-and-battery combination on a coarse lattice
against the same hourly weather the cards use, keep the systems nothing cheaper
beats, and draw the resulting cost-versus-coverage curve. One picture, and the
site can finally say: *Honolulu reaches full independence for about $3,100. At
Oslo, the largest system this tool sizes still leaves you short — and the last
few percent cost more than twenty times what the first ones did.*

What it must **never** say is that Oslo is impossible. See §6a.

---

## 1. How the backlog was ranked

Criterion for this pass: **more powerful and easier to read at the same time —
visual, data-driven, and building credibility by showing the comprehensive
picture rather than a single cherry-picked answer.**

| Phase / item | State before | Score against this pass | Verdict |
|---|---|---|---|
| 1. Bill-first front door | shipped 2026-08-28 | done | — |
| 2. Home energy map | appliance builder shipped; "I don't know" profile and flexible-load split missing | moderate: better input, same output | later |
| **3. Bill-cut explorer** | 3 fixed targets, numbers only, no comparison surface | **highest: turns one point into the whole shape, and shows what a hard site really costs** | **THIS PASS** |
| 4. Best first dollar | not started | high, but ranks *actions*; the frontier already exposes the cheapest useful step (solar-only shows up as the first grid-tie point) | next |
| 5. Realistic grid economics | flat tariff + export rate only; fixed charges, TOU and demand charges unmodelled | high and partly a **correctness** issue — see §6 | next, paired with 4 |
| 6. Staged energy plan | not started | depends on 4 | later |
| 7. Reality check and safety | assumptions panel + disclaimers; no constraint checklist | moderate | later |
| 8. Global and offline | bundled profiles, currency, EN/ES/PT/FR/AR chrome | largely done | maintain |
| 9. Community validation | not started | low now (needs traffic first) | later |
| 10. Personal energy workspace | not started | low | later |
| 11. Comprehension polish | partial | **folded into this pass** | in progress |
| 12. Trust polish | partial | **folded into this pass** | in progress |
| 13. Quality polish | partial | ongoing | ongoing |
| Sheet replication gate | blocked on the owner's CSV export | n/a | blocked |
| Streaming advisor, temp 0.3–0.4 | not started | low visual payoff | later |
| Monitoring (`/api/health` cron, Groq quota alert) | not started | zero visual payoff, real operational value | separate track |

Phase 3 won because it is the only item that makes the tool **more powerful and
easier to read with the same change**. It also subsumes work phases 4 and 6 will
need: the marginal cost of each further percentage point is exactly the number
"best first dollar" has to rank against.

---

## 2. What shipped

### `assets/js/sizing/frontier.js` — pure, no DOM, no network

| Export | Does |
|---|---|
| `pvLadder`, `battLadder` | Geometric lattices — fine where small systems live, coarse at the expensive end. `battLadder` offers **0 kWh only in grid-tie**, so solar-with-no-battery can win the cheap end. |
| `sweepSystems` | Simulates every lattice point. Takes an injected `costFn` so prices come from the same `fullRange()` the cards use. |
| `paretoFront` | Cheapest-first; a system survives only if nothing cheaper covers more. |
| `thinFront` | Drops points closer than 1 percentage point and anything under 25% coverage; caps at 22 points. Endpoints always survive. |
| `findKnee` | Furthest point above the chord from cheapest to most capable — "good value stops here". |
| `isBoundLimited` | Did the best system sit on the edge of the lattice? If so the sweep ran out of road before the physics did — see §6a. |
| `classifyReach` | Returns an **id plus numbers, never prose**: `beyond-sweep` / `steep-tail` / `tapering` / `linear`, with knee %, best-reached %, the envelope searched, and marginal cost per point before and after the knee. |
| `buildFrontier` | The whole thing, plus `chemLabel`, `simCount` and the lattice used. |

### `assets/js/sizing/frontier-chart.js` — SVG renderer

SVG rather than canvas: crisp on the printable one-pager, no `devicePixelRatio`
juggling, real text for screen readers and translation, and a matching data
table for anyone who cannot use the picture.

- `chartBox(hostWidth)` builds the viewBox **to match the element**. The results
  column is ~290px on a phone and ~400px on a laptop; a fixed 760-wide viewBox
  was being scaled to 0.44 and delivering 5px labels.
- `placeLabel` measures the callout and puts it on whichever side it fits,
  centring it when neither does. Below 360px the two callouts are dropped —
  the legend and the verdict sentence already say both in words.
- `axisTicks` snaps to round money. Dividing the axis evenly produced
  `$1,333.333`, which reads as a bug rather than a price.
- Price-uncertainty band from bare cells to shipped retail, drawn behind the
  curve — the site's "ranges, not false precision" rule, made visual.
- `markerOffCurve` note: the cards recommend on **true 20-year cost** while the
  curve ranks by **up-front price**, so the recommended system can legitimately
  sit right of the curve. Rather than snapping the marker onto the line and
  misstating its price, the page says why.

### Wiring

- `run.js`: `attachFrontier()` on all four payload paths; **contract 6 → 7**.
  Per-point simulation objects are stripped before `postMessage`.
- `ui.js`: renders the panel, feeds the verdict to the printable one-pager and
  to the advisor brief (so the model explains *these* numbers, never its own),
  and redraws on resize because the chart is built at its container's width.
- `index.html`: the panel, above the state-of-charge chart.
- All module `?v=` stamps bumped to `20260829a` so no browser serves a stale
  `run.js` against a new `ui.js`.

### Worldwide

35 new strings across **en, es, pt, fr, ar**, verified complete in all five —
`t()` falls back to the raw key, not to English, so a missing key ships visible
garbage. Costs run through the existing currency conversion. RTL verified: the
document flips, the plot stays LTR (the convention in every locale), and the
legend uses `margin-inline-end` so its swatches follow the text direction.

---

## 3. Verification

- `tests/frontier.test.mjs` — 15 tests. Suite is **106 passing**, up from 91.
- **The gate that matters:** the curve's price for an 80% bill cut is required
  to land within 0.6–1.45× of what the dedicated `sizeForBillCut` search
  charges. A chart that disagrees with the cards printed beside it is worse
  than no chart.
- Driven end-to-end in a real browser at 1100px and 390px, in English and
  Arabic, with NASA POWER blocked so the bundled-profile offline path is the
  one under test. No console errors; chart text renders at 12.3–13 real pixels.
- `validate-jsonld`, `check-chars`, and the deploy allowlist all clean.

---

## 4. Cost

~250 extra hourly simulations per run, for one chemistry: about 0.1 s on a
single year of weather, roughly 0.5 s on five. It runs inside the existing web
worker, so the page never blocks.

---

## 5. Deliberately not in this pass

- **Ranking actions** (efficiency, load-shifting, generator) — that is phase 4.
  The frontier ranks *systems*; it does not yet know that a new fridge might
  beat both.
- **Aging fade inside the search objective** — still replacement-count only.
- **Refining the lattice around the frontier.** The coarse sweep is within a
  few percent of the fine search, and the chart is a shape, not a quote.

---

## 6. Two ways this chart could lie, and what stops it

### 6a. A search bound is not a law of physics — caught in review

The first version reported an "88.1% ceiling" for Oslo and told the reader that
was the limit *at any price*. It was not. It was the top-right corner of the
sweep, and it moved every time the box was widened:

| Sweep | reported "ceiling" | best system found |
|---|---|---|
| 30 kW / 100 kWh | 88.1% | (30, 100) — the corner |
| 30 kW / 250 kWh | 92.4% | (30, 250) — the corner |
| 60 kW / 400 kWh | 94.5% | (60, 400) — the corner |
| 100 kW / 600 kWh | 97.2% | (100, 600) — the corner |

A brute-force check settles it: **for the 10 kWh/day household in the fixture,
300 kW of panels and 1,000 kWh of battery covers Oslo 100%, with zero unmet
hours.** Full independence is reachable there; it just costs roughly a quarter
of a million dollars and needs an array the size of a car park. That is a
devastating answer, and a true one. "Impossible" was neither.

Note the load in that sentence. It is doing real work: **independence is a
ratio, not an amount.** The same Oslo winter that defeats a 10 kWh/day house is
irrelevant to someone charging a phone and running some lights — see §6c.

Three things now prevent the false negative:

1. `isBoundLimited()` checks whether the best system sat on the lattice edge,
   and the flag rides on every payload.
2. The verdict id is `beyond-sweep`, never `unreachable`, and every locale's
   copy names the envelope searched — "up to {pvMax} kW of panels and
   {battMax} kWh of battery" — rather than implying physics. The chart's
   dashed line is labelled "best within the sizes searched".
3. `tests/frontier.test.mjs` carries a regression test that widens the sweep
   and **requires** the reported figure to move. If it ever stops moving, the
   number has quietly become a claim about the world again.

The fallback sweep now also matches the envelope the card search already
explored (off-grid 30 kW / 250 kWh, grid-tie 45 kW / 120 kWh), so the chart can
never imply a smaller world than the cards beside it had already looked at.

The general rule this produced: **a confident negative needs stronger evidence
than a confident positive**, because nobody goes and checks it.

### 6b. Bill-cut percentage is energy displaced, not bill reduced

The bill-cut percentage — on the curve *and* on the cards — is computed as
`1 − imported kWh ÷ total kWh`. That is the share of **energy** displaced, not
the share of the **bill**, because fixed connection charges do not fall when
your imports do. On a tariff with a large standing charge, a "95% bill cut" is
not a 95% smaller bill.

The cards have always had this; the frontier now puts it in a headline, which
raises the stakes. Modelling fixed charges is roadmap phase 5, and it should be
the next thing after phase 4 — or before it, if the standing charge in a common
market is large enough to change which action wins.

---

### 6c. A small load has no sizing problem — caught in review

Raised while reviewing §6a: if independence is a ratio, then a small enough
load is covered by anything. Checking what the tool actually did:

| Site | Load | Frontier |
|---|---|---|
| Honolulu | 0.05 kWh/day | **1 point** — panel silently vanished |
| Honolulu | 0.5 kWh/day | **1 point** — panel silently vanished |
| Oslo | 0.05 kWh/day | 5 points, starting at 91.9% |
| Oslo | 10 kWh/day | 22 points, up to 92.4% |

Below roughly 1 kWh/day the smallest system on the lattice — 0.4 kW of panels
and 1 kWh of battery — already covers 100%, the curve collapses to one point,
and the renderer (which needs two) hid the whole panel.

The lattice floor is not the bug: 0.4 kW and 1 kWh is about the smallest thing
a person can actually buy and build, so "the smallest real system already covers
you" is the true answer. The bug was going **silent** instead of saying it.

`classifyReach` now returns `already-covered` when the cheapest system on the
frontier is at or above 99%, carrying that system's size and price, and the
panel prints: *"Sizing is not your constraint here. The smallest practical
system — 0.4 kW of panels and 1 kWh of battery, about $304 — already covers
this entire load, year-round."* For a phone-and-lights visitor that is the
whole answer, and they are exactly the audience a worldwide free tool should
serve best.

---

## 7. Next

1. **Phase 5, fixed charges first** — add a standing-charge field and separate
   "energy displaced" from "bill reduced" everywhere. Correctness before polish.
2. **Phase 4, best first dollar** — rank efficiency, load shifting, solar,
   battery and generator against the marginal-cost numbers the frontier
   already computes.
3. **Phase 6** — turn the ranked actions plus the frontier into a staged plan.
