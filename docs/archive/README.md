# Archive — superseded plans and audits

Twelve legacy plan and audit documents, moved here by master plan item **P0.2**
(closing finding `F-40`: _"Twelve legacy plan and audit documents at the repo root
give conflicting guidance to contributors and agents"_).

**Nothing in this directory is current guidance.** The governing document is
[`../plan/MASTER_PLAN.md`](../plan/MASTER_PLAN.md), hash-pinned by
`../plan/PLAN.lock.json` and changeable only through a recorded amendment
(master plan §16). Where any file here disagrees with it, **the master plan wins**.

Each file carries a banner at the top naming the specific reason it was archived
and where its content went. Those reasons differ, and the difference matters: some
of these documents were _executed_, some are _obsolete_, and one is a _data
provenance record that was never a plan at all_.

## What is here, and why each one moved

| Document                                                               | Why it was archived                                                                                                                                   |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`GOOGLE_QUALITY_PLAN.md`](GOOGLE_QUALITY_PLAN.md)                     | Executed in full — all six phases shipped. A completed work order, not a forward plan.                                                                |
| [`PLAN.md`](PLAN.md)                                                   | Pre-launch roadmap whose critical blocker (quick-tunnel URL rotation) no longer exists and whose security item is already done.                       |
| [`PHASE2_PLAN.md`](PHASE2_PLAN.md)                                     | Sizing-core build ledger; shipped. Its §5.1 spreadsheet gate is still registered and still blocked on an owner export.                                |
| [`PHASE3_PLAN.md`](PHASE3_PLAN.md)                                     | Plausibility-frontier build ledger; shipped. Useful for what it deliberately left out.                                                                |
| [`ROADMAP_10_PHASES.md`](ROADMAP_10_PHASES.md)                         | Ten-phase vision superseded by a twelve-phase program with owners and measured exit criteria.                                                         |
| [`SEO_MASTER_PLAN.md`](SEO_MASTER_PLAN.md)                             | SEO strategy written before the data registry existed; its best idea is now a first-class requirement.                                                |
| [`LAUNCH_AUDIT.md`](LAUNCH_AUDIT.md)                                   | Point-in-time checklist from 2026-08-03. Most items shipped; it documents a launch model that no longer exists.                                       |
| [`IMPLEMENTATION_COMPLETE.md`](IMPLEMENTATION_COMPLETE.md)             | Shipped-status snapshot referencing files since deleted. Goes stale silently.                                                                         |
| [`GROQ_AUDIT_AND_OPTIMIZATION.md`](GROQ_AUDIT_AND_OPTIMIZATION.md)     | Advisor context contract and three-layer Jev audit. The most valuable archived document; carries one requirement the master plan does not yet absorb. |
| [`GROQ_IMPLEMENTATION_GUIDE.md`](GROQ_IMPLEMENTATION_GUIDE.md)         | Written against `proxy_server.py`, a deleted file. Following it would reintroduce deleted code.                                                       |
| [`GROQ_ROADMAP_VISUAL.md`](GROQ_ROADMAP_VISUAL.md)                     | Visual companion to the above; same deleted-file basis.                                                                                               |
| [`CYCLE_LIFE_CORRECTION_SUMMARY.md`](CYCLE_LIFE_CORRECTION_SUMMARY.md) | Cycle-life correction record — the provenance of `BATTERY_CYCLE_LIFE_REFERENCE_2026.md`, which stays live at the repo root.                           |

## Deliberately **not** archived

These stay at the repo root because they are reference data or live legal
posture, not plans. Archiving them would lose information the site depends on.

- `BATTERY_CYCLE_LIFE_REFERENCE_2026.md` — the current cycle-life data reference.
- `LIABILITY.md` — legal, tax and privacy posture; required by the deploy
  runbook before any promote (master plan R-CONT-04).

## The carry-forward review

P0.2 also requires reading every archived document — **including
`GOOGLE_QUALITY_PLAN.md` and `docs/INDEX.md`, which the planning session was
denied read access to** (finding `F-41`) — and mapping every requirement that the
master plan does not already cover to an existing requirement ID, or proposing an
amendment.

That table is in the body of the P0.2 pull request. Four items are **not**
covered and are proposed as amendments; they are listed there with the exact
change and the tradeoff, because an amendment requires owner approval
(master plan §16, O-07) and changes the hash-pinned plan.
