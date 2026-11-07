# TEMP-VERIFY LEDGER 2026-11-01 — Steps 1-2, remaining surface

Companion to `STATE-2026-11-01.md` in this directory. Proof standard: a file is proven only if
its exact bytes reachable from a live/archived ref **or** its regeneration path is named and
reachable. Anything else is HELD — held items are not deleted, only classified.

Executed this session: `prove-ctemp.py` -> `ctemp-proof.tsv` (blob membership per file against the
canonical clone's object database, 1,667 commits / 276 refs fetched including all preservation
branches).

---

## A. `C:\temp` — 122 files, 109 MB, per-file proof

| Class                                                                                                                                                                                 | Files | Bytes    | Disposition | Basis                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Empty test logs (`npmTestErr3.txt`, `npmTestOut3.txt`)                                                                                                                                | 2     | 0        | PROVEN      | blob `e69de29b…` (empty blob) present in repo ODB                                                                                                      |
| npm test output logs (`_npmTestOut.txt`, `_npmTestErr.txt`, `npmTestOut5/7`, `npmTestErr5/7`)                                                                                         | 6     | ~610 KB  | DERIVED     | re-run `npm test`; outputs of 2026-10-10 runs                                                                                                          |
| PR context dumps (`pr_dump/pr-183…282.json`)                                                                                                                                          | 100   | 1.28 MB  | DERIVED     | `gh api repos/Sovereign-Communication/SCMessenger/pulls/<N>` — all 100 are SCMessenger PRs (136 repo refs confirmed), live on GitHub                   |
| PR/issue dumps (`all.txt` UTF-16, `all_prs_context.md`)                                                                                                                               | 2     | 1.1 MB   | DERIVED     | same `gh api` path; 101 `SCMessenger/pull` references                                                                                                  |
| Repomix packs (`repo-pack.md`, `repo-pack - Copy.md`, `repo-pack.txt`)                                                                                                                | 3     | 107.5 MB | DERIVED     | `npx repomix` against this repo; content is git history. `- Copy.md` is byte-identical to `repo-pack.md` (both 36,032,106 B)                           |
| Org pack (`harness-org-pack.md`, `.txt`)                                                                                                                                              | 2     | 1.8 MB   | DERIVED     | repomix pack of `Sovereign-Communication/harness`, live on GitHub; the two files are byte-identical                                                    |
| SCMessenger log extract (`logsSCMessenger.txt`)                                                                                                                                       | 1     | 525 KB   | DERIVED     | source logs are live on disk: `C:\Users\SCM\AppData\Local\scmessenger\logs` (767 MB of `scm.log.*`); this is a cut of them                             |
| Jev log-analysis artifacts (`log_analysis_scmsgr.json`, `jev_log_rows.jsonl`, `jev_log_error_rows.jsonl`, `log_pack_draft.json`, `log_pack_frozen.json`, `jev_log_dogfood_STATUS.md`) | 6     | ~262 KB  | DERIVED     | pipeline documented stage-by-stage in `jev_log_dogfood_STATUS.md` (factor pass -> operator freeze -> judgment -> envelope) over the live log dir above |

**Result: 122/122 accounted. 2 proven, 120 derived with a named path, 0 unique, 0 to preserve.**
No file in `C:\temp` was deleted — purge is behind the approval gate.

Judgment recorded: the Jev artifacts are machine-generated, cost real API spend to reproduce, and
their _verdict_ is captured in the STATUS doc. They are derived, but re-running them is not free;
the approval gate should treat them as the last candidates in this location, not the first.

---

## B. `%TEMP%` (`C:\Users\SCM\AppData\Local\Temp`) — 1,413.8 MB, 105,255 files, 23,604 dirs

This is the largest surface in the mission and had never been measured before this session.

### B.1 HELD by rule — active / fresh

| Item                                                                                                  | Size               | Reason HELD                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 167 entries modified within 24 h                                                                      | —                  | unified rule: under 24 h is held unless proven                                                                                                |
| `codebuff-process-ZWknLV`, `codebuff-process-uhyQBw`                                                  | —                  | this session's own process logs, live                                                                                                         |
| `harness-freeze-*` (16+), `harness-lock-test-*` (3), `route_pack_test_*` (7), `provision-probe-npx_*` | 0 B each           | **churn observed during this pass** (created 13:03-13:04 today) — a live harness run is writing here                                          |
| `harness-backups`                                                                                     | 2.6 MB             | touched 13:04 today                                                                                                                           |
| `scoped_dir23588_1988820407`                                                                          | 4 KB               | Chromium scratch, live browser session                                                                                                        |
| `*.tmp` (`0aea80c6…` 2.0 MB, `80348633…` 5.3 MB, `a6e0ff1c…` 2.5 MB, others)                          | ~9.8 MB            | written 13:03-13:19 today; in-flight temp files                                                                                               |
| `node-compile-cache`                                                                                  | 5.2 MB / 560 files | live Node compile cache; regenerates on use                                                                                                   |
| `beco-smoke-3nd5N7`, `beco-smoke-9OovPi`                                                              | 44.6 + 24.9 MB     | Chromium **profile** dirs (Crashpad/GPUPersistentCache/Last Version); regenerable only by relaunching the smoke run — not proven this session |

Locked-file handling: no force-kill, no `handle.exe` enumeration. Items held by live processes are
named above and excluded from any deletion batch until re-checked. Two earlier measurements
(`%TEMP%` walk) also confirm the surface is moving: file count rose during the session.

### B.2 DERIVED — named regeneration path

| Item                                                                                                                  | Size     | Files  | Regeneration path                                                            |
| --------------------------------------------------------------------------------------------------------------------- | -------- | ------ | ---------------------------------------------------------------------------- |
| `beco-p04-clean-install-verification-20261027`                                                                        | 250.1 MB | 26,169 | `npm ci` in a fresh checkout (contains only `node_modules/`)                 |
| `beco-clean-install-verification-20261027`                                                                            | 250.1 MB | 26,169 | same; **not** a duplicate of the above (byte totals differ by 2,666 B)       |
| `beco-recovery-fetch-verify-9443128e…`                                                                                | 178.7 MB | 994    | `git clone` / `git fetch` from origin (has `.git`)                           |
| `harness-main-0780ea7473-step1-20261031`                                                                              | 119.9 MB | 4,932  | `main.tar` + `repo` + `venv314`; re-fetch harness + `pip install`            |
| `harness-trace-843a512`                                                                                               | 96.8 MB  | 9,615  | python venv (`pyvenv.cfg`); recreate with the recorded requirements          |
| `wb-fresh`                                                                                                            | 77.1 MB  | 3,438  | git checkout with `node_modules`; re-clone + install                         |
| `harness-288-trial-0170dfde…`                                                                                         | 65.6 MB  | 6,369  | venv + pyright/pyrefly evidence logs; re-run the same checks                 |
| `harness-pr435-pyright-venv`                                                                                          | 31.7 MB  | 6,348  | venv; `pip install`                                                          |
| `beco-pages-generated-verification-20261027`                                                                          | 14.6 MB  | 367    | `npm run deploy:check` / page generator                                      |
| `tmphan_ynmh`, `tmppir6qh4w`, `tmp94s2obgs`, `tmpqwjczyqj`, `tmp5jqxjjug`, `tmpqr8wkj7e`, `h1_app.js`, `civicscope-*` | ~50 MB   | ~800   | scratch clones/venvs of the same families above; regenerate per parent class |
| `harness-*.log` (43 suite/gate logs)                                                                                  | 24 MB    | 43     | re-run the harness suite at the commit named in each log                     |

### B.3 HELD — unproven, unique in the strict sense (no named path)

These are BigEnergyCo lane audit artifacts generated on 2026-10-26/27. Their _information_ is
re-derivable by re-running the census, but the byte-exact records are not:

