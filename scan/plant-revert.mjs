// Plant a false fact in the committed artifacts, capture the gate's named
// failure, revert byte-for-byte, and prove the widened check does not fire on
// the truthful tree.
//
// This is the pass's evidence that the gate bites through the REAL wiring —
// npm run seo / the committed record and probe — rather than only through the
// PROSE_OVERRIDE fixtures tests/evidence-freshness.test.mjs mutates.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = "C:/tmp/gate-freshness";
const RECORD = `${ROOT}/evidence/advisor-and-release.json`;
const PROBE = `${ROOT}/evidence/production-probe.json`;

const gate = () => {
  try {
    const out = execFileSync(
      process.execPath,
      ["scripts/check-evidence-freshness.mjs"],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout || ""}${e.stderr || ""}` };
  }
};

const original = { record: readFileSync(RECORD), probe: readFileSync(PROBE) };
const restore = () => {
  writeFileSync(RECORD, original.record);
  writeFileSync(PROBE, original.probe);
};

const plants = [
  {
    what: "the record's original production sentence, verbatim",
    plant: () => {
      const p = JSON.parse(readFileSync(RECORD, "utf8"));
      p.smoke_note = p.smoke_note.replace(
        /Production is measured:.*$/s,
        "PRODUCTION IS BEHIND THIS TREE AND HAS NOT BEEN RE-VERIFIED: the " +
          "deployed build is at servedStamp 20260925c and this tree ships " +
          "20261005c, and no deploy has been made from this branch because that " +
          "needs the owner's Cloudflare credentials.",
      );
      writeFileSync(RECORD, `${JSON.stringify(p, null, 2)}\n`);
    },
    expect: /states asset stamp 20260925c/,
  },
  {
    what: "a production block that retypes the served stamp",
    plant: () => {
      const p = JSON.parse(readFileSync(RECORD, "utf8"));
      p.production.served_stamp = "20260925c";
      writeFileSync(RECORD, `${JSON.stringify(p, null, 2)}\n`);
    },
    expect: /production\.served_stamp is "20260925c", but the probe measured/,
  },
  {
    what: "a probe of a tree that is not this one",
    plant: () => {
      const p = JSON.parse(readFileSync(PROBE, "utf8"));
      p.tree_stamp = "20260925c";
      writeFileSync(PROBE, `${JSON.stringify(p, null, 2)}\n`);
    },
    expect: /was measured against tree stamp 20260925c, but this tree ships/,
  },
  {
    what: "a production block dated before the probe that measured it",
    plant: () => {
      const p = JSON.parse(readFileSync(RECORD, "utf8"));
      p.production.measured_at = "2026-10-01T00:00:00.000Z";
      writeFileSync(RECORD, `${JSON.stringify(p, null, 2)}\n`);
    },
    expect: /production\.measured_at is 2026-10-01T00:00:00\.000Z, but evidence/,
  },
];

const before = gate();
console.log(`truthful tree first: exit ${before.code} (${before.out.trim().split("\n").pop()})`);
if (before.code !== 0) {
  console.error("the truthful tree already fails; not a valid baseline");
  process.exit(1);
}

let bad = 0;
for (const { what, plant, expect } of plants) {
  plant();
  const r = gate();
  const hit = r.out.match(/^FAIL .*$/m) || [];
  const named = expect.test(r.out);
  console.log(`\nPLANTED ${what}`);
  console.log(`  exit ${r.code}${r.code !== 0 ? " (red as required)" : " (NOT RED)"}`);
  console.log(`  named  : ${named ? "yes" : "NO"} ${expect}`);
  console.log(`  first  : ${hit[0] || "(no FAIL line)"}`);
  if (r.code === 0 || !named) bad += 1;
  restore();
}

const after = gate();
const sameBytes =
  Buffer.compare(readFileSync(RECORD), original.record) === 0 &&
  Buffer.compare(readFileSync(PROBE), original.probe) === 0;
console.log(
  `\nafter revert: exit ${after.code}, artifacts byte-identical to before: ${sameBytes}`,
);
if (after.code !== 0 || !sameBytes) bad += 1;
console.log(bad ? `\nPLANT/RECOVER FAILED (${bad})` : "\nPLANT/RECOVER OK");
process.exit(bad ? 1 : 0);
