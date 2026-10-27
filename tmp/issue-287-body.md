# Unblock jev-complete: evidence stability + targeted improvements

## Problem

The `jev-complete` gate is red on main. 9/21 facets sit below proven/100 (8 at 85, translation at 60).

**Root causes identified:**
1. **Evidence wiped by merges** — commit `22da28a9` ("fix(evidence): derive live report facets") silently dropped the performance/translation evidence lines added by #257. The evidence file `evidence/advisor-and-release.json` is a static JSON that any merge can overwrite.
2. **Judge calibration** — the live TypeSafe judge gives 85 ("confident — solid with minor gaps") instead of 100 ("proven") for 9 facets, even with strengthened evidence lines.
3. **Translation semantic gap** — judge explicitly wants "back-reading translated strings for meaning (native judgement)." Only technical parity (0 raw keys) is currently verified.

## Goal

Get `jev-complete` green on main and **keep it green across merges** (not just green-once).

## Plan (outcome-driven, ~675 LoC total)

### Phase 1: Stabilize evidence (~105 LoC) — CRITICAL

**Outcome:** Evidence definitions can never be silently dropped by a merge again.

Move `FACET_EVIDENCE` from the JSON file to a frozen constant in `scripts/lib/jev-facet-evidence.mjs`. Update the evidence builder to import from the lib. Add a CI guard (`scripts/check-facet-evidence.mjs`) that fails fast if any of the 21 facets is missing — clear error message, not a silent judge downgrade.

**Why this matters:** Without this, any evidence improvements in later phases can be wiped by the next merge touching the file. This is the foundation everything else builds on.

### Phase 2: Targeted evidence improvements (~280 LoC)

**Outcome:** Move the highest-viability facets from 85 to 100.

Focus on the 3 facets where Jev assessment says evidence work will actually succeed:
- **Quality** (~100 LoC, viability 96/100): Finish the remaining inline style consolidations. When there are 0 exceptions, the evidence can claim it.
- **Performance** (~60 LoC, viability 85/100): The playtest numbers already exist. Add them as hard CI gates so the evidence cites enforced thresholds, not just measurements.
- **i18n** (~120 LoC, viability 68/100): Extend the runtime locale sweep with DOM snapshot comparison to prove rendering correctness, not just key presence.

Each as a separate PR so they land independently. **Go/No-Go:** After these land, run `jev-complete` on main. If we move from 12→15 proven, continue. If zero movement, skip to Phase 5.

### Phase 3: Judge prompt improvement (~80 LoC)

**Outcome:** The judge recognizes "proven" evidence when it sees it.

Add facet-specific "proven" criteria to the Jev assessment pack (what counts as proven for each facet type). This clarifies the bar — it does not lower it.

### Phase 4: Translation path (~180 LoC)

**Outcome:** Translation moves from 60, or we have a documented path forward.

Try in order:
1. **Terminology consistency** (~100 LoC): Build a per-locale glossary and verify key terms are translated consistently. Deterministic, catches real errors, no native speakers needed.
2. **Semantic spot-check** (~80 LoC): Sample keys per locale, back-translate via Jev, check similarity. Experimental but useful as a signal.
3. **Policy exception** (if 1-2 fail): Document the gap and request an exception for the main gate, with full verification deferred to P10.

### Phase 5: Policy safety net (~30 LoC markdown, owner approval required)

**Outcome:** If evidence alone can't unblock, we have a principled fallback.

Only if Phases 1-4 leave us stuck: propose amendment B1 — main (staging) gate requires combined ≥95, every facet ≥85, no facet below 60. P10 (program exit) keeps the full 95/95/95. The code comment at `jev-complete.mjs:1076` already frames the all-proven rule as "the program-exit rule."

**This requires owner approval.** Do not implement without it.

### Phase 6: Verify stability (0 LoC)

**Outcome:** Prove the fix holds, not just green-once.

Confirm `jev-complete` green on main (from check-runs API, not combined status). Then land 3 consecutive content merges and confirm still green after each. If it goes red, the Phase 1 CI guard should identify the cause immediately.

## Critical constraints

- **Non-destructive only.** All work is infrastructure, evidence, prompts, or docs. No production logic changes.
- **LoC estimates only.** This repo does not use time-based estimates.
- **All work via PR.** No direct pushes to main.
- **Do not implement Phase 5 without owner approval.** The policy change is a proposal until Lucas signs off.
- **Outcome-driven execution.** The phases describe desired outcomes, not exact implementation steps. Use your judgment on the details — if a different approach achieves the same outcome with fewer LoC or better robustness, do that instead.

## Verification

- [ ] Phase 1: CI guard fails when a facet is removed (test by temporarily deleting one)
- [ ] Phase 2: `jev-complete` shows movement on targeted facets
- [ ] Phase 4: Translation moves from 60, or documented exception path
- [ ] Phase 6: Green on main + green after 3 merges

## References

- Root-cause note: issue #249, comment 6354869731
- Prior proposal: `~/workspace/bigenergyco-jev-gate-proposal-2026-10-21.md` (Options A/B/C)
- Evidence wipe: commit `22da28a9` overwrote #257 (`e439b0a1`)
- Current main: check `git log --oneline -1`

