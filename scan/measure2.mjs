// Measure the corrected record texts against the clips that carry them,
// including every branch the generated smoke verdict can take.
import { COMPLETE_FACET_CLIP } from "file:///C:/tmp/gate-freshness/scripts/lib/jev-complete.mjs";

const compared = 366;
const specialNames = "_headers and _redirects";
const PARITY =
  `${compared} allowlist entries compared byte-for-byte, all identical ` +
  `(${specialNames} are surface rules, not bytes)`;
const PARITY_SHORT =
  `${compared} allowlist entries byte-identical ` +
  `(${specialNames} as surface rules, not bytes)`;

const SMOKE_NOTE =
  "The browser smoke runs {{smoke_gates_total}} gates; measured this run: " +
  "{{smoke_gates_passed}} pass, {{smoke_gates_failed}} fail. The count is " +
  "written by the gate reporter (scripts/smoke/runtime.mjs), not typed here. " +
  "Production is measured, not asserted: " +
  PARITY +
  "; evidence/production-probe.json carries each surface's smoke verdict.";

const CORRECTNESS =
  "the promote gate refuses to deploy unless staging serves the checkout's " +
  "stamp at full byte parity with the smoke passing. Re-measured live: " +
  `${compared} allowlist entries byte-identical, ${specialNames} as surface ` +
  "rules, not bytes; no ledger release records that build.";

const verdicts = {
  "both green": "both smoke legs green",
  "pages only": "Pages' smoke green, the brand's not",
  "brand only": "the brand's smoke green, Pages' not",
  "neither": "no smoke leg green",
};
const RELEASE = (verdict) =>
  "releases #141/#142, #144, #146-#148 dated in release-ledger.jsonl. Live: " +
  PARITY_SHORT +
  "; brand serves the app past its challenge (F-44), parity unmeasurable " +
  "(403); " +
  verdict +
  ".";

const rows = [
  ["smoke_note", SMOKE_NOTE, 460],
  ["correctness", CORRECTNESS, COMPLETE_FACET_CLIP],
];
for (const [name, text, clip] of rows)
  console.log(
    name.padEnd(12),
    String(text.length).padStart(4),
    "/",
    clip,
    text.length <= clip ? "OK" : `OVER by ${text.length - clip}`,
  );
for (const [label, verdict] of Object.entries(verdicts)) {
  const text = RELEASE(verdict);
  console.log(
    `release(${label})`.padEnd(22),
    String(text.length).padStart(4),
    "/",
    COMPLETE_FACET_CLIP,
    text.length <= COMPLETE_FACET_CLIP ? "OK" : `OVER by ${text.length - COMPLETE_FACET_CLIP}`,
  );
}
