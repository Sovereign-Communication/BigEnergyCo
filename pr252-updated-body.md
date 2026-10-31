## Scope

P0.3(e): keep the post-merge staging and production promotion targets explicit alongside the Jev release gate. The owner’s canonical model is bigenergyco.pages.dev for staging and freeoffgridcalculator.com for production.

Links: [Master plan](https://github.com/Sovereign-Communication/BigEnergyCo/blob/main/docs/plan/MASTER_PLAN.md) · [Pinned tracker #145](https://github.com/Sovereign-Communication/BigEnergyCo/issues/145).

## Changes

- Correct the deploy workflow comments to match the owner-approved environment mapping.
- The target choice and branch mapping are unchanged; this is comment-only.
- No staging or production deployment was made.

## Local validation

npm test, check-chars, seo, format:check, deploy:check, plan:check, and Prettier 3.9.6 all pass on the rebased tree. Fresh scoped Jev and required CI will run on this head.