Jev v1 investigation for exact head `b313f619fb159895c76cd8dd996d8621e0619de9` (P0.4)

The scoped report is 94.75/95 and reports `pass:false`; hard gates passed and the ratchet is met with zero regressions. The 95/95/95 PR report is advisory under the post-merge gate rule, so I investigated the below-bar facets before proceeding.

- Accessibility: ordinal 85 / confidence 0.65. The browser smoke passed 20/20 checks; the axe matrix has 11 audited cells, zero violations, zero regressions, and no unmeasured cells. This supports the measured keyboard, accessible-name, contrast, and motion claims. The evidence does not claim a screen-reader pass or every Q-07 clause; the plan records the NVDA/VoiceOver pass per UI-changing phase.
- Performance: ordinal 60 / confidence 0.40. The artifact records current Q-02/Q-03 misses (homepage LCP 3.81s mobile / 6.54s desktop, CLS 0.177 / 0.157, mobile TBT 110ms). The corresponding current-main readings were 4.00s / 5.66s LCP and the same CLS. Performance is reported but not ratcheted at P0.4 because repeated Lighthouse scores are materially variable; the absolute thresholds bind at P5/P8. I’m retaining these readings as an existing measured performance gap, not treating the scoped report as a numeric pass.
- Quality: ordinal 85 / confidence 0.27. `npm run quality` and the quality CI job pass on 84 pages; the report measures 302/318 inline-style declarations and no inline scripts or handlers, with labels, buttons, links, and headings validated. This is an improvement with no observed user-facing regression.
- Testing: ordinal 100 / confidence 0.68; the full local suite passed 1714/1714 and CI passed on this exact head.

V1 disposition: proceed with this evidence PR. Investigation found no new merge-blocking risk or ratchet regression. The existing performance miss and the limits of current Q-07 evidence remain visible for the relevant later phase gates.
