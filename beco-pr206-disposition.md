## Disposition — pilot declined after current-main audit (2026-10-22)

This PR will not be merged.

- Its unique workflow change moves the test job to the external Blacksmith label. The PR itself states the required org-side app installation/access cannot be verified from the available repository session. Current main runs all required checks on GitHub-hosted runners; switching an owner-installed runner without confirming access can leave the required test gate queued. This is an organization-level execution and credential boundary, so it needs an owner-approved runner decision.
- The one CSS change sets mobile navigation links to 44px minimum height, below MASTER_PLAN Q-07's 48×48 CSS-pixel touch-target requirement; it is not imported.
- The two-runner runbook paragraph describes a Blacksmith configuration that is not present on current main, so it would be inaccurate if landed alone.
- The inherited use-case, locale, privacy, and staging-script changes were swept: the use-case/privacy work is superseded by the stronger current-main implementation and #203 disposition; the staging-script edits are not required by a remaining plan item and current-main CI/preflight pass without them. The large index trim also has no canonical requirement and is not imported.

The exact PR head's CI is red (test, web-smoke, coverage, Lighthouse, and Jev). Closing this records a declined optional pilot; it does not claim a canonical plan item complete.
