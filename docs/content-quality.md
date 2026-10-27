# Content Quality Gate (P9.7) — Detailed Specification

This document provides concrete examples and detailed guidance for the P9.7 content quality gate defined in `docs/plan/MASTER_PLAN.md`.

## (a) Canonical Formatting

**Pass example:** A new blog post copies `blog/is-a-home-battery-worth-it/index.html`'s `<style>` block byte-for-byte. `diff` against the canonical template shows zero differences. Headers, footers, and CTA sections match the template structure. JSON-LD BlogPosting metadata matches the visible article content.

**Fail example:** A post uses a different font stack in the style block, or omits the JSON-LD. CI fails with "style block mismatch."

**Verification:** `diff <canonical-template> <new-post>` must be empty for the style block. `npm run seo` validates JSON-LD.

## (b) SEO

**Pass example:** Target keyword "salderingsregeling 2027" shows 1,200 monthly searches in Google Keyword Planner. Sitemap contains no other URL targeting this keyword. `npm run seo` passes (sitemap valid, structured data valid).

**Fail example:** Target keyword has 0 monthly searches (no demand), or another post already targets the same keyword (cannibalization).

**Verification:** Keyword Planner screenshot or Search Console data in PR description. Manual sitemap review for overlap.

## (c) Sourcing

**Pass example:** Claim "The salderingsregeling ends 1 January 2027" links to Rijksoverheid.nl page. Every factual claim has a hyperlink to its source.

**Fail example:** Claim cites a tweet or Facebook post for a news hook. Or a factual claim has no source link.

**Verification:** PR reviewer checks that every factual claim links to a verifiable source. News hooks must use official sources only.

## (d) Voice (R-CONT-01..04)

**Pass example:** "Your solar panels generate electricity during the day. You can use this power directly or store it in a battery." (Plain, second person, grade 7 reading level per Flesch-Kincaid.)

**Fail example:** "Revolutionize your energy independence with cutting-edge solar technology!" (Hype, sales language, not second person.)

**Verification:** `npx text-readability` or Hemingway App confirms ≤ grade 8. Jev voice check for hype/fear/sales language.

## Enforcement

- Jev assesses these criteria with the five aspects in [Jev Gate Policy v1](JEV_GATE_POLICY_V1.md): completeness, confidence, correctness, no-regression, and evidence quality. Mark an aspect irrelevant only with a reason.
- A below-bar verdict starts an investigation and claim-level verification. When four aspects are at least 90 and the fifth is 85–89, the work passes only if investigation finds no actual risk. An aspect below 85 blocks until fixed.
- The repository's native full-main CI gate remains separate and unchanged: 95 overall, every facet at ordinal 95, and every facet at confidence 0.95.
- PR #232 bootstraps this gate under amendment A-006. The exception applies to this gate-authoring PR only; later P9.7 content changes are assessed under Jev Gate Policy v1.
- **Post-merge:** Implementation is browser-verified against these criteria before production deploy.
