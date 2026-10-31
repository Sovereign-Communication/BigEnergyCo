## Post-merge measurement on `43f5378b` — and what it proves

Everything except `jev-complete` is green on that merge: 97.50 → **95.50**, hard gates green, **5/21 facets proven**, 0/21 at the 0.95 confidence bar, max confidence 0.87.

The useful part is the paired comparison against the immediately preceding main (`4a5a6689`):

| facet | before | after | evidence text |
| --- | --- | --- | --- |
| design | 100 | 85 | byte-identical |
| correctness | 100 | 85 | byte-identical |
| security | 100 | 85 | byte-identical |
| docs | 100 | 85 | byte-identical |
| release | 100 | 85 | byte-identical |
| translation | 60 | 35 | byte-identical (261 chars both runs) |
| experience | 100 | 85 | changed by #171 |

Six facets lost 15 points and translation lost 25 on unchanged evidence within one day. Whatever else is true, an all-facets-95 rule is partly adjudicating judge noise, and a translation floor of 60 would be violated by the 35 reading that arrived with no evidence change at all.

The draft now records this table, names translation's measured range (35–60) instead of a single figure, and keeps the same three decisions. No gate code, threshold, or amendment chain is touched.
