# Agent & Contributor Guidelines for BigEnergyCo

## 1. Golden Rule: Always Push to `main` Through a Pull Request (PR)

- **Never push commits directly to `main`**.
- Always create a dedicated, descriptively named branch for any feature, fix, or refactor (e.g. `feat/...`, `fix/...`, `refactor/...`, `chore/...`).
- Open a Pull Request against `main` using `gh pr create`.
- Only merge into `main` after CI checks (Tests, CodeQL, Lint) have completed and passed.

## 2. Regression Prevention & Test Discipline

- Every new feature, heuristic, formula, UI control, or bug fix **must** have corresponding automated tests added or updated in `tests/*.test.mjs`.
- Never decrease test coverage or delete regression tests.
- Verify the local test suite prior to opening or updating a PR:
  ```bash
  # Run full offline test suite
  npm test

  # Character encoding check (no illegal characters or corrupt UTF-8)
  node scripts/check-chars.mjs

  # SEO, sitemap, JSON-LD, and token validation
  npm run seo

  # Code style check
  npx prettier --check .

  # Deployment staging check
  npm run deploy:check
  ```

## 3. Core Architectural Principles

- **Permanently Free & Public**: No paywalls, no lead collection forms, no commercial sales pitches.
- **Zero Runtime Dependencies**: The calculator runs 100% client-side with pure vanilla JavaScript and Web Workers.
- **Physics & Determinism First**: All sizing calculations derive deterministically from hourly NASA POWER solar irradiance and temperature data.
- **Educational Mission**: Provide transparent, plain-English breakdowns (ELI5) of system components, physical footprints, and honest DIY/wholesale equipment costs vs. high-markup turnkey installer quotes.
