# Preservation conformance sheet - 2026-11-05

Lane `lane/finish` (standing draft PR #330, tracker #145). Built under R1 + R7 of
the 2026-11-04 dissemination directive: a conformance sheet is one row per
preservation item carrying the item, its receipt, its disposition and the date its
state was last verified. **Gaps are rows, not prose.**

This sheet is evidence. It is **not** acceptance: the Claude-removal ALL-CLEAR
stays UNISSUED until a **non-author verdict** lands on this sheet (see the last
section). No part of this document may be read as an ALL-CLEAR.

Every row below was re-read in the 2026-11-05 session; where a read is the prior
session's, the row says so. Reads are named per the lane's house rule,
`(read: <method>, <timestamp>)`.

## A. Preserved items

| ID   | Item                                                  | Receipt (where the content provably lives)                                                                                            | Disposition                    | Verified 2026-11-05 (read)                                                                                                                                                                                   |
| ---- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P-01 | 47 local-only audit branches                          | `mission/branch-tips-20261101/*` on the remote, 47 refs                                                                               | PUSHED, tip-equal              | 47 of 47 equal, 0 differ, 0 unmapped (read: `git ls-remote --heads origin` + `git rev-parse refs/heads/<b>` per branch, 2026-11-05)                                                                          |
| P-02 | `docs/ledger-p1-3` substance (54 files, `+6116/-130`) | `mission/preserve-ledger-p1-3-substance-20261103` = `99e932e18d74eaa29b3a42f6422de419e3d99f61`                                        | PUSHED                         | Ref present at the recorded tip (read: `git ls-remote --heads origin`, 2026-11-05)                                                                                                                           |
| P-03 | stash `82b70c8f` (3 files, `+3965/-3664`)             | `mission/preserve-stash-82b70c8f-20261010` = `2f18b5a0bda0241cffc6f0323d30bcc63f1f073f`                                               | CONVERTED, stash retained      | Ref present at the recorded tip (read: `git ls-remote --heads origin`, 2026-11-05); tree-vs-stash equality is the 2026-11-03 read, not re-run here                                                           |
| P-04 | PR #171 worktree mid-merge WIP                        | `mission/preserve-beco-pr171-squash-worktree-20261103` = `fbb6f1aa0b88639ec663c84986e4e30cec91b32b`                                   | PUSHED                         | Ref present at the recorded tip (read: `git ls-remote --heads origin`, 2026-11-05)                                                                                                                           |
| P-05 | `.claude/settings.local.json` (1,689 B)               | `claude-config-archive/settings.local.json` + `MANIFEST.md` sha256 `c5375af9e05ab9bdc326cac5cfe55d073d16936785319b8e90f82dbcd99f1b95` | ARCHIVED, NOT PUSHED BY DESIGN | Archive file present at 1,689 B, source still present at 1,689 B, `claude-config-archive/` excluded at `.git/info/exclude:9` (read: filesystem `ls -la` + `grep`, 2026-11-05). Residual: single-machine copy |
| P-06 | Whole-disk sweep statement                            | `docs/lane/allclear-2026-11-03.md`, tracked on `lane/finish`                                                                          | INTEGRATED                     | Tracked in the lane tree (read: `git ls-tree`, 2026-11-05)                                                                                                                                                   |
| P-07 | `_inline.js` owner hold (55,198 B)                    | `docs/preserve/ctmp-owner-staged/_inline.js` on `99e932e18`                                                                           | PUSHED, content-identical      | sha256 `2619aabf...f317918` on both sides after LF normalisation; 933 lines both sides; the 933-byte delta is one CR per line (read: `git cat-file -p` + `sha256sum`, 2026-11-05)                            |
| P-08 | `v0.5.0-release-notes.md` owner hold (12,966 B)       | `docs/notes/v0.5.0-release-notes.md`                                                                                                  | INTEGRATED                     | Tracked in the lane tree (read: `git ls-tree -r HEAD`, 2026-11-05)                                                                                                                                           |
| P-09 | `C:/tmp` file set, incl. root scratch                 | `mission/preserve-c-tmp-files-20261030` = `bb2faa2813ebc5f28a86cb5cc41e8bdc3ffb56dc`                                                  | PUSHED                         | Ref present at the recorded tip (read: `git ls-remote --heads origin`, 2026-11-05)                                                                                                                           |
| P-10 | `C:/tmp` dangling-object set (car1)                   | `mission/preserve-c-tmp-20261030-beco-car1-dangling` = `c111cd004271557bfe8b55fb4d7529a34cdfd640`                                     | PUSHED                         | Ref present at the recorded tip (read: `git ls-remote --heads origin`, 2026-11-05)                                                                                                                           |
| P-11 | `C:/tmp` dangling-object set (car5b)                  | `mission/preserve-c-tmp-20261030-beco-car5b-dangling` = `907ed499f3d39d89d111e17b88daa911ee052464`                                    | PUSHED                         | Ref present at the recorded tip (read: `git ls-remote --heads origin`, 2026-11-05)                                                                                                                           |
| P-12 | Ledger branch archive                                 | `archive/20261021/branch/docs/ledger-p1-3` = `5d002fd383c3f6373c86bde68ce6d0831595d945`                                               | PUSHED                         | Ref present at the recorded tip (read: `git ls-remote --heads origin`, 2026-11-05)                                                                                                                           |
| P-13 | Review packets                                        | `mission/preserve-review-packets-20261101` = `e69f4d2468dec698072701e494ae968177919a3a`                                               | PUSHED                         | Ref present (read: `git ls-remote --heads origin`, 2026-11-05)                                                                                                                                               |
| P-14 | p95 off-grid/grid-tie working branch                  | `mission/p95-offgrid-gridtie-20261023` = `c4b890f77a9e3ea8e655a1e0d8bcdf78650e8346`                                                   | PUSHED                         | Ref present (read: `git ls-remote --heads origin`, 2026-11-05)                                                                                                                                               |
| P-15 | PR #321 worktree WIP                                  | `C:/tmp/be-jev-burndown-20261026` @ `ae3074ca758b276a04e4e9c6798c3bc82ac99682`; branch is the PR head and is on the remote            | HELD ABSOLUTELY (owner)        | Worktree present, HEAD at the recorded tip, working tree clean (read: `git -C ... rev-parse HEAD` + `status --porcelain`, 2026-11-05). Not touched, not moved                                                |
| P-16 | `beco-pr171-squash-20261023` worktree WIP             | The same content as P-04 on the remote                                                                                                | PUSHED (via P-04)              | Worktree present (read: filesystem `-e`, 2026-11-05); not modified                                                                                                                                           |

## B. The six known gaps

The 2026-11-04 readiness dispatch names "six known gaps" without enumerating
them. This sheet does not invent a sixth to match the number and does not shrink a
seventh to fit it: the set below is derived from the preservation record by one
stated rule, and the temp-surface purge is recorded separately because the same
dispatch holds it behind its own approval (row H-1).

Rule applied: a gap is a preservation item that is **neither** pushed to a durable
remote ref with a receipt, **nor** integrated into canonical, **nor** proven
regenerable by a committed generator. Under that rule the record yields exactly
the six rows below.

| ID  | Gap                                                                                                                                       | Why it is a gap (the durability test it fails)                                                                                                                                                                                                                                                                                                               | Verified 2026-11-05 (read)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Curing path / owner                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | `-bak` pair: `C:/tmp/car2-bak/cities.js` (blob `a964fc51`, 20,722 B), `C:/tmp/car4-bak/frontier.js` (blob `1a6da8de`, 24,977 B)           | Unrecovered: no matching copy found through the documented checks; carried as a known preservation gap. Not pushed, not integrated, and not shown to be regenerable. The cited checks (size-exact + git blob SHA-1 gate, VSS shadow-copy probe) establish only that no matching copy was found through them, which is not the same as proof that none exists | Both paths absent, directories absent (read: `stat` per path, 2026-11-05; re-read 2026-11-06). The pair's content is also absent from git history: no blob under `assets/js/sizing/cities.js` or `assets/js/sizing/frontier.js` has the lost sizes 20,722 B / 24,977 B (read: `git rev-list --all --objects` + `git cat-file --batch-check` over all 393 historical blobs for those paths, 2026-11-06), and the two recorded blob SHAs `a964fc51` / `1a6da8de` are not objects in this clone (`git cat-file -t`, 2026-11-06) | NOT curable by preservation. Carried as a known loss; owner's call whether any reconstruction is worth a session                                                                                                                                                                                                                                                                                                                 |
| G2  | 8,899 unreadable entries in the 2026-11-01 profile walk (7,268 permission-denied across other accounts' junctions, 1,631 path-not-found)  | The sweep's own boundary. Absence of a BigEnergyCo artifact inside those entries is UNPROVEN, so the ALL-CLEAR is a name-bounded claim, not a byte-level one                                                                                                                                                                                                 | Log headline re-read 2026-11-06: `files visited: 1489174` / `errors: 8899`, and the log records the two unreadable accounts by name (`muse-sbx-r1`, `muse-sbx-u1`). The 7,268 / 1,631 split is the 2026-11-01 session's derivation, re-read from `STATE-2026-11-01.md:158-159` and NOT recomputed - the log itself carries only the 8,899 total                                                                                                                                                                              | Lane can re-run the error scan for this repo's names by 2026-11-19 (register row A-06); a full byte-level walk needs owner-approved elevation                                                                                                                                                                                                                                                                                    |
| G3  | Repo-scoped Claude session transcripts: `%USERPROFILE%/.claude/projects/C--Users-SCM-Documents-GitHub-BigEnergyCo` (3.8 MB, 10 files)     | Third-party tool state, classified as not-repo-work-product, therefore never pushed: it exists on this machine only                                                                                                                                                                                                                                          | Present, 10 files, 3.8 MB - unchanged from the 2026-11-03 record (read: recursive `find -type f` + `du -sh`, 2026-11-05; re-read 2026-11-06: 10 files, 3.8 MB)                                                                                                                                                                                                                                                                                                                                                               | Classification is the disposition; if the owner wants it durable, it must be pushed as an out-of-repo artifact                                                                                                                                                                                                                                                                                                                   |
| G4  | Showcase-scoped transcripts: `.../C--Users-SCM-Documents-GitHub-BigEnergyCo-BigEnergyCo-showcase` (76 KB, 4 files)                        | Same class as G3: single-machine copy, never pushed                                                                                                                                                                                                                                                                                                          | Present, 4 files, 76 KB (read: recursive `find -type f` + `du -sh`, 2026-11-05; re-read 2026-11-06: 4 files, 76 KB)                                                                                                                                                                                                                                                                                                                                                                                                          | Same as G3                                                                                                                                                                                                                                                                                                                                                                                                                       |
| G5  | Machine-wide Claude state: `%USERPROFILE%/.claude` root (`settings.json`, `.claude.json*`, history, cache; 751 MB at the 2026-11-03 read) | Shared by every project on this laptop, so it is neither this repo's footprint nor preserved; it is unpreserved third-party state                                                                                                                                                                                                                            | Directory walk performed 2026-11-05 only for the three repo-scoped project dirs (G3, G4 and the empty `-BigEnergyCo-BigEnergyCo` dir: present, 0 files); the 751 MB root total was measured again on 2026-11-06 and still reads 751 MB (`du -sh`), so it is now a current read rather than a carried one                                                                                                                                                                                                                     | Out of this repo's scope. Recorded so the ALL-CLEAR's boundary is honest                                                                                                                                                                                                                                                                                                                                                         |
| G6  | `C:/tmp/audit-sim` (`cc53113f30c90f9c458ef8afe908af2da9b81647`) and `C:/tmp/audit-sim3` (`13c9c70bf3d579eda88b8b573b8252378a944411`)      | Fabricated audit fixtures (`Merge pull request #999`, `#9999`). GitHub rejects the tips (422) so they are not pushed; "reproducible scaffolding" was asserted in the 2026-11-03 record but no committed generator proves it                                                                                                                                  | Both present at the recorded tips, with the fabricated merge subjects still in place (read: `git -C ... rev-parse HEAD` + `log --oneline -1`, 2026-11-05)                                                                                                                                                                                                                                                                                                                                                                    | **DONE 2026-11-06.** Generator committed at `scripts/make-audit-sim-fixture.mjs`, with `tests/audit-sim-fixture.test.mjs` running it: the fixture is rebuilt from source, its tip SHA is identical across two runs (deterministic), and the fabricated merge still hides the pulled non-documentation commit from `prDeliveredShas` while `directPushVerdict` still blocks the same change pushed directly. Row CLOSED - see B.2 |

### B.2 Gap ledger, 2026-11-06 (state, receipt, and what remains)

Every row of section B above carries exactly one state below. No gap is
unlabelled, and no state here is asserted without the read that produced it.
The three states are: **CLOSED** (the durability test is met), **DECISION-READY**
(everything the owner or a non-author needs to decide is assembled; nothing in
the lane can advance it further), and **OPEN** (a lane action is still possible).

| ID  | State          | One-line receipt (2026-11-06)                                                                                                                                                                                                                                                             | What remains / who                                                                                                                 |
| --- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| G1  | DECISION-READY | Wording verdict PASS: the reviewer's 103-character sentence matches byte-for-byte at the G1 row (offset 148) and the retired phrasing (the claim that the loss was _proved_ unrecoverable) appears 0 times; no historical blob for either path carries the lost sizes; both paths absent. | Owner only: whether reconstruction from the last committed versions is worth a session. Nothing in the lane can recover the bytes. |
| G2  | DECISION-READY | `scan-errors.log` re-read: 1,489,174 files visited, `errors: 8899`, and the two unreadable accounts named; the 7,268 / 1,631 split is the 2026-11-01 derivation, re-read from the STATE doc, not recomputed.                                                                              | Owner-approved elevation for a byte-level walk. The lane's own narrower route is the A-06 name-bounded re-scan, due by 2026-11-19. |
| G3  | DECISION-READY | Repo-scoped transcripts re-measured: 10 files, 3.8 MB, present and unchanged.                                                                                                                                                                                                             | Owner: push them as an out-of-repo artifact, or accept the single-machine copy on the record.                                      |
| G4  | DECISION-READY | Showcase transcripts re-measured: 4 files, 76 KB, present and unchanged.                                                                                                                                                                                                                  | Same decision as G3, same owner.                                                                                                   |
| G5  | DECISION-READY | The 751 MB machine-wide root is no longer a carried number: `du -sh` on 2026-11-06 reads 751 MB.                                                                                                                                                                                          | Nothing in this lane's scope. The row exists so the ALL-CLEAR's boundary is stated, not to be closed here.                         |
| G6  | CLOSED         | Generator committed (`scripts/make-audit-sim-fixture.mjs`) and run by `tests/audit-sim-fixture.test.mjs`: 5/5 pass, and two runs produce the identical tip SHA, so the fixture is proven regenerable rather than asserted to be.                                                          | Nothing. The two `C:/tmp` directories are now disposable, subject to the H-1 purge approval.                                       |

GATE: local pass (decision-signal) - gap dispositions (G6 CLOSED, G1-G5
DECISION-READY) and the G1 wording verdict - checks 1-5 clean

What this ledger does not do is shorten the distance to ALL-CLEAR by a
producer's act. Five rows are decision-ready and one is closed; a non-author
verdict on those six states is still the only thing that can issue an
ALL-CLEAR, and it is not this lane's to write.

## C. Separately held (recorded, outside the six)

| ID  | Item                                                                                                        | Disposition                                                  | Verified 2026-11-05 (read)                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| H-1 | Unified temp purge: `C:\tmp` 3,969 files / 180.3 MB, `C:\temp` 122 / 108.2 MB, `%TEMP%` 55,472 / 1,144.3 MB | OWNER-RESERVED, behind its own approval (burndown ledger D8) | All three surfaces measured this session (read: PowerShell recursive `Get-ChildItem -File` + `Measure-Object -Sum Length`, 2026-11-05). Nothing deleted, moved or purged |
| H-2 | PR #321 worktree hold                                                                                       | OWNER-RESERVED, stands regardless of the PR having merged    | See P-15. #321 merged 2026-11-04T00:31:16Z, head `03d5fc94`, base `main` (read: GitHub PR API, 2026-11-05); the hold is unaffected by the merge                          |

## D. ALL-CLEAR status

**NOT ISSUED.** This sheet is the prerequisite, not the verdict.

- The lane's own preservation log is evidence, and self-reported acceptance is
  retired as a mechanism. A producer cannot issue its own ALL-CLEAR.
- Six gap rows (G1-G6) stand above and none is unlabelled: as of 2026-11-06,
  G1-G5 are DECISION-READY and G6 is CLOSED (B.2). G1 is an unrecovered loss
  whose absence is established only through the documented checks, G2 bounds the
  sweep, G3-G5 are single-machine third-party state, and G6's regenerability
  claim is now proven by a committed generator and its test rather than
  asserted.
- What cures the path: an independent (non-author) verifier reads this sheet and
  the sweep statement, accepts or rejects each row's read and disposition, and
  records the verdict here. Until that lands, every statement about Claude
  removal for this repo is a bounded claim, not an ALL-CLEAR.

### Non-author verdict received: CHANGES (2026-11-05T11:27:19Z)

- Verdict: **CHANGES**, confidence 0.88, by the GPT slow lane's independent
  Sol-class review of this sheet at lane head `638295c8`, blob `c8bb3229`.
  Review record: `bigenergyco/reviews/PRESERVATION_CONFORMANCE_2026-11-05.md`
  in `Treystu/slow-lane-ledger` (read: the review's own carry comment on PR
  #330, 2026-11-05T11:27:19Z).
- Corroborated by that review: this sheet's framing (evidence is not acceptance,
  ALL-CLEAR NOT ISSUED, six gaps open, H-1/H-2 owner-reserved) and 47 refs under
  `mission/branch-tips-20261101`, with exact remote SHAs matching this sheet for
  P-02/03/04/09-14.
- Cured in this pass: row G1's wording. It said the pair was "proven
  unrecoverable"; the checks establish only that no matching copy was found
  through them, and the row now says exactly that, with the distinction spelled
  out.
- **The ALL-CLEAR still stands UNISSUED.** A CHANGES verdict is not an
  acceptance, and this lane cannot convert one into the other by curing the
  wording on its own: after the cure the sheet needs a further non-author read
  confirming the change, not the producer's word that it was made.

### G1 wording verification - 2026-11-06

The reviewer's required replacement wording, verbatim (103 characters):

> Unrecovered: no matching copy found through the documented checks; carried as a known preservation gap.

The live sheet's G1 cell, at offset 148 of the row:

> Unrecovered: no matching copy found through the documented checks; carried as a known preservation gap. Not pushed, not integrated, and not shown to be regenerable. ...

**Verdict: PASS.** Character-by-character comparison (`find` on the exact
string, then a byte equality check in Node): the required sentence appears
**103 of 103 characters identical** at its first match, which is inside the G1
row, with no paraphrase, no re-punctuation and no case drift. The only text
after it is the sentence's continuation, which adds the same qualification the
review asked for rather than weakening it. The retired claim (that the loss was
_proved_ beyond recovery) now matches **0 times** in the live sheet; the single
remaining `unrecoverable` is section D's own "G1 is an unrecovered loss", which
is the corrected sense.

Counting note, so a re-reader grepping for the sentence is not misled: a
case-sensitive grep of this file returns **3** matches - the G1 body cell
itself, plus the two block quotations above that reproduce it for this
verification. Only the first is the sheet's live claim; the other two are this
narrative quoting it. That is also why the earlier draft of this paragraph said
"one occurrence", which was accurate about the live claim and imprecise as a
grep count, and is now stated instead of assumed.

Difference from the required wording: none. The superseded 2026-11-03 draft
(`docs/lane/allclear-2026-11-03.md:69`) still carries the old phrasing, left
untouched on purpose because the directive named the sheet; it is named here so
the difference is recorded rather than later discovered.

### Non-author G1 re-read received: PASS WITH NOTES (2026-11-06T21:20:09Z)

The re-read the 2026-11-05 CHANGES verdict asked for has landed, and it was
scoped to exactly what that verdict cured. Recorded here in the reviewer's own
terms:

- Verdict: **PASS WITH NOTES**, by the GPT slow lane, filed at
  `bigenergyco/reviews/PRESERVATION_REREAD_2026-11-06.md` in
  `Treystu/slow-lane-ledger` (read: its carry comment on PR #330,
  2026-11-06T21:20:09Z - the review record itself is in that repo, not this one).
- Scope it actually covers: the cured G1 wording, and this sheet's continued
  NOT-ISSUED posture. It states the required 103-character sentence is present at
  the live PR #330 head `5fb38580` and accurately limits the claim to the
  documented checks.
- What it explicitly does **not** do, in its own words: it "did not
  independently replay every receipt", and G1/G2/G3/G4 still carry owner
  decisions. It issues no ALL-CLEAR.

So this closes item 1 below and only item 1. The sheet is not accepted as a
whole by it, G6's closure has not been second-read, and the owner dispositions
are untouched.

### What stands between the current state and ALL-CLEAR

1. ~~**A non-author re-read confirming the G1 cure.**~~ **DONE 2026-11-06** - PASS
   WITH NOTES, recorded above. This is the read the CHANGES verdict asked for, and
   it was scoped to the cure rather than to the sheet as a whole, which is why it
   does not advance items 2-4.
2. **Non-author acceptance of the six states in B.2** - five decision-ready, one
   closed. A closed row still needs a second pair of eyes to be counted, because
   the row is the producer's own.
3. **Owner dispositions, where the row is the owner's:** G3/G4 (push as an
   out-of-repo artifact, or accept the single-machine copy), G1 (whether a
   reconstruction session is worth running at all), and G2 (whether a
   byte-level walk is wanted, or the stated boundary stands).
4. **Then the verdict itself,** issued by someone who is not this lane.

Nothing on that list is a lane act. That is why the lane reports the sheet as
complete-up-to-verdict rather than waiting silently: the remaining distance is
verdict-shaped, and the only thing a producer can do about it is make the rows
cheap to judge.

## E. What this sheet does not claim

- It does not claim a byte-level forensic walk of the machine. It claims a
  name-bounded profile sweep plus the repo-scoped evidence, with the boundary
  stated as G2.
- It does not re-verify P-03's tree-vs-stash equality or P-05's secret scan;
  those are the 2026-11-03 session's reads and the rows say so.
- It does not re-measure the 751 MB machine-wide Claude root (G5) or re-walk the
  8,899 unreadable entries (G2); both are named as carried reads.
- It issues no ALL-CLEAR, and none may be quoted from it.
