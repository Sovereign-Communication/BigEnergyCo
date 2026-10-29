## Trigger retest — 2026-10-22

I replaced the stale #192 head through a regular `git push --force-with-lease` after verifying the remote was still `036c9626`. The exact new head `e196dc14` immediately created two `pull_request` workflows: Tests run `39780840031` and CodeQL run `39780839967`. The current `.github/workflows/test.yml` has a `pull_request` trigger with no branch or path filters.

This proves the branch is not excluded by workflow filters and a normal Git push triggers checks. The old `036c9626` event produced no recorded run, so GitHub provides no delivery record from which to prove whether its update mechanism differed. I am not attributing that historical miss to an API push without evidence. The current trigger path is verified; the new Tests run is being diagnosed separately because its offline unit-test job failed.
