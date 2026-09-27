// The Lighthouse gate (plan §8 P0.4, Q-02 / Q-03), tests written before the
// gate. Every test here fails against the tree this file landed on: there is no
// scripts/check-lighthouse.mjs, no scripts/lib/lighthouse-budgets.mjs and no
// lighthouse job in the workflow.
//
// The thing these tests exist to prevent is the failure mode the plan already
// names for the sibling gate: a threshold that exists only to make the run
// pass. That is the same defect as narrowing an axe tag, and it is invisible in
// the diff — the gate is green and everyone assumes the number means something.
// So the derivation is pinned in code: a floor must be traceable to a recorded
// measurement and may never sit above it, and a category may only be left
// UN-ratcheted if the file carries the measured evidence for why.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const PKG = JSON.parse(readFileSync("package.json", "utf8"));
const WORKFLOW_YAML = readFileSync(".github/workflows/test.yml", "utf8");
const GATE = "scripts/check-lighthouse.mjs";
const LIB = "scripts/lib/lighthouse-budgets.mjs";

/** The lib does not exist yet; each test says so in its own words. */
async function lib() {
  assert.ok(
    existsSync(LIB),
    `${LIB} must exist: the declared targets, the recorded first measurement ` +
      "and the floors belong in one auditable place, not in the gate's body",
  );
  return import("../" + LIB);
}

test("GATE: Lighthouse is a pinned devDependency behind a declared script", () => {
  // The plan (§8 P0.4) says Playwright, axe-core and Lighthouse are pinned
  // devDependencies, and no runtime dependency. Pinned means exact: a caret range
  // lets a score move because a dependency did, which is the one cause this
  // gate must never have.
  assert.equal(
    PKG.devDependencies?.lighthouse,
    "13.5.0",
    "lighthouse must be pinned exactly, like playwright and axe-core",
  );
  assert.equal(
    PKG.dependencies?.lighthouse,
    undefined,
    "lighthouse is a devDependency; the calculator ships zero runtime deps",
  );
  assert.ok(
    /^node scripts\/check-lighthouse\.mjs\b/.test(
      PKG.scripts["gate:lighthouse"] || "",
    ),
    `gate:lighthouse must run the gate script (got ${PKG.scripts["gate:lighthouse"]})`,
  );
  assert.ok(
    existsSync(GATE),
    `${GATE} must exist: a Lighthouse reading nothing is not a measurement`,
  );
});

test("GATE: every declared target is a real page, both form factors, median of 3", async () => {
  const { LIGHTHOUSE_TARGETS } = await lib();
  assert.ok(
    Array.isArray(LIGHTHOUSE_TARGETS) && LIGHTHOUSE_TARGETS.length > 0,
    "the gate must declare which pages it measures, rather than measuring all",
  );

  // Q-02: "Every page template, mobile AND desktop, median of 3 runs". Each of
  // those three things is checked per target, not once: the run count is what
  // makes a median meaningful, and a target list that quietly drops a form
  // factor halves the coverage the plan asked for.
  const pages = new Set();
  for (const t of LIGHTHOUSE_TARGETS) {
    assert.ok(t.id, "each target needs an id to be named in a report");
    assert.ok(
      ["mobile", "desktop"].includes(t.formFactor),
      `${t.id}: formFactor must be mobile or desktop (got ${t.formFactor})`,
    );
    assert.equal(
      t.runs,
      3,
      `${t.id}: Q-02 says median of 3 runs; ${t.runs} makes the median ` +
        "meaningless or the run too slow to be worth doing",
    );
    assert.ok(
      existsSync(t.page),
      `${t.id}: ${t.page} must exist, or the gate measures a 404 page`,
    );
    pages.add(t.page);
  }
  for (const page of pages) {
    for (const ff of ["mobile", "desktop"]) {
      assert.ok(
        LIGHTHOUSE_TARGETS.some((t) => t.page === page && t.formFactor === ff),
        `${page} has no ${ff} target: Q-02 requires both, and a target list ` +
          "that quietly drops one is a narrowed scope",
      );
    }
  }
});

