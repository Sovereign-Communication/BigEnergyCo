# Master plan amendments

Append-only log of changes to `docs/plan/MASTER_PLAN.md` (see §16 of the
plan). Each entry chains the plan's SHA-256 from the adopted genesis hash to
the hash pinned in `docs/plan/PLAN.lock.json`; `npm run plan:check` rejects a
broken chain, a missing approver, or any rewrite of an earlier entry.

No amendments yet: the plan is at its genesis hash.
