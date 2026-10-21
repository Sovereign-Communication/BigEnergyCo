# BigEnergyCo — Lane (paste-ready mission prompt)

**Repo:** Sovereign-Communication/bigenergyco. **Scope: BigEnergyCo ONLY.** Cross-repo matters go to main chat, never this lane.

## Role

Single lane: work the merge queue, then fix-forwards, then the Netherlands chain. Green-means-merge per repo policy (green PRs merge without waiting unless destructive/unsafe).

## Current state (verified 2026-10-21 ~12:00 HST)

- 18 open PRs. 4 merged in the last 24h — the queue is moving.
- **#248** (head 3298b017, clean, 9/9 green) and **#239** (head 44a9314e, clean, 9/9 green): BOTH merge-ready. Merge these first.
- **#244** (head 621b33a6 — new push, branch `fix/offgrid-mode-chrome`): still red, 7/9 — `jev-complete` and `web-smoke` failing. Keep iterating.
- **#232** (head dda865d1, dirty/conflicts): BLOCKED — `jev-complete` failing (8/9) plus the P9.7 SCOPE_FACETS bug (issue #249, your fix). Translation facet at 35 ("at risk"). Do not merge until fully green.

## Work order

1. Merge #248, then #239 (both verified green on exact heads).
2. Fix-forward #244 to green.
3. Fix #249 (P9.7 missing from SCOPE_FACETS in `jev-complete.mjs`), then re-run #232's gate.
4. Netherlands chain after #232 merges: retitle #231 with (P9.7) → #215 (add Problem/End-state to body) → #230 (add "nl" at tests/fuel-units.test.mjs:416) → #231 → MANUAL production deploy ("Deploy to Cloudflare Pages", workflow_dispatch, target=production) → run `~/workspace/bigenergyco-blog/jev-readiness-audit.py`.
5. Stale pile: #171/#203 rebase-or-close; #206 likely obsolete (Blacksmith pilot cancelled) — recommend close with evidence.

## Repo gates (binding)

- BigEnergyCo CI bar: combined ≥95, every facet ordinal at 100, every facet Jev confidence ≥0.95 (PR #237, amendment A-004). Note ordinals are 0/35/60/85/100 — "95" as an ordinal is unreachable; the bar is really 95/100/0.95.
- Blog post anatomy: shared inline `<style>` block (~7KB, byte-identical) + JSON-LD BlogPosting entry + visible `<article class="article-card">` in blog/index.html. PROSE_CEILING: raise only with a measured reason in the commit message.
- Prod deploys are MANUAL — after any blog/content PR merges, dispatch the deploy workflow or the post 404s.

## Standing rules

Jev gate policy v1 (`~/workspace/jev-gate-policy-v1.md`): below-bar → auto-investigate, escalate only on actual risk. Assess content BLIND to CI (mentioning gate state depresses scores 30–55 pts); report the gate verdict separately. Never ask Lucas technical questions — ramifications and end-state only.
