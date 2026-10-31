## CI caught a byte-budget regression on the first head — fixed, re-verified

Head `31060af2` failed two checks, one causally:

- **web-smoke → Compressed byte and request budgets (plan section 3.1): FAIL.** `js_to_first_result` grew 197.1 KB -> 197.4 KB against the declared ledger baseline (`201806 -> 202131`, delta **325 bytes** vs the 256-byte noise tolerance). The hard limit (200 KB) was never crossed; the gate fails on *growth* — "not the smallest version that keeps the proven behavior".
- **jev-complete: FAIL** by fail-closed design ("job web-smoke concluded failure, so the run is cut short"), not on its own merits.

Fixes landed on the same branch, no threshold or baseline was touched:

1. `0a50df52` — trimmed the explanatory comment from the render site (rationale lives in the fix commit, this PR, and the test header instead of shipping in bytes). Delta 325 -> 262.
2. `903aa034` — deleted the four now-dead English `desc` strings from `BOM_ITEMS`: after the fix nothing reads them (`t(descKey)` resolves every locale including `en` from `LOCALES`, and `pricing.test.mjs` only uses `PRICES_CHECKED`). Delta 262 -> **no regression, 1 improvement**.

Re-verified locally on the final head `d3c1bb9e`: `npm test` 1986/1986, `check-chars`, `seo` (stamp 20261028d), `format:check`, `deploy:check`, `plan:check`, `check-byte-budgets` (0 regressions), `smoke:local` 232/232, and the visual audit (28 cells, 0 failures, 12/12 English-leak checks pass).

The audit's own Jev verification (one direct TypeSafe call, recorded either way): **pass**, model `jev-1.14.0`, confidence 0.8.
