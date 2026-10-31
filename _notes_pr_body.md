## Summary

Imports the session handoff notes from the working lanes into `docs/notes/`,
per the burndown sweep item "7 notes -> docs PR (confirm set first)".

**Set confirmation (done before import):** a case-insensitive scan of the lane
scratch directory found **exactly seven note-named files**, and a grep of
`origin/main -- docs/` confirmed none of them were already in the repo. That
exact-7 match is the confirmation basis; if the intended set differs, this PR
is the place to say so and the missing file can be added.

| File | Records |
| --- | --- |
| `beco-pr192-v1-note.md` | PR #192 verification note (force-with-lease merge mechanics) |
| `issue-208-trigger-note.md` | Issue #208 trigger-retest handoff note |
| `pr233-jev-note.md` | PR #233 Jev Gate v1 investigation before merge |
| `pr260-main-audit-note.md` | PR #260 post-merge main audit note |
| `pr292-note.md` / `pr292-note2.md` | PR #292 handoff note (two parts) |
| `v0.5.0-release-notes.md` | Release-notes draft; **no v0.5.0 release exists** — imported as the recorded import decision for that sweep item, not a shipped artifact |

Notes are verbatim; the only edits are stripping a UTF-8 BOM from the pr233
note and renaming it `.txt` -> `.md`. A README index states the
point-in-time rule (plan/`main` wins on disagreement), and `docs/INDEX.md`
gets a pointer alongside the archive section.

This PR deletes nothing — the scratch files stay where they are; this lane
never deletes.

## Gates (local, on this head `771b8777`)

| Gate | Result |
| --- | --- |
| `npm test` | PASS — 1986/1986 |
| `node scripts/check-chars.mjs` | PASS |
| `npm run seo` | PASS |
| `npm run format:check` | PASS |
| `npm run deploy:check` | PASS |
| `npm run plan:check` | PASS |

Plan items: sweep item "7 notes -> docs PR" and the "v0.5.0 notes (no release
exists)" import-or-discard record (decision: import as history).
