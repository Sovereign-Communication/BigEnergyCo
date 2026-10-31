## Exact-head CI diagnosis — 2026-10-22

The `test` job on `e196dc14` failed 5/1,727 tests. The logs show all five are cascades from `tests/promote-gates.test.mjs` serving a staging copy of `robots.txt` whose hash differs from the restored checkout file. The fixture was built at module load without the mutation lock. I isolated that shared test-harness fix in #261; once its CI passes and it lands, I will rebase this candidate onto the new main and rerun the six required local checks.

The Jev job failed closed because the test job was red (`tests_green=false`), so that run produced no judgment to interpret under policy v1.