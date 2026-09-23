// Pure core of the Jev complete gate — scores a BigEnergyCo tree/staging state
// 0-100 (95 = the 9.5/10 target) across ALL quality facets, emits required-work
// buckets per category, and groups recommended actions by work type.
//
// Ownership model (the contract this file enforces, no exceptions):
//   - CODE owns: evidence facts (tests/prettier/seo/smoke/ci/secrets/tree),
//     the hard-gate points, the pack schema, level ordinals, and arithmetic.
//     A hard-gate failure CAPS the score below the target no matter what the
//     semantic side says (fail-closed: prose can never wash out a red gate).
//   - JEV owns: a bounded semantic level per facet, answerable only from the
//     pack's declared levels via official TypeSafe score/choice shapes.
//     Code-authority facets take min(code, live) — Jev may lower a code fact,
//     never raise it (0-hallucination).
//   - The PACK owns every bucket, label, keyword, work type, and suggested
//     action. Nothing here invents remediation; unmatched stays unmatched.
//
// No I/O and no network in this module — scripts/validate-jev-complete.mjs
// collects evidence and performs the live call; tests exercise this file
// hermetically. Upstreamable-by-design: this mirrors the Harness Jev pack /
// sentiment / improvement-bucket contract so the generic half can be proposed
// as a handoff file if it ever earns a home upstream.
import { readFileSync } from "node:fs";

export const COMPLETE_PACK_PATH = "scripts/lib/jev-complete.pack.json";
export const COMPLETE_SITE = "jev_complete";
export const COMPLETE_MIN_SCORE = 95.0;
export const COMPLETE_SCORE_MAX = 100.0;

// Mechanical points per passing hard gate. Sum == 100.
export const HARD_GATE_POINTS = {
  tests_green: 30,
  smoke_green: 15,
  ci_green: 15,
  prettier_clean: 10,
  seo_green: 10,
  secrets_clean: 10,
  tree_clean: 10,
};

// Bucket id a failed hard gate maps to — always a pack-declared bucket.
export const HARD_GATE_BUCKETS = {
  tests_green: "tests_gap",
  smoke_green: "release_gap",
  ci_green: "release_gap",
  prettier_clean: "quality_gap",
  seo_green: "seo_gap",
  secrets_clean: "security_gap",
  tree_clean: "release_gap",
};

// The pass repertoire this repo actually runs, bucketed recommendations may
// only name one of these (validated with the pack).
export const WORK_TYPES = [
  "audit",
  "adversarial-fix",
  "playtest",
  "architecture",
  "polish",
  "deletion",
  "contract-tests",
  "release-verify",
];

