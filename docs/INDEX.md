# Docs index — what to read, and what is history

## Start here (current)

| Doc                                    | Status                                                                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`docs/plan/MASTER_PLAN.md`**         | **The governing plan.** Hash-pinned by `docs/plan/PLAN.lock.json`; changeable only through a recorded amendment (§16). It supersedes every other plan in the repo. |
| `docs/plan/LEDGER.jsonl`               | Append-only evidence: what shipped, with its proving PR, SHA, gate outcomes and Jev score                                                                          |
| `README.md`                            | Project status, deploy runbook summary, ground rules                                                                                                               |
| `docs/DEPLOY_RUNBOOK.md`               | **Canonical** release path (only supported way to ship)                                                                                                            |
| `docs/ARCHITECTURE.md`                 | Module map and the i18n boundary                                                                                                                                   |
| `docs/DOMAIN_MIGRATION_PLAN.md`        | Domain cutover mechanics; still active and consistent with D-19                                                                                                    |
| `LIABILITY.md`                         | Liability/tax/privacy posture — read before promoting the site                                                                                                     |
| `BATTERY_CYCLE_LIFE_REFERENCE_2026.md` | Battery cycle-life reference data                                                                                                                                  |

## Point-in-time (history — do not act on)

All twelve legacy plan and audit documents were moved to
[`docs/archive/`](archive/) by master plan item **P0.2**, each with a banner
naming the specific reason it was archived and where its content went. That
directory's [README](archive/README.md) lists them.

Nothing in `docs/archive/` is current guidance. Where an archived document
disagrees with the master plan, **the master plan wins**.

Rule: if a doc disagrees with `main`, `main` wins. Promote corrections into
`README.md` / `docs/DEPLOY_RUNBOOK.md` / `docs/plan/LEDGER.jsonl` rather than
editing history files.
