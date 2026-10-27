// Master plan P0.3(d): the Jev pack gains the five facets the plan names —
// `provenance`, `comparison`, `usecases`, `privacy`, `translation`.
//
// Why these five. The pack had 16 axes and could not see three of the
// program's central promises: that every visible number is sourced (Q-10), that
// the four purchase paths are compared like for like (D-01, U-03), and that the
// six use cases exist in one flow (D-16, U-14). Privacy and translation were
// likewise invisible as judged dimensions. A gate that cannot see a gap cannot
// report one, and P1/P2/P4 would have shipped with nothing measuring them.
//
// These tests pin the FACTS, not a description of the facts: the ids come from
// the plan text itself, every declared axis must be owned by at least one plan
// item, every axis must carry a proof line in the run record (an axis with no
// evidence is rated from nothing), and the evidence-transport budget must grow
// with the axis count so a twenty-second facet can never be silently starved of
// its own proof line.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SCOPE_FACETS,
  loadCompletePack,
  buildStateText,
  mergeEvidence,
  heuristicFacetLevels,
  stateTextBudget,
  axisLineBudget,
  COMPLETE_FACET_CLIP,
  COMPLETE_STATE_BASE_CHARS,
  COMPLETE_STATE_PER_AXIS_CHARS,
} from "../scripts/lib/jev-complete.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLAN = readFileSync(join(ROOT, "docs/plan/MASTER_PLAN.md"), "utf8");
const pack = loadCompletePack(ROOT);
const axes = Object.keys(pack.axes);

// The five ids are quoted from the plan, so a rename in the pack without a plan
// amendment fails here instead of silently changing what the gate measures.
const NEW_FACETS = [
  "provenance",
  "comparison",
  "usecases",
  "privacy",
  "translation",
];

const AUTO = {
  target: "main @ affdc22",
  sha: "affdc22",
  treeClean: true,
  secretsClean: true,
  dirtyPaths: [],
  testCount: 66,
};

test("PACK: the plan's five P0.3(d) facets exist, each with its own bucket", () => {
  for (const axis of NEW_FACETS) {
    const spec = pack.axes[axis];
    assert.ok(spec, `the pack has no "${axis}" axis`);
    assert.ok(
      ["code", "jev"].includes(spec.authority),
      `${axis} declares a real authority`,
    );
    assert.ok(
      pack.buckets[spec.bucket],
      `${axis} must own a declared bucket, not an ad-hoc id`,
    );
    assert.ok(
      spec.instructions.length > 60,
      `${axis} instructions must say what to judge, not name the facet`,
    );
  }
  // Each is a genuinely new axis, not an alias of an existing one: a
  // different id pointing at the same question would double the denominator.
  assert.equal(axes.length, 16 + NEW_FACETS.length);
});

test("PACK: the plan names these five ids, verbatim", () => {
  const bullet = /New pack facets:[^.]*\./.exec(PLAN);
  assert.ok(bullet, "the P0.3(d) bullet still lists the facets to add");
  for (const axis of NEW_FACETS) {
    assert.ok(
      bullet[0].includes(`\`${axis}\``),
      `the plan's P0.3(d) bullet no longer names \`${axis}\``,
    );
  }
});

test("SCOPE: every declared axis is owned by at least one plan item", () => {
  // A facet no item judges is a facet nothing is ever measured against: it
  // drifts silently and the exit rule can never hold it to `proven`.
  const owned = new Set(Object.values(SCOPE_FACETS).flat());
  for (const axis of axes) {
    assert.ok(
      owned.has(axis),
      `axis "${axis}" is in no SCOPE_FACETS entry, so no plan item judges it`,
    );
  }
});

test("SCOPE: the items that do the work are the items that judge the facet", () => {
  // The routing that matters, taken from the plan's own phase tables: P2 is the
  // registry, P3 the path economics, P4 the use cases, P1.3 the coordinate
  // rounding, P5.4 the i18n runtime. If any of these loses its new facet, the
  // item could ship with that facet unmeasured.
  const routes = {
    "P2.1": "provenance", // registry schema, grades, licences
    "P2.6": "provenance", // live pricing.js adapters read the registry
    "P3.1": "comparison", // the four path cost models
    "P3.3": "comparison", // lease / PPA
    "P3.5": "comparison", // frontier + timeline per path
    "P4.1": "usecases", // export regimes
    "P4.4": "usecases", // outage simulator, essential loads
    "P1.3": "privacy", // round coordinates before egress
    "P5.3": "privacy", // cookie and CSP audit
    "P5.4": "translation", // per-locale files, Intl, parity gates
    "P6.9": "translation", // comprehension probe per locale
  };
  for (const [item, axis] of Object.entries(routes)) {
    assert.ok(
      SCOPE_FACETS[item]?.includes(axis),
      `${item} must judge "${axis}"`,
    );
  }
});