| Item                                               | Size    | Content                                                            |
| -------------------------------------------------- | ------- | ------------------------------------------------------------------ |
| `beco-dirty-recovery-prepared-20261026.json`       | 13.8 MB | prepared recovery plan, `head 5d002fd3`, `branch docs/ledger-p1-3` |
| `beco-dirty-recovery-dry-run-20261026-185255.json` | 13.8 MB | dry-run record, `mode: dry-run`, 2026-10-27T04:35Z                 |
| `beco-dirty-recovery-execute-20261026-185819.json` | 4.2 MB  | execute record                                                     |
| `beco-worktree-census-20261026.json`               | 3.9 MB  | worktree/PR census snapshot (generated 2026-10-27T04:01Z)          |
| `live-blobs-raw.txt`                               | 4.5 MB  | raw blob SHA-1 list from the 10-30 recovery work                   |

Disposition: **HELD, not preserved this session.** Preserving was not required — nothing in this
location is being deleted. Rationale for holding rather than committing: these are 40 MB of
machine-generated JSON whose value is the Oct-26 snapshot; committing them buys little that Step 4's
fresh census will not, and the approval gate should decide with the rest.

---

## C. `C:\tmp` remainder beyond the held/staged set — fully classified

| Item                                                        | Size     | Disposition                                   | Basis                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------- | -------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_inline.js`                                                | 55,198 B | HELD (owner-staged)                           | never in scope                                                                                                                                                                                                                                                        |
| `v0.5.0-release-notes.md`                                   | 12,966 B | HELD (owner-staged)                           | never in scope                                                                                                                                                                                                                                                        |
| `audit-sim`                                                 | 57 MB    | HELD (owner-staged)                           | never in scope                                                                                                                                                                                                                                                        |
| `audit-sim3`                                                | 26 MB    | HELD (owner-staged)                           | never in scope                                                                                                                                                                                                                                                        |
| `beco-pr171-squash-20261023`                                | 26 MB    | HELD (owner-staged worktree)                  | never in scope                                                                                                                                                                                                                                                        |
| `be-jev-burndown-20261026`                                  | 80 MB    | HELD (#321, clean @ ae3074ca)                 | merge withheld                                                                                                                                                                                                                                                        |
| `.freebuff` (`project-id`, `.gitignore`, 114 B)             | 2 KB     | DERIVED                                       | local tool marker; recreated by the app                                                                                                                                                                                                                               |
| `.cloud-attachments/imported-conversation-*.json` (2 files) | 1.4 MB   | **HELD — unique, deliberately not published** | FreeBuff conversation records; they are the surviving evidence trail for the Oct-30/31 recovery method. **Not** committed: the repo is public and these transcripts may contain third-party content or credentials. Retention is a deliberate hold, not an oversight. |
| `.shadow-recover.ps1`, `.shadow-recover.log`                | 3.7 KB   | DERIVED — redundant                           | exact copies now committed in this directory (`shadow-recover.ps1`, `shadow-recover.log`)                                                                                                                                                                             |
| `car2-bak/`, `car4-bak/`                                    | —        | ABSENT                                        | the two-file loss; see STATE §1.6                                                                                                                                                                                                                                     |

`C:\tmp` is therefore 100% classified: 6 held owner/#321 items, 3 derived, 1 deliberate hold.

---

## D. Headline numbers for the approval gate

| Location           | Size           | Files       | Proven  | Derived                   | Held                                             | Deletable today                            |
| ------------------ | -------------- | ----------- | ------- | ------------------------- | ------------------------------------------------ | ------------------------------------------ |
| `C:\tmp`           | 190 MB         | 3,964       | —       | 3 items                   | owner set + #321 (163 MB) + `.cloud-attachments` | no — 2026-10-30 order covers a subset only |
| `C:\temp`          | 109 MB         | 122         | 2 (0 B) | 120 (109 MB)              | 0                                                | awaits approval                            |
| `%TEMP%`           | 1,413.8 MB     | 105,255     | 0       | ~1,191 MB (classes above) | ~223 MB active/fresh + 40 MB audit records       | no — live writers observed                 |
| **Total in scope** | **1,712.8 MB** | **109,341** |         |                           |                                                  |                                            |

The single largest recoverable block is the two `beco-*-clean-install-verification-20261027`
`node_modules` trees at 500 MB combined — pure `npm ci` output with nothing unique in them.
