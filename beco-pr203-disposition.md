## Disposition — superseded after current-main work sweep (2026-10-22)

No unique canonical implementation remains to import from this PR.

- MASTER_PLAN D-16 is implemented on current main by the single registry in assets/js/sizing/usecases.js. scripts/check-usecases.mjs passes its six-case end-to-end walk and verifies distinct metrics, all 14 controls, the shared chooser, and honest not-here states. tests/usecases.test.mjs covers reserve floor, outage coverage distributions, reserve release, and portable runtime/shore-power behavior.
- The added tests here duplicate weaker formulas or assert copied calculations rather than exercising the current worker and use-case engine. The added NASA privacy test is covered by the shared rounded-coordinate policy, tests/privacy.test.mjs, and scripts/check-privacy.mjs; the current gate confirms NASA POWER and Nominatim only receive 0.01-degree coordinates.
- The only unique visitor copy, financeOwnNote, makes unsourced absolute claims that leasing always costs more, ownership pays back in a few years, and power is then free. The plan requires generic purchase paths; it does not require that financial advice. I did not import it.
- The provenance edits remove a current documented assumption and promote an unsupported installed-cost grade. I did not import those changes.

The current main use-case and static privacy gates passed during this audit. Closing this PR records supersession; it does not claim a new plan item or phase complete.
