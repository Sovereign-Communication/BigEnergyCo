// Measure candidate record texts against the transport clips that carry them.
import { COMPLETE_FACET_CLIP } from "file:///C:/tmp/gate-freshness/scripts/lib/jev-complete.mjs";

const P =
  "The browser smoke runs {{smoke_gates_total}} gates; measured this run: " +
  "{{smoke_gates_passed}} pass, {{smoke_gates_failed}} fail. The count is written " +
  "by the gate reporter itself (scripts/smoke/runtime.mjs), not typed here. ";

const smoke =
  P +
  "Production is measured: Pages serves this tree's stamp at whole-allowlist " +
  "parity, the ledger records no release of it, and each surface's smoke verdict " +
  "is a field in evidence/production-probe.json, not a sentence here.";

const corr =
  "the gate is the promote, which refuses to deploy unless staging serves the " +
  "checkout's stamp at full byte parity with the smoke passing. Re-measured live: " +
  "Pages serves this tree's stamp at whole-allowlist parity, and the ledger " +
  "records no release of that build.";

const rel =
  "advisor fix #141, shipped #142; P0.1-P0.3b #144, #146-#148, dated in " +
  "release-ledger.jsonl. Production re-measured live: Pages serves this tree's " +
  "stamp at whole-allowlist parity; the brand serves the app past its challenge " +
  "(F-44), parity unmeasurable there (403), smoke not green.";

const cases = [
  ["smoke_note", smoke, 460],
  ["correctness", corr, COMPLETE_FACET_CLIP],
  ["release", rel, COMPLETE_FACET_CLIP],
];
for (const [name, text, clip] of cases) {
  console.log(
    name.padEnd(12),
    String(text.length).padStart(4),
    "/",
    clip,
    text.length <= clip ? "OK" : `OVER by ${text.length - clip}`,
  );
}
