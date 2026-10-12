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
    "blocked on the owner's spreadsheet export (docs/archive/PHASE2_PLAN.md tracks it)",
  ],
  [
    "scripts/validate-jev-complete.mjs",
    "the Jev complete gate: needs the direct provider key + network for live " +
      "judgment. It also runs in CI (P0.3(e), the `jev-complete` job, live only " +
      "once O-01 adds the repository secret); listed here because the LOCAL run " +
      "is by hand, before a promote, where it falls back to a deterministic " +
      "heuristic with no judgment",
  ],
  [
    "scripts/check-cross-browser.mjs",
    "Q-08, and MANUAL BY DECISION, not by omission. It drives Firefox and WebKit, " +
      "which exist only as Playwright downloads, so the mission decision of " +
      "2026-09-27 moved the browser gates OFF GitHub CI and onto the agent " +
      "machine: no browsers in CI, no CI wall-clock bloat. It runs locally " +
      "against a staged build and its report is committed to .quality-evidence/, " +
      "where scripts/validate-quality-evidence.mjs — which IS wired into CI as " +
      "the `quality-evidence` job — asserts the report is present, in schema and " +
      "in its bar. So the gate is not orphaned by leaving CI; its evidence is " +
      "enforced on every PR by the half that needs no browser",
  ],
  [
    "scripts/check-visual.mjs",
    "Q-09, and MANUAL for the same reason as check-cross-browser.mjs: the capture " +
      "needs a browser. Its baseline PNGs are a local artifact and its report is " +
      "committed, so the no-browser CI validator asserts the report's schema and " +
      "its unapproved-diffs count",
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