test("GATE: every floor is derived from a recorded first measurement", async () => {
  const {
    LIGHTHOUSE_TARGETS,
    LIGHTHOUSE_RATCHET_CATEGORIES,
    LIGHTHOUSE_FLOORS,
    LIGHTHOUSE_FIRST_MEASUREMENT,
    LIGHTHOUSE_FLOOR_SLACK,
  } = await lib();

  assert.equal(
    typeof LIGHTHOUSE_FLOOR_SLACK,
    "number",
    "how far below an observed minimum a floor may sit must be a declared " +
      "number, so the gap is visible rather than implied",
  );
  assert.ok(
    LIGHTHOUSE_FLOOR_SLACK >= 0 && LIGHTHOUSE_FLOOR_SLACK <= 2,
    `a slack of ${LIGHTHOUSE_FLOOR_SLACK} is not a slack; it would let the bar ` +
      "drift down a point at a time until the gate measured nothing",
  );

  for (const t of LIGHTHOUSE_TARGETS) {
    const first = LIGHTHOUSE_FIRST_MEASUREMENT[t.id];
    assert.ok(
      first && typeof first === "object",
      `${t.id}: the first measurement must be recorded verbatim. A floor with ` +
        "no recorded reading behind it is a number someone chose.",
    );
    for (const category of LIGHTHOUSE_RATCHET_CATEGORIES) {
      const reading = first[category];
      const floor = LIGHTHOUSE_FLOORS[t.id]?.[category];
      // min / median / max, not a single number: the runs of one unchanged tree
      // do not always agree, and a record of only the median would hide the very
      // thing the floor has to absorb.
      for (const k of ["min", "median", "max"]) {
        assert.equal(
          typeof reading?.[k],
          "number",
          `${t.id}/${category}: the first measurement must record ${k}`,
        );
      }
      assert.ok(
        reading.min <= reading.median && reading.median <= reading.max,
        `${t.id}/${category}: min <= median <= max (${reading.min}/${reading.median}/${reading.max})`,
      );
      assert.equal(
        typeof floor,
        "number",
        `${t.id}/${category}: a ratcheted category must carry a floor`,
      );
      assert.ok(
        floor <= reading.min,
        `${t.id}/${category}: the floor ${floor} is ABOVE the worst reading ` +
          `observed (${reading.min}). A floor above it cannot be cleared by the ` +
          "build as measured, so it is an aspiration wearing a gate's clothes — " +
          "and it would be red on day one.",
      );
      assert.ok(
        reading.min - floor <= LIGHTHOUSE_FLOOR_SLACK,
        `${t.id}/${category}: the floor ${floor} sits ${reading.min - floor} below ` +
          `the worst observed ${reading.min}, more than the declared slack of ` +
          `${LIGHTHOUSE_FLOOR_SLACK}. A floor far under the reading is not a ` +
          "ratchet, it is permission to lose the score.",
      );
    }
  }
});

