# Friction audit — 2026-11-03 (last 48 hours, this lane)

Sources: every status comment on #330 and #145 (timestamps in UTC), `git log`
with timestamps (local, UTC−10), and this session's own command record. Nothing
here is estimated from memory; where a cause is inferred rather than observed it
says so.

## Tally

| class                               | count in window           | time lost (est.)             | cure                                           | owner |
| ----------------------------------- | ------------------------- | ---------------------------- | ---------------------------------------------- | ----- |
| GATE_LOOP                           | 2                         | ~30 min (two CI round trips) | applied — see G-1                              | lane  |
| OTHER: premature rule-out           | 1                         | ~9 h of lane idle            | applied — see O-1                              | lane  |
| SESSION_DEATH / TRUNCATION          | 1 recorded resumption     | ~5 h                         | applied — see S-1                              | lane  |
| STEERING_LATENCY / WAITING_RESERVED | 3 gaps                    | ~42 h elapsed, not lost work | recorded — not a defect                        | owner |
| INFRA: command time cap             | 1 (this session, 2 calls) | ~8 min                       | applied — see I-1                              | lane  |
| CONTENTION                          | 0 observed                | —                            | —                                              | —     |
| DISK                                | 0                         | —                            | 13 GB free at pre-flight, above the 5 GB floor | —     |

## The stops, one by one

**G-1 · Format gate failed twice on a lane-introduced file (2026-11-03).**
`a99d8668e` (01:19) committed `docs/lane/allclear-2026-11-03.md` unformatted
because `npm run format:check` was run while the file was still untracked — the
check walks tracked files, so it never saw it. CI failed `test` at the Prettier
step; `61b6dee5b` (01:32) fixed it. The same class had already occurred once
before on the two temp-verify documents. **Cure applied:** format checks are only
evidence when run against the index that will be committed — i.e. `git add`
first, then check. **Lane habit for every future slice:** `git add` → `format`
→ `format:check` → commit.

**O-1 · Session 1 closed by declaring "no unblocked item left" (11:22).**
The claim was false: P1.1, P1.2, P1.4, P1.5, P1.6 and P2–P11 were open, and only
P0.5's sub-items were owner-reserved. The next session (12:41) corrected it and
delivered P1.1. Cost: the lane sat idle from 11:42 until the next steering at
22:28. **Cure applied:** the burndown ledger now enumerates every open item with
its class, so "nothing left" can only be claimed by walking a list, never by
recall. **Proposal (oversight):** a stop reason of `WAITING_RESERVED` is only
admissible with a ledger line count of zero for CURABLE NOW.

**S-1 · The 2026-11-01 temp-verification sessions died mid-census.**
Evidence: `9e5c8b68d` is literally titled "STATE 2026-11-01 — unified temp
verification resumption checkpoint", and the two commits after it re-add "the
executed evidence logs the STATE checkpoint cites". The lane resumed from that
checkpoint on 11-03 at 01:12. **Cure applied:** the checkpoint-before-long-run
rule (protocol point 6) is what made the resume cheap; it stays.

**I-1 · This session: the shell tool refuses a single command over 300 s.**
`npm test` takes ~4.5 min here, so two calls were rejected outright before the
run was moved to a background process with a log and polled. **Cure applied:**
long suites run as `(npm test > log 2>&1; echo EXIT=$? >> log) &` then poll —
which also gives the real exit status, keeping the "never report a pass you did
not see" rule intact.

**W-1 · Three long silences (23:22→01:12, 03:03→09:36, 12:41→22:28).**
These are owner/oversight gaps, not lane stalls: each one ends with a steering
comment, and the lane's last action before each was a pushed checkpoint plus a
status comment. Recorded for completeness; **no cure proposed** — a lane cannot
invent steering, and protocol already forbids idling on a blocked item.

## The costly discovery of this pass (not a stop, but the biggest time sink)

