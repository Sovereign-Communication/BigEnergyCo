// The Jev complete gate contract: pack single-sourcing, fail-closed evidence, the
// 0-hallucination live parse, and the score arithmetic the 95/100 target
// rests on. Every rule here is one a later edit could silently break.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  COMPLETE_MIN_SCORE,
  COMPLETE_PACK_PATH,
  WORK_TYPES,
  HARD_GATE_POINTS,
  HARD_GATE_BUCKETS,
  DEFAULT_COMPLETE_PACK,
  validateCompletePack,
  loadCompletePack,
  completeQuestionPack,
  heuristicFacetLevels,
  matchCompleteKeywords,
  parseLiveAnswers,
  mergeEvidence,
  buildStateText,
  scoreCompleteGate,
} from "../scripts/lib/jev-complete.mjs";

const CLI = fileURLToPath(
  new URL("../scripts/validate-jev-complete.mjs", import.meta.url),
);
const LEVELS = DEFAULT_COMPLETE_PACK.sentiment.levels;
const AXIS_IDS = Object.keys(DEFAULT_COMPLETE_PACK.axes);
const BUCKET_IDS = Object.keys(DEFAULT_COMPLETE_PACK.buckets);

const ALL_GREEN = {
  tests_green: true,
  prettier_clean: true,
  seo_green: true,
  smoke_green: true,
  ci_green: true,
  tests_summary: "606/606",
  seo_summary: "ok",
  smoke_note: "ALL GATES PASSED",
  ci_summary: "5/5 green",
};
const AUTO_CLEAN = {
  secretsClean: true,
  envIgnored: true,
  treeClean: true,
  dirtyPaths: [],
  sha: "abc1234",
  branch: "main",
  target: "local",
  testCount: 606,
};

/** A live judgment where every axis answers at the given level index. */
function liveAll(index, overrides = {}) {
  const live_levels = {};
  const live_confidence = {};
  for (const axis of AXIS_IDS) {
    live_levels[axis] = index;
    live_confidence[axis] = 0.9;
  }
  return {
    live_levels,
    live_confidence,
    primary_gap: null,
    notes: ["constructed"],
    ...overrides,
  };
}

/** One live axis answer as the provider emits it: legend + probabilities. */
function axisAnswer(level, confidence = 0.9, prob = 0.9) {
  return { probabilities: { a: prob }, legend: { a: level }, confidence };
}

function mutatedPack(mutate) {
  const clone = structuredClone(DEFAULT_COMPLETE_PACK);
  mutate(clone);
  return clone;
}

// ── pack ─────────────────────────────────────────────────────────────────────

