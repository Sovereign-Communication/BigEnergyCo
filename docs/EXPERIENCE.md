# Experience Library — Lessons from Real Failures

Seeded from actual past failures. Each entry: what happened, what we learned,
what changed. Add new entries when something surprises you.

## 2026-10-19: Jev gate bootstrap failure

**What happened:** The `jev-complete` gate failed on all 11 open PRs with
"no plan item id in the title". Content PRs (blog, locale) don't map to
P-items, so the fail-closed gate blocked everything.

**Lesson:** A gate that can't scope the work is worse than no gate. Fail-closed
without a fallback creates systemic blockage.

**Changed:** PR #236 added three-tier scope inference (explicit → path →
keyword) plus governance precedence (plan PRs → P0.1). The gate now scopes
semantically instead of failing syntactically.

## 2026-10-19: P9.7 missing measurement methods

**What happened:** Jev scored P9.7 plan text at 63% (spec) — the criteria
("real search demand", "grade 8 reading level") had no measurement methods.

**Lesson:** A plan item without measurable criteria can't be judged. "Real
search demand" is meaningless without "≥100 monthly searches via Keyword
Planner".

**Changed:** P9.7 now specifies measurement for each criterion. Created
`docs/content-quality.md` with pass/fail examples.

## 2026-10-18: Currency codes stranded on closed branch

**What happened:** Three correct currency fixes (AG→XCD, CW→XCG, ZW→ZWG) sat
on `showcase/cold-start-verify`, a branch whose PR (#182) was closed unmerged.
The fixes were never proposed to main.

**Lesson:** Work on branches without PRs is invisible. 50 branches had never
had a PR. The lane builds but doesn't ship.

**Changed:** PR #235 extracted the currency fixes. Audit now tracks branches
with no PR.

## 2026-10-17: Asset stamp forgotten on shipped-JS PR

**What happened:** PR #228 changed shipped JS but didn't bump asset tokens.
Staging served stale JS until the stamp was bumped manually.

**Lesson:** Shipped-JS changes require: bump script, verify fetch URL, update
evidence, commit atomically, confirm with --check.

**Changed:** Documented in PR template and lane checklist.

## 2026-10-16: Combined status API lies

**What happened:** The GitHub combined commit-status API returned `pending`
for every PR, suggesting CI was stuck. The real state (via check-runs API)
was green.

**Lesson:** For GitHub Actions, always read `GET /repos/{org}/{repo}/commits/{sha}/check-runs`.
The combined status API is unreliable for Actions.

**Changed:** All lane tooling uses check-runs API exclusively.
