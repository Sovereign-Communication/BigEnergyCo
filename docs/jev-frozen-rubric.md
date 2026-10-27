# Jev Frozen-Rubric Before/After Pattern

Convention for measuring change with Jev: freeze the rubric BEFORE the work,
run it after, and report the delta. This prevents moving the goalposts.

## The pattern

1. **Freeze the rubric**: Write the assessment questions, criteria, and scoring
   rubric BEFORE any work begins. Commit it. The rubric must not change
   between before and after runs.
2. **Run "before"**: Execute the audit against the current state. Save the
   JSON output with a timestamp. These are the baseline numbers.
3. **Do the work**: Implement the changes.
4. **Run "after"**: Execute the SAME audit (same rubric, same questions)
   against the new state. Save the JSON output.
5. **Report the delta**: Show before → after for each facet. The delta is
   the honest measure of improvement.

## Why frozen matters

If the rubric changes between runs, the delta is meaningless. A "before: 1.5,
after: 3.2" claim is only valid if both used identical questions and criteria.
Freezing prevents:

- Tightening the rubric after to make the improvement look bigger
- Loosening the rubric before to make the baseline look worse
- Asking different questions that aren't comparable

## Example: Netherlands readiness audit

`~/workspace/bigenergyco-blog/jev-readiness-audit.py` implements this pattern:

- `jev-readiness-audit-before-2026-10-16.json`: baseline (NL 1.49/4, world 1.99/4)
- Run `python3 jev-readiness-audit.py after` once Dutch is live in prod
- The delta measures the actual impact of shipping the Dutch locale

## For other repos

SCMessenger and harness lanes should adopt this pattern for their own
before/after assessments. The key is: **freeze first, then measure twice**.
