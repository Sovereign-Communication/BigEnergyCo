## Scope

Draft proposal for issue #287 Phase 5. This records the B1 wording and the questions that need Lucas's explicit approval before implementation. It is not ready to merge until the policy interpretation is approved.

No gate code, threshold, approved amendment, plan hash, or CI behavior changes are included.

## Evidence

- Main SHA `53888bfbd30d22d17a4639e136abf8df9b35fcb1` Jev check-run `120288346665`: 97.50/100, hard gates green, 11/21 facets proven.
- Quality, performance, and i18n remained 85 after the three Phase 2 PRs; translation remained 60. The Phase 2 go/no-go is zero targeted-facet movement, so Phases 3 and 4 stop here.
- Accessibility changed 100 to 85 while its 40/40 browser evidence stayed identical; no new behavior or evidence gap was found.

## Approval needed

Please review the draft document's three questions: whether 85 or 60 is the staging floor, how the staging confidence requirement changes, and whether B1 applies only to merged main while P10 retains 95/95/95. No threshold implementation is part of this PR.

LoC: 27.
