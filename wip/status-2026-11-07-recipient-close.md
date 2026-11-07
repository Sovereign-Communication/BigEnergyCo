## STATUS 2026-11-07 (recipient session, close) — C7 verified present, my one red named and cured, rail green at the final head

**Head `0da361b7b`, pushed, `origin/lane/finish == local`, working tree clean.** `ci/circleci: verify` **success** at that head — pipeline 27, https://circleci.com/gh/Treystu/BigEnergyCo/27.

### DONE — V3/C7: the share card is not empty, and the row's premise was stale

The C7 row said `index.html` has no `og:title`, no `og:description`, no `og:image` and no meta description. **That is no longer true at this head, and I checked it instead of rebuilding it:** all four are present, plus `twitter:card=summary_large_image` and the full twitter mirror, and `blog/index.html` carries the same family. The asset is a real **1200×630 JPEG, 88,513 B** (read: JPEG SOF dimensions, not a filename).

| Read                                                  | Result                                                                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| local staged build, stamp `20261107j`                 | `og:title` / `og:description` / `og:image` present; `GET /assets/og-card.jpg` → **200 image/jpeg 88,513 B** |
| `bigenergyco.pages.dev` (plain `curl`)                | same three tags; `GET /assets/og-card.jpg` → **200 image/jpeg 88,513 B**                                    |
| apex `freeoffgridcalculator.com` (plain `curl -m 15`) | `/` → **403, 5,477 B**; `/assets/og-card.jpg` → **403 `text/html`, 5,574 B**                                |

**So the markup half is done and the end-to-end unfurl is not, and the missing half is #328, not more markup.** `og:image` is absolute to the apex origin, which answers 403 to anything that is not a challenged browser — a crawler that cannot fetch the page or the image cannot render a card. C7's state is recorded as **VERIFIED (parked on #328)**, with those reads in the row, rather than closed on a claim the apex cannot support.

### RAIL — one red of mine, named and cured

| Head                        | `ci/circleci: verify`                   |
| --------------------------- | --------------------------------------- |
| `7a179cb62` (session start) | success — 21                            |
| `256b3770e`                 | success — 22                            |
| `ec5f69015`                 | success — 23                            |
| `75a3b2549`                 | success — 24                            |
| `830dea76c`                 | **failure — 25**                        |
| `6ee256bd9`                 | failure — 26, inherited from 25's cause |
| `0da361b7b` (this status)   | **success — 27**                        |

**Cause, mine:** the status artifact `wip/status-2026-11-07-recipient.md` was written and committed before prettier had seen it. `format:check` gates via `git ls-files`, so a file is invisible to it until it is tracked — the same trap this lane hit on 2026-11-07 03:47, and the same cure: commit the formatter's output (`0da361b7b`), never exempt the path, never skip the gate.

Battery re-read at the final code head `ec5f69015` (unchanged by the three documentation commits after it): `npm test` **2090/2095**, `seo` **0** (stamp `20261107j`, 61 assets), `format:check` **0** (1143 files), `check-chars` **0**, `deploy:check` **0**. The five local reds are the pre-existing CRLF class, proven both ways in the status above (fails at HEAD with my work stashed; 13/13 pass with `locales.js` converted to LF).

### NEXT (exact, unblocked)

**V4 — the comprehension pass** (E13): one-line plain glosses at first use for `kWh/day`, nameplate, autonomy and the tier language; one "what's included" line reconciling buy-cost vs 20-year cost; presets labelled by who they fit, the typical home called out; and one line above the three result tabs saying what each opens. Receipt V4 owes: a first-timer drive quoting the result surface, in that same cold-recipient style.

### PARKED (unchanged)

- **#342** — decision-ready; its precondition still cannot exist on that branch, and the P1.4 design choice is the owner's. The `ci/circleci: verify` context now exists here, so landing it is the cheap path to a rail at its head.
- **P-1 Jev vision-audit PASS**, **P-2 rollback target**, **P3 staging-origin naming** — absent/unnamed/the owner's.
- **#328 apex 403s** — now with a second consumer named: it is what blocks the share card's unfurl, not just browser access.

**BLOCKERS:** none.

GATE: local pass (decision-signal) - verify C7 from served reads instead of rebuilding it, park the unfurl on #328 with the read, cure my own format red - checks 1-5 clean
