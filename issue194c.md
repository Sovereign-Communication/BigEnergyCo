## Post-#171 gate measurement on main `43f5378b` — the score moved, the evidence did not

Main `43f5378b` (Tests run `39955130960`) is green on every check except `jev-complete`: 95.50/100, hard gates green, 5/21 facets proven, 0/21 at the 0.95 confidence bar, max confidence 0.87.

Compared with the immediately preceding main (`4a5a6689`): design, correctness, security, docs and release each fell 100 → 85 on byte-identical evidence; translation fell 60 → 35 on a byte-identical 261-character line; experience fell 100 → 85 where the only text difference was a measured timing digit (83ms → 82ms). #171 changed composed lines only for accessibility (more detailed, and still 85), experience (same content), privacy, performance and quality.

So the 2-point score drop and the six-ordinal drop are judge variance, not a product regression. That is now recorded with the paired table in #292, which is the vehicle for the decision it implies: an all-facets-proven staging rule is partly adjudicating noise, and the 0.95 confidence clause cannot be met at all.
