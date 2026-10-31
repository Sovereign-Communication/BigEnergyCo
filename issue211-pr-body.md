Fixes #211.

## Root cause

The Linux `npm test` run on #192 SHA `e196dc14` failed 5 promotion tests with the same mismatch: `robots.txt` in the checkout hashed to `0e775510`, while the just-built staging fixture served `bc786939`. `buildStage()` copied the fixture at module load without taking the cross-process mutation lock. At the same time, another test can temporarily modify the root `robots.txt` under that lock. The verifier then compares the restored checkout file with a fixture captured during the mutation.

## Change

Build the promotion fixture under the same mutation lock used by its verifier and by the tests that mutate tracked files. This serializes fixture creation with those mutations.

## Validation

Local `npm test`: 1,724/1,724 passed. The six required local checks all passed: character scan, SEO, format, deploy, and plan checks in addition to the test suite. The Linux CI run on this PR will verify the race fix on the failing platform.