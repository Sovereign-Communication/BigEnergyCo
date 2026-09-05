# Docs index — what to read, and what is history

## Start here (current)

| Doc                      | Status                                                               |
| ------------------------ | -------------------------------------------------------------------- |
| `README.md`              | Project status, deploy runbook summary, ground rules                 |
| `docs/DEPLOY_RUNBOOK.md` | **Canonical** release path (only supported way to ship)              |
| `LIABILITY.md`           | Liability/tax/privacy posture — read before promoting the site       |
| `SEO_MASTER_PLAN.md`     | Content/SEO strategy                                                 |
| `PLAN.md`                | Roadmap ledger (includes open security tasks, e.g. API-key handling) |

## Point-in-time (history — do not act on without verifying against `main`)

| Doc                                                                         | Captures                                                                        |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `LAUNCH_AUDIT.md`                                                           | Pre-launch checklist, 2026-08-03                                                |
| `IMPLEMENTATION_COMPLETE.md`                                                | Shipped-status snapshot                                                         |
| `PHASE2_PLAN.md` / `PHASE3_PLAN.md`                                         | Sizing-engine / frontier build ledgers                                          |
| `ROADMAP_10_PHASES.md`                                                      | 10-phase vision                                                                 |
| `GROQ_IMPLEMENTATION_GUIDE.md` / `GROQ_ROADMAP_VISUAL.md`                   | Groq integration notes                                                          |
| `GROQ_AUDIT_AND_OPTIMIZATION.md`                                            | **Superseded** — references deleted files (`proxy_server.py`, old token scheme) |
| `BATTERY_CYCLE_LIFE_REFERENCE_2026.md` / `CYCLE_LIFE_CORRECTION_SUMMARY.md` | Battery cycle-life reference + correction record                                |

Rule: if a doc disagrees with `main`, `main` wins. Promote corrections into
`README.md` / `docs/DEPLOY_RUNBOOK.md` rather than editing history files.