// In-code canonical pack: hermetic fallback when no pack file exists (temp
// repos in tests). scripts/lib/jev-complete.pack.json must deep-equal this —
// tests/jev-complete.test.mjs pins the two together (the JEV-BAR pattern:
// the JSON file is canonical, this is the fallback that must never drift).
export const DEFAULT_COMPLETE_PACK = {
  id: "bigenergyco-complete-gate-v1",
  sentiment: {
    levels: [
      "failing — evidence contradicts quality",
      "at risk — known gap likely to hurt users or review",
      "mixed — partial or unverified evidence",
      "confident — solid with minor gaps",
      "proven — google-quality, evidenced end to end",
    ],
    ordinals: [0, 35, 60, 85, 100],
    blocking_max_index: 0,
    improve_below_index: 3,
  },
  axes: {
    spec: {
      authority: "jev",
      bucket: "spec_gap",
      instructions:
        "Rate SPEC conformance: does the evidence show the product delivers " +
        "exactly what was requested — every requested outcome present and " +
        "working, and no unrequested features, UI, or rewrites added?",
    },
    design: {
      authority: "jev",
      bucket: "design_gap",
      instructions:
        "Rate DESIGN: one owner per piece of state, concerns in separate " +
        "modules, a change to one behavior landing in one obvious place — " +
        "or a grown app still living in one or two giant files?",
    },
    correctness: {
      authority: "jev",
      bucket: "correctness_gap",
      instructions:
        "Rate CORRECTNESS: was behavior exercised through the real surface " +
        "(browser/CLI/service) rather than re-read — boundary, empty-input, " +
        "ordering, async, cleanup and state-sync failures hunted and fixed?",
    },
    quality: {
      authority: "jev",
      bucket: "quality_gap",
      instructions:
        "Rate QUALITY/concision: no unnecessary lines, branches, " +
        "abstractions, dead scaffolding, or duplicated logic; formatting " +
        "clean; the smallest version that keeps the proven behavior.",
    },
    security: {
      authority: "jev",
      bucket: "security_gap",
      instructions:
        "Rate SECURITY/privacy against the free-public mission: no secrets " +
        "in the tree, CSP/headers sane, sensitive actions (geolocation, " +
        "auto-runs) only on explicit user consent, no lead-collection or " +
        "paywall creep. Evidence facts state what was checked.",
    },
    performance: {
      authority: "jev",
      bucket: "perf_gap",
      instructions:
        "Rate PERFORMANCE: warm same-location interactions are instant, " +
        "no redundant network re-pulls (weather/NASA memoized), and the " +
        "first paint stays light. Cite only what the evidence describes.",
    },
    accessibility: {
      authority: "jev",
      bucket: "a11y_gap",
      instructions:
        "Rate ACCESSIBILITY: keyboard reachability, labels/ARIA on the " +
        "calculator controls, contrast, and reduced-motion respect across " +
        "the main flows described in the evidence.",
    },
    i18n: {
      authority: "jev",
      bucket: "i18n_gap",
      instructions:
        "Rate I18N: locale parity for user-visible strings (all locales " +
        "carry the same keys), no hardcoded English leaking into non-English " +
        "locales, and locale switching covering the main flows.",
    },
    seo: {
      authority: "code",
      bucket: "seo_gap",
      instructions:
        "Rate SEO from the code-owned gate evidence only: sitemap, " +
        "JSON-LD, metadata and character checks green means proven; a red " +
        "gate means failing; no run recorded means unverified.",
    },
    resilience: {
      authority: "jev",
      bucket: "resilience_gap",
      instructions:
        "Rate RESILIENCE of the delivery path: transient-failure retry " +
        "classification, nested timeout budgets that provably fit, and " +
        "stuck-run recovery — as evidenced, not aspired.",
    },
    experience: {
      authority: "jev",
      bucket: "experience_gap",
      instructions:
        "Rate EXPERIENCE: first-run clarity within moments, actions " +
        "acknowledging themselves, errors saying what to do next, empty " +
        "states inviting rather than confusing, coherent spacing/hierarchy.",
    },
    docs: {
      authority: "jev",
      bucket: "docs_gap",
      instructions:
        "Rate DOCS: architecture and runbook match the code as it now " +
        "stands (module ownership, gate inventory, deploy steps) — not " +
        "stale descriptions of removed behavior.",
    },
    testing: {
      authority: "code",
      bucket: "tests_gap",
      instructions:
        "Rate TESTING from the code-owned evidence only: a green full unit " +
        "suite means proven, a red suite means failing, no recorded run " +
        "means unverified.",
    },
    release: {
      authority: "code",
      bucket: "release_gap",
      instructions:
        "Rate RELEASE readiness from code-owned facts only: CI green, " +
        "browser smoke green, and a clean tree mean proven; any recorded " +
        "red means at risk; unknowns mean unverified.",
    },
    physics: {
      authority: "jev",
      bucket: "physics_gap",
      instructions:
        "Rate PHYSICS/determinism of the sizing engine: hourly irradiance " +
        "derivations deterministic, thresholds intact (none weakened), and " +
        "live-model validation status as stated in the evidence.",
    },
  },
  buckets: {
    spec_gap: {
      label: "Spec conformance gap",
      path_id: "complete/spec",
      work_type: "audit",
      keywords: ["unrequested", "scope creep", "not asked", "missing feature"],
      suggested_next_action:
        "Run the four-dimension audit pass against the request as written: " +
        "list every unrequested addition to remove and every requested " +
        "outcome that is not yet present and working.",
    },
    design_gap: {
      label: "Design / ownership gap",
      path_id: "complete/design",
      work_type: "architecture",
      keywords: ["monolith", "too many lines", "ownership", "coupled", "giant"],
      suggested_next_action:
        "Run the architecture pass: name the state each module owns, move " +
        "misplaced logic to its owner, and extract the next cohesive unit " +
        "from any file still acting as a second application controller.",
    },
    correctness_gap: {
      label: "Correctness gap",
      path_id: "complete/correctness",
      work_type: "adversarial-fix",
      keywords: ["race", "stale", "async", "broken", "flaky", "hang"],
      suggested_next_action:
        "Run the adversarial exercise pass through real entry points: hunt " +
        "boundary, ordering, async and state-sync failures, fix only " +
        "substantiated defects, then re-run the failing flows.",
    },
    quality_gap: {
      label: "Concision / formatting gap",
      path_id: "complete/quality",
      work_type: "deletion",
      keywords: ["prettier", "format", "dead code", "scaffolding", "verbose"],
      suggested_next_action:
        "Run the deletion-first pass: npx prettier --write the red files, " +
        "then delete redundancy, one-use indirection and unrequested " +
        "branches; re-run focused checks after pruning.",
    },
    security_gap: {
      label: "Security / consent gap",
      path_id: "complete/security",
      work_type: "adversarial-fix",
      keywords: ["secret", "key", "csp", "consent", "geolocation", "header"],
      suggested_next_action:
        "Run the adversarial pass over security surfaces: confirm no secret " +
        "is tracked, headers/CSP intact, and every sensitive action stays " +
        "behind explicit user consent; fix what contradicts that.",
    },
    perf_gap: {
      label: "Performance gap",
      path_id: "complete/performance",
      work_type: "playtest",
      keywords: ["slow", "refetch", "re-pull", "reload", "latency", "cache"],
      suggested_next_action:
        "Run the playtest pass on the real surface: measure the slow " +
        "interaction, confirm warm-cache paths issue zero redundant " +
        "network pulls, and make subsequent adjustments instant.",
    },
    a11y_gap: {
      label: "Accessibility gap",
      path_id: "complete/a11y",
      work_type: "polish",
      keywords: ["keyboard", "aria", "contrast", "focus", "screen reader"],
      suggested_next_action:
        "Run the experience-polish pass focused on accessibility: keyboard " +
        "through every main flow, label the calculator controls, fix " +
        "contrast, and verify reduced-motion behavior.",
    },
    i18n_gap: {
      label: "Localization gap",
      path_id: "complete/i18n",
      work_type: "contract-tests",
      keywords: ["locale", "translation", "hardcoded", "parity", "language"],
      suggested_next_action:
        "Pin locale parity as a behavioral test (every locale carries every " +
        "user-visible key), fix the drifting strings it exposes, and keep " +
        "the parity check green.",
    },
    seo_gap: {
      label: "SEO gate gap",
      path_id: "complete/seo",
      work_type: "audit",
      keywords: ["sitemap", "json-ld", "metadata", "structured", "canonical"],
      suggested_next_action:
        "Run npm run seo, fix whatever it reports (sitemap, JSON-LD, " +
        "metadata, characters), and record the green run as evidence.",
    },
    resilience_gap: {
      label: "Delivery resilience gap",
      path_id: "complete/resilience",
      work_type: "adversarial-fix",
      keywords: ["timeout", "budget", "retry", "503", "stall", "watchdog"],
      suggested_next_action:
        "Run the adversarial pass over the delivery path: prove inner " +
        "retry/timeout budgets fit every outer cap, classification covers " +
        "transport failures end to end, and stuck runs recover.",
    },
    experience_gap: {
      label: "User experience gap",
      path_id: "complete/experience",
      work_type: "polish",
      keywords: [
        "confusing",
        "empty state",
        "feedback",
        "error message",
        "lost",
      ],
      suggested_next_action:
        "Run the experience-polish pass: walk the first-run flow, make " +
        "actions acknowledge themselves, give errors a next step, and " +
        "invite rather than confuse in empty states.",
    },
    docs_gap: {
      label: "Documentation drift",
      path_id: "complete/docs",
      work_type: "architecture",
      keywords: ["stale", "outdated", "undocumented", "docs", "runbook"],
      suggested_next_action:
        "Run the architecture pass's documentation step: reconcile " +
        "ARCHITECTURE and the deploy runbook with the code as it stands, " +
        "deleting descriptions of behavior that no longer exists.",
    },
    tests_gap: {
      label: "Test suite gap",
      path_id: "complete/tests",
      work_type: "contract-tests",
      keywords: ["test", "suite", "coverage", "regression", "assertion"],
      suggested_next_action:
        "Get the full unit suite green (npm test), add behavioral contracts " +
        "for any behavior that changed without one, and never weaken a " +
        "gate to get there.",
    },
    release_gap: {
      label: "Release readiness gap",
      path_id: "complete/release",
      work_type: "release-verify",
      keywords: ["ci", "smoke", "dirty", "uncommitted", "merge", "staging"],
      suggested_next_action:
        "Run the release-candidate pass: ship in-flight work through the " +
        "protected path, get CI and browser smoke green on the merge, and " +
        "re-run this gate on the clean tree.",
    },
    physics_gap: {
      label: "Physics / determinism gap",
      path_id: "complete/physics",
      work_type: "contract-tests",
      keywords: ["determinism", "threshold", "irradiance", "nasa", "engine"],
      suggested_next_action:
        "Pin the physics contract with tests: deterministic derivations, " +
        "thresholds intact, and a recorded verify:live run — fix any " +
        "assertion the evidence shows weakened.",
    },
  },
};

