# STATUS — m-20261017-p04-scroll

- **phase:** in_progress
- **request:** Fix only the P0.4 first-load budget/reduced-motion PR findings: one scroll-policy owner, behavior-level regression coverage, and Chrome proof for both sizing-module and chat-module scroll paths under normal and reduced motion. Review current live Jev evidence and do not widen plan scope.
- **success_definition:** P0.4-only change is lean, behavior is proven in Chrome for both paths under normal and reduced motion, exact-head CI passes, and Jev reaches 99; otherwise record the exact scope blocker. Do not merge or deploy.
- **scope.in_scope:** assets/js/sizing/ui.js, assets/js/chat.js, tests/reduced-motion.test.mjs, scripts/smoke/a11y.js, existing P0.4 first-load budget test, required asset-token metadata only
- **scope.out_of_scope:** immutable plan, other plan items, translation work, unrelated UI or performance changes, shared dirty checkout, merge, deploy
- **limits.max_cost_usd:** 2.0
- **terminal_reserve.cost_usd:** 0.2
- **verifier.kind:** claude-isolated-mission
- **budget.spent:** 0.0
- **budget.terminal_reserve_cost_usd:** 0.2
- **budget.working_remaining:** 1.8
- **budget.terminal_available:** 2.0
- **budget.phase:** attempt
- **receipts:** 1
- **jev_evals:** 0
- **resume.attempts:** 0
- **artifacts:** scout-r1.json
- **terminal:** no
