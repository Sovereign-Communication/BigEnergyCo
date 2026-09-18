// Single owner for validator disposition — where each gate lives and why.
// Both tests/gate-net.test.mjs and docs/DEPLOY_RUNBOOK.md point here; no
// other file should define a MANUAL or RETIRED list.
export const MANUAL_VALIDATORS = new Map([
  [
    "scripts/validate-live.mjs",
    "live sweep of the deployed API and NASA endpoints; needs the network",
  ],
  [
    "scripts/validate-against-sheet.mjs",
    "blocked on the owner's spreadsheet export (PHASE2_PLAN.md tracks it)",
  ],
]);

export const RETIRED = new Map([
  [
    "scripts/verify-polish.mjs",
    "crashed (its mirror list missed climate.js) with a stale contract pin; " +
      "covered by tests/run.test.mjs, tests/contract.test.mjs, tests/rescale.test.mjs, " +
      "tests/breakeven.test.mjs, tests/consistency.test.mjs and npm run verify:staging",
  ],
  [
    "scripts/verify-chart-contract.mjs",
    "replicated a worker payload the worker no longer builds, and its served-bytes " +
      "tail could not fail; the chart-gate invariant lives in tests/run.test.mjs",
  ],
]);
