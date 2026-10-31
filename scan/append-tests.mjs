// Append the 2026-10-13 mutation tests to tests/evidence-freshness.test.mjs.
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "C:/tmp/gate-freshness/tests/evidence-freshness.test.mjs";
let text = readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");

// 1. The mutation helper gains an env escape hatch, so a rule that reads a
//    second file can be pointed at a fixture too.
// Exactly two lines change: the helper may take extra env, and it passes it
// through to the gate. Everything else in it stays byte-identical.
for (const [from, to] of [
  ["function gateAgainst(mutate) {", "function gateAgainst(mutate, env = {}) {"],
  [
    "env: { ...process.env, PROSE_OVERRIDE: file },",
    "env: { ...process.env, PROSE_OVERRIDE: file, ...env },",
  ],
]) {
  const count = text.split(from).length - 1;
  if (count !== 1) {
    console.error(`expected one occurrence of ${JSON.stringify(from)}, found ${count}`);
    process.exit(1);
  }
  text = text.replace(from, to);
}

// 2. deployList, for the manifest rule.
text = text.replace(
  'import { parseCounts, measurementFrom } from "../scripts/run-tests.mjs";',
  'import { parseCounts, measurementFrom } from "../scripts/run-tests.mjs";\nimport { deployList } from "../scripts/lib/deploy-manifest.mjs";',
);