/**
 * Validate an operator complete-gate pack; return a clean copy.
 * Shape: {id, sentiment{levels>=2 unique, ordinals same-length 0..100
 * non-decreasing, blocking_max_index, improve_below_index},
 * axes{id: {authority: code|jev, bucket, instructions}},
 * buckets{id: {label, path_id, work_type ∈ WORK_TYPES, keywords[], action}}}.
 * Reserved: axis id "primary_gap", bucket id "none".
 */
export function validateCompletePack(pack) {
  if (typeof pack !== "object" || pack === null || Array.isArray(pack)) {
    throw new Error("complete pack must be an object");
  }
  const id = pack.id;
  if (typeof id !== "string" || !id) {
    throw new Error("complete pack requires a non-empty string id");
  }
  const sentiment = pack.sentiment;
  if (
    typeof sentiment !== "object" ||
    sentiment === null ||
    Array.isArray(sentiment)
  ) {
    throw new Error("complete pack requires a sentiment block object");
  }
  const levels = sentiment.levels;
  if (
    !Array.isArray(levels) ||
    levels.length < 2 ||
    levels.some((x) => typeof x !== "string" || !x)
  ) {
    throw new Error(
      "complete pack sentiment levels must be at least two non-empty strings",
    );
  }
  if (new Set(levels).size !== levels.length) {
    throw new Error("complete pack sentiment levels must be unique");
  }
  const ordinals = sentiment.ordinals;
  if (
    !Array.isArray(ordinals) ||
    ordinals.length !== levels.length ||
    ordinals.some((o) => typeof o !== "number" || Number.isNaN(o))
  ) {
    throw new Error(
      "complete pack sentiment ordinals must be numbers matching levels length",
    );
  }
  if (ordinals.some((o) => o < 0 || o > 100)) {
    throw new Error("complete pack sentiment ordinals must be within 0..100");
  }
  for (let i = 0; i < ordinals.length - 1; i += 1) {
    if (ordinals[i] > ordinals[i + 1]) {
      throw new Error(
        "complete pack sentiment ordinals must be non-decreasing",
      );
    }
  }
  const blockingMax = sentiment.blocking_max_index;
  if (
    typeof blockingMax !== "number" ||
    !Number.isInteger(blockingMax) ||
    blockingMax < 0 ||
    blockingMax >= levels.length
  ) {
    throw new Error(
      "complete pack sentiment blocking_max_index must be an in-range int",
    );
  }
  const improveBelow = sentiment.improve_below_index;
  if (
    typeof improveBelow !== "number" ||
    !Number.isInteger(improveBelow) ||
    improveBelow < 0 ||
    improveBelow > levels.length
  ) {
    throw new Error(
      "complete pack sentiment improve_below_index must be an in-range int",
    );
  }

  const buckets = pack.buckets;
  if (
    typeof buckets !== "object" ||
    buckets === null ||
    Array.isArray(buckets)
  ) {
    throw new Error("complete pack requires a non-empty buckets map");
  }
  const bucketIds = Object.keys(buckets);
  if (bucketIds.length === 0) {
    throw new Error("complete pack requires a non-empty buckets map");
  }
  const outBuckets = {};
  for (const bid of bucketIds) {
    if (!bid) throw new Error("bucket ids must be non-empty strings");
    if (bid === "none") throw new Error("bucket id 'none' is reserved");
    const bucket = buckets[bid];
    if (
      typeof bucket !== "object" ||
      bucket === null ||
      Array.isArray(bucket)
    ) {
      throw new Error(`bucket ${JSON.stringify(bid)} must be an object`);
    }
    if (typeof bucket.label !== "string" || !bucket.label) {
      throw new Error(
        `bucket ${JSON.stringify(bid)} requires a non-empty label`,
      );
    }
    if (typeof bucket.path_id !== "string" || !bucket.path_id) {
      throw new Error(
        `bucket ${JSON.stringify(bid)} requires a non-empty path_id`,
      );
    }
    if (!WORK_TYPES.includes(bucket.work_type)) {
      throw new Error(
        `bucket ${JSON.stringify(bid)} work_type must be one of: ${WORK_TYPES.join(", ")}`,
      );
    }
    if (
      !Array.isArray(bucket.keywords) ||
      bucket.keywords.some((k) => typeof k !== "string" || !k)
    ) {
      throw new Error(
        `bucket ${JSON.stringify(bid)} keywords must be a list of non-empty strings`,
      );
    }
    if (
      typeof bucket.suggested_next_action !== "string" ||
      !bucket.suggested_next_action
    ) {
      throw new Error(
        `bucket ${JSON.stringify(bid)} requires a non-empty suggested_next_action`,
      );
    }
    outBuckets[bid] = {
      label: bucket.label,
      path_id: bucket.path_id,
      work_type: bucket.work_type,
      keywords: [...bucket.keywords],
      suggested_next_action: bucket.suggested_next_action,
    };
  }

  const axes = pack.axes;
  if (typeof axes !== "object" || axes === null || Array.isArray(axes)) {
    throw new Error("complete pack requires a non-empty axes map");
  }
  const axisIds = Object.keys(axes);
  if (axisIds.length === 0) {
    throw new Error("complete pack requires a non-empty axes map");
  }
  const outAxes = {};
  for (const axis of axisIds) {
    if (!axis) throw new Error("axis ids must be non-empty strings");
    if (axis === "primary_gap")
      throw new Error("axis id 'primary_gap' is reserved");
    const spec = axes[axis];
    if (typeof spec !== "object" || spec === null || Array.isArray(spec)) {
      throw new Error(`axis ${JSON.stringify(axis)} must be an object`);
    }
    if (spec.authority !== "code" && spec.authority !== "jev") {
      throw new Error(
        `axis ${JSON.stringify(axis)} authority must be 'code' or 'jev'`,
      );
    }
    if (typeof spec.bucket !== "string" || !(spec.bucket in outBuckets)) {
      throw new Error(
        `axis ${JSON.stringify(axis)} bucket must be a declared bucket id`,
      );
    }
    if (typeof spec.instructions !== "string" || !spec.instructions) {
      throw new Error(
        `axis ${JSON.stringify(axis)} requires non-empty instructions`,
      );
    }
    outAxes[axis] = {
      authority: spec.authority,
      bucket: spec.bucket,
      instructions: spec.instructions,
    };
  }

  return {
    id,
    sentiment: {
      levels: [...levels],
      ordinals: [...ordinals],
      blocking_max_index: blockingMax,
      improve_below_index: improveBelow,
    },
    axes: outAxes,
    buckets: outBuckets,
  };
}

