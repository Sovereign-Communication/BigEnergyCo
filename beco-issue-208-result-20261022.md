### Result — verified 2026-10-22

- The current `pull_request` trigger works. A regular Git push of PR #192's rebased head `5b229a97acd7ba978054b6b73da21336775aae0c` created Tests run `39789793345` and CodeQL run `39789793344`.
- On that exact Tests run, test, web-smoke, Lighthouse, quality-lab, quality-evidence, and coverage completed successfully. The `jev-complete` job is still queued; that execution remains tracked on #192.
- `.github/workflows/test.yml` has an unfiltered `pull_request` trigger. GitHub has no retained delivery record for the original `036c9626` event, so the historical reason it produced zero runs cannot be established from available evidence.

Disposition: current CI trigger behavior is verified; close this trigger-investigation issue with the historical cause recorded as unknown. The queued Jev job is separate from trigger delivery.