const appended = `

// ── the 2026-10-13 widening ────────────────────────────────────────────────
// Every rule below exists because the audit found a stated fact about the build
// or about production that nothing in this pipeline read: three facet proof
// lines named a build three releases old, the staged-manifest half of rule 2
// compared its claim to nothing at all, and the record's one sentence about
// production was typed by hand and never measured. Each rule is mutation-checked
// here — a claim the tree disagrees with must fail and must fail NAMING what it
// was compared against — and each is also checked from the other side, because a
// rule that fires on a truthful fact is worse than no rule.

const PROBE = join(ROOT, "evidence", "production-probe.json");
const probe = JSON.parse(readFileSync(PROBE, "utf8"));
const committed = JSON.parse(readFileSync(PROSE, "utf8"));
const ledgerRecords = readFileSync(
  join(ROOT, "docs", "release-ledger.jsonl"),
  "utf8",
)
  .trim()
  .split("\\n")
  .map((line) => JSON.parse(line));
const lastRelease = ledgerRecords
  .filter((r) => typeof r.stamp === "string")
  .pop().stamp;
const servedByProbe = probe.targets.find(
  (t) => t.name === committed.production.target,
).served_stamp;

test("a stale build identity in a facet proof line fails the gate", () => {
  const r = gateAgainst((p) => {
    p.facet_evidence.seo = p.facet_evidence.seo.replace(
      /2026\\d{4}[a-z]/,
      "20260925c",
    );
  });
  assert.notEqual(r.code, 0, "a facet line naming another build must not pass");
  assert.match(r.out, /facet_evidence\\.seo states asset stamp 20260925c/);
  assert.match(r.out, /but the shipped pages reference/);
});

test("a stale SW cache version in a facet proof line fails the gate", () => {
  const r = gateAgainst((p) => {
    p.facet_evidence.seo = p.facet_evidence.seo.replace(/beco-v\\d+/, "beco-v88");
  });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /facet_evidence\\.seo states SW cache beco-v88, but sw\\.js ships/);
});

test("a stated manifest size is checked against the real deploy allowlist", () => {
  const real = deployList().length;
  const wrong = gateAgainst((p) => {
    p.facet_evidence.docs = "this tree stages 999 manifest files";
  });
  assert.notEqual(wrong.code, 0, "a manifest size nothing ships must not pass");
  assert.match(
    wrong.out,
    /states the deploy manifest stages 999 files, but the deploy allowlist holds/,
  );
  const right = gateAgainst((p) => {
    p.facet_evidence.docs = \`this tree stages \${real} manifest files\`;
  });
  assert.equal(
    right.code,
    0,
    "the size the allowlist actually holds must pass: the rule checks a fact, not a shape",
  );
});

test("a production claim with no measured block fails the gate", () => {
  const r = gateAgainst((p) => {
    delete p.production;
  });
  assert.notEqual(r.code, 0, "a production claim no measurement backs must not pass");
  assert.match(r.out, /states production facts/);
  assert.match(r.out, /with no measured block to check them against/);
});

test("a production number the probe did not measure fails the gate", () => {
  const r = gateAgainst((p) => {
    p.production.served_stamp = "20260917h";
  });
  assert.notEqual(r.code, 0, "a retyped served stamp must not pass");
  assert.match(r.out, /production\\.served_stamp is "20260917h", but the probe measured/);
});

test("a probe measured against another tree backs nothing here", () => {
  const dir = mkdtempSync(join(tmpdir(), "beco-probe-fixture-"));
  try {
    const file = join(dir, "probe.json");
    writeFileSync(
      file,
      JSON.stringify({ ...probe, tree_stamp: "20260925c" }, null, 2),
    );
    const r = gateAgainst(() => {}, { PROBE_OVERRIDE: file });
    assert.notEqual(
      r.code,
      0,
      "a probe of a tree that is not this one must fail, however green it was there",
    );
    assert.match(
      r.out,
      /was measured against tree stamp 20260925c, but this tree ships/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a ledger stamp the release ledger does not record fails the gate", () => {
  const r = gateAgainst((p) => {
    p.production.ledger_stamp = "20260101a";
  });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /production\\.ledger_stamp is 20260101a, but the last release/);
});

test("recorded_release must be the truth about the two stamps", () => {
  const shouldBe = servedByProbe === lastRelease;
  const r = gateAgainst((p) => {
    p.production.recorded_release = !shouldBe;
  });
  assert.notEqual(r.code, 0, "the flag may not disagree with the two stamps it describes");
  assert.match(r.out, /production\\.recorded_release is (true|false), but the build production serves/);
});

test("a surface the probe could not verify must be named in the record", (t) => {
  const unverified = probe.targets
    .filter((x) => x.verified !== true)
    .map((x) => x.name);
  if (!unverified.length) return t.skip("every probed surface is verified");
  const r = gateAgainst((p) => {
    p.production.unverified_surfaces = [];
  });
  assert.notEqual(r.code, 0, "an unmeasured surface may not be silently omitted");
  assert.match(
    r.out,
    /production\\.unverified_surfaces is \\[\\], but the probe could not verify \\[/,
  );
});

test("a committed run report may not claim a release nothing released", () => {
  const report = join(ROOT, ".jev-test-report.json");
  try {
    writeFileSync(
      report,
      JSON.stringify({
        evidence: { smoke_note: "Production: servedStamp 20260101a, verified:true." },
      }),
    );
    const bad = gateAgainst(() => {});
    assert.notEqual(
      bad.code,
      0,
      "a stamp no release records and this tree does not ship must not pass",
    );
    assert.match(bad.out, /claims production served stamp 20260101a/);

    // …and the same claim about a build that IS this tree's passes, so the rule
    // is checking the release of record rather than the shape of a sentence.
    writeFileSync(
      report,
      JSON.stringify({
        evidence: { smoke_note: \`Production serves stamp \${servedByProbe}.\` },
      }),
    );
    const good = gateAgainst(() => {});
    assert.equal(good.code, 0, "a truthful served-release claim must pass");
  } finally {
    rmSync(report, { force: true });
  }
});

test("a facet proof line may quote a composed count, and an invented one fails", () => {
  const invented = gateAgainst((p) => {
    p.facet_evidence.testing = "{{smoke_gate_count}} gates";
  });
  assert.notEqual(invented.code, 0, "a channel no runner writes is not a measurement");
  assert.match(
    invented.out,
    /facet_evidence\\.testing quotes \\{\\{smoke_gate_count\\}\\}, which no runner writes/,
  );
  const real = gateAgainst((p) => {
    p.facet_evidence.testing = "{{tests_total}} tests green";
  });
  assert.equal(real.code, 0, "a real channel in a facet line must pass");
});

test("composition reaches every string in the record, not a list of fields", () => {
  const { prose: filled, problems } = composeMeasuredCounts(
    {
      facet_evidence: { testing: "{{tests_total}} tests green" },
      notes: ["the smoke ran {{smoke_gates_total}} gates"],
    },
    {
      test: { measurements: { tests_total: 1668 } },
      "web-smoke": { measurements: { smoke_gates_total: 166 } },
    },
  );
  assert.deepEqual(problems, [], "every channel here exists");
  assert.equal(
    filled.facet_evidence.testing,
    "1668 tests green",
    "a facet proof line is composed like any other field",
  );
  assert.equal(filled.notes[0], "the smoke ran 166 gates");
});

test("the committed production block mirrors the committed probe", () => {
  const target = probe.targets.find((x) => x.name === committed.production.target);
  assert.ok(target, "the block names a surface the probe measured");
  for (const key of ["surface", "served_stamp", "files_checked", "matched", "verified"]) {
    assert.equal(
      committed.production[key],
      target[key],
      \`production.\${key} must be the measurement, not a retyping of it\`,
    );
  }
  assert.equal(committed.production.measured_at, probe.measured_at);
  assert.equal(committed.production.tree_stamp, probe.tree_stamp);
  assert.deepEqual(
    [...committed.production.unverified_surfaces].sort(),
    probe.targets
      .filter((x) => x.verified !== true)
      .map((x) => x.name)
      .sort(),
  );
});
`;

text = text.replace(/\n$/, "") + appended;
writeFileSync(FILE, text.replace(/\n/g, "\r\n"), "utf8");
console.log("appended tests to", FILE);
