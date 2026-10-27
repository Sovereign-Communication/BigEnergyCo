# BigEnergyCo fluent translation review packet

**Status: UNREVIEWED.** This packet contains no reviewer approval, fluency claim, correction, or confidence score.

## Source

- Repository revision: eabb378c2900d4e315eb97845cffef0f5d822ba8
- Source files: assets/js/shared/locales.js and assets/js/shared/home-copy.js
- Coverage: all 436 English-backed string keys in each of Spanish (es), Portuguese (pt), French (fr), German (de), Dutch (nl), and Arabic (ar): 2616 locale/key rows total.
- Arabic rtl=true is recorded in manifest.json; it is direction metadata, not translated copy, so it is not a review row.
- Each locale CSV carries the full source revision and a SHA-256 digest of that locale's exact ordered key/source/translation corpus. Do not edit those fields.

## Review each locale CSV

For every row, replace UNREVIEWED in review_status with APPROVED or NEEDS_CORRECTION. Review meaning against the English source, natural phrasing, grammar, register, locale conventions, and preservation of placeholders, units, and quantities. If a change is needed, fill suggested_correction and explain it in reviewer_notes. Keep current_translation unchanged so the reviewed text remains auditable. If the key lacks enough product context, record the question in reviewer_notes; do not guess.

Fill one row per locale in signoff.csv. Enter the actual reviewer's name and factual basis for fluency, review date in UTC, exact source revision, and number of keys personally reviewed. In reviewer_signoff, the reviewer should attest that they personally reviewed every row for that locale against its English source and recorded all identified corrections. A person reviewing multiple locales should complete a separate signoff row for each. Leave signoff blank until the human review is complete.

Do not enter a numeric confidence. Do not use model output as a substitute for fluent human review. This packet does not change locale data or Jev thresholds.

## Return

Return the six completed locale CSVs, the completed signoff.csv, and the unchanged manifest.json. Keep each locale's source revision and corpus digest intact. If either differs from the required values in signoff.csv, the packet is stale and must be regenerated from the new reviewed source before it can support gate evidence. Suggested corrections are review findings only; they are not applied to the product by this packet.
