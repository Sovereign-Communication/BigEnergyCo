// The experience facet's rules, checked against false readings.
//
// Every test in here that names a MUTATION is asserting the same one thing: that
// the evaluator can say NO. A gate whose rules only ever fire on the healthy
// reading is indistinguishable from a gate that is not there, and it is the only
// way a score can rise in this repo without the product changing — which is the
// defect this file exists to make impossible.
//
// So for each expectation there is at least one reading that is green everywhere
// else and violates exactly that one, and the assertion is that a NAMED failure
// comes out. A test that only ever fed the good reading would pass against an
// evaluator that returned { regressions: [], holes: [] } unconditionally.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  EXPERIENCE_ACTIONS,
  EXPERIENCE_EMPTY_STATES,
  EXPERIENCE_ERRORS,
  EXPERIENCE_EXPECTATIONS,
  EXPERIENCE_FACET_AXES,
  EXPERIENCE_LOCALES,
  EXPERIENCE_SCOPE_LIMIT,
  LOCALE_PHASES,
  LOCALE_SURFACES,
  composeExperienceFacetLine,
  composeTranslationFacetLine,
  evaluateExperience,
  judgeLocaleSweep,
  summariseLocaleSweep,
} from "../scripts/lib/experience-budgets.mjs";
import {
  LOCALE_KEYS,
  hasNextStep,
  withNextStep,
} from "../scripts/smoke/experience.mjs";
import { COMPLETE_FACET_CLIP } from "../scripts/lib/jev-complete.mjs";
import { LOCALES } from "../assets/js/shared/locales.js";

// ── a fully healthy reading, built from the tables so it cannot drift ─────────

function goodAction(id) {
  const spec = EXPERIENCE_ACTIONS.find((a) => a.id === id);
  return {
    id,
    label: spec.label,
    kind: spec.kind,
    attempted: true,
    acknowledged: true,
    moved: ["status"],
    ms: 90,
    acknowledged_before_result: true,
    status: "a plausible status line",
  };
}

function goodError(id) {
  const spec = EXPERIENCE_ERRORS.find((e) => e.id === id);
  return {
    id,
    label: spec.label,
    triggered: true,
    acknowledged: true,
    status:
      "Something went wrong — enter a figure in that range and try again.",
    next_step: true,
  };
}

function goodEmpty(id) {
  const spec = EXPERIENCE_EMPTY_STATES.find((e) => e.id === id);
  return {
    id,
    label: spec.label,
    selector: spec.selector,
    ok: true,
    visible: true,
    controls: 0,
    text: "Enter something and the estimate appears here.",
    invites: true,
    blank_while_visible: false,
    raw_key: false,
  };
}

// A healthy locale reading: every locale, at every moment, each surface holding
// the sentence the SHIPPED DICTIONARY holds for that locale. Built from the
// tables and the dictionary rather than typed, so a new surface or a new locale
// is covered by construction.
function goodLocalePass(locale, phase) {
  return {
    locale,
    phase,
    lang: locale,
    dir: locale === "ar" ? "rtl" : "ltr",
    beco_lang: locale,
    picker: locale,
    ready: true,
    surfaces: LOCALE_SURFACES.map((s) => ({
      id: s.id,
      key: s.key,
      exists: true,
      text: LOCALES[locale][s.key],
      visible: true,
      raw_key: false,
    })),
    leaks: [],
  };
}

const HEALTHY = () => ({
  ok: true,
  actions: EXPERIENCE_ACTIONS.map((a) => goodAction(a.id)),
  errors: EXPERIENCE_ERRORS.map((e) => goodError(e.id)),
  empty_states: EXPERIENCE_EMPTY_STATES.map((e) => goodEmpty(e.id)),
  locales: EXPERIENCE_LOCALES.flatMap((l) =>
    LOCALE_PHASES.map((p) => goodLocalePass(l, p)),
  ),
  key_leaks: [],
  // The walk always runs the AT pass last; a healthy fixture is a walk that
  // ran it and found nothing. Without this the evaluator would (correctly)
  // hole on the missing pass.
  at: {
    ran: true,
    violations: [],
    counts: { critical: 0, serious: 0, moderate: 0, minor: 0 },
    incomplete: 0,
  },
});

// ── the shape of the tables themselves ───────────────────────────────────────

test("TABLES: every action has an id, a label and a settle bound", () => {
  for (const a of EXPERIENCE_ACTIONS) {
    assert.ok(a.id, "an action with no id cannot be reported");
    assert.ok(a.label, `${a.id} has no label to report`);
    assert.ok(
      typeof a.settleMs === "number" && a.settleMs > 0,
      `${a.id} has no settle bound, so a hung step would wait forever`,
    );
    assert.ok(
      Array.isArray(a.ack) || a.kind === "invite",
      `${a.id} names no observable to watch`,
    );
  }
});

test("TABLES: ids are unique, so no step can shadow another", () => {
  for (const [name, table] of [
    ["EXPERIENCE_ACTIONS", EXPERIENCE_ACTIONS],
    ["EXPERIENCE_ERRORS", EXPERIENCE_ERRORS],
    ["EXPERIENCE_EMPTY_STATES", EXPERIENCE_EMPTY_STATES],
  ]) {
    const ids = table.map((x) => x.id);
    assert.equal(
      new Set(ids).size,
      ids.length,
      `${name} has a duplicate id, and a walk would report one under the other`,
    );
  }
});

