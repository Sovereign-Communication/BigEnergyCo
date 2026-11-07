# Verdict input packet - 2026-11-06

For the **non-author read** that confirms the G1 cure and accepts or rejects the
six gap dispositions in
`docs/lane/PRESERVATION-CONFORMANCE-2026-11-05.md`. That read sits with the GPT
slow lane; this packet exists so the read is mechanical rather than
archaeological. Every item below is a claim, the read that produced it, and the
command that reproduces the read.

**This packet is not a verdict and issues no ALL-CLEAR.** It is the producer
handing over its evidence in the form the reviewer needs, which is the only move
available to a producer under protocol point 7.

## 1. The one item that needs a confirming character-level read

Row G1 said the `-bak` pair was "proven unrecoverable". The review required this
replacement wording, verbatim (103 characters, ending in a full stop):

```
Unrecovered: no matching copy found through the documented checks; carried as a known preservation gap.
```

Reproduce the check (no paraphrase, no reading):

```bash
node -e '
const s=require("fs").readFileSync("docs/lane/PRESERVATION-CONFORMANCE-2026-11-05.md","utf8");
const req="Unrecovered: no matching copy found through the documented checks; carried as a known preservation gap.";
const i=s.indexOf("| G1 "), j=s.indexOf(req);
console.log("exact:", s.slice(j,j+req.length)===req, "inside G1 row:", j>i && j<s.indexOf("\n",i),
            "retired phrase count:", (s.match(/proven unrecoverable/g)||[]).length);
'
```

Expected: `exact: true inside G1 row: true retired phrase count: 0`.

What is **not** asserted anywhere in the sheet any more: that the loss is proved
unrecoverable. What is asserted: no matching copy was found through the
documented checks. Those are different claims, and the second is the one the
evidence supports.

## 2. The six rows, and the read behind each

| Row                        | State claimed  | Read to confirm (2026-11-06)                                                                                                                                                                                                                                                                                                  |
| -------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1 `-bak` pair             | DECISION-READY | wording check above; `stat` on both `C:/tmp/car2-bak/cities.js` and `C:/tmp/car4-bak/frontier.js` (absent); no historical blob under either path carries the lost sizes 20,722 B / 24,977 B (`git rev-list --all --objects` + `git cat-file --batch-check` over 393 blobs); `git cat-file -t a964fc51` / `1a6da8de` both fail |
| G2 unreadable entries      | DECISION-READY | `docs/lane/temp-verify-20261101/scan-errors.log` reads `files visited: 1489174`, `errors: 8899`; the 7,268 / 1,631 split is the 2026-11-01 derivation re-read from `STATE-2026-11-01.md:158-159` and is labelled as carried, not recomputed                                                                                   |
| G3 repo-scoped transcripts | DECISION-READY | 10 files, 3.8 MB at `%USERPROFILE%/.claude/projects/C--Users-SCM-Documents-GitHub-BigEnergyCo` (recursive `find -type f` + `du -sh`)                                                                                                                                                                                          |
| G4 showcase transcripts    | DECISION-READY | 4 files, 76 KB in the `-showcase` sibling                                                                                                                                                                                                                                                                                     |
| G5 machine-wide root       | DECISION-READY | `du -sh %USERPROFILE%/.claude` = 751 MB, measured 2026-11-06 (was a carried 2026-11-03 number)                                                                                                                                                                                                                                |
| G6 audit-sim fixtures      | CLOSED         | `scripts/make-audit-sim-fixture.mjs` + `tests/audit-sim-fixture.test.mjs`; `node --test tests/audit-sim-fixture.test.mjs` = 5/5, and two runs give one tip SHA                                                                                                                                                                |

Two states deserve the reviewer's attention because they are the ones a producer
is most likely to have rounded up:

- **G2's split is carried, not recomputed.** The log has the total only. If the
  review wants the 7,268 / 1,631 split to be current, it needs the re-scan the
  row already names as the lane's A-06 route (due 2026-11-19).
- **G6 is closed on a generated fixture, not on the two `C:/tmp` directories.**
  The directories remain in place and untouched; what changed is that they are
  no longer the only copy of the idea, so their loss would cost a regeneration,
  not a preservation.

## 3. What this packet cannot answer, and will not pretend to

1. Whether the reviewer **confirms** the G1 cure. The producer's byte comparison
   is evidence for that read, not the read.
2. Whether the six states are **accepted**.
3. The owner dispositions that remain: G3/G4 (push as an out-of-repo artifact, or
   accept the single-machine copy), G1 (whether reconstruction is worth a
   session), G2 (whether a byte-level walk is wanted or the stated boundary
   stands).
4. The ALL-CLEAR itself.

## 4. If the review rejects a row

Name the row and the failing read; the lane re-opens that row and cures it on its
next pass. A rejected row does not re-open the others, and nothing here is
worded to make a rejection expensive.

Sheet head for this packet: `lane/finish` `0165f2c1e`.

GATE: local pass (decision-signal) - verdict-input packet scope (hand over the
producer's evidence; claim no verdict) - checks 1-5 clean