/**
 * Load the canonical pack JSON from disk; fall back to the in-code default
 * only when the file is absent (hermetic temp repos). An explicit bad path
 * still throws — same rule as the upstream completion-pack loader.
 */
export function loadCompletePack(repoRoot = ".") {
  try {
    const raw = readFileSync(joinPath(repoRoot, COMPLETE_PACK_PATH), "utf8");
    return validateCompletePack(JSON.parse(raw));
  } catch (err) {
    if (err && (err.code === "ENOENT" || err.code === "ENOTDIR")) {
      return validateCompletePack(DEFAULT_COMPLETE_PACK);
    }
    if (err instanceof SyntaxError) {
      throw new Error(`invalid complete pack JSON: ${err.message}`);
    }
    throw err;
  }
}

function joinPath(root, rel) {
  const sep = process.platform === "win32" ? "\\" : "/";
  return String(root).replace(/[\\/]+$/, "") + sep + rel.split("/").join(sep);
}

/**
 * The TypeSafe question pack: one `score` per declared axis (criteria = the
 * declared levels, in order) plus one `primary_gap` choice over the declared
 * buckets + "none". Typed primitives only; nothing invented.
 */
export function completeQuestionPack(pack) {
  const doc = validateCompletePack(pack);
  const questions = {};
  for (const [axis, spec] of Object.entries(doc.axes)) {
    questions[axis] = {
      type: "score",
      instructions: spec.instructions,
      criteria: [...doc.sentiment.levels],
    };
  }
  const criteria = {};
  for (const [bid, entry] of Object.entries(doc.buckets)) {
    criteria[bid] = entry.label;
  }
  criteria.none = "no improvement needed";
  questions.primary_gap = {
    type: "choice",
    instructions:
      "Choose the single declared bucket that best represents the primary " +
      "gap blocking this product from a confident pass at the 95/100 " +
      "(9.5/10) quality bar, or 'none' when no improvement is needed. " +
      "Select only from the declared criteria keys; do not invent categories.",
    criteria,
  };
  return questions;
}