The 2026-11-01 audit measured **Cloudflare Pages staging**, which has not been
deployed since 2026-10-25 (`ui.js?v=20261025b` read live today, while `main`
carries `20261029a` and the lane `20261103c`). Two of the four recorded defects
are already cured in code that never reached that surface, and one is not. Every
hour spent reproducing "off-grid renders the bill model" was spent on a stale
artifact. **Cure applied:** deployment drift is now a first-class ledger entry
(G1) with a `cf-pages-deploy` dispatch as its closing act, and the finding is
recorded on #330/#145. **Proposal:** a staging-staleness check attached to
`cf-pages-deploy.yml` (compare the live asset stamp against `main`'s), so a
five-day drift can never again present itself as a product defect.

## What this audit does not claim

- No count of session deaths beyond the one that left a committed checkpoint —
  a stop that leaves no record cannot be counted from GitHub, and inventing a
  count would be worse than leaving it out.
- Time-lost figures are elapsed windows between recorded events, not measured
  work interruption.

## Added during the burndown (living document)

**G-2 · The byte gate is regression-blocking, and a deliberate localization
slice always trips it (2026-11-03).** `#337` added nine dictionary keys and an
error line; the gate reported `home_document 18.5 → 18.9 KB` and
`js_to_first_result 197.1 → 197.8 KB`, both far under the plan's limits but over
the _baseline_. The gate is right: it asks "is this the smallest version that
keeps the proven behavior". The cure is the repo's own mechanism — a `baseline`
row in `docs/plan/LEDGER.jsonl` carrying the measured values, `was`/`delta` and
the reason — never a limit change. Cost: one CI round trip per PR (×2 today,
#337 and #321). **Note for the next lane:** when two i18n slices land in
sequence, the second must re-measure on top of the first, so land them in order
and merge main into the second before measuring.

**F-2 · The asset stamp must move on EVERY edit to a stamped file, and the check
can only pass after the stamp commit exists (2026-11-03).** A comment-only trim
in `ui.js` after stamp commit `12ea5e242` left the stamp at `20261103c`; the
token check failed the `test` job in 21 s with the exact reason and cue. The
same check reports "no commit in history ever introduced ?v=…" when run before
the stamp commit is created, which reads like a content error and is not one.
**Cure applied:** bump the stamp in the same commit as any asset edit, and run
`bump-asset-tokens --check` _after_ committing, never before. Two CI round trips
cost today (~25 min including queue).

**G-3 · The byte gate tripped again on the first P1.4 cut (2026-11-04).**
`js_to_first_result` read 204,845 against the unchanged 204,800 limit - 45
bytes over - because the new module shipped its explanation whole. Cured the
repo's way: the module prose was trimmed once (behavior unchanged, tests
still pin it) and a `baseline` row recorded the measured 204,608 with
`was`/`delta` and the reason. One build-and-measure round trip, no CI round
trip, no limit touched. This is G-2 recurring exactly as recorded; the lane
habit that works is measure locally with `deploy:check` + the byte gate
before the first push of any slice that adds shipped bytes.

**T-1 · A tracker tick claimed a record that did not exist (2026-11-04).**
The P1.6 box was ticked with "ledger row carried by #341" while #341 was
carrying only the P1.1 and P1.2 rows. Caught in the same session by reading
the ledger line back, and corrected on #145 to "ledger row still open"; the
missing `P1.6` row is now an explicit EVIDENCE ONLY entry. **Cure:** a tick's
parenthetical names an artifact that exists at the moment of writing, or it
names the gap. Read the artifact back before posting the tick.

**X-1 · GitHub Actions stopped starting runners mid-session (2026-11-04).**
Every job in #342's Tests run failed in about two seconds with zero executed
steps, and the check-run annotation gave the reason: "The job was not started
because your account is locked due to a billing issue." main's own Tests and
CodeQL runs at `7b3c108b` were cancelled at the same moment, and re-running
either (attempt 2) failed identically. This is an account-level lock the lane
cannot clear and must not route around: base policy requires green checks, so
two otherwise-ready PRs (#342, #343) stop at the gate. **Cure:** none available
in-lane; recorded as an owner-reserved blocker on #330, with local gate
evidence attached to the blocked heads so the work can be verified immediately
when runners return. The lane habit that made this cheap: every slice had its
full local gate run before the push, so the block cost time, not evidence.

**D-1 · Two "silent no-result" runs were a driver error, not a product defect (2026-11-04).**
The prior pass clicked Run twice on the off-grid staging page, saw `#tierResults`
at 0 rows, and recorded that the surface reached no result cards with no visible
reason. Re-driving the same surface at the same stamp (`20261103u`) showed why.
`#tierResults` is the matrix tab's table and stays empty for a successful off-grid
run; the result paints into `#resultsRegion`, and the first run of a site pulls
~2 MB of hourly weather before simulating — the status line names that stage and
the button spins while it happens. One read after the weather stage returned the
full off-grid result, the off-grid money-bar sentence and a `display: none` cut
row. **Cure:** drive the container the page actually paints (`#resultsRegion`),
wait for the status to leave the weather stage, and read a 0-row matrix as "tab
not open", not "no result". No code change: nothing was wrong with the surface.

**R-1 · A runner restart and a restored share payload broke two surface drives (2026-11-04).**
The Cloud runner restarted mid-session while the callout drive was running; the
worktree, the local server and the 4/4 pinning test survived, so the first cost
was one re-orientation turn, not lost work. The second cost was staler: after a
reload the page restored the previous share hash (hardware label solar, but the
payload was 7.78 kW plus a 40 kWh battery at 40.58 kWh/day), so a solar-only
drive rendered the battery zero-swap callout; setting the hidden hardware select
without a change event was overridden by the same restore; a hand-built share
hash with uc=offgrid was ignored (the page stayed grid-tied at 41.1 kWh). The
three callouts that were captured came from visible controls: the default run,
the noSwapToggle run, and the off-grid 120 kWh run. **Cure:** clear the share
hash before a drive, change visible controls in dependency order, wait for the
status to leave the fetch stage, and treat any restored payload as stale until
the result heading changes.

**R-2 · A share link's hardware choice was silently discarded by the run boundary (2026-11-04).**
The solar-only drive looked like stale state for a turn: the hash applied `hw=solar`
and `window.lastInputs.hardwareConfig` read `solar`, yet the run sized a 20 kWh
battery and rendered the battery sentence. The cause was product code, not the
drive: `runSizing()` derived `hardwareConfig` from the use case and overwrote the
visitor's value, and bill-cut's legacy pair is `both`. A second turn went to the
boot-only share restore: `restoreFromShare()` runs at load, so a hash change on the
same document is ignored — a full reload with a query is required. **Cure:** the
new `hardwareForRun()` honors solar/both on unlocked cases and keeps locked pairs
(ToU/off-grid/backup); the pinning test covers the lock table. For drives, always
load the hash with a full navigation, then read `lastInputs` before trusting a
result. Cost: two diagnostic turns; the first receipt (solar-only) and the
standard-sizing receipt came only after the fix.

**R-3 · The last two C4 keys are a cycle-band branch, and the surface drive needed a correctly shaped fixture (2026-11-04).**
The two remaining callouts are not reachable by "trying more loads": both sit behind
an AGM cycle band. The oversize estimate is only cheaper on paper while the bank's
annual equivalent cycles stay under 25 x (1 + replacements); Phoenix cycles its
bank at ~620-700/yr, so the estimate can never favour oversizing there, which is
why the earlier 20/60/120/200 kWh/day drives all landed on natural zero-swap or
standard-sizing-cheapest. Reading the emission sites first, then constructing the
state, found both: off-grid AGM at 10 kWh/day (no-figures flip) and 15 kWh/day
(beyond-search) in a pinned synthetic year, and real one-year NASA series at
Bergen/Anchorage (8-10 kWh/day) and London/Seattle (25-30 kWh/day). The page's
five-year fixture now renders the beyond-search sentence through the ordinary
surface at 8-10 kWh/day (see C4). Three drive defects cost turns and are worth
recording. A share hash does not auto-run: restore sets `shareLoaded` and waits for
the Run button, so a drive that only waits reads as a stalled weather stage. A
hash-only change stays same-document and re-runs the previous cached
configuration; use a query for a full load. And the first IndexedDB seed carried
`{ghi,tAmb,meta}` with no `meta.latitude/longitude`, so the run's print sheet threw
`Cannot read properties of undefined (reading 'toFixed')` at `ui.js:8224`; with
the cache's real shape (Float32Array pairs plus meta carrying latitude, longitude
and the 2021-2025 window) the same drive completes, the status reads "5 ans de
donnees horaires (2021-2025)", and the print sheet fills (3,629 chars at 8 kWh/day)
— a harness-shape defect, not a product defect. **Cure:** seed typed arrays plus
full meta, navigate with a query, press Dimensionner, and allow minutes for the
five-year search; the share states are recorded in the C4 row.

**R-4 · An off-grid share link sized the previous slider load (2026-11-04, fixed).**
Opening an off-grid `#s=` link wrote `dailyKwhInput` but never
`offgridKwhSlider`; `readInputs()` reads the slider first for off-grid, so the
link silently sized whatever load the slider already held. The drive showed it
plainly: shares naming 4, 8 and 10 kWh/day all produced the identical 41 kW /
138 kWh, 432 h/yr system because the slider held 20. `restoreFromShare` now
writes the slider when the shared value fits its range and clears it when it
does not, so the numeric input wins instead of a stale thumb;
`tests/playtest-guards.test.mjs` pins the slider write and the clear.
**Cure:** every control `readInputs()` prefers over the numeric input must be
restored by the share path.