// Single source of truth: the pack exists exactly once — the JSON file beside
// the lib module. The old contract pinned a hand-maintained in-code copy
// against that file (drift test); the copy is gone, so what remains to prove
// is that BOTH load paths — the module-sibling URL the export uses and the
// CLI's repo-relative COMPLETE_PACK_PATH — resolve to one pack, and that no
// second in-code literal is ever reintroduced.
test("PACK: single source — both load paths resolve to one pack, no in-code copy", () => {
  const raw = JSON.parse(
    readFileSync(
      new URL("../scripts/lib/jev-complete.pack.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(raw, DEFAULT_COMPLETE_PACK, "module-sibling load diverged");
  // Read COMPLETE_PACK_PATH itself (cwd = repo root in the suite): a wrong or
  // moved path throws here instead of silently falling back to the export.
  const viaPath = JSON.parse(readFileSync(COMPLETE_PACK_PATH, "utf8"));
  assert.deepEqual(
    viaPath,
    DEFAULT_COMPLETE_PACK,
    "COMPLETE_PACK_PATH no longer names the same pack",
  );
  assert.deepEqual(
    loadCompletePack("."),
    validateCompletePack(DEFAULT_COMPLETE_PACK),
    "loadCompletePack diverged from the validated export",
  );
  const libSrc = readFileSync(
    new URL("../scripts/lib/jev-complete.mjs", import.meta.url),
    "utf8",
  );
  assert.ok(
    !libSrc.includes("export const DEFAULT_COMPLETE_PACK = {"),
    "in-code pack copy reintroduced — edit jev-complete.pack.json instead",
  );
});

test("PACK: every axis declares a real authority, its own bucket, and instructions", () => {
  const doc = validateCompletePack(DEFAULT_COMPLETE_PACK);
  for (const [axis, spec] of Object.entries(doc.axes)) {
    assert.ok(["code", "jev"].includes(spec.authority), `${axis} authority`);
    assert.ok(spec.bucket in doc.buckets, `${axis} bucket`);
    assert.ok(spec.instructions.length > 20, `${axis} instructions`);
  }
  // Every declared bucket is reachable from at least one axis.
  const used = new Set(Object.values(doc.axes).map((s) => s.bucket));
  for (const id of Object.keys(doc.buckets)) {
    assert.ok(used.has(id), `bucket ${id} has no owning axis — dead work type`);
  }
});

test("PACK: validator rejects each malformed shape with a named error", () => {
  const cases = [
    ["non-object pack", 42, /must be an object/],
    [
      "empty id",
      mutatedPack((p) => {
        p.id = "";
      }),
      /non-empty string id/,
    ],
    [
      "duplicate levels",
      mutatedPack((p) => {
        p.sentiment.levels[1] = p.sentiment.levels[0];
      }),
      /must be unique/,
    ],
    [
      "decreasing ordinals",
      mutatedPack((p) => {
        p.sentiment.ordinals = [60, 35, 0, 85, 100];
      }),
      /non-decreasing/,
    ],
    [
      "reserved axis id",
      mutatedPack((p) => {
        p.axes.primary_gap = {
          authority: "jev",
          bucket: "spec_gap",
          instructions: "x",
        };
      }),
      /reserved/,
    ],
    [
      "reserved bucket id",
      mutatedPack((p) => {
        p.buckets.none = {
          label: "n",
          path_id: "n",
          work_type: "audit",
          keywords: ["n"],
          suggested_next_action: "n",
        };
      }),
      /reserved/,
    ],
    [
      "undeclared bucket reference",
      mutatedPack((p) => {
        p.axes.spec.bucket = "nope";
      }),
      /declared bucket id/,
    ],
    [
      "unknown authority",
      mutatedPack((p) => {
        p.axes.spec.authority = "llm";
      }),
      /authority must be/,
    ],
    [
      "work_type outside the repertoire",
      mutatedPack((p) => {
        p.buckets.spec_gap.work_type = "vibes";
      }),
      /work_type must be one of/,
    ],
    [
      "bucket without an action",
      mutatedPack((p) => {
        delete p.buckets.spec_gap.suggested_next_action;
      }),
      /requires a non-empty suggested_next_action/,
    ],
  ];
  for (const [name, pack, pattern] of cases) {
    assert.throws(() => validateCompletePack(pack), pattern, name);
  }
});

test("PACK: the AI advisor is a dedicated live-audited facet with a declared work bucket", () => {
  const doc = validateCompletePack(DEFAULT_COMPLETE_PACK);
  assert.equal(doc.axes.advisor.authority, "jev");
  assert.equal(doc.axes.advisor.bucket, "advisor_gap");
  assert.match(
    doc.axes.advisor.instructions,
    /deterministic calculator figures authoritative/,
  );
  assert.match(doc.axes.advisor.instructions, /privacy/);
  assert.match(doc.axes.advisor.instructions, /multilingual/);
  assert.ok(doc.buckets.advisor_gap);
  assert.ok(
    doc.buckets.advisor_gap.suggested_next_action.includes(
      "same selected deterministic state",
    ),
  );
});

test("PACK: gate constants stay coherent with the pack", () => {
  const total = Object.values(HARD_GATE_POINTS).reduce((a, b) => a + b, 0);
  assert.equal(total, 100, "hard-gate points must sum to exactly 100");
  for (const key of Object.keys(HARD_GATE_BUCKETS)) {
    assert.ok(
      key in HARD_GATE_POINTS,
      `${key} maps a gate that does not exist`,
    );
    assert.ok(
      HARD_GATE_BUCKETS[key] in
        BUCKET_IDS.reduce((o, k) => ((o[k] = 1), o), {}),
      `${key} maps to an undeclared bucket`,
    );
  }
});

// ── question pack ────────────────────────────────────────────────────────────

test("QUESTIONS: one score per axis over the declared levels, one choice over the buckets", () => {
  const q = completeQuestionPack(DEFAULT_COMPLETE_PACK);
  assert.deepEqual(Object.keys(q).sort(), [...AXIS_IDS, "primary_gap"].sort());
  for (const axis of AXIS_IDS) {
    assert.equal(q[axis].type, "score", axis);
    assert.deepEqual(q[axis].criteria, LEVELS, axis);
  }
  assert.equal(q.primary_gap.type, "choice");
  assert.deepEqual(
    new Set(Object.keys(q.primary_gap.criteria)),
    new Set([...BUCKET_IDS, "none"]),
    "primary_gap must offer exactly the declared buckets plus 'none'",
  );
  for (const [id, question] of Object.entries(q)) {
    assert.ok(
      ["score", "choice"].includes(question.type),
      `${id} typed primitive only`,
    );
  }
});

// ── code-owned heuristic ─────────────────────────────────────────────────────

test("EVIDENCE: advisor audit summary is transported without becoming an optimistic fact", () => {
  const merged = mergeEvidence(
    {
      advisor_audit:
        "same selected state, prompt-injection, locale, provider failure",
    },
    AUTO_CLEAN,
  );
  assert.match(
    buildStateText(merged, AUTO_CLEAN),
    /advisor_audit: same selected state/,
  );
  assert.equal(
    buildStateText(mergeEvidence({}, AUTO_CLEAN), AUTO_CLEAN).includes(
      "advisor_audit: not recorded",
    ),
    true,
  );
});

test("EVIDENCE: per-facet proof lines survive transport intact, bounded per line", () => {
  const proof =
    "keyboard walks 64/81/47 stops + wrap, named controls, AA contrast, reduced-motion both modes";
  const merged = mergeEvidence(
    {
      facet_evidence: {
        accessibility: proof,
        experience: "pipeline stepper + speed notes + retryable timeout error",
        bogus: 42,
        broken: "",
      },
      notes: Array.from(
        { length: 8 },
        (_, i) => `note ${i} ${"x".repeat(200)}`,
      ),
    },
    AUTO_CLEAN,
  );
  const text = buildStateText(merged, AUTO_CLEAN);
  assert.ok(
    text.includes(`accessibility: ${proof}`),
    "a facet proof line must reach the judge whole, not truncated mid-way",
  );
  assert.match(text, /experience: pipeline stepper/);
  assert.ok(!text.includes("bogus"), "non-string facet entries are dropped");
  assert.ok(!text.includes("broken:"), "empty facet entries are dropped");

  const long = mergeEvidence(
    { facet_evidence: { docs: "d".repeat(1000) } },
    AUTO_CLEAN,
  );
  const longLine = buildStateText(long, AUTO_CLEAN)
    .split("\n")
    .find((l) => l.startsWith("docs: "));
  assert.equal(
    longLine.length,
    "docs: ".length + 280,
    "each facet line is bounded so one verbose axis cannot crowd out the rest",
  );
});

test("TRANSPORT: a full 16-axis record survives whole — no axis lost to the tail", () => {
  const facet_evidence = {};
  for (const axis of AXIS_IDS) {
    facet_evidence[axis] = `${axis} proof: ` + "x".repeat(120);
  }
  const merged = mergeEvidence(
    {
      ...ALL_GREEN,
      facet_evidence,
      notes: ["note one survives", "note two survives"],
    },
    AUTO_CLEAN,
  );
  const text = buildStateText(merged, AUTO_CLEAN);
  for (const axis of AXIS_IDS) {
    assert.ok(
      text.includes(`${axis}: ${axis} proof: `),
      `axis lost from transport: ${axis}`,
    );
  }
  assert.ok(text.includes("note one survives"));
  assert.ok(text.includes("note two survives"));
  assert.ok(text.length <= 6000, "transport budget holds the full record");
});

test("HEURISTIC: only code-owned axes move, and only toward their evidence", () => {
  const cases = [
    ["no facts", {}, { testing: 2, seo: 2, release: 2 }],
    ["tests green", { tests_green: true }, { testing: 4, seo: 2, release: 2 }],
    ["tests red", { tests_green: false }, { testing: 0, seo: 2, release: 2 }],
    ["seo green", { seo_green: true }, { testing: 2, seo: 4, release: 2 }],
    [
      "all release facts green",
      { ci_green: true, smoke_green: true, tree_clean: true },
      { testing: 2, seo: 2, release: 4 },
    ],
    [
      "any release fact red",
      { ci_green: true, smoke_green: false, tree_clean: true },
      { testing: 2, seo: 2, release: 1 },
    ],
    [
      "release fact unknown",
      { ci_green: true },
      { testing: 2, seo: 2, release: 2 },
    ],
  ];
  for (const [name, ev, expect] of cases) {
    const levels = heuristicFacetLevels(ev, DEFAULT_COMPLETE_PACK);
    for (const [axis, want] of Object.entries(expect)) {
      assert.equal(levels[axis], want, `${name}: ${axis}`);
    }
    // A Jev-owned facet never guesses from a code fact.
    assert.equal(levels.design, 2, `${name}: design must stay neutral`);
  }
});

// ── keyword fallback ─────────────────────────────────────────────────────────

test("KEYWORDS: most hits wins, ties go lexicographic, zero hits invents nothing", () => {
  const cases = [
    ["PRETTIER red", "quality_gap"],
    ["prettier format dead code", "quality_gap"],
    ["prettier and a monolith", "design_gap"], // 1–1 tie → lexicographic first
    ["everything is wonderful", null],
    ["", null],
  ];
  for (const [text, want] of cases) {
    const got = matchCompleteKeywords(text, DEFAULT_COMPLETE_PACK);
    assert.equal(got.bucket, want, JSON.stringify(text));
    if (want === null) assert.equal(got.score, 0);
  }
  // Case-insensitive, and the winning bucket reports the keywords it matched.
  const hit = matchCompleteKeywords("PRETTIER format", DEFAULT_COMPLETE_PACK);
  assert.equal(hit.bucket, "quality_gap");
  assert.deepEqual(hit.evidence, ["prettier", "format"]);
});

// ── live parse (0-hallucination) ─────────────────────────────────────────────

test("LIVE: highest-probability valid legend anchor wins; invented levels are ignored", () => {
  const answers = {
    spec: {
      probabilities: { low: 0.2, high: 0.8 },
      legend: { low: LEVELS[0], high: LEVELS[4] },
      confidence: 0.7,
    },
    design: {
      probabilities: { a: 0.9 },
      legend: { a: "google-plus-ultra" },
      confidence: 0.8,
    },
  };
  const parsed = parseLiveAnswers(answers, DEFAULT_COMPLETE_PACK);
  assert.ok(parsed, "partial valid answers must still parse");
  assert.equal(parsed.live_levels.spec, 4, "0.8 on the proven anchor wins");
  assert.equal(parsed.live_confidence.spec, 0.7);
  assert.equal(
    parsed.live_levels.design,
    null,
    "an invented level string never maps to an index",
  );
  assert.equal(parsed.live_confidence.design, 0.8);
  // Every declared axis is reported — answered or unmatched, never omitted.
  assert.equal(Object.keys(parsed.live_levels).length, AXIS_IDS.length);
  assert.equal(
    parsed.notes.length,
    AXIS_IDS.length + 1,
    "one note per axis + the gap choice",
  );
});

test("LIVE: primary_gap accepts 'none' and declared buckets, refuses invented ones", () => {
  const base = { spec: axisAnswer(LEVELS[4]) };
  const none = parseLiveAnswers(
    { ...base, primary_gap: { choice: "none" } },
    DEFAULT_COMPLETE_PACK,
  );
  assert.equal(none.primary_gap, null);
  assert.ok(none.notes.includes("primary_gap:none"));

  const declared = parseLiveAnswers(
    { ...base, primary_gap: { choice: "quality_gap" } },
    DEFAULT_COMPLETE_PACK,
  );
  assert.equal(declared.primary_gap, "quality_gap");

  const invented = parseLiveAnswers(
    { ...base, primary_gap: { choice: "vibes_gap" } },
    DEFAULT_COMPLETE_PACK,
  );
  assert.equal(
    invented.primary_gap,
    null,
    "an out-of-pack bucket must never be adopted",
  );
  assert.ok(
    invented.notes.some((n) => n.includes("refused")),
    "but the refusal is recorded",
  );
});

test("LIVE: a judgment with no valid axis answer is null, never a guess", () => {
  assert.equal(parseLiveAnswers(null, DEFAULT_COMPLETE_PACK), null);
  assert.equal(
    parseLiveAnswers({}, DEFAULT_COMPLETE_PACK),
    null,
    "every axis unmatched → fallback",
  );
  assert.equal(
    parseLiveAnswers(
      { spec: { probabilities: { a: 1 }, legend: { a: "nope" } } },
      DEFAULT_COMPLETE_PACK,
    ),
    null,
    "all answers invented → fallback",
  );
});

// ── evidence merge (fail-closed) ─────────────────────────────────────────────

test("EVIDENCE: absent means red, and evidence cannot override code-owned facts", () => {
  const empty = mergeEvidence({}, AUTO_CLEAN);
  for (const key of Object.keys(HARD_GATE_POINTS)) {
    if (key === "secrets_clean" || key === "tree_clean") continue; // auto-owned
    assert.equal(empty[key], false, `${key} absent must be red`);
  }
  assert.equal(empty.tests_summary, "");
  assert.deepEqual(empty.notes, []);

  const liar = mergeEvidence(
    {
      tree_clean: true,
      secrets_clean: true,
      tests_green: "yes",
      notes: "not an array",
    },
    { secretsClean: false, treeClean: false },
  );
  assert.equal(
    liar.tree_clean,
    false,
    "auto-owned tree fact wins over evidence",
  );
  assert.equal(
    liar.secrets_clean,
    false,
    "auto-owned secret scan wins over evidence",
  );
  assert.equal(liar.tests_green, false, "only literal true counts as green");
  assert.deepEqual(
    liar.notes,
    [],
    "non-array notes are dropped, not stringified",
  );

  const honest = mergeEvidence(ALL_GREEN, AUTO_CLEAN);
  assert.equal(honest.tests_green, true);
  assert.equal(honest.tree_clean, true);
  assert.equal(honest.env_ignored, true);
});

// ── evidence transport ───────────────────────────────────────────────────────

test("TRANSPORT: every recorded evidence channel reaches the live judge", () => {
  // The old 1200-char cap silently cut per-facet evidence — nine facets were
  // answered "partial or unverified" despite green recorded runs — and
  // seo_summary was collected but never transported at all. Pins: the seo
  // line exists, and all 12 per-facet notes survive into the state text.
  const notes = Array.from(
    { length: 12 },
    (_, i) =>
      `facet-evidence-${i}: recorded artifact at affdc22 — deterministic ` +
      "derivation pinned by engine.test.mjs, verified green in the full suite",
  );
  const ev = {
    tests_green: true,
    prettier_clean: true,
    seo_green: true,
    smoke_green: true,
    ci_green: true,
    tests_summary: "T".repeat(120),
    seo_summary: "sitemap/JSON-LD green",
    smoke_note: "S".repeat(120),
    ci_summary: "C".repeat(120),
    notes,
  };
  const auto = {
    target: "main @ affdc22",
    sha: "affdc22",
    treeClean: true,
    secretsClean: true,
    dirtyPaths: [],
    testCount: 66,
  };
  const text = buildStateText(mergeEvidence(ev, auto), auto);
  assert.match(text, /seo: sitemap\/JSON-LD green/);
  for (const n of notes) {
    assert.ok(text.includes(n), `note missing from transport: ${n}`);
  }
  assert.ok(text.length <= 6000, "transport budget holds the full record");
});

// ── score arithmetic ─────────────────────────────────────────────────────────

test("SCORE: everything green with a proven live judgment passes at 95", () => {
  const ev = mergeEvidence(ALL_GREEN, AUTO_CLEAN);
  const report = scoreCompleteGate(ev, { liveJudgment: liveAll(4) });
  assert.equal(report.mechanical_score, 100);
  assert.equal(report.score, 100);
  assert.equal(report.pass, true);
  assert.deepEqual(report.blocking_facets, []);
  assert.deepEqual(report.required_work, [], "a proven tree needs no work");
  assert.deepEqual(report.blockers, []);
  assert.equal(report.min_score, COMPLETE_MIN_SCORE);
});

test("SCORE: a red hard gate pins the score below target no matter how good the prose", () => {
  const pointsWithout = Object.entries(HARD_GATE_POINTS)
    .filter(([key]) => key !== "smoke_green")
    .reduce((sum, [, pts]) => sum + pts, 0);
  const ev = mergeEvidence({ ...ALL_GREEN, smoke_green: false }, AUTO_CLEAN);
  const report = scoreCompleteGate(ev, { liveJudgment: liveAll(4) });
  assert.equal(report.pass, false);
  assert.equal(
    report.score,
    Math.min(pointsWithout, COMPLETE_MIN_SCORE - 0.01),
  );
  assert.equal(report.hard_gates.smoke_green, false);
  const release = report.required_work.find((w) => w.bucket === "release_gap");
  assert.ok(release, "the failed gate surfaces through its bucket");
  assert.equal(release.source, "hard_gate");
  assert.equal(
    release.ordinal,
    -1,
    "a code-certain gate failure outranks semantic flags",
  );
  assert.ok(report.blockers.some((b) => b.includes("smoke_green")));
});

test("SCORE: Jev may lower a code fact but never raise one", () => {
  // Raise attempt: tests are green (code 4) but Jev says failing (0).
  const downJudgment = liveAll(4, {
    live_levels: { ...liveAll(4).live_levels, testing: 0 },
  });
  const down = scoreCompleteGate(mergeEvidence(ALL_GREEN, AUTO_CLEAN), {
    liveJudgment: downJudgment,
  });
  assert.equal(down.facets.testing.index, 0, "live can lower a code fact");
  assert.equal(down.facets.testing.source, "live");
  assert.ok(
    down.score >= COMPLETE_MIN_SCORE,
    "score can still be numerically high…",
  );
  assert.equal(down.pass, false, "…but a blocking facet refuses the pass");
  assert.deepEqual(down.blocking_facets, ["testing"]);

  // Raise attempt: tests are red (code 0) but Jev claims proven (4).
  const upJudgment = liveAll(4);
  const up = scoreCompleteGate(
    mergeEvidence({ ...ALL_GREEN, tests_green: false }, AUTO_CLEAN),
    {
      liveJudgment: upJudgment,
    },
  );
  assert.equal(
    up.facets.testing.index,
    0,
    "live can never lift a red code fact",
  );
});

test("SCORE: Jev-owned facets use live when valid, heuristic when absent", () => {
  const ev = mergeEvidence(ALL_GREEN, AUTO_CLEAN);
  const noLive = scoreCompleteGate(ev, {});
  assert.equal(noLive.facets.design.source, "heuristic");
  assert.equal(noLive.facets.design.index, 2);
  assert.equal(noLive.live.is_fallback, true);

  const live = scoreCompleteGate(ev, { liveJudgment: liveAll(4) });
  assert.equal(live.facets.design.source, "live");
  assert.equal(live.facets.design.index, 4);
  assert.equal(live.live.is_fallback, false);

  const partial = scoreCompleteGate(ev, {
    liveJudgment: liveAll(4, {
      live_levels: { ...liveAll(4).live_levels, design: null },
    }),
  });
  assert.equal(
    partial.facets.design.source,
    "heuristic",
    "an invalid live level falls back",
  );
  assert.equal(partial.facets.design.index, 2);
});

test("SCORE: required work dedupes worst-wins and honors the keyword primary gap", () => {
  const ev = mergeEvidence({ ...ALL_GREEN, smoke_green: false }, AUTO_CLEAN);
  const report = scoreCompleteGate(ev, {
    liveJudgment: liveAll(4),
    keywordGap: { bucket: "release_gap" },
  });
  const releaseItems = report.required_work.filter(
    (w) => w.bucket === "release_gap",
  );
  assert.equal(
    releaseItems.length,
    1,
    "hard-gate and facet flags on one bucket collapse to one item",
  );
  assert.equal(releaseItems[0].ordinal, -1, "worst-wins");
  assert.equal(
    releaseItems[0].primary,
    true,
    "the primary gap flags its bucket",
  );
  assert.equal(report.live.primary_gap_source, "keyword");

  // A primary bucket with no facet below the line is still surfaced.
  const quiet = scoreCompleteGate(mergeEvidence(ALL_GREEN, AUTO_CLEAN), {
    liveJudgment: liveAll(4),
    keywordGap: { bucket: "quality_gap" },
  });
  const quality = quiet.required_work.find((w) => w.bucket === "quality_gap");
  assert.ok(quality, "primary gap alone summons its bucket");
  assert.equal(quality.ordinal, null);
  assert.equal(quality.primary, true);
});

test("SCORE: recommended actions group by declared work type with severity order", () => {
  const ev = mergeEvidence(
    { ...ALL_GREEN, smoke_green: false, prettier_clean: false },
    AUTO_CLEAN,
  );
  const report = scoreCompleteGate(ev, { liveJudgment: liveAll(2) });

  const groups = Object.keys(report.recommended_actions);
  for (const group of groups)
    assert.ok(WORK_TYPES.includes(group), `${group} is a declared work type`);

  // Every required-work item appears in exactly one group.
  const grouped = groups.flatMap((g) => report.recommended_actions[g]);
  assert.equal(grouped.length, report.required_work.length);
  assert.deepEqual(
    grouped.map((g) => g.bucket).sort(),
    report.required_work.map((w) => w.bucket).sort(),
    "grouping repartitions required work — it never drops or duplicates a bucket",
  );

  // Groups order by their worst item (null ordinal counts as 50).
  const weight = (list) =>
    Math.min(...list.map((i) => (i.ordinal === null ? 50 : i.ordinal)));
  const weights = groups.map((g) => weight(report.recommended_actions[g]));
  assert.deepEqual(
    [...weights].sort((a, b) => a - b),
    weights,
    "groups must be severity-ordered",
  );
});

// ── CLI (hermetic end-to-end) ────────────────────────────────────────────────

test("CLI: offline runs report honestly — green evidence still cannot pass without live judgment", () => {
  const repo = mkdtempSync(join(tmpdir(), "jev-gate-"));
  try {
    const init = spawnSync("git", ["init", "-q"], {
      cwd: repo,
      encoding: "utf8",
    });
    assert.equal(init.status, 0, init.stderr);

    // The evidence file lives OUTSIDE the repo so it cannot dirty the tree.
    const evidencePath = join(
      tmpdir(),
      `jev-gate-evidence-${process.pid}.json`,
    );
    writeFileSync(evidencePath, JSON.stringify(ALL_GREEN));
    try {
      const json = spawnSync(
        process.execPath,
        [CLI, "--local-only", "--json", "--evidence", evidencePath],
        { cwd: repo, encoding: "utf8" },
      );
      assert.equal(json.status, 1, "an offline run must not claim a pass");
      const report = JSON.parse(json.stdout);
      assert.equal(report.pass, false);
      assert.equal(
        report.score < COMPLETE_MIN_SCORE,
        true,
        "offline ceiling stays under 95",
      );
      assert.equal(
        report.live.is_fallback,
        true,
        "no live provider was consulted",
      );
      assert.equal(
        report.mechanical_score,
        100,
        "all code-owned facts were green",
      );
      // The heuristic never guesses semantic quality: every Jev-owned facet
      // sits below the improve line, so all of its work is demanded — visible,
      // not silently accepted.
      const jevBuckets = new Set(
        Object.values(DEFAULT_COMPLETE_PACK.axes)
          .filter((spec) => spec.authority === "jev")
          .map((spec) => spec.bucket),
      );
      const demanded = new Set(report.required_work.map((w) => w.bucket));
      for (const bucket of jevBuckets) {
        assert.ok(demanded.has(bucket), `offline run must demand ${bucket}`);
      }

      // No evidence file at all: the run-derived gates go red, fail-closed.
      const missing = spawnSync(
        process.execPath,
        [CLI, "--local-only", "--json"],
        {
          cwd: repo,
          encoding: "utf8",
        },
      );
      assert.equal(missing.status, 1);
      const redReport = JSON.parse(missing.stdout);
      assert.equal(redReport.hard_gates.tests_green, false);
      assert.ok(
        redReport.required_work.some(
          (w) => w.bucket === "tests_gap" && w.source === "hard_gate",
        ),
        "a missing suite run surfaces as a tests gap",
      );

      // Human mode stays human and still fails loudly.
      const human = spawnSync(process.execPath, [CLI, "--local-only"], {
        cwd: repo,
        encoding: "utf8",
      });
      assert.equal(human.status, 1);
      assert.match(human.stdout, /Jev complete gate/);
      assert.match(human.stdout, /required work/);
    } finally {
      rmSync(evidencePath, { force: true });
    }
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
