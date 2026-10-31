# Planning Tracker — Single Source of Truth

**Rule: one canonical plan, one current execution tracker.**

The master plan (`docs/plan/MASTER_PLAN.md`) is the single immutable plan.
This tracker is the mutable view of canonical work in flight. Other planning
documents do not supersede the master plan; archive obsolete drafts and link
active execution work here.

## In flight

| Item                                  | Status                  | Owner | Notes                                                                                                          |
| ------------------------------------- | ----------------------- | ----- | -------------------------------------------------------------------------------------------------------------- |
| P9.5 blog audit                       | No proving PR           | lane  | PR #212 covers a DIY battery cost correction; the audit and its ledger proof remain open                       |
| P9.6 Search Console and Web Analytics | No proving PR           | lane  | Configure both live services and record monthly reach in the ledger                                            |
| P9.7 content quality gate             | PR #232 open            | lane  | Owner authorized the bootstrap exemption; record it as A-006 and rebuild the amendment hash chain before merge |
| P10 program exit gate                 | No proving PR           | lane  | Prove P10.1–P10.4 and cite evidence in the ledger; P10.4 requires owner signoff                                |
| P11 continuous work                   | Ongoing; no proving PRs | lane  | Track i18n waves, weekly freshness and Jev reviews, and monthly reach/CWV rows per §8                          |
| Currency corrections (XCD/XCG/ZWG)    | PR #235 open            | lane  | Corrections have not landed                                                                                    |
| UX P0.4 regression tests              | PR #215 open            | lane  | Merge before the dependent Dutch locale work                                                                   |
| Dutch (nl) locale                     | PR #230 open            | lane  | Follows #215; add `nl` to the fuel-unit test locale list                                                       |
| Salderen blog post (nl)               | PR #231 open            | lane  | Follows #230                                                                                                   |
| P0.4 first-paint measurement          | PR #192 open; CI absent | lane  | Issue #208 tracks the missing CI trigger; enable checks before judging the change                              |
| P0.4 Blacksmith pilot                 | PR #206 open            | lane  | Individual triage required                                                                                     |
| Use-case engine and provenance        | PR #203 open            | lane  | Individual triage required                                                                                     |
| Canonical slider workflow             | PR #171 open            | lane  | Individual triage required                                                                                     |

## Recently landed

| Item                                | PR   | Landed     |
| ----------------------------------- | ---- | ---------- |
| Jev scope infrastructure            | #236 | 2026-10-19 |
| Heatmap pre-rendered PNG            | #219 | 2026-10-17 |
| Jev evidence refresh                | #247 | 2026-10-21 |
| Canonical staging/production naming | #252 | 2026-10-21 |

## Lessons → EXPERIENCE.md

When something fails or surprises, add it to `docs/EXPERIENCE.md` with:

- What happened (facts)
- What we learned (lesson)
- What changed (action)

The tracker stays lean; the lessons accumulate.
