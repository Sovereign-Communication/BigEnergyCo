# Planning Tracker — Single Source of Truth

**Rule: ONE planning document. No parallel plans.**

The master plan (`docs/plan/MASTER_PLAN.md`) is the single immutable plan.
This tracker is the single mutable view of what's in flight. If a plan
exists anywhere else, it is stale — delete it or merge it here.

## In flight

| Item | Status | Owner | Notes |
|------|--------|-------|-------|
| P9.7 content quality gate | PR #232 open | lane | Jev audit passed (spec 96%, docs 91%) |
| Dutch (nl) locale | PR #230 open | lane | Blocked on #215; test fix needed |
| Salderen blog post (nl) | PR #231 open | lane | Blocked on #230 |
| UX P0.4 remediation | PR #215 open | lane | WIP lane; merge at discretion |

## Recently landed

| Item | PR | Landed |
|------|----|--------|
| Jev scope infrastructure | #236 | 2026-10-19 |
| Currency corrections (XCD/XCG/ZWG) | #235 | open |
| Heatmap pre-rendered PNG | #219 | 2026-10-17 |

## Lessons → EXPERIENCE.md

When something fails or surprises, add it to `docs/EXPERIENCE.md` with:
- What happened (facts)
- What we learned (lesson)
- What changed (action)

The tracker stays lean; the lessons accumulate.
