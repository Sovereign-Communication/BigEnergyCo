## Inventory reconcile — 2026-10-23

The 2026-10-21 inventory listed 18 open PRs. The queue is now two, and every branch that carried the rest landed or was closed with a recorded disposition.

| PR | state | disposition |
| --- | --- | --- |
| #292 | draft, owner approval pending | B1 staging-policy proposal. No code or threshold change; stays draft until the owner records approval. |
| #171 | open, CI running on `e32eab45` | Repaired: pinned-budget reset on the cut preview, and two missing smoke-harness bindings (`gatesSince`, `reportCheckpoint`) that killed the accessibility flow. Merge on green. |

Merged since 2026-10-21 (the #287 program): #288 evidence stability, #289 performance evidence, #290 quality consolidation, #291 rendered-locale snapshots, #294 deterministic translation evidence. Closed with evidence: #293 (facet-specific proof criteria, measured as worse than the generic labels).

Also closed earlier in this mission: #248, #239, #244, #247, #243, #242, #235, #252, #255.

The only remaining blocker to "zero open PRs" is an owner decision on #292, not a branch with unlanded work.