/**
 * Code-owned deterministic level per axis from evidence (the fallback floor
 * for unkeyed runs and the base code-authority facts). Recognized ids:
 * testing / seo / release — straight from their hard evidence. Every other
 * axis gets the neutral "mixed" tier (index 2): this heuristic NEVER guesses
 * a semantic quality it was not given a fact for; live Jev (or the honest
 * unverified floor) decides those.
 */
export function heuristicFacetLevels(evidence, pack) {
  const doc = validateCompletePack(pack);
  const n = doc.sentiment.levels.length;
  const neutral = Math.min(2, n - 1);
  const ev = typeof evidence === "object" && evidence !== null ? evidence : {};
  const out = {};
  for (const axis of Object.keys(doc.axes)) {
    if (axis === "testing") {
      out[axis] =
        ev.tests_green === true ? 4 : ev.tests_green === false ? 0 : neutral;
    } else if (axis === "seo") {
      out[axis] =
        ev.seo_green === true ? 4 : ev.seo_green === false ? 0 : neutral;
    } else if (axis === "release") {
      const known = [ev.ci_green, ev.smoke_green, ev.tree_clean];
      if (known.every((v) => v === true)) out[axis] = 4;
      else if (known.some((v) => v === false)) out[axis] = 1;
      else out[axis] = neutral;
    } else {
      out[axis] = neutral;
    }
  }
  return out;
}

/**
 * Keyword fallback for primary_gap only (unkeyed / transport-failed runs).
 * Deterministic: most hits wins, ties keep the lexicographically first id.
 * Never invents a bucket; zero hits returns null.
 */
