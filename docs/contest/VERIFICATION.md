# Cold Start — verification log

What was actually run in this session, and what was not. Written so nobody has
to guess which claims have a number behind them.

**Nothing here has been deployed.** No `wrangler deploy`, no Pages project, no
Turnstile site, no filing. Every item below is local, executed, and reported
with its real output.

---

## Executed and green

| Check                          | Result                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `npm test`                     | **1093 / 1093 pass**, 0 fail                                                          |
| `node scripts/check-chars.mjs` | exit 0                                                                                |
| `npm run seo`                  | exit 0 — JSON-LD, chars, SEO, quality, i18n, CSP headers, country files, asset tokens |
| `npm run format:check`         | exit 0 — 618 tracked files, as the CI runner reads them                               |
| `npm run plan:check`           | exit 0 — plan SHA `c8271d11…`, amendment chain intact                                 |
| `npm run smoke:advisor`        | exit 0 — 4 scenarios, 14 checks, all pass                                             |

## The advisor client smoke (`npm run smoke:advisor`)

This runs the **shipped** `sendChatMsg()` from `assets/js/chat.js` inside a vm
against a fake DOM — not a source-reading assertion. Observed output:

```
  no Turnstile configured, advisor healthy
    requests=1 token=(none) degraded=false label=false spinner-cleared=true
    first line: For a 30 kWh/day household, start near 40 kWh usable.

  Turnstile configured, token produced
    requests=1 token=token-abc-123 degraded=false label=false spinner-cleared=true
    first line: Start near 40 kWh usable.

  Turnstile configured, widget unavailable (blocked script)
    requests=1 token=(none) degraded=false label=false spinner-cleared=true
    first line: Start near 40 kWh usable.

  advisor unavailable (B2 fallback)
    requests=1 token=(none) degraded=true label=true spinner-cleared=true
    first line: DEGRADED: I cannot answer this one right now — a service this advisor depends on did not
```

Reading it:

- **Line 1** is the state the showcase is in _today_: no site key, no token, and
  the advisor fully usable. B1's fix did not break the default path.
- **Line 2** is B1 fixed: the widget's token arrives in the request body under
  `turnstileToken`.
- **Line 3** is the non-fatal guarantee: a challenge that cannot render still
  lets the request through instead of hanging on "Thinking…".
- **Line 4** is B2 fixed: an unavailable advisor produces a labelled message,
  not a blank box — and the label is rendered, not merely sent.

## Two pre-existing failures, fixed

Both were red **before** this work started. Confirmed by stashing everything
and re-running on the clean tree, where both reproduced.

1. **`verify-staging.mjs` could crash instead of returning a verdict.** The
   parity loop called `readFileSync(file)` above its `try`, so a file named by
   the git-index-derived deploy manifest but absent from disk escaped as an
   uncaught `ENOENT`, the top-level `await` rejected, and the gate exited on a
   stack trace. A gate that dies tells the caller nothing — "crashed" and
   "skipped" look identical. Now returns a named `unreadable` state.
   Reproduced because the manifest deliberately enumerates from the index, so a
   concurrently-mutated tree is expected, not anomalous.

2. **`npm run seo` failed on a token-less asset reference** to
   `/assets/js/cf-beacon.js` — inside a _comment_ in `cf-beacon.js`, so the
   file's own usage example shipped an unversioned script reference. The asset
   token check reads the whole file, comments included. Fixed with a `?v=`.

## Not verified — describe as shipping, never as shipped

Per §11 of the contest plan. None of the following has a number behind it yet.

| Item                            | State            | Why                                      |
| ------------------------------- | ---------------- | ---------------------------------------- |
| Showcase deployed               | **not deployed** | no `wrangler deploy` run                 |
| Demo URL captured               | **none**         | Pages project not created                |
| Real-browser verification       | **not done**     | fake DOM only, no Chromium               |
| §9 cookie gate result           | **not measured** | needs the live showcase host             |
| `TURNSTILE_SECRET_KEY` decision | **not made**     | blocked on the cookie gate, deliberately |
| `gate:byte-budgets`             | **not run**      | CPU embargo (§3 of the plan)             |
| `deploy:check`                  | **not run**      | CPU embargo                              |
| `smoke:local`                   | **not run**      | CPU embargo                              |
| Traction figures                | **none**         | need a deployed site with traffic        |
| Application filed               | **not filed**    | requires a human, by hand (Rules §4)     |

The CPU embargo is real and self-imposed: a concurrent session is deciding a
merge on a noisy three-run Lighthouse distribution, and load here has already
misled it once. Running a browser or a staged build alongside that would corrupt
the exact number it is deciding on. It lifts when that session reports final
numbers or is parked.

## The ordering that was followed

1. B1–B5 fixed, each with tests that fail against the original defect.
2. Two pre-existing gate failures found and fixed rather than worked around.
3. The cookie gate built **as code**, with the not-measured case pinned to
   "do not provision" — the judge's 45 % finding was that a risk named without
   a gate is not named at all.
4. A-003 written in full and parked, because appending it today would break the
   amendment chain (A-002 is still open in PR #171).
5. The application narrative drafted for a human to file.
6. Full preflight run and recorded.
