## Scope (P9.5 / R-CONT-05)

This is a partial factual correction to the existing DIY battery article. It does not complete the blog audit or close P9.5.

- Replaces broad, unsupported price comparisons with one dated supplier example and states that freight and tax are excluded.
- Uses Docan listings viewed on 2026-10-22: 16 REPT LF280 cells at $60 each plus a $365 inquiry-only DIY box with a 200A JK BMS. Nameplate capacity is 16 × 3.2V × 280Ah = 14.336 kWh; at 80% usable capacity, the $1,325 listed subtotal is about $116 per usable kWh.
- Keeps the owner-supplied $80–$120 range only as an explicitly labeled planning assumption, not a verified quote.
- Updates the article modification dates and sitemap, and adds regression checks for source links, arithmetic, visible FAQ/JSON-LD agreement, and dates.

Plan: [MASTER_PLAN.md, P9.5](https://github.com/Sovereign-Communication/BigEnergyCo/blob/main/docs/plan/MASTER_PLAN.md#L666). Tracking issue: [#194](https://github.com/Sovereign-Communication/BigEnergyCo/issues/194).

Sources: [Docan REPT LF280 listing](https://www.docanpower.com/rept-280ah-prismatic-cell), [Docan DIY box listing](https://www.docanpower.com/s3-diy-box-jk-bms-v19).

Local preflight on this candidate passed: `npm test` (1721/1721), `node scripts/check-chars.mjs`, `npm run seo`, `npm run format:check`, `npm run deploy:check`, and `npm run plan:check`.
