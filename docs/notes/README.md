# Session handoff notes

Point-in-time records carried over from working lanes so the context they
capture is not lost with a scratch directory. Like `docs/archive/`, these are
**history, not current guidance**: where a note disagrees with `main` or
`docs/plan/MASTER_PLAN.md`, the plan and `main` win.

Set (7 files, confirmed 2026-10-28 as the full note-typed set from the lanes):

| File                        | What it records                                                           |
| --------------------------- | ------------------------------------------------------------------------- |
| `beco-pr192-v1-note.md`     | PR #192 verification note (force-with-lease merge mechanics)              |
| `issue-208-trigger-note.md` | Issue #208 trigger-retest handoff note                                    |
| `pr233-jev-note.md`         | PR #233 Jev Gate v1 investigation before merge (exact-head scoped report) |
| `pr260-main-audit-note.md`  | PR #260 post-merge main audit note                                        |
| `pr292-note.md`             | PR #292 handoff note (first part)                                         |
| `pr292-note2.md`            | PR #292 handoff note (continuation)                                       |
| `v0.5.0-release-notes.md`   | Release-notes draft for v0.5.0 — **no such release exists**; imported as  |
|                             | the recorded import decision for this sweep item, not a shipped artifact  |

Notes are preserved verbatim from their source files (the only edit is a
removed UTF-8 BOM on `pr233-jev-note.md`, renamed from `.txt` to `.md`).
