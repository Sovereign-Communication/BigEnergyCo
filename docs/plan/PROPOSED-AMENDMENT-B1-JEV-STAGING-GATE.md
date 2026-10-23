# Proposed Amendment B1: Staging Jev Gate

**Status:** Draft for Lucas's review. Not approved or adopted.

This is a proposal only. It does not amend `MASTER_PLAN.md`, append to the approved amendment chain, or change any gate code or CI threshold. Lucas's explicit approval is required before implementation.

## Proposed policy text for Lucas's approval

1. **Scope:** B1 applies to the Jev staging check on an exact merged-main revision. Scoped PR reports remain advisory under A-005.
2. **Staging score:** Require combined score at least 95.0 and every facet ordinal at least 85. A facet below 85 blocks staging; there is no separate 60 floor or implied translation exception.
3. **Staging confidence:** Record every facet's unmodified Jev confidence. Confidence below 0.95 requires a documented investigation under Jev Gate Policy v1; actual unresolved risk blocks. Low confidence alone does not block staging after that investigation clears the risk. This confidence rule is proposed here and is not current policy until approved.
4. **Unchanged safeguards:** Keep hard gates, current-revision evidence, pinned live-model requirements, fail-closed handling of missing or malformed results, and the all-facet ratchet binding.
5. **P10 and production:** Retain combined score at least 95.0, every facet ordinal at least 95, and every facet confidence at least 0.95 for P10's full program-exit assessment. A green B1 staging result does not satisfy P10 or authorize promotion while the required full release assessment fails.

## Evidence and remaining gap

- Main `53888bfbd30d22d17a4639e136abf8df9b35fcb1`, check-run `120288346665`, is red at 97.50/100 with all hard gates passing and 11/21 facets proven.
- Phase 2 did not raise the targeted facets: quality, performance and i18n remain 85; translation remains 60. The latest mission authorizes Phases 3 and 4 to continue with explicit proof criteria and terminology/semantic checks.
- Translation at 60 would still fail the proposed 85 floor. Phase 4 must close that gap, or Lucas must approve a separate, explicit exception with scope and exit conditions. This draft contains no exception.
- This proposal changes the staging bar; it must not be presented as a reinterpretation already authorized by A-004, A-005 or Jev Gate Policy v1.

## Adoption boundary

Lucas must explicitly approve the score floor, staging confidence rule and retained P10/production boundary before implementation. No approval is recorded in this draft.

After approval, append the agreed text as the next unused approved amendment, rebuild the hash chain, and implement the corresponding scoped gate and regression tests in a separate PR. This draft changes no approved amendment, plan hash, gate code or threshold.