export function matchCompleteKeywords(text, pack) {
  const doc = validateCompletePack(pack);
  const lower = typeof text === "string" ? text.toLowerCase() : "";
  let bestId = null;
  let bestScore = 0;
  let bestEvidence = [];
  for (const bid of Object.keys(doc.buckets).sort()) {
    const hits = doc.buckets[bid].keywords.filter((kw) =>
      lower.includes(kw.toLowerCase()),
    );
    if (hits.length > bestScore) {
      bestId = bid;
      bestScore = hits.length;
      bestEvidence = hits;
    }
  }
  if (bestScore === 0 || bestId === null)
    return { bucket: null, score: 0, evidence: [] };
  return { bucket: bestId, score: bestScore, evidence: bestEvidence };
}

/**
 * Parse a live TypeSafe answer set under the 0-hallucination contract:
 * per axis, the highest-probability legend anchor whose declared level string
 * is one of the pack's own levels → its index; anything missing/invalid →
 * null (never invented). primary_gap ∈ declared buckets, "none" → null, an
 * out-of-pack choice → refused with a note. Returns null for the whole
 * judgment when no axis answered validly (caller treats that as fallback).
 */
export function parseLiveAnswers(answers, pack) {
  const doc = validateCompletePack(pack);
  if (typeof answers !== "object" || answers === null) return null;
  const levelIds = doc.sentiment.levels;
  const bucketIds = new Set(Object.keys(doc.buckets));
  const liveLevels = {};
  const liveConfidence = {};
  const notes = [];
  let anyValid = false;
  for (const axis of Object.keys(doc.axes)) {
    const answer = answers[axis];
    let level = null;
    let value = null;
    let conf = null;
    if (typeof answer === "object" && answer !== null) {
      const probs = answer.probabilities;
      const legend = answer.legend;
      if (
        typeof probs === "object" &&
        probs !== null &&
        typeof legend === "object" &&
        legend !== null
      ) {
        for (const [anchor, lvl] of Object.entries(legend)) {
          if (typeof lvl !== "string" || !levelIds.includes(lvl)) continue;
          const prob = probs[String(anchor)];
          if (typeof prob === "number" && (value === null || prob > value)) {
            level = lvl;
            value = prob;
          }
        }
      }
      const rawConf = answer.confidence;
      if (typeof rawConf === "number" && !Number.isNaN(rawConf)) conf = rawConf;
    }
    if (level !== null) {
      anyValid = true;
      liveLevels[axis] = levelIds.indexOf(level);
      notes.push(`${axis}:${level}`);
    } else {
      liveLevels[axis] = null;
      notes.push(`${axis}:unmatched`);
    }
    liveConfidence[axis] = conf;
  }
  let primaryGap = null;
  const gapAnswer = answers.primary_gap;
  const choice =
    typeof gapAnswer === "object" && gapAnswer !== null
      ? gapAnswer.choice
      : null;
  if (choice === "none") {
    notes.push("primary_gap:none");
  } else if (typeof choice === "string" && bucketIds.has(choice)) {
    primaryGap = choice;
    notes.push(`primary_gap:${choice}`);
  } else if (typeof choice === "string") {
    notes.push(`out-of-pack primary_gap refused: ${JSON.stringify(choice)}`);
  } else {
    notes.push("primary_gap:unmatched");
  }
  if (!anyValid) return null;
  return {
    live_levels: liveLevels,
    live_confidence: liveConfidence,
    primary_gap: primaryGap,
    notes,
  };
}

/**
 * Bounded state text for the live call (mirrors the upstream 1200-char
 * evidence view): the merge of auto facts + recorded gate runs + notes.
 */
export function buildStateText(evidence, auto = {}) {
  const ev = typeof evidence === "object" && evidence !== null ? evidence : {};
  const parts = [
    `target=${auto.target || "local"} ref=${auto.sha || "?"}`,
    `gates: tests=${ev.tests_green} prettier=${ev.prettier_clean} seo=${ev.seo_green} ` +
      `smoke=${ev.smoke_green} ci=${ev.ci_green}`,
    `tree_clean=${auto.treeClean === true} secrets_clean=${auto.secretsClean === true}`,
    `tests: ${ev.tests_summary || "unrecorded"}`,
    `ci: ${ev.ci_summary || "unrecorded"}`,
    `smoke: ${ev.smoke_note || "unrecorded"}`,
    `dirty: ${(auto.dirtyPaths || []).slice(0, 8).join(" ")}`,
    `tests_present=${auto.testCount || 0} files`,
    `notes: ${Array.isArray(ev.notes) ? ev.notes.slice(0, 6).join(" | ") : ""}`,
  ];
  return parts.filter(Boolean).join("\n").slice(0, 1200);
}

/**
 * Merge evidence over auto facts. Run-derived keys come from the evidence
 * file with FAIL-CLOSED defaults (absent = false = red, never optimistically
 * green); auto facts are code-owned and cannot be overridden by evidence.
 */
