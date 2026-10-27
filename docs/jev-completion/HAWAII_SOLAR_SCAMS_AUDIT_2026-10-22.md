# Hawaii solar warning claim audit (2026-10-22)

## Scope

P9.5 (R-CONT-05): review of blog/hawaii-solar-scams-2026-warning/index.html, its BlogPosting entry, and the visible blog card. The shared inline style block remains byte-identical to the canonical article template.

## Primary-source review

- [Hawaii DCCA / OCP release](https://cca.hawaii.gov/ocp/state-warns-public-about-misleading-door-to-door-solar-sales/) (August 26, 2026; page updated September 10): supports the reported false contractor-closure and state free-PV/storage claims; says the state does not provide free solar PV, state employees do not sell solar or conduct program outreach by cold call or door knocking, identifies fake HGIA/GEM$ affiliations, describes Business Check, and provides OCP complaint contacts.
- [FTC Cooling-Off Rule guide](https://consumer.ftc.gov/articles/buyers-remorse-ftcs-cooling-rule-may-help): explains that the federal three-day right covers certain sales, with exclusions and specific cancellation steps.
- [NASA POWER documentation](https://power.larc.nasa.gov/docs/): supports the solar and meteorological data source used by the calculator.

## Findings corrected

- Replaced the unsupported present-tense claim that deceptive sellers were working neighborhoods "right now" and removed categorical claims that every state-affiliation pitch is a lie.
- Narrowed the free-solar claim to the DCCA's actual statement about free state solar PV and attributed the reported PV/storage pitch to the release.
- Attributed the three-business-day cancellation statement to DCCA and added the FTC's scope limits; removed universal "any sale" language.
- Removed "no license, no signature," the unverified HGIA phone number, and advice to record a conversation. Replaced them with source-backed registry and complaint guidance.
- Qualified the calculator output as an estimate, synchronized the article and listing descriptions/dates, and removed FAQPage JSON-LD because the article had no matching visible FAQ section.

## Jev Gate Policy v1 investigation record

The claim-level review identified actual overstatements and a visibility mismatch; each was corrected and checked against the cited primary sources. Remaining factual statements in the reviewed article are confined to those sources or clearly labeled as consumer guidance or model estimates. No unresolved risk was found in the audited scope. This report records the investigation evidence; it does not invent Jev scores or substitute for the exact-head live report produced by the PR gate.

## Remaining scope

This audit is one article in P9.5. It does not establish keyword-demand metrics or complete the remaining blog audits. The separate P9.6 Search Console and Web Analytics access remains a live-account task.

## Jev v1 investigation

- On exact source SHA 82657bd, the pull-request workflow reported all required checks successful. Its `jev-complete` job is advisory for pull requests; the attached P9.5 report is not a score pass: scoped score 97.75 (semantic 92.5), with quality 85 at confidence 0.27 and SEO 100 at confidence 0.88. The report's scoped `pass` is false against the plan's 99/proven bar.
- The full report is also below the production exit bar (96.57; `pass` false). It records an experience ratchet change from 85 to 35 at confidence 0.00 and translation 60 at confidence 0.62. The PR changes only article content, card/schema metadata, and a focused test; it does not change the calculator UI or translated UI strings.
- Exact-run measurements show 232/232 browser-smoke gates, 9/9 acknowledgement steps, 3/3 actionable errors, 3 inviting empty states, zero raw keys on 22 pages, 42/42 dictionary surfaces, and zero axe violations. Source-backed article claims and all 1,748 tests pass. Under Jev Gate Policy v1, investigation found no actual risk from this article change, so the scoped PR proceeds with this note. This does not declare P9.5 complete or the production exit gate passed.