test("GATE: a category is only left un-ratcheted with the measurement that proves it", async () => {
  const {
    LIGHTHOUSE_CATEGORIES,
    LIGHTHOUSE_RATCHET_CATEGORIES,
    LIGHTHOUSE_REPORTED_ONLY,
    LIGHTHOUSE_VARIANCE,
    LIGHTHOUSE_FLOORS,
    LIGHTHOUSE_TARGETS,
  } = await lib();

  // Every category Q-02 names is still measured and reported. The question is
  // which ones carry a BLOCKING floor — and dropping one is a narrowing, so it
  // has to be a declared, evidenced decision rather than an omission.
  for (const category of LIGHTHOUSE_CATEGORIES) {
    const ratcheted = LIGHTHOUSE_RATCHET_CATEGORIES.includes(category);
    const explained = Object.hasOwn(LIGHTHOUSE_REPORTED_ONLY, category);
    assert.equal(
      ratcheted !== explained,
      true,
      `${category} must be either ratcheted with a floor, or listed in ` +
        "LIGHTHOUSE_REPORTED_ONLY with the measurement that justifies it. " +
        "Being in neither is how a scope quietly narrows.",
    );
  }
  assert.ok(
    LIGHTHOUSE_RATCHET_CATEGORIES.length > 0,
    "at least one category must be ratcheted, or this is a reporting job " +
      "wearing a gate's name",
  );

  // A reported-only category must carry real numbers, not a sentence. The whole
  // argument for leaving `performance` unratcheted is that it moved 12 and 36
  // points on an unchanged tree, and that claim has to be checkable here.
  for (const [category, why] of Object.entries(LIGHTHOUSE_REPORTED_ONLY)) {
    assert.equal(
      typeof why,
      "string",
      `${category}: the reason must be recorded`,
    );
    assert.ok(
      why.length > 80,
      `${category}: a one-line reason is an opinion. State what was measured.`,
    );
    const cal = LIGHTHOUSE_VARIANCE.performance_not_ratcheted;
    const samples = Object.values(cal).filter((s) => Array.isArray(s.runs));
    assert.ok(
      samples.length > 0,
      `${category}: LIGHTHOUSE_VARIANCE must carry the observed runs, so the ` +
        "claim of irreproducibility is a number a reviewer can check",
    );
    for (const s of samples) {
      assert.ok(
        s.n >= 9,
        `${category}: ${s.n} runs is too few to claim a distribution is unstable`,
      );
      assert.equal(
        s.runs.length,
        s.n,
        `${category}: the recorded runs must match the sample size`,
      );
      assert.ok(
        s.max - s.min >= 8,
        `${category}: the recorded spread is ${s.max - s.min} points, which is ` +
          "NOT wide enough to justify leaving it unratcheted",
      );
      assert.ok(
        typeof s.median_width_by_k === "object",
        `${category}: record how wide the median stays as runs are added, so ` +
          "'raise the run count' is shown not to have been tried on evidence",
      );
    }
  }

  // And the ratcheted categories must be absent from the floors entirely, so
  // nothing can quietly compare against a floor that was never justified.
  for (const floors of Object.values(LIGHTHOUSE_FLOORS)) {
    for (const category of Object.keys(floors)) {
      assert.ok(
        LIGHTHOUSE_RATCHET_CATEGORIES.includes(category),
        `${category} has a floor but is not a ratcheted category: either it ` +
          "earns a floor or it does not have one",
      );
    }
  }
  for (const t of LIGHTHOUSE_TARGETS) {
    assert.deepEqual(
      Object.keys(LIGHTHOUSE_FLOORS[t.id] || {}).sort(),
      [...LIGHTHOUSE_RATCHET_CATEGORIES].sort(),
      `${t.id}: every ratcheted category needs a floor on every target`,
    );
  }
});

test("GATE: the floors are declared here, never read from the ledger", async () => {
  // The plan forbids absorbing a change by declaring a baseline row, and the
  // sibling gate reads its bar from the ledger. Lighthouse must NOT: a bar read
  // from the ledger can be moved by appending a row, which makes "the gate is
  // green" a statement about the last commit rather than about the product.
  const libSrc = readFileSync(existsSync(LIB) ? LIB : GATE, "utf8");
  assert.ok(
    !/LEDGER\.jsonl/.test(libSrc),
    "the Lighthouse bar is a declared constant in this module, not read from " +
      "the ledger: a ledger-sourced bar can be moved by appending a row, which " +
      "makes the gate a statement about the last commit",
  );
  assert.doesNotMatch(
    libSrc,
    /floor\s*=\s*[^;]*(previous|last|latest|raise|auto)/i,
    "nothing here may raise a floor to absorb a movement: a score that " +
      "regresses is the finding",
  );
});

test("GATE: a score below its floor is a named regression, and at or above passes", async () => {
  const { compareLighthouse } = await lib();
  const t = "home/mobile";
  const floors = {
    [t]: { accessibility: 100, "best-practices": 100, seo: 100 },
  };

  // Equal is a pass: the floor is the bar, not a target to beat on every run.
  const atBar = compareLighthouse(
    [
      {
        id: t,
        scores: { accessibility: 100, "best-practices": 100, seo: 100 },
      },
    ],
    floors,
  );
  assert.equal(
    atBar.regressions.length,
    0,
    "a score exactly at its floor passes",
  );
  assert.equal(atBar.unmeasured.length, 0);

  // Above is a pass, and is reported as an improvement so the report says which
  // way the number moved rather than only that it did not fail.
  const better = compareLighthouse(
    [
      {
        id: t,
        scores: { accessibility: 100, "best-practices": 100, seo: 100 },
      },
    ],
    floors,
  );
  assert.equal(better.regressions.length, 0);

  // Below is a regression, and the message must name the numbers. A gate that
  // reports "failed" without saying 100 -> 96 leaves the reader to re-run it.
  const worse = compareLighthouse(
    [{ id: t, scores: { accessibility: 96, "best-practices": 100, seo: 100 } }],
    floors,
  );
  assert.equal(worse.regressions.length, 1);
  assert.equal(worse.regressions[0].id, t);
  assert.equal(worse.regressions[0].category, "accessibility");
  assert.equal(worse.regressions[0].from, 100);
  assert.equal(worse.regressions[0].to, 96);
  assert.match(worse.regressions[0].message, /100 -> 96/);
});

