## Why the score is 20 (target 99)
**Scoped gate (P9.7): 0/99 — 99 points short.** Short of proven: `docs` (confident — solid with minor gaps), `quality` (mixed — partial or unverified evidence), `seo` (failing — evidence contradicts quality). Ratchet: violation.
- `docs`: confident — solid with minor gaps (ordinal 85, live)
  - _why:_ the live judge rated this "confident — solid with minor gaps" (ordinal 85) — short of proven
  - _why:_ no proof line was recorded for this axis in the evidence
- `quality`: mixed — partial or unverified evidence (ordinal 60, live)
  - _why:_ the live judge rated this "mixed — partial or unverified evidence" (ordinal 60) — short of proven
  - _what the judge saw:_ "For this P9.7 infrastructure-only change: judge gate correctness, tests, representative fixtures, and whether content criteria activate only for governed pages or sources. Do not grade infrastructure files as published copy. Evidence is incomplete or truncated; do not grant a pas"
- `seo`: failing — evidence contradicts quality (ordinal 0, code)
  - _why:_ a blocking facet — at or below the blocking bar, so it alone can hold the gate red
  - _why:_ a code-authority fact (Jev may lower a code fact, never raise it)
  - _why:_ no proof line was recorded for this axis in the evidence
### 1. `quality_gap` — Concision / formatting gap _(work type: deletion)_
- **hard gate**: hard gate red (ordinal -1, source: hard_gate)
  - _why:_ a hard gate failed — this caps the score below target regardless of the semantic side (fail-closed)
- **Focus:** Run the deletion-first pass: npx prettier --write the red files, then delete redundancy, one-use indirection and unrequested branches; re-run focused checks after pruning.
### 2. `seo_gap` — SEO gate gap _(work type: audit)_
- **hard gate**: hard gate red (ordinal -1, source: hard_gate)
  - _why:_ a hard gate failed — this caps the score below target regardless of the semantic side (fail-closed)
- **Focus:** Run npm run seo, fix whatever it reports (sitemap, JSON-LD, metadata, characters), and record the green run as evidence.
### 3. `tests_gap` — Test suite gap _(work type: contract-tests)_
- **hard gate**: hard gate red (ordinal -1, source: hard_gate)
  - _why:_ a hard gate failed — this caps the score below target regardless of the semantic side (fail-closed)
- **Focus:** Get the full unit suite green (npm test), add behavioral contracts for any behavior that changed without one, and never weaken a gate to get there.
### 4. `release_gap` — Release readiness gap _(work type: release-verify)_
- **hard gate**: hard gate red (ordinal -1, source: hard_gate)
  - _why:_ a hard gate failed — this caps the score below target regardless of the semantic side (fail-closed)
- **Focus:** Run the release-candidate pass: ship in-flight work through the protected path, get CI and browser smoke green on the merge, and re-run this gate on the clean tree.
### 5. `a11y_gap` — Accessibility gap _(work type: polish)_
- **accessibility**: mixed — partial or unverified evidence (ordinal 60, source: live)
  - _why:_ the live judge rated this "mixed — partial or unverified evidence" (ordinal 60) — short of proven
  - _why:_ no proof line was recorded for this axis in the evidence
- **Focus:** Run the experience-polish pass focused on accessibility: keyboard through every main flow, label the calculator controls, fix contrast, and verify reduced-motion behavior.
### 6. `advisor_gap` — AI advisor quality gap _(work type: audit)_
- **advisor**: mixed — partial or unverified evidence (ordinal 60, source: live)
  - _why:_ the live judge rated this "mixed — partial or unverified evidence" (ordinal 60) — short of proven
  - _why:_ no proof line was recorded for this axis in the evidence
- **Focus:** Run the advisor audit against the real chat and worker paths: verify the same selected deterministic state reaches Jev and prose, exercise prompt-injection, stale-response, provider-failure, locale, privacy, uncertainty, neutrality, and safety cases, then add or fix regression evidence for every observed gap.
### 7. `comparison_gap` — Path comparison gap _(work type: architecture)_
- **comparison**: mixed — partial or unverified evidence (ordinal 60, source: live)
  - _why:_ the live judge rated this "mixed — partial or unverified evidence" (ordinal 60) — short of proven
  - _why:_ judge confidence was low (0.37) — the evidence was thin or ambiguous
  - _why:_ no proof line was recorded for this axis in the evidence
- **Focus:** Model all four purchase paths for one sized system over 20 years from the same registry inputs — turnkey benchmark, lease or PPA terms, self-purchase plus electrician labour, DIY mounting plus inspection — with permits, incentives, replacements and end-of-term choice counted identically, then check the paths rank in an order the evidence explains.
### 8. `correctness_gap` — Correctness gap _(work type: adversarial-fix)_
- **correctness**: mixed — partial or unverified evidence (ordinal 60, source: live)
  - _why:_ the live judge rated this "mixed — partial or unverified evidence" (ordinal 60) — short of proven
  - _why:_ no proof line was recorded for this axis in the evidence
- **Focus:** Run the adversarial exercise pass through real entry points: hunt boundary, ordering, async and state-sync failures, fix only substantiated defects, then re-run the failing flows.
### 9. `experience_gap` — User experience gap _(work type: polish)_
- **experience**: mixed — partial or unverified evidence (ordinal 60, source: live)
  - _why:_ the live judge rated this "mixed — partial or unverified evidence" (ordinal 60) — short of proven
  - _why:_ no proof line was recorded for this axis in the evidence
