## Plan items

P0.3; Q-01 / section 13.3. Refs #287 Phase 3.

## What changed and why

Every facet previously used the same generic description for the highest Score level. The assessment pack now supplies a distinct evidence bar for each of its 21 facets, and pack validation preserves that text in the live questions. The criteria distinguish measured coverage from assumptions and keep missing semantic, accessibility, or live checks visible as gaps.

Score levels, ordinal anchors, hard gates, ratchets, and the 95/95/95 release policy are unchanged. Operator packs that omit the optional criteria retain their original level descriptions.

## Validation

- Full offline suite: 1,792/1,792 passed; focused pack/scope suite: 72/72.
- Character, SEO, formatting, deploy staging, plan pin, and 21/21 facet-coverage checks passed locally.
- Tests verify proof text reaches every live Score question, malformed text is rejected, ordinal anchors stay fixed, and operator packs remain supported.
- Ledger note appended for #287 Phase 3. The live scoped result will be attached by CI; no facet movement is claimed in advance.

## Definition of done

- [x] Tests updated without reducing coverage.
- [x] Required local preflight passed.
- [x] Progress recorded in the append-only ledger.
- [ ] CI and scoped live Jev report on this head.

LoC: +88 / -24 across four files.