## Post-merge audit note — 2026-10-22

The main-audit run for merge commit `4c828a3d` failed because I supplied the custom subject `Merge PR #260: unify blog article styles`. The audit recognizes the repository's standard GitHub merge-commit form; this custom subject caused the merge and its commit to be reported as two unassociated pushes. PR #260 itself had all required checks green and was merged through GitHub, but the main-audit check on that push is red.

I will use GitHub's default merge subject on subsequent PR merges so the audit can identify the delivery path. The next main push will rerun the audit against that push range; I will verify its result before treating main CI as green. No history rewrite or direct push to main is being made.