test("EVIDENCE: every declared axis carries a proof line in the run record", async () => {
  // The honest-failure mode this closes: an axis with no evidence line is
  // scored from nothing, and "mixed — partial or unverified evidence" then
  // reads like a product defect when it is really an empty record.
  //
  // An axis's line may now come from either place, and the test is about the
  // axis being ACCOUNTED FOR, not about where the words are typed. A gate that
  // measures an axis composes its line from the run (see
  // tests/jev-derived-facets.test.mjs); everything else is prose. What must
  // never happen is an axis in neither — that is the empty record this test
  // exists to prevent, and the reason it reads the gates' declared axes rather
  // than assuming every line is typed.
  const { LIGHTHOUSE_FACET_AXES, composeFacetLine } =
    await import("../scripts/lib/lighthouse-budgets.mjs");
  const ev = JSON.parse(
    readFileSync(join(ROOT, "evidence/advisor-and-release.json"), "utf8"),
  );

  // The derived lines a run of the Lighthouse gate would compose, built from the
  // RECORDED first measurement so this test needs no browser and no network.
  const derived = {};
  if (LIGHTHOUSE_FACET_AXES.includes("performance")) {
    const {
      LIGHTHOUSE_FIRST_MEASUREMENT,
      LIGHTHOUSE_RATCHET_CATEGORIES,
      LIGHTHOUSE_TARGETS,
    } = await import("../scripts/lib/lighthouse-budgets.mjs");
    derived.performance = composeFacetLine({
      lighthouse_version: "13.5.0",
      ratchet_categories: LIGHTHOUSE_RATCHET_CATEGORIES,
      regressions: [],
      holes: [],
      measured: LIGHTHOUSE_TARGETS.map((t) => ({
        scores: {
          performance: LIGHTHOUSE_FIRST_MEASUREMENT[t.id].performance.median,
          ...Object.fromEntries(
            LIGHTHOUSE_RATCHET_CATEGORIES.map((c) => [
              c,
              LIGHTHOUSE_FIRST_MEASUREMENT[t.id][c].median,
            ]),
          ),
        },
      })),
    });
  }

  for (const axis of axes) {
    const line = ev.facet_evidence?.[axis] ?? derived[axis];
    assert.equal(
      typeof line,
      "string",
      `facet_evidence.${axis} is missing, is not a string, and no gate ` +
        "declares it as derived — an axis in neither place is scored from nothing",
    );
    assert.ok(
      line.trim().length > 40,
      `facet_evidence.${axis} is too thin to be a proof line`,
    );
  }
});

test("HEURISTIC: the new facets are judged, never guessed by code", () => {
  // They are semantic axes: the only honest code-side answer is the neutral
  // "mixed — partial or unverified" tier, and a live judgment is what moves them.
  const levels = heuristicFacetLevels(
    { tests_green: true, seo_green: true, ci_green: true },
    pack,
  );
  for (const axis of NEW_FACETS) {
    assert.equal(
      pack.axes[axis].authority,
      "jev",
      `${axis} must be jev-authority or code could invent a level for it`,
    );
    assert.equal(
      levels[axis],
      2,
      `${axis} must default to the unverified tier without a live judgment`,
    );
  }
});

test("TRANSPORT: the budget is derived from the axis count, never pinned flat", () => {
  // The 16-axis record sat at 5972 of 6000: 28 characters of headroom. A
  // twenty-first axis cannot be added under a flat cap without the tail axes
  // losing their own proof lines, which is the exact failure the cap was raised
  // twice to stop. The budget therefore has to grow with the pack.
  assert.ok(
    stateTextBudget(axes) > 6000,
    "a 21-axis record needs more than the 16-axis cap, and must get it",
  );
  // Derived from the per-axis share, not chosen by hand: every axis line is
  // guaranteed its own allowance, so no facet can be crowded out by a neighbour.
  const shares = axes.map((a) => axisLineBudget(a));
  for (const share of shares) {
    assert.ok(
      share >= COMPLETE_STATE_PER_AXIS_CHARS,
      "an axis is never given less than the standard share",
    );
  }
  assert.equal(
    stateTextBudget(axes),
    COMPLETE_STATE_BASE_CHARS + shares.reduce((s, n) => s + n, 0),
    "the budget must be exactly the fixed part plus one share per declared axis",
  );
  assert.equal(
    stateTextBudget(axes),
    stateTextBudget([...axes]),
    "the budget is a pure function of the axis set",
  );
  assert.equal(
    stateTextBudget([]),
    COMPLETE_STATE_BASE_CHARS,
    "an empty axis set still reserves the fixed part of the record",
  );
  // One more axis must cost exactly one more share: that is what makes adding a
  // facet a budget question rather than an eviction.
  const more = [...axes, "an_extra_axis"];
  assert.equal(
    stateTextBudget(more) - stateTextBudget(axes),
    axisLineBudget("an_extra_axis"),
  );
});