export function mergeEvidence(evidence, auto) {
  const ev = typeof evidence === "object" && evidence !== null ? evidence : {};
  const keys = [
    "tests_green",
    "prettier_clean",
    "seo_green",
    "smoke_green",
    "ci_green",
  ];
  const merged = {};
  for (const key of keys) merged[key] = ev[key] === true;
  merged.tests_summary =
    typeof ev.tests_summary === "string" ? ev.tests_summary : "";
  merged.seo_summary = typeof ev.seo_summary === "string" ? ev.seo_summary : "";
  merged.smoke_note = typeof ev.smoke_note === "string" ? ev.smoke_note : "";
  merged.ci_summary = typeof ev.ci_summary === "string" ? ev.ci_summary : "";
  merged.notes = Array.isArray(ev.notes) ? ev.notes.map(String) : [];
  merged.secrets_clean = auto.secretsClean === true;
  merged.env_ignored = auto.envIgnored === true;
  merged.tree_clean = auto.treeClean === true;
  return merged;
}

function hardGates(evidence) {
  const points = { ...HARD_GATE_POINTS };
  const gates = {};
  for (const key of Object.keys(points)) gates[key] = evidence[key] === true;
  return gates;
}

/**
 * The gate itself: evidence + optional live judgment → the full 0-100 report.
 *
 * Arithmetic (fail-closed, both directions):
 *   mechanical = sum(points of passing hard gates), sum(all) == 100;
 *   semantic   = mean(ordinal of each facet's effective level);
 *   effective  = code authority: min(code level, live level when valid) —
 *                Jev may LOWER a code fact, never raise it;
 *                jev authority: live level when valid, else code heuristic;
 *   combined   = all hard gates pass ? 0.7*mechanical + 0.3*semantic
 *                : max(0, min(mechanical, semantic, min_score - 0.01));
 *   pass       = all hard gates AND combined >= min_score AND no facet at a
 *                blocking level. Hard-red evidence therefore makes 95
 *                unreachable no matter how generous the prose reads.
 *
 * required_work: every facet below improve_below_index (and every failed hard
 * gate, dedup worst-wins) surfaced through its pack-declared bucket;
 * recommended_actions: the same items grouped by the bucket's declared
 * work_type (severity order preserved inside each group).
 */
