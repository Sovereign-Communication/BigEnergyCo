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
  composeExperienceFacetLine,
  evaluateExperience,
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

const HEALTHY = () => ({
  ok: true,
  actions: EXPERIENCE_ACTIONS.map((a) => goodAction(a.id)),
  errors: EXPERIENCE_ERRORS.map((e) => goodError(e.id)),
  empty_states: EXPERIENCE_EMPTY_STATES.map((e) => goodEmpty(e.id)),
  key_leaks: [],
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
  assert.deepEqual(EXPERIENCE_FACET_AXES, ["experience"]);
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
  assert.match(line, /0 raw keys visible/);
  assert.match(
    line,
    /No device matrix/,
    "the scope limit must travel with the numbers",
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
  assert.match(line, /1 raw key\(s\) visible/);
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