- **Focus:** Run the experience-polish pass: walk the first-run flow, make actions acknowledge themselves, give errors a next step, and invite rather than confuse in empty states.
### 10. `perf_gap` — Performance gap _(work type: playtest)_
- **performance**: mixed — partial or unverified evidence (ordinal 60, source: live)
  - _why:_ the live judge rated this "mixed — partial or unverified evidence" (ordinal 60) — short of proven
  - _why:_ no proof line was recorded for this axis in the evidence
- **Focus:** Run the playtest pass on the real surface: measure the slow interaction, confirm warm-cache paths issue zero redundant network pulls, and make subsequent adjustments instant.
### 11. `physics_gap` — Physics / determinism gap _(work type: contract-tests)_
- **physics**: mixed — partial or unverified evidence (ordinal 60, source: live)
  - _why:_ the live judge rated this "mixed — partial or unverified evidence" (ordinal 60) — short of proven
  - _why:_ no proof line was recorded for this axis in the evidence
- **Focus:** Pin the physics contract with tests: deterministic derivations, thresholds intact, and a recorded verify:live run — fix any assertion the evidence shows weakened.
### 12. `privacy_gap` — Privacy gap _(work type: adversarial-fix)_
- **privacy**: mixed — partial or unverified evidence (ordinal 60, source: live)
  - _why:_ the live judge rated this "mixed — partial or unverified evidence" (ordinal 60) — short of proven
  - _why:_ no proof line was recorded for this axis in the evidence
- **Focus:** Adversarially audit data egress: list every request that leaves the device with its payload, prove coordinates are rounded before each one, prove no cookie or identifier is set or logged, remove any ad, tracker or affiliate path, and state each third-party disclosure on the page.
### 13. `provenance_gap` — Provenance gap _(work type: audit)_
- **provenance**: mixed — partial or unverified evidence (ordinal 60, source: live)
  - _why:_ the live judge rated this "mixed — partial or unverified evidence" (ordinal 60) — short of proven
  - _why:_ judge confidence was low (0.42) — the evidence was thin or ambiguous
  - _why:_ no proof line was recorded for this axis in the evidence
- **Focus:** Trace every visible number back to a source a visitor can open: list each displayed assumption, name the publisher, grade and date behind it, mark every value that has none, and replace each unsourced multiplier with a cited value or an explicit unknown.
### 14. `resilience_gap` — Delivery resilience gap _(work type: adversarial-fix)_
- **resilience**: mixed — partial or unverified evidence (ordinal 60, source: live)
  - _why:_ the live judge rated this "mixed — partial or unverified evidence" (ordinal 60) — short of proven
  - _why:_ no proof line was recorded for this axis in the evidence
- **Focus:** Run the adversarial pass over the delivery path: prove inner retry/timeout budgets fit every outer cap, classification covers transport failures end to end, and stuck runs recover. Exercise the page-side deadline with a silent worker, including share-restore, stale inputs, and an explicit retry; keep the error actionable and the worker/channel cleanup tested.
### 15. `security_gap` — Security / consent gap _(work type: adversarial-fix)_
- **security**: mixed — partial or unverified evidence (ordinal 60, source: live)
  - _why:_ the live judge rated this "mixed — partial or unverified evidence" (ordinal 60) — short of proven
  - _why:_ no proof line was recorded for this axis in the evidence
- **Focus:** Run the adversarial pass over security surfaces: confirm no secret is tracked, headers/CSP intact, and every sensitive action stays behind explicit user consent; fix what contradicts that.
### 16. `spec_gap` — Spec conformance gap _(work type: audit)_
- **spec**: mixed — partial or unverified evidence (ordinal 60, source: live)
  - _why:_ the live judge rated this "mixed — partial or unverified evidence" (ordinal 60) — short of proven
  - _why:_ no proof line was recorded for this axis in the evidence
- **Focus:** Run the all-facet audit against the request as written: inspect every declared quality dimension with its evidence, list requested outcomes that are missing or unproven, and flag unrequested additions without treating unrun checks as passes.
### 17. `translation_gap` — Translation quality gap _(work type: contract-tests)_
- **translation**: mixed — partial or unverified evidence (ordinal 60, source: live)
  - _why:_ the live judge rated this "mixed — partial or unverified evidence" (ordinal 60) — short of proven
  - _why:_ no proof line was recorded for this axis in the evidence
- **Focus:** Gate each locale on parity in both directions, placeholder integrity, no English leakage and no raw key name reaching a visitor, then back-translate the rendered strings and read them for meaning: fix any string that is technically present and not actually readable.
### 18. `usecases_gap` — Use-case coverage gap _(work type: playtest)_
- **usecases**: mixed — partial or unverified evidence (ordinal 60, source: live)
  - _why:_ the live judge rated this "mixed — partial or unverified evidence" (ordinal 60) — short of proven
  - _why:_ judge confidence was low (0.21) — the evidence was thin or ambiguous
  - _why:_ no proof line was recorded for this axis in the evidence
- **Focus:** Walk each of the six use cases through the real flow: bill cut, time-of-use battery-only, essential-load backup, an emergency reserve, full off-grid and portable power. For each, record the input a visitor is asked for, the outcome metric returned, and the honest verdict when the numbers do not work; name the step where a use case is only named in copy.