test("TABLES: every error names a next-step pattern", () => {
  for (const e of EXPERIENCE_ERRORS)
    assert.ok(e.next_step instanceof RegExp, `${e.id} has no next_step`);
});

test("TABLES: every empty state has a selector and an invite pattern", () => {
  for (const e of EXPERIENCE_EMPTY_STATES) {
    assert.match(e.selector, /^#/, `${e.id} must target by id`);
    assert.ok(e.invite instanceof RegExp, `${e.id} has no invite pattern`);
    // Every one of these surfaces sat inside a panel that quick mode HIDES, so a
    // table entry with no reveal sequence would measure an invisible element and
    // report it clean — the mistake the first draft made twice.
    assert.ok(
      typeof e.reveal === "string" && e.reveal.length > 0,
      `${e.id} has no reveal sequence, so it can only ever be probed while ` +
        "hidden — and a hidden element always passes",
    );
  }
});

test("TABLES: the facet has exactly one owner", () => {
  // The rule is ONE OWNER PER AXIS, not one axis per gate. This gate now speaks
  // for two, because the judge's demand for `translation` names a question only
  // a browser can answer ("no raw key name reaching a visitor") and leaving it
  // to a typed line meant the measurement went unread under `experience`. What
  // must never happen is the same axis being claimed twice: the builder
  // overwrites per axis, so a second claimant deletes the first line rather than
  // adding a second.
  assert.deepEqual(EXPERIENCE_FACET_AXES, ["experience", "translation"]);
  assert.equal(
    new Set(EXPERIENCE_FACET_AXES).size,
    EXPERIENCE_FACET_AXES.length,
    "an axis declared twice is one line silently overwriting the other",
  );
  // And every declared axis must have a line composed FOR it, or the builder
  // would file one axis's sentence under the other's name.
  for (const axis of EXPERIENCE_FACET_AXES) {
    const line =
      axis === "translation"
        ? composeTranslationFacetLine({ experience_reading: HEALTHY() })
        : composeExperienceFacetLine({ experience_reading: HEALTHY() });
    assert.ok(line, `axis ${axis} composes nothing from a healthy run`);
  }
});

test("TABLES: no other gate claims an axis this one owns", () => {
  // One owner, checked against the tree rather than against intent. A second
  // gate declaring `translation` would not add a proof line — it would delete
  // the one the browser run just composed.
  for (const file of [
    "scripts/check-lighthouse.mjs",
    "scripts/check-resilience.mjs",
  ]) {
    const src = readFileSync(file, "utf8");
    for (const axis of EXPERIENCE_FACET_AXES)
      assert.doesNotMatch(
        src,
        new RegExp(`"${axis}"`),
        `${file} must not claim \`${axis}\`: this gate composes it from the run`,
      );
  }
});

// ── the next-step matcher, which is the load-bearing judgment ────────────────

test("NEXT STEP: a message naming the failure alone does not count", () => {
  // This is the real copy that shipped: correct English, and a dead end.
  assert.equal(hasNextStep("invalid_daily_kwh", "Invalid share link."), false);
  assert.equal(
    hasNextStep(
      "invalid_daily_kwh",
      "Daily energy use must be between 0.5 and 500 kWh per day.",
    ),
    false,
    "stating the constraint is not naming a next step",
  );
});

test("NEXT STEP: the shipped strings now pass, in English", () => {
  assert.equal(
    hasNextStep(
      "invalid_daily_kwh",
      "Daily energy use must be between 0.5 and 500 kWh per day — enter a figure in that range, or tick the appliances you want to power instead.",
    ),
    true,
  );
  assert.equal(
    hasNextStep(
      "malformed_share",
      "This share link could not be read — it may have been cut short when it was copied. Ignore it and set up your own estimate below.",
    ),
    true,
  );
});

test("NEXT STEP: an unknown error id is an error, not a silent false", () => {
  // Returning false for an id nobody declared would make a typo in the table
  // look exactly like a product defect, which is the wrong place to spend a
  // reviewer's attention.
  assert.throws(
    () => hasNextStep("not_a_real_error", "anything"),
    /no experience/,
  );
});

test("NEXT STEP: withNextStep reads the message it is given", () => {
  assert.equal(
    withNextStep({ id: "malformed_share", status: "Invalid share link." })
      .next_step,
    false,
  );
  assert.equal(
    withNextStep({
      id: "malformed_share",
      status: "That link is broken — start your own estimate below.",
    }).next_step,
    true,
  );
});

test("NEXT STEP: an empty message is never a next step", () => {
  for (const e of EXPERIENCE_ERRORS)
    assert.equal(
      hasNextStep(e.id, ""),
      false,
      `${e.id} accepted an empty message`,
    );
});

// ── the healthy reading passes, and says why ─────────────────────────────────

test("HEALTHY: a clean walk produces no failures at all", () => {
  const v = evaluateExperience(HEALTHY());
  assert.deepEqual(v.regressions, [], "regressions on a clean reading");
  assert.deepEqual(v.holes, [], "holes on a clean reading");
  assert.ok(
    v.notes.length > 0,
    "a clean run must still report what it measured",
  );
});

test("HEALTHY: an absent reading is a hole, never a pass", () => {
  // The defect this whole file is about: a gate that returns an empty verdict for
  // "I did not run" is a gate that scores a facet it never measured.
  for (const bad of [undefined, null, {}]) {
    const v = evaluateExperience(bad);
    assert.ok(
      v.holes.length > 0,
      `absent reading ${JSON.stringify(bad)} passed`,
    );
    assert.deepEqual(v.regressions, []);
  }
});

test("MUTATION: an AT pass that did not run is a hole", () => {
  // The facet line claims an assistive-technology run; a reading without one
  // is an unexercised claim, never a pass.
  for (const at of [undefined, { ran: false, error: "axe timed out" }]) {
    const r = HEALTHY();
    if (at === undefined) delete r.at;
    else r.at = at;
    const v = evaluateExperience(r);
    assert.ok(
      v.holes.some((h) => h.what === "at"),
      "a missing AT run must hole",
    );
    assert.deepEqual(v.regressions, []);
  }
});

test("MUTATION: AT violations are reported, never regressed", () => {
  // check-a11y-matrix.mjs owns axe violations and ratchets them against its
  // baseline; this gate must not double-block a single finding.
  const r = HEALTHY();
  r.at = {
    ran: true,
    violations: [
      {
        id: "color-contrast",
        impact: "serious",
        help: "x",
        nodes: 2,
        example: "",
      },
    ],
    counts: { critical: 0, serious: 1, moderate: 0, minor: 0 },
    incomplete: 0,
  };
  const v = evaluateExperience(r);
  assert.deepEqual(v.regressions, [], "violations must not regress here");
  assert.deepEqual(v.holes, [], "a ran pass must not hole");
  assert.ok(
    v.notes.some((n) => /AT run: axe reported 1 violation/.test(n)),
    "the violation count must be reported",
  );
});

// ── MUTATION: each expectation, violated one at a time ───────────────────────

test("MUTATION: a step that acknowledges nothing is a regression", () => {
  const r = HEALTHY();
  r.actions.find((a) => a.id === "adjust").acknowledged = false;
  const v = evaluateExperience(r);
  assert.equal(v.regressions.length, 1);
  assert.equal(v.regressions[0].id, "adjust");
  assert.match(v.regressions[0].message, /cannot tell happened/);
});

test("MUTATION: a step the walk never attempted is a HOLE, not a pass", () => {
  // The specific lie this facet cannot have: a journey that died at step two and
  // reported nine green steps. A hole blocks harder than a regression because a
  // regression at least says something broke.
  const r = HEALTHY();
  Object.assign(
    r.actions.find((a) => a.id === "result"),
    {
      attempted: false,
      acknowledged: false,
      reason: "no city suggestion appeared, so the flow could not continue",
    },
  );
  const v = evaluateExperience(r);
  assert.equal(
    v.regressions.length,
    0,
    "an unattempted step must not read as a defect",
  );
  assert.ok(
    v.holes.some(
      (h) => h.what === "flow:result" && /never attempted/.test(h.why),
    ),
    `expected a flow:result hole, got ${JSON.stringify(v.holes)}`,
  );
});

test("MUTATION: a step missing from the reading entirely is a hole", () => {
  const r = HEALTHY();
  r.actions = r.actions.filter((a) => a.id !== "repeat_run");
  const v = evaluateExperience(r);
  assert.ok(v.holes.some((h) => h.what === "flow:repeat_run"));
});

test("MUTATION: a step that took too long to acknowledge is a regression", () => {
  const r = HEALTHY();
  r.actions.find((a) => a.id === "choose_city").ms =
    EXPERIENCE_EXPECTATIONS.max_acknowledgement_ms + 1;
  const v = evaluateExperience(r);
  assert.equal(v.regressions.length, 1);
  assert.equal(v.regressions[0].id, "choose_city");
  assert.match(v.regressions[0].message, /ceiling on recognition/);
});

test("MUTATION: the ceiling itself is not a free pass for a missing duration", () => {
  // A step scored on a committed value has no meaningful latency. Inventing one
  // would be a number about nothing, so the ceiling must NOT fire on null.
  const r = HEALTHY();
  r.actions.find((a) => a.id === "accept_kwh").ms = null;
  const v = evaluateExperience(r);
  assert.deepEqual(v.regressions, []);
});

test("MUTATION: Run acknowledging only after the answer is a regression", () => {
  const r = HEALTHY();
  r.actions.find((a) => a.id === "start_run").acknowledged_before_result =
    false;
  const v = evaluateExperience(r);
  assert.ok(
    v.regressions.some((x) => x.id === "start_run_precedes_result"),
    `expected the pre-result acknowledgement to fail, got ${JSON.stringify(v.regressions)}`,
  );
});

test("MUTATION: an error that never fired is a hole", () => {
  const r = HEALTHY();
  r.errors.find((e) => e.id === "malformed_share").triggered = false;
  r.errors.find((e) => e.id === "malformed_share").next_step = false;
  const v = evaluateExperience(r);
  assert.ok(v.holes.some((h) => h.what === "error:malformed_share"));
  assert.equal(v.regressions.length, 0);
});

test("MUTATION: an error with no next step is a regression", () => {
  // The exact defect the walk found in the shipped copy.
  const r = HEALTHY();
  Object.assign(
    r.errors.find((e) => e.id === "invalid_daily_kwh"),
    {
      next_step: false,
      status: "Daily energy use must be between 0.5 and 500 kWh per day.",
    },
  );
  const v = evaluateExperience(r);
  assert.equal(v.regressions.length, 1);
  assert.equal(v.regressions[0].id, "invalid_daily_kwh");
  assert.match(v.regressions[0].message, /names the failure but no next step/);
});

test("MUTATION: a next_step flag the page never earned is still caught", () => {
  // next_step is computed by the instrument, so a bug that hard-coded it true
  // would silence this clause entirely. The status text is re-judged here, so the
  // flag cannot be the only thing standing between a dead end and a pass.
  const r = HEALTHY();
  const e = r.errors.find((x) => x.id === "malformed_share");
  e.next_step = true;
  e.status = "Invalid share link.";
  const v = evaluateExperience(r);
  assert.equal(v.regressions.length, 1, "the flag alone must not be believed");
  assert.equal(v.regressions[0].id, "malformed_share");
});

test("MUTATION: an error that said nothing at all is a hole", () => {
  const r = HEALTHY();
  r.errors.find((e) => e.id === "unresolvable_city").status = "";
  const v = evaluateExperience(r);
  assert.ok(v.holes.some((h) => h.what === "error:unresolvable_city"));
});

test("MUTATION: an empty state that is still hidden is a hole", () => {
  // The instrument's own first-draft mistake, re-checked as a gate rule: a probe
  // of a hidden element always passes, so visibility is a precondition.
  const r = HEALTHY();
  const e = r.empty_states.find((x) => x.id === "bill_readout");
  e.visible = false;
  e.text = "";
  e.invites = true;
  const v = evaluateExperience(r);
  assert.ok(
    v.holes.some(
      (h) => h.what === "empty:bill_readout" && /hidden|on screen/.test(h.why),
    ),
  );
});

test("MUTATION: a visible but blank surface is a regression", () => {
  const r = HEALTHY();
  Object.assign(
    r.empty_states.find((x) => x.id === "kwh_readout"),
    {
      text: "",
      controls: 0,
      invites: false,
      blank_while_visible: true,
    },
  );
  const v = evaluateExperience(r);
  assert.equal(v.regressions.length, 1);
  assert.match(v.regressions[0].message, /visible and empty/);
});

test("MUTATION: a surface that neither invites nor controls is a regression", () => {
  const r = HEALTHY();
  Object.assign(
    r.empty_states.find((x) => x.id === "appliance_readout"),
    {
      text: "0",
      invites: false,
      blank_while_visible: false,
    },
  );
  const v = evaluateExperience(r);
  assert.equal(v.regressions.length, 1);
  assert.match(v.regressions[0].message, /neither a control to act on/);
});

test("MUTATION: a raw dictionary key on a surface is a regression", () => {
  // The defect the facet was built to find, reproduced on the reading.
  const r = HEALTHY();
  Object.assign(
    r.empty_states.find((x) => x.id === "bill_readout"),
    {
      text: "readoutBillIncomplete",
      invites: true,
      raw_key: true,
    },
  );
  const v = evaluateExperience(r);
  assert.ok(v.regressions.some((x) => /raw dictionary key/.test(x.message)));
});

test("MUTATION: a visible key anywhere on the page is a regression", () => {
  const r = HEALTHY();
  r.key_leaks = [
    {
      tag: "DIV",
      id: "useCaseBlurb",
      key: "useCaseBillCutBlurb",
      visible: true,
    },
  ];
  const v = evaluateExperience(r);
  assert.equal(v.regressions.length, 1);
  assert.equal(v.regressions[0].id, "raw_keys");
  assert.match(v.regressions[0].message, /useCaseBlurb/);
});

test("MUTATION: a key that is only in a hidden panel is reported, not failed", () => {
  // Hidden panels are still in the DOM and the sweep reaches them on purpose.
  // Failing on those would make the gate noisy enough to be ignored; what it
  // must do is SAY they are there.
  const r = HEALTHY();
  r.key_leaks = [
    { tag: "DIV", id: "hiddenThing", key: "someKey", visible: false },
  ];
  const v = evaluateExperience(r);
  assert.deepEqual(v.regressions, []);
  assert.ok(v.notes.some((n) => /none on a visible surface/.test(n)));
});

test("MUTATION: a missing key sweep is a hole, not a clean page", () => {
  // Without this, a walk that simply stopped before the sweep would report zero
  // leaks — the most expensive way to be wrong.
  const r = HEALTHY();
  delete r.key_leaks;
  const v = evaluateExperience(r);
  assert.ok(v.holes.some((h) => h.what === "raw_keys"));
  assert.equal(v.regressions.length, 0);
});

test("MUTATION: a key sweep that returned nonsense is a hole", () => {
  for (const bad of [null, "clean", 0, true]) {
    const r = HEALTHY();
    r.key_leaks = bad;
    const v = evaluateExperience(r);
    assert.ok(
      v.holes.some((h) => h.what === "raw_keys"),
      `a sweep returning ${JSON.stringify(bad)} must not read as clean`,
    );
  }
});

test("MUTATION: an empty walk records holes for every clause", () => {
  const v = evaluateExperience({ ok: true, actions: [] });
  assert.ok(v.holes.some((h) => h.what === "flow"));
  assert.ok(v.holes.some((h) => h.what === "errors"));
  assert.ok(v.holes.some((h) => h.what === "empty_states"));
});

test("MUTATION: relaxing an expectation off removes its failures", () => {
  // Proves the failures above come from the expectations and not from the
  // evaluator refusing to pass anything at all. The status is mutated too, not
  // just the flag: the evaluator re-judges the message, so a dead end has to be
  // written into the text to be seen.
  const r = HEALTHY();
  Object.assign(
    r.errors.find((e) => e.id === "malformed_share"),
    {
      next_step: false,
      status: "Invalid share link.",
    },
  );
  assert.equal(evaluateExperience(r).regressions.length, 1);
  assert.equal(
    evaluateExperience(r, {
      ...EXPERIENCE_EXPECTATIONS,
      every_error_gives_a_next_step: false,
    }).regressions.length,
    0,
  );
});

// ── the facet line ───────────────────────────────────────────────────────────

test("FACET LINE: composed from a healthy run, and says what it did", () => {
  const report = { experience_reading: HEALTHY() };
  const line = composeExperienceFacetLine(report);
  assert.ok(line, "a healthy walk must compose a line");
  assert.match(line, /^WALKED, 1 Chrome, 1 city:/);
  assert.match(line, /9\/9 steps acknowledge/);
  assert.match(line, /3\/3 errors give a next step/);
  assert.match(line, /3 empty states invite/);
  // The raw-key claim now carries its own scope — how many pages it covers —
  // because "0 raw keys" means one very different thing over one English boot
  // than it does over nineteen pages in six languages.
  assert.match(line, /0 raw keys on 19 pages/);
  assert.match(line, /72\/72 surfaces match the dictionary/);
  // The AT pass ran on the healthy fixture and found nothing: the line says
  // so, instead of the old admission that no AT run had ever happened.
  assert.match(
    line,
    /AT run: axe 0 violation\(s\) \(0 critical, 0 serious\)/,
    "the AT clause must travel with the numbers",
  );
});

test("FACET LINE: a missing reading composes NOTHING", () => {
  // "0 holes" from a run that measured nothing is the most dangerous sentence
  // available about this facet, so the null is load-bearing.
  assert.equal(composeExperienceFacetLine({ experience_reading: null }), null);
  assert.equal(composeExperienceFacetLine({}), null);
  assert.equal(composeExperienceFacetLine(null), null);
  assert.equal(
    composeExperienceFacetLine({ experience_reading: { actions: [] } }),
    null,
    "a walk that recorded no steps must not compose a line",
  );
});

test("FACET LINE: a visible key is reported in the line, not hidden by it", () => {
  const r = HEALTHY();
  r.key_leaks = [
    {
      tag: "DIV",
      id: "readoutBill",
      key: "readoutBillIncomplete",
      visible: true,
    },
  ];
  const line = composeExperienceFacetLine({ experience_reading: r });
  assert.match(line, /1 raw keys on 19 pages/);
});

test("FACET LINE: it fits the transport's clip", () => {
  // The transport silently cuts the TAIL, which is exactly where the scope limit
  // lives — so an over-long line loses the half that keeps the numbers honest.
  const line = composeExperienceFacetLine({ experience_reading: HEALTHY() });
  assert.ok(
    line.length <= COMPLETE_FACET_CLIP,
    `the line is ${line.length} chars, over the ${COMPLETE_FACET_CLIP}-char clip`,
  );
});

// ── the key list the sweep runs against ──────────────────────────────────────

test("SWEEP: the key list comes from the shipped dictionary", () => {
  assert.ok(LOCALE_KEYS.length > 100, `only ${LOCALE_KEYS.length} keys found`);
  // A sweep whose key list was typed here would go on passing a renamed key.
  assert.ok(LOCALE_KEYS.includes("invalidShare"));
  assert.ok(LOCALE_KEYS.includes("readoutBillIncomplete"));
  // Ten of the shipped keys carry an underscore. This is asserted rather than
  // assumed because the first draft of the sweep guessed key SHAPE with
  // /^[a-z][A-Za-z0-9]+$/ and would have missed every one of them — a sweep that
  // misses a tenth of its own targets reports clean, which is worse than none.
  assert.ok(
    LOCALE_KEYS.includes("pathsLabel_diy"),
    "the dictionary's underscored keys must be in the sweep's target list",
  );
  assert.deepEqual(
    LOCALE_KEYS,
    Object.keys(LOCALES.en),
    "the sweep's list must BE the dictionary's key list, not a filtered copy",
  );
});

test("SWEEP: the empty-state raw_key test is membership, not a shape guess", () => {
  // The property above is only load-bearing if the sweep actually uses it. A
  // shape heuristic and a membership test disagree on exactly these keys, so the
  // source is asserted directly rather than inferred from a passing run.
  const src = readFileSync("scripts/smoke/experience.mjs", "utf8");
  assert.match(src, /raw_key: localeKeys\.includes\(node\.text\)/);
  assert.doesNotMatch(
    src,
    /raw_key: \/\^\[a-z\]/,
    "a shape heuristic silently misses the dictionary's underscored keys",
  );
});

test("SWEEP: no shipped dictionary value IS its own key", () => {
  // If a value equalled its own key the sweep would flag ordinary copy as a
  // defect. The i18n gate already refuses that class; this asserts the two gates
  // agree, so a page cannot pass one and be failed by the other.
  const leaks = LOCALE_KEYS.filter((k) =>
    Object.values(LOCALES).some((d) => d[k] === k),
  );
  assert.deepEqual(
    leaks,
    [],
    `a dictionary value equals its key, so the sweep would flag real copy: ${leaks.join(", ")}`,
  );
});

// ── the locale sweep: the class behind "no raw key reaching a visitor" ───────
//
// Every test below is a MUTATION: a reading that is green in every other clause
// and violates exactly this one, with the assertion that a NAMED failure comes
// out. The two that matter most are the last pair, because they are the two the
// live gate was actually run against: deleting the boot repaint, and deleting
// the repaint on a language switch. Both were confirmed against the real staged
// page, and both produced named regressions rather than silence.

// The healthy reading has to be clean, or none of the mutations below mean
// anything. Asserted first so a broken fixture cannot make the rest vacuous.
test("SWEEP: the healthy reading is clean", () => {
  const v = evaluateExperience(HEALTHY());
  assert.deepEqual(v.regressions, [], JSON.stringify(v.regressions, null, 1));
  assert.deepEqual(v.holes, [], JSON.stringify(v.holes, null, 1));
});

test("SWEEP: the tables cover every shipped locale at every moment", () => {
  assert.equal(EXPERIENCE_LOCALES.length, 6);
  assert.deepEqual(EXPERIENCE_LOCALES, Object.keys(LOCALES));
  for (const locale of EXPERIENCE_LOCALES)
    for (const spec of LOCALE_SURFACES)
      assert.equal(
        typeof LOCALES[locale][spec.key],
        "string",
        `${locale} has no ${spec.key}, so the sweep would compare against nothing`,
      );
});

test("SWEEP: every surface names a key, a selector and a way to paint it", () => {
  for (const s of LOCALE_SURFACES) {
    assert.ok(s.id && s.key && s.selector && s.label, JSON.stringify(s));
    assert.match(
      s.setup,
      /dispatchEvent/,
      `${s.id} has no visitor action to run`,
    );
  }
  assert.equal(
    new Set(LOCALE_SURFACES.map((s) => s.id)).size,
    LOCALE_SURFACES.length,
  );
});

test("SWEEP: at least one surface is judged in every locale at every moment", () => {
  const s = summariseLocaleSweep(HEALTHY());
  // Six locales x three moments, and every judged reading must have matched —
  // a denominator smaller than the locale count would mean the sweep looked at
  // fewer places than it claims.
  assert.equal(s.matched, s.judged);
  assert.equal(s.locales, 6);
  assert.equal(s.phases, 3);
  assert.ok(s.judged >= EXPERIENCE_LOCALES.length * LOCALE_PHASES.length);
});

test("MUTATION: a raw key in ONE locale is a regression naming that locale", () => {
  const r = HEALTHY();
  const pass = r.locales.find((p) => p.locale === "de" && p.phase === "boot");
  pass.surfaces.find((s) => s.id === "bill_readout").text =
    "readoutBillIncomplete";
  const v = evaluateExperience(r);
  const hit = v.regressions.find((x) => x.id === "locale:de:boot:bill_readout");
  assert.ok(hit, "a key in German at boot must be named, not averaged away");
  assert.match(hit.message, /readoutBillIncomplete/);
});
test("MUTATION: a key on a HIDDEN surface at boot still fails", () => {
  // The disguise that let the first two survive: quick mode hides the panel they
  // live in, so every landing-frame check reported clean.
  const r = HEALTHY();
  const pass = r.locales.find((p) => p.locale === "ar" && p.phase === "boot");
  const row = pass.surfaces.find((s) => s.id === "use_case_blurb");
  row.text = "useCaseBillCutBlurb";
  row.visible = false;
  const v = evaluateExperience(r);
  assert.ok(
    v.regressions.some((x) => x.id === "locale:ar:boot:use_case_blurb"),
    "hiding a broken surface must not be a way to pass",
  );
});

test("MUTATION: a surface left in the PREVIOUS language is a regression", () => {
  // The language-switch defect, and the reason the sweep compares against the
  // dictionary rather than looking for the shape of a key: no key is involved
  // anywhere here. The surface shows a perfect sentence in the wrong language.
  const r = HEALTHY();
  const pass = r.locales.find(
    (p) => p.locale === "en" && p.phase === "after_switch",
  );
  pass.surfaces.find((s) => s.id === "bill_readout").text =
    LOCALES.ar.readoutBillIncomplete;
  const v = evaluateExperience(r);
  const hit = v.regressions.find(
    (x) => x.id === "locale:en:after_switch:bill_readout",
  );
  assert.ok(hit, "a half-translated surface must be named");
  assert.match(hit.message, /previous language/);
});

test("MUTATION: a surface still in English after a switch is named as leakage", () => {
  const r = HEALTHY();
  const pass = r.locales.find(
    (p) => p.locale === "es" && p.phase === "after_switch",
  );
  pass.surfaces.find((s) => s.id === "use_case_blurb").text =
    LOCALES.en.useCaseBillCutBlurb;
  const v = evaluateExperience(r);
  const hit = v.regressions.find(
    (x) => x.id === "locale:es:after_switch:use_case_blurb",
  );
  assert.ok(hit);
  assert.match(hit.message, /still in English/);
});

test("MUTATION: a locale that was never swept is a hole, not a pass", () => {
  const r = HEALTHY();
  r.locales = r.locales.filter((p) => p.locale !== "pt");
  const v = evaluateExperience(r);
  const holes = v.holes.filter((h) => h.what.startsWith("locale:pt:"));
  assert.equal(
    holes.length,
    LOCALE_PHASES.length,
    "a locale dropped from the sweep must produce a hole at every moment",
  );
  assert.match(holes[0].why, /never read/);
});

test("MUTATION: a locale swept only at boot is a hole at the other moments", () => {
  const r = HEALTHY();
  r.locales = r.locales.filter(
    (p) => !(p.locale === "fr" && p.phase !== "boot"),
  );
  const v = evaluateExperience(r);
  assert.ok(v.holes.some((h) => h.what === "locale:fr:after_rerun"));
  assert.ok(v.holes.some((h) => h.what === "locale:fr:after_switch"));
});

test("MUTATION: no locale sweep at all is a hole", () => {
  const r = HEALTHY();
  delete r.locales;
  const v = evaluateExperience(r);
  assert.ok(v.holes.some((h) => h.what === "locales"));
  assert.deepEqual(v.regressions, []);
});

test("MUTATION: a locale sweep that is not a list is a hole", () => {
  for (const bad of [null, "clean", 0, {}]) {
    const r = HEALTHY();
    r.locales = bad;
    const v = evaluateExperience(r);
    assert.ok(
      v.holes.some((h) => h.what === "locales"),
      `a sweep returning ${JSON.stringify(bad)} must not read as clean`,
    );
  }
});

test("MUTATION: a reading claiming a locale or moment that does not exist is a hole", () => {
  const r = HEALTHY();
  r.locales.push({
    ...goodLocalePass("en", "boot"),
    locale: "klingon",
    phase: "after_telepathy",
  });
  const v = evaluateExperience(r);
  assert.ok(
    v.holes.some((h) => h.what === "locale:klingon:after_telepathy"),
    "a sweep that walked somewhere else must not read as one that passed",
  );
});

test("MUTATION: a page that reported the wrong language is a hole", () => {
  const r = HEALTHY();
  r.locales.find((p) => p.locale === "de" && p.phase === "boot").lang = "en";
  const v = evaluateExperience(r);
  assert.ok(
    v.holes.some((h) => h.what === "locale:de:boot"),
    "a boot reading of the wrong locale describes a page nobody walked",
  );
});

test("MUTATION: a boot page whose dictionary never landed is a hole", () => {
  const r = HEALTHY();
  r.locales.find((p) => p.locale === "es" && p.phase === "boot").ready = false;
  const v = evaluateExperience(r);
  assert.ok(v.holes.some((h) => h.what === "locale:es:boot"));
});

test("MUTATION: a surface missing from a reading is a hole", () => {
  const r = HEALTHY();
  const pass = r.locales.find(
    (p) => p.locale === "pt" && p.phase === "after_rerun",
  );
  pass.surfaces = pass.surfaces.filter((s) => s.id !== "bill_readout");
  const v = evaluateExperience(r);
  assert.ok(
    v.holes.some((h) => h.what === "locale:pt:after_rerun:bill_readout"),
  );
});

test("MUTATION: a visible surface saying nothing is a hole, not a match", () => {
  // A hole in one locale's dictionary leaves the surface empty rather than
  // wrong. Silence is not a pass, and it must never be counted as a match.
  const r = HEALTHY();
  const pass = r.locales.find(
    (p) => p.locale === "es" && p.phase === "after_rerun",
  );
  pass.surfaces.find((s) => s.id === "bill_readout").text = "";
  const v = evaluateExperience(r);
  assert.ok(
    v.holes.some((h) => h.what === "locale:es:after_rerun:bill_readout"),
  );
  const s = summariseLocaleSweep(r);
  assert.ok(
    s.matched < s.judged,
    "an empty surface must not be scored as a match on the facet line",
  );
});

test("MUTATION: a surface absent from the document is a hole", () => {
  const r = HEALTHY();
  const pass = r.locales.find(
    (p) => p.locale === "ar" && p.phase === "after_switch",
  );
  pass.surfaces.find((s) => s.id === "kwh_readout").exists = false;
  const v = evaluateExperience(r);
  assert.ok(
    v.holes.some((h) => h.what === "locale:ar:after_switch:kwh_readout"),
  );
});

test("MUTATION: a visible raw key anywhere on a locale's page is a regression", () => {
  const r = HEALTHY();
  r.locales.find((p) => p.locale === "en" && p.phase === "after_switch").leaks =
    [
      {
        tag: "P",
        id: "pathsDriverNote",
        key: "pathsDriver_leasePayments",
        visible: true,
      },
    ];
  const v = evaluateExperience(r);
  const hit = v.regressions.find(
    (x) => x.id === "locale:en:after_switch:sweep",
  );
  assert.ok(hit, "a key anywhere on a page in that locale must be named");
  assert.match(hit.message, /pathsDriver_leasePayments/);
});

test("MUTATION: a per-locale key sweep that did not report is a hole", () => {
  const r = HEALTHY();
  delete r.locales.find((p) => p.locale === "de").leaks;
  const v = evaluateExperience(r);
  assert.ok(
    v.holes.some(
      (h) => h.what.startsWith("locale:de:") && /did not report/.test(h.why),
    ),
  );
});

test("MUTATION: a walk that mislabels its own raw_key flag is overruled by the text", () => {
  // The instrument's flag is compared, never believed. The disagreement is
  // recorded rather than silently resolved in the walk's favour.
  const clean = HEALTHY();
  const row = clean.locales
    .find((p) => p.locale === "en" && p.phase === "after_switch")
    .surfaces.find((s) => s.id === "bill_readout");
  row.raw_key = true; // the walk panics about a key
  row.text = LOCALES.en.readoutBillIncomplete; // and the text is clean
  const v1 = evaluateExperience(clean);
  assert.ok(
    v1.notes.some((n) => /the text decides/.test(n)),
    "a disagreement between the flag and the text must be named",
  );
  assert.deepEqual(v1.regressions, [], "a clean sentence is not a defect");

  const dirty = HEALTHY();
  const row2 = dirty.locales
    .find((p) => p.locale === "fr" && p.phase === "boot")
    .surfaces.find((s) => s.id === "bill_readout");
  row2.text = "readoutBillIncomplete";
  row2.raw_key = false; // the walk says fine
  const v2 = evaluateExperience(dirty);
  assert.ok(
    v2.regressions.some((x) => x.id === "locale:fr:boot:bill_readout"),
    "the evaluator must re-judge the text, not the flag",
  );
});

test("SWEEP: the facet line claims the coverage the evaluator judged", () => {
  const line = composeExperienceFacetLine({ experience_reading: HEALTHY() });
  assert.ok(
    line.length <= COMPLETE_FACET_CLIP,
    `the line is ${line.length} chars and would be cut in transit`,
  );
  assert.match(line, /6 locales x 3 moments/);
  const judged = summariseLocaleSweep(HEALTHY());
  assert.ok(
    line.includes(`${judged.matched}/${judged.judged} surfaces`),
    "the denominator must be the one the evaluator used",
  );
});

test("SCOPE: the scope limit no longer claims copy is checked in English only", () => {
  // The old sentence said the other five locales were "asserted to exist rather
  // than read". That is now false, and a scope limit that lies is worse than
  // one that is missing.
  assert.match(EXPERIENCE_SCOPE_LIMIT, /all six locales/);
  assert.doesNotMatch(
    EXPERIENCE_SCOPE_LIMIT,
    /asserted to exist rather than read/,
  );
  // …and it must still say what the sweep does NOT cover, or the new sentence
  // reads as a licence to stop measuring.
  assert.match(EXPERIENCE_SCOPE_LIMIT, /NOT walked/);
  assert.match(EXPERIENCE_SCOPE_LIMIT, /not the prose/);
});

test("FACETS: one gate speaking for two axes emits a DIFFERENT line for each", () => {
  // The builder applies a single string to every axis in facet_axes. Reusing
  // the journey line as the translation line would file a first-run walk under
  // a heading that never mentions a locale, so `facet_lines` is the mechanism
  // and it has to produce two sentences, not one sentence twice.
  const exp = composeExperienceFacetLine({ experience_reading: HEALTHY() });
  const tra = composeTranslationFacetLine({ experience_reading: HEALTHY() });
  assert.ok(exp && tra, "both axes compose from a healthy run");
  assert.notEqual(
    exp,
    tra,
    "two axes cannot be served by one sentence; serving them one sentence is " +
      "exactly the 'one line silently wins' failure this move was meant to fix",
  );
  assert.match(tra, /locales/, "the translation line must name the locales");
  assert.match(tra, /check-i18n/, "and say where parity is gated");
  assert.match(tra, /Not done/, "and what it did not do");
  for (const [axis, line] of [
    ["experience", exp],
    ["translation", tra],
  ]) {
    assert.ok(
      line.length <= COMPLETE_FACET_CLIP,
      `the ${axis} line is ${line.length} chars and would be cut in transit`,
    );
  }
});

test("FACETS: the translation line refuses to compose from an unwalked run", () => {
  // A line about six locales composed from a walk that never happened is the
  // most expensive sentence available on this axis, and it is exactly what the
  // typed line it replaced was doing. Null has to stay null.
  for (const reading of [
    null,
    {},
    { experience_reading: null },
    { experience_reading: { actions: [] } },
    { experience_reading: { actions: [{ id: "land", acknowledged: true }] } },
  ]) {
    assert.equal(
      composeTranslationFacetLine(reading),
      null,
      `a line composed from ${JSON.stringify(reading)} is a claim about nothing`,
    );
  }
});

test("FACETS: the translation line counts the locales and moments it swept", () => {
  const tra = composeTranslationFacetLine({ experience_reading: HEALTHY() });
  const s = summariseLocaleSweep(HEALTHY());
  assert.ok(
    tra.includes(`${s.matched}/${s.judged}`),
    "the denominator must be the evaluator's, not a number typed beside it",
  );
  assert.match(tra, new RegExp(`${s.locales} locales`));
  assert.match(tra, new RegExp(`${s.phases} re-entry points`));
  // …and it must NOT claim a locale it did not walk, which is the whole reason
  // the count comes from the sweep rather than from the constant six.
  const oneLocale = HEALTHY();
  oneLocale.locales = oneLocale.locales.filter((p) => p.locale === "en");
  const short = composeTranslationFacetLine({
    experience_reading: oneLocale,
  });
  assert.match(short, /1 locales/, "a sweep of one locale must say one locale");
});