test("TRANSPORT: every axis line fits the share the budget reserves for it", () => {
  for (const axis of axes) {
    const line = `${axis}: ` + "x".repeat(COMPLETE_FACET_CLIP) + "\n";
    assert.ok(
      axisLineBudget(axis) >= line.length,
      `${axis} line (${line.length}) exceeds its reserved share (${axisLineBudget(axis)})`,
    );
  }
  // A pathological name is covered rather than clamped: the guarantee is that a
  // facet's proof line is never pushed out of the record, whatever it is called.
  for (const name of ["x".repeat(40), "x".repeat(200), "x".repeat(400)]) {
    const line = `${name}: ` + "x".repeat(COMPLETE_FACET_CLIP) + "\n";
    assert.ok(
      axisLineBudget(name) >= line.length,
      `a ${name.length}-character axis name still fits its share`,
    );
  }
});

test("TRANSPORT: the real 21-axis record survives whole — every line and note", async () => {
  // The proof that the derived budget is enough, measured on the actual run
  // record rather than a synthetic maximum.
  const {
    LIGHTHOUSE_FACET_AXES,
    composeFacetLine,
    LIGHTHOUSE_FIRST_MEASUREMENT,
    LIGHTHOUSE_RATCHET_CATEGORIES,
    LIGHTHOUSE_TARGETS,
  } = await import("../scripts/lib/lighthouse-budgets.mjs");
  const ev = JSON.parse(
    readFileSync(join(ROOT, "evidence/advisor-and-release.json"), "utf8"),
  );
  // Built as the builder builds it: prose, plus the lines gates compose from a
  // run. The derived line is the real composed one (from the recorded first
  // measurement), so this measures the length that actually reaches the judge.
  if (LIGHTHOUSE_FACET_AXES.includes("performance")) {
    ev.facet_evidence.performance = composeFacetLine({
      lighthouse_version: "13.5.0",
      ratchet_categories: LIGHTHOUSE_RATCHET_CATEGORIES,
      regressions: [],
      holes: [],
      measured: LIGHTHOUSE_TARGETS.map((t) => ({
        scores: {
          performance: LIGHTHOUSE_FIRST_MEASUREMENT[t.id].performance.median,
          ...Object.fromEntries(
            LIGHTHOUSE_RATCHET_CATEGORIES.map((c) => [
              c,
              LIGHTHOUSE_FIRST_MEASUREMENT[t.id][c].median,
            ]),
          ),
        },
      })),
    });
  }
  const merged = mergeEvidence(ev, AUTO);
  const text = buildStateText(merged, AUTO, axes);
  for (const axis of axes) {
    assert.ok(text.includes(`${axis}: `), `axis lost from transport: ${axis}`);
  }
  for (const note of merged.notes) {
    assert.ok(text.includes(note), `note lost from transport: ${note}`);
  }
  assert.ok(
    text.length <= stateTextBudget(axes),
    "the record must fit the derived budget",
  );
  // Headroom is reported rather than assumed: a record that only just fits
  // will be cut by the next honest evidence line.
  const headroom = stateTextBudget(axes) - text.length;
  assert.ok(
    headroom >= 0,
    `negative headroom (${headroom}) would mean silent truncation`,
  );
});

test("TRANSPORT: a maximum-size record keeps every axis line whole", () => {
  // Worst case: every axis at its clip. The axes are the guarantee; a note tail
  // is the only accepted loss, so this asserts on the axes alone.
  const facet_evidence = {};
  for (const axis of axes) {
    facet_evidence[axis] = `${axis}: `.repeat(1) + "x".repeat(2000);
  }
  const merged = mergeEvidence(
    {
      tests_summary: "T".repeat(300),
      ci_summary: "C".repeat(320),
      smoke_note: "S".repeat(460),
      seo_summary: "E".repeat(260),
      advisor_audit: "A".repeat(480),
      facet_evidence,
      notes: ["note one survives", "note two survives"],
    },
    AUTO,
  );
  const text = buildStateText(merged, AUTO, axes);
  for (const axis of axes) {
    // The proof line repeats its own axis name, so it is distinguishable from
    // the fixed channels that share a name with an axis (`seo: <summary>`).
    const line = text
      .split("\n")
      .find((l) => l.startsWith(`${axis}: ${axis}: `));
    assert.ok(line, `axis lost at maximum record size: ${axis}`);
    assert.equal(
      line.length,
      axis.length + 2 + COMPLETE_FACET_CLIP,
      `${axis} line must be clipped, not dropped, at maximum size`,
    );
  }
});

test("TRANSPORT: the pre-existing flat-cap assertions still hold", () => {
  // 6000 stays as a floor for the 16-axis-era fixtures, so this item does not
  // quietly relax the bar the previous two transports were pinned to.
  const facet_evidence = {};
  for (const axis of axes) {
    facet_evidence[axis] = `${axis} proof: ` + "x".repeat(120);
  }
  const text = buildStateText(
    mergeEvidence(
      {
        tests_summary: "T".repeat(120),
        ci_summary: "C".repeat(120),
        smoke_note: "S".repeat(120),
        seo_summary: "sitemap/JSON-LD green",
        facet_evidence,
        notes: ["note one survives", "note two survives"],
      },
      AUTO,
    ),
    AUTO,
    axes,
  );
  assert.ok(text.length <= 6000, "the 6000 floor still holds for this fixture");
});