test("GATE: an unratcheted category is reported, never failed", async () => {
  const { compareLighthouse } = await lib();
  const t = "home/mobile";
  // `performance` at 40 must not fail the run — that is the whole point of the
  // measured split — but it must still surface as a Q-02 breach, so the gap is
  // on the record rather than merely not-blocking.
  const r = compareLighthouse(
    [
      {
        id: t,
        scores: {
          performance: 40,
          accessibility: 100,
          "best-practices": 100,
          seo: 100,
        },
      },
    ],
    { [t]: { accessibility: 100, "best-practices": 100, seo: 100 } },
  );
  assert.equal(
    r.regressions.length,
    0,
    "a reported-only category must never fail the run",
  );
  assert.ok(
    r.breaches.some((b) => b.category === "performance" && b.score === 40),
    "…and a low reading there is still reported as a Q-02 breach",
  );
});

test("GATE: a target that did not measure is a hole, never a pass", async () => {
  const { compareLighthouse } = await lib();
  const t = "home/mobile";

  // This is the exact shape the a11y matrix hole had: a cell that produced no
  // reading. It must not pass by being absent — that is the failure that held
  // quality-lab red, and repeating it in a new gate would be worse.
  for (const scores of [
    {},
    { accessibility: null },
    { accessibility: undefined },
  ]) {
    const r = compareLighthouse([{ id: t, scores }], {
      [t]: { accessibility: 100, "best-practices": 100, seo: 100 },
    });
    assert.equal(
      r.regressions.length,
      0,
      "an absent reading is a hole, not a regression",
    );
    assert.ok(
      r.holes.some((h) => h.id === t && h.category === "accessibility"),
      `scores ${JSON.stringify(scores)} must be reported as a hole: a gate ` +
        "that passes on a target it never measured is green for the wrong reason",
    );
  }
});

test("CI: the job runs the gate, records its own result, and ci_green requires it", async () => {
  const { requiredJobsFromWorkflow } =
    await import("../scripts/lib/jev-evidence.mjs");
  const job = "lighthouse";

  assert.match(
    WORKFLOW_YAML,
    new RegExp(`^ {2}${job}:[ \\t]*$`, "m"),
    `the workflow must declare a \`${job}\` job`,
  );

  // Records its own outcome and uploads it, the way quality-lab does. Without
  // the artifact the job is still required and the missing file is a named fatal
  // problem — so this is not optional plumbing.
  assert.match(
    WORKFLOW_YAML,
    new RegExp(`RESULT_PATH:\\s*jev-artifacts/${job}\\.json`),
    `${job} must record its result for the Jev gate, as quality-lab does`,
  );
  assert.match(
    WORKFLOW_YAML,
    new RegExp(`name:\\s*jev-results-${job}`),
    `${job} must upload its result artifact`,
  );
  assert.match(
    WORKFLOW_YAML,
    new RegExp(`name:\\s*jev-results-lighthouse-report`),
    "the Lighthouse report must be uploaded under a name the judge's " +
      "jev-results-* download picks up, or no record can read it: the numbers " +
      "are the proof and the artifact name is the wire",
  );

  // The consequence, asserted rather than discovered: because the required set
  // is derived from the workflow, declaring the job makes it required with no
  // code change anywhere. A red lighthouse run therefore takes ci_green red with
  // it. That is the design working, and nothing may carve out an exception to
  // soften it.
  const required = requiredJobsFromWorkflow(WORKFLOW_YAML);
  assert.ok(
    required.includes(job),
    `${job} must be a required job: it is derived from the workflow, so a run ` +
      `that goes red makes ci_green red (required: ${required.join(", ")})`,
  );
});