export function scoreCompleteGate(
  evidence,
  { pack, minScore, liveJudgment, keywordGap } = {},
) {
  const doc = validateCompletePack(pack ?? DEFAULT_COMPLETE_PACK);
  const target =
    typeof minScore === "number" && minScore > 0
      ? minScore
      : COMPLETE_MIN_SCORE;
  const ev = typeof evidence === "object" && evidence !== null ? evidence : {};
  const gates = hardGates(ev);
  const mechanical = Object.entries(HARD_GATE_POINTS).reduce(
    (sum, [key, pts]) => sum + (gates[key] ? pts : 0),
    0,
  );
  const allHard = Object.values(gates).every(Boolean);

  const codeLevels = heuristicFacetLevels(ev, doc);
  const live = liveJudgment || null;
  const facets = {};
  for (const [axis, spec] of Object.entries(doc.axes)) {
    const codeIdx = codeLevels[axis];
    const liveIdx =
      live && live.live_levels && typeof live.live_levels[axis] === "number"
        ? live.live_levels[axis]
        : null;
    let effective;
    let source;
    if (spec.authority === "code") {
      if (liveIdx !== null && liveIdx >= 0) {
        effective = Math.min(codeIdx, liveIdx);
        source = liveIdx < codeIdx ? "live" : "code";
      } else {
        effective = codeIdx;
        source = "code";
      }
    } else if (liveIdx !== null && liveIdx >= 0) {
      effective = liveIdx;
      source = "live";
    } else {
      effective = codeIdx;
      source = "heuristic";
    }
    const confidence =
      live && live.live_confidence
        ? (live.live_confidence[axis] ?? null)
        : null;
    facets[axis] = {
      bucket: spec.bucket,
      authority: spec.authority,
      level: doc.sentiment.levels[effective],
      index: effective,
      ordinal: doc.sentiment.ordinals[effective],
      source,
      confidence,
    };
  }

  const semantic =
    Object.values(facets).reduce((sum, f) => sum + f.ordinal, 0) /
    Math.max(1, Object.keys(facets).length);

  let combined;
  if (!allHard) {
    combined = Math.max(0, Math.min(mechanical, semantic, target - 0.01));
  } else {
    combined = 0.7 * mechanical + 0.3 * semantic;
    combined = Math.max(0, Math.min(COMPLETE_SCORE_MAX, combined));
  }

  const blocking = Object.entries(facets)
    .filter(([, f]) => f.index <= doc.sentiment.blocking_max_index)
    .map(([axis]) => axis)
    .sort();
  const pass = allHard && combined >= target && blocking.length === 0;

  // ── required work ────────────────────────────────────────────────────────
  const improvementByBucket = {};
  const addImprovement = (bucketId, axis, level, ordinal, source) => {
    if (!bucketId || !(bucketId in doc.buckets)) return;
    const entry = doc.buckets[bucketId];
    const candidate = {
      bucket: bucketId,
      label: entry.label,
      path_id: entry.path_id,
      work_type: entry.work_type,
      suggested_next_action: entry.suggested_next_action,
      axis,
      level,
      ordinal,
      source,
      confidence: axis && facets[axis] ? facets[axis].confidence : null,
    };
    const existing = improvementByBucket[bucketId];
    if (
      existing === undefined ||
      (ordinal !== null &&
        (existing.ordinal === null || ordinal < existing.ordinal))
    ) {
      improvementByBucket[bucketId] = candidate;
    }
  };
  for (const [axis, f] of Object.entries(facets)) {
    if (f.index < doc.sentiment.improve_below_index) {
      addImprovement(f.bucket, axis, f.level, f.ordinal, f.source);
    }
  }
  for (const [gateKey, bucketId] of Object.entries(HARD_GATE_BUCKETS)) {
    if (!gates[gateKey]) {
      // A code-certain hard-gate failure outranks any semantic flag on the
      // same bucket — ordinal -1 always wins the dedupe.
      addImprovement(bucketId, null, null, -1, "hard_gate");
    }
  }
  const primaryGap =
    (live && typeof live.primary_gap === "string" && live.primary_gap) ||
    (keywordGap && typeof keywordGap.bucket === "string"
      ? keywordGap.bucket
      : null);
  const primarySource =
    live && live.primary_gap ? "live" : keywordGap ? "keyword" : null;
  if (primaryGap && !(primaryGap in improvementByBucket)) {
    const entry = doc.buckets[primaryGap];
    if (entry) {
      improvementByBucket[primaryGap] = {
        bucket: primaryGap,
        label: entry.label,
        path_id: entry.path_id,
        work_type: entry.work_type,
        suggested_next_action: entry.suggested_next_action,
        axis: null,
        level: null,
        ordinal: null,
        source: primarySource,
        confidence: null,
      };
    }
  }
  const requiredWork = Object.values(improvementByBucket).sort((a, b) => {
    const ao = a.ordinal === null ? 50 : a.ordinal;
    const bo = b.ordinal === null ? 50 : b.ordinal;
    return ao - bo || String(a.axis || "").localeCompare(String(b.axis || ""));
  });
  for (const item of requiredWork) {
    item.primary = Boolean(primaryGap && item.bucket === primaryGap);
  }

  const recommended = {};
  for (const item of requiredWork) {
    if (!recommended[item.work_type]) recommended[item.work_type] = [];
    recommended[item.work_type].push({
      bucket: item.bucket,
      label: item.label,
      path_id: item.path_id,
      suggested_next_action: item.suggested_next_action,
      axis: item.axis,
      level: item.level,
      ordinal: item.ordinal,
      primary: item.primary,
    });
  }
  const workOrder = [...WORK_TYPES].sort((a, b) => {
    const aw = recommended[a]
      ? Math.min(
          ...recommended[a].map((i) => (i.ordinal === null ? 50 : i.ordinal)),
        )
      : Infinity;
    const bw = recommended[b]
      ? Math.min(
          ...recommended[b].map((i) => (i.ordinal === null ? 50 : i.ordinal)),
        )
      : Infinity;
    return aw - bw || a.localeCompare(b);
  });
  const recommendedActions = {};
  for (const wt of workOrder) {
    if (recommended[wt]) recommendedActions[wt] = recommended[wt];
  }

  const blockers = [];
  for (const gateKey of Object.keys(HARD_GATE_POINTS)) {
    if (!gates[gateKey]) blockers.push(`hard gate failed: ${gateKey}`);
  }
  for (const axis of blocking) blockers.push(`blocking facet: ${axis}`);
  if (combined < target) {
    blockers.push(
      `score ${combined.toFixed(2)} below target ${target.toFixed(2)}`,
    );
  }

  return {
    gate: "jev-complete",
    pack_id: doc.id,
    min_score: target,
    score: Math.round(combined * 100) / 100,
    pass,
    hard_gates: gates,
    mechanical_score: mechanical,
    semantic_score: Math.round(semantic * 100) / 100,
    facets,
    blocking_facets: blocking,
    required_work: requiredWork,
    recommended_actions: recommendedActions,
    blockers,
    live: {
      is_fallback: !live,
      primary_gap: primaryGap,
      primary_gap_source: primarySource,
      notes: live && Array.isArray(live.notes) ? live.notes : [],
    },
    evidence: {
      tests_summary: ev.tests_summary || "",
      seo_summary: ev.seo_summary || "",
      smoke_note: ev.smoke_note || "",
      ci_summary: ev.ci_summary || "",
      notes: [...(ev.notes || [])],
      dirty_paths:
        evidence && Array.isArray(evidence._dirtyPaths)
          ? evidence._dirtyPaths
          : [],
    },
  };
}
