# PR #203 canonical use-case repair — local WIP

## Current handoff — final verification (2026-10-09)

**Repair patch and preservation checks completed. Release is NOT ready:** the single preserved full-suite run exited 1 with 82 failure records; root causes are not established by this run. No full-suite rerun or per-failure retries were made.

### Repair scope recorded by patch

Patch base is `07f51ea4712acbd5d8688470be5b9889001e4b59`. Ten intended paths are present in [repair.patch](repair.patch): four production modules, smoke runtime, four use-case test files, and shared fixture. It excludes the unrelated `robots.txt` edit. The currently settled UI FX/recovery changes are included.

The behavior changes represented in the patch:

- Routes reserve/TOU/backup/portable mode aliases through the existing canonical use-case registry and preserves explicit-case precedence and legacy behavior.
- Uses actual measured system configuration and lifecycle cost for TOU; annualizes weather-period totals to the existing 20-year horizon and accounts for off-peak charging/losses.
- Corrects reserve thresholds to percentage units; invalid or unknown battery cost cannot be counted as free and is rendered as unknown.
- Converts TOU rates at the browser/worker boundary and preserves USD meaning when FX is invalid, refreshed, or manually changed.
- Replaces formula-only tests with simulator/UI/worker-path checks. No plan, ledger, tokens, unrelated SEO/HTML-budget/staging gates, or real Git index were altered.

### Full suite: one preserved run; failures classified from emitted text only

Ran `npm test` exactly once on the current settled WIP. The preserved log is [repro-current-full-suite.log](repro-current-full-suite.log); [repro-current-full-suite.exit](repro-current-full-suite.exit) records exit code `1`. Node v24.18.0 recorded **1135 passed, 82 failed, 1217 total, 0 skipped**. Of the 82 failure records, **32 name an individual test and 50 are file-level runner records that do not emit an individual test name**. The [failure inventory](current-full-suite-failures.json) copies each reporter title/location and captured diagnostic, distinguishes these record types, and counts observed diagnostic classes.

The inventory reports **0 inferred root causes; all 82 root-cause assessments remain unresolved**. Its classes describe only literal diagnostics/assertion shapes in each failure block, not explanations for why they occurred. Counts: 18 `UNKNOWN` spawn diagnostics; 5 Windows-status/expected-status assertion mismatches; 6 `null`/expected-status mismatches; 5 explicit out-of-memory diagnostics; 2 `ENOMEM` spawn diagnostics; 2 shallow-history wordings; 1 `CSPRNG(nullptr, 0)` assertion; 1 CDP `Runtime.evaluate` timeout; 1 filesystem `scandir` `UNKNOWN`; 1 OS “cannot execute” message; 1 structured assertion diff; 1 regex assertion mismatch; 3 child-command failures without a narrower diagnostic; 1 other present-but-ambiguous diagnostic; and 34 generic file-level `test failed` markers. These mutually exclusive inventory classes sum to 82; they are observations, **not confirmed causes**. In particular, this single run does not establish resource exhaustion, parallel load, checkout history, or a product defect as a root cause. No reruns were made, per instruction.

No failure was hidden by filtering: the npm command's exit code was preserved as `1`. The recorded summary is also in `jev-artifacts/test-measurement.json`.

### Patch validation

A disposable detached worktree at the baseline was created. `git apply --check` and apply succeeded; all ten paths matched the WIP byte-for-byte after CRLF/LF normalization; reverse-check and reverse-apply succeeded; the temporary tree returned to clean baseline and was removed. Patch apply emitted two existing whitespace warnings from blank lines in changed hunks; apply/reverse validation still succeeded. Patch is not staged.

### Checkout preservation and limits

The original checkout is recorded at branch `docs/ledger-p1-3`, HEAD `0546265d2345a8bb17cb7918e11f24747195e165`. The prior preservation record [checkout-preservation.json](checkout-preservation.json) reports 150 hashes checked, no original modified-file hash drift, no removed original status entries, and only the WIP directory as an added original-checkout status entry. The current original checkout status was not edited. Existing unrelated dirt remains, including `robots.txt`; it is not in the repair patch. Both real indexes remain unstaged.

No commit, PR, push, merge, deploy, or publication was made. The suite failed and release readiness is false. User-requested unrelated SEO, HTML-budget, and staging-parity gates were not changed. Historical details below are retained as prior checkpoints; this current handoff supersedes old full-suite totals and status claims.

---

## Historical outcome-correction checkpoint

The change corrects reserve thresholds to match percentage units, annualizes TOU record totals across 20 years, deducts off-peak charge costs including losses, uses measured-system lifetime costs, and prevents null/non-positive costs from generating a free/payable verdict. Earlier deterministic numerical results and browser display evidence are in [outcomes-evidence.json](outcomes-evidence.json) and [repro-browser-evidence.json](repro-browser-evidence.json). Their accuracy scope does not certify real tariff schedules or financial-model validity.

Prior validation recorded 18/18 TOU tests passing, two focused browser regressions passing repeatedly, syntax, format, and diff checks passing. Do not substitute those focused checks for the failed single full-suite run above.

## Historical routing-only checkpoint

The initial PR #203 defect was four outcome branches nested under `mode === "gridtie"` while checking mutually exclusive modes. Direct new-mode requests fell into the off-grid core; canonical `useCase` requests already used the registry. The patch routes aliases through the existing registry and replaces copied-formula assertions with shipped simulator-path tests.

Earlier checkpoints and historical blockers are preserved below for provenance. They are not current suite results and must not override the single run documented above.
