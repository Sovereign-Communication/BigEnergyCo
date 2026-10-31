## Historical testplan retrieval — not recovered (2026-10-24)

Applied Jev Gate Policy v1: the missing source is an evidence gap; it does not establish that the remaining functions are covered or uncovered.

Sources checked:

- **Issue #201:** its body and comments identify the source as `audit.db` table `battery_testplan`; the remaining ~196 candidates are not enumerated there.
- **PR #193:** checked its body, complete 13-file changed list, and all eight commits (`ac6b8b89` through `522ae2d2`). The published per-function data is `prescriptions.csv` and `context-needs.csv`, with `PRESCRIPTIONS.md` and `VERDICTS.md`; there is no `audit.db`, `battery_testplan` export, or candidate-list file. The PR's `prescriptions.csv` has zero `testplan` matches.
- **Commit history:** the full, non-shallow checkout at `eabb378c` matches `origin/main`. Its reachable history/object names contain no `audit.db`, `battery_testplan` data file, or candidate export.
- **Workflow artifacts:** downloaded the `jev-complete-report` artifact from all eight `Tests` runs for PR #193's commits (runs `37452263795`, `37453412361`, `37453720281`, `37457208308`, `37459659905`, `37695991432`, `37702410921`, `37708970474`) and from current-main run `40106777172`. The PR artifacts contain only `jev-evidence.json` and, in later runs, `jev-report.json`; none contains the database/table rows, an exported testplan, or the ~196 identities. The current-main report artifact also contains no candidate export.

**Finding:** the remaining ~196 identities cannot be recovered from the issue, PR, reachable commit history, or workflow artifacts checked. I did not reconstruct a candidate list or mark candidates covered. Keep #201 open pending the owner's choice already framed there: publish the original testplan, authorize a rerun, or select a replacement queue. No gate thresholds changed.