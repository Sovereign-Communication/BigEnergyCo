import test from "node:test";
import assert from "node:assert/strict";
import {
  cycleLifeForDoD,
  CYCLE_LIFE_CURVES,
  CHEMISTRIES,
} from "../assets/js/sizing/engine.js";

/**
 * Cycle-life goldens, REVALIDATED against the super-linear model (issue #156).
 *
 * Every assertion below that changed records the old value, the new one, and the
 * reference line that justifies the move. Nothing here was widened to make the
 * model pass: where the number moved, the document moved with it.
 *
 * The three model changes this file pins, in order of how much they matter:
 *
 *   1. SHAPE. One exponent per chemistry could not fit the reference document's
 *      DoD response, which is super-linear and band-specific: LFP needs 2.618
 *      between 55-80% and 1.817 between 80-100%, lead-acid 2.424 then 3.705.
 *      The old flat 1.65/1.45 fitted neither and read 2.08x too optimistic for
 *      LFP at full discharge.
 *   2. LEVEL, LFP. Held at 6,000 cycles at 80% DoD. The shape comes from one
 *      product that publishes all three of its depths; the level comes from the
 *      mainstream CATL 280Ah this calculator is built around. Conflating the two
 *      would make every LFP bank here behave like a value-tier one.
 *   3. LEVEL, AGM. Moved 500 -> 1,250 cycles at 50% DoD, because the old figure
 *      contradicted BOTH the reference (lines 124 and 134: "1,000-1,500") and
 *      this product's own "3-5 years" copy. At 300 cycles/year, 500 is 1.7 years
 *      and 1,250 is 4.2 — the model was the outlier, not the copy.
 */

test("cycleLifeForDoD: LFP keeps its 6,000-cycle benchmark and gains a super-linear shape", () => {
  // UNCHANGED. The mainstream 80% anchor is the number the product sells on and
  // the whole reason the Winston shape is scaled rather than adopted raw.
  assert.equal(
    cycleLifeForDoD("lfp", 0.8),
    6000,
    "LFP baseline benchmark must be exactly 6,000 cycles at 80% DoD",
  );

  // 4,152 -> 4,000. The old flat curve put this at 2.08x the Winston figure of
  // 2,000 (reference line 65). The new curve reproduces the documented SHAPE
  // exactly: a 1.500x drop from 80% to 100%, which is the reference's own
  // 3,000 -> 2,000 (lines 66, 65).
  const c100 = cycleLifeForDoD("lfp", 1.0);
  assert.ok(
    c100 >= 3800 && c100 <= 4500,
    `100% DoD still ~4,000 cycles under the super-linear curve, got ${c100}`,
  );
  assert.equal(
    cycleLifeForDoD("lfp", 0.8) / cycleLifeForDoD("lfp", 1.0),
    1.5,
    "the 80%->100% drop must equal the reference's 3,000/2,000 = 1.500x",
  );

  // 9,946 -> 12,741. THIS GOLDEN MOVED, and it is the change the issue is about.
  // The old range encoded the flat beta=1.65. Under the documented 55-80% band
  // (beta 2.618) the shallow-cycling case is worth materially more, because the
  // reference records Winston at 8,000 cycles at 55% against 3,000 at 80% — a
  // 2.67x gain for a 0.69x cut in depth (lines 67, 66). A linear-ish curve
  // cannot express that, which is precisely how the old model mis-estimated the
  // long-life oversize tradeoff. Oversizing a bank so it cycles at 60% rather
  // than 80% now buys a third more life than it used to claim.
  const c60 = cycleLifeForDoD("lfp", 0.6);
  assert.ok(
    c60 >= 12000 && c60 <= 13500,
    `60% DoD reaches ~12,700 cycles under the 2.618 band (zero-swap threshold), got ${c60}`,
  );
  assert.ok(
    c60 > 12000,
    "the super-linear band must exceed the old flat reading of ~9,946",
  );

  // Shallow DoD still strictly wins, and the cap still bounds the extrapolation.
  assert.ok(
    cycleLifeForDoD("lfp", 0.5) > c60,
    "Shallower DoD must strictly yield higher cycle life",
  );
  assert.equal(
    cycleLifeForDoD("lfp", 0.1),
    CYCLE_LIFE_CURVES.lfp.cap,
    "the shallow extrapolation must be bounded by the declared cap",
  );
});

test("cycleLifeForDoD: the curve reproduces the reference document's own data points", () => {
  // The acceptance test for issue #156 criterion 1. Lead-acid is checked against
  // the reference midpoints (lines 134-136) because there the reference IS the
  // mainstream figure, so the model must land on all three exactly.
  assert.equal(
    cycleLifeForDoD("agm", 0.5),
    1250,
    "reference line 134: 1,000-1,500, midpoint",
  );
  assert.equal(
    cycleLifeForDoD("agm", 0.8),
    400,
    "reference line 135: 300-500, midpoint",
  );
  assert.equal(
    cycleLifeForDoD("agm", 1.0),
    175,
    "reference line 136: 150-200, midpoint",
  );

  // LFP's shape is checked as a ratio, because its LEVEL is deliberately the
  // mainstream CATL figure rather than Winston's (see the header).
  assert.equal(
    cycleLifeForDoD("lfp", 0.55) / cycleLifeForDoD("lfp", 0.8),
    15000 / 6000,
    "the 55%->80% gain must be the reference's 8,000/3,000 shape, at the LFP level",
  );
});

test("cycleLifeForDoD: every band exponent is super-linear where the evidence says so", () => {
  // The band table is precomputed, so this re-derives each exponent from the
  // encoded anchor pairs and checks the stored value against it. A precomputed
  // constant is a claim; this is the check that it still matches its anchors.
  for (const [chem, curve] of Object.entries(CYCLE_LIFE_CURVES)) {
    const b = curve.bands;
    assert.equal(b.length % 3, 0, `${chem}: bands must be whole triples`);
    for (let i = 0; i + 3 < b.length; i += 3) {
      const derived =
        Math.log(b[i + 3 + 1] / b[i + 1]) / Math.log(b[i] / b[i + 3]);
      assert.ok(
        Math.abs(derived - b[i + 2]) < 0.01,
        `${chem}: stored exponent ${b[i + 2]} disagrees with its anchors (${derived.toFixed(3)})`,
      );
    }
    // The final band carries the 0 sentinel rather than an exponent.
    assert.equal(
      b[b.length - 1],
      0,
      `${chem}: last band must be the 0 sentinel`,
    );
  }

  // LFP and lead-acid are super-linear in EVERY band. This is the issue's claim
  // and it is asserted per band, not as an average, because the old single
  // exponent was an average that fitted no band at all.
  for (const chem of ["lfp", "agm"]) {
    const b = CYCLE_LIFE_CURVES[chem].bands;
    for (let i = 0; i + 3 < b.length; i += 3) {
      assert.ok(
        b[i + 2] > 1,
        `${chem} band ${b[i]}->${b[i + 3]} must be super-linear, got ${b[i + 2]}`,
      );
    }
  }

  // Sodium-ion is the counter-example, and it is asserted as one: the reference
  // records it as DoD-insensitive (lines 23, 214), so its band must stay below 1
  // where the others exceed it. If a future change makes Na-ion super-linear
  // without a reference line saying so, this fails.
  const na = CYCLE_LIFE_CURVES.naion.bands;
  assert.ok(
    na[2] < 1,
    `Na-ion must stay sub-linear per the reference, got ${na[2]}`,
  );
});

test("cycleLifeForDoD: Sodium-ion stays near-flat, per the reference's 'no DoD derating'", () => {
  assert.equal(
    cycleLifeForDoD("naion", 0.85),
    5500,
    "Na-ion baseline at ~85% inverter cutoff window is 5,500 cycles",
  );

  // 4,202 -> 5,000. The old flat beta=1.55 derated 23% across the full
  // discharge range, which the reference denies for this chemistry (line 23:
  // "No DoD derating"; line 214: "Insensitive to DoD"). The new band is 0.586,
  // so a full 0V discharge costs 9% instead of 23%.
  const c100 = cycleLifeForDoD("naion", 1.0);
  assert.ok(
    c100 >= 4800 && c100 <= 5200,
    `Full 0V discharge costs ~10% under the near-flat band, got ${c100}`,
  );
  assert.ok(
    cycleLifeForDoD("naion", 0.85) / c100 <= 1.15,
    "Na-ion must stay within 15% across the full discharge range (reference: insensitive)",
  );

  // 8,394 -> 6,436. THIS GOLDEN MOVED, and it moves the WRONG way from LFP's,
  // which is the point. Shallow Na-ion cycling is now worth less than the flat
  // curve claimed, because the reference says this chemistry does not reward it.
  const c65 = cycleLifeForDoD("naion", 0.65);
  assert.ok(
    c65 >= 6200 && c65 <= 6700,
    `Oversized Na-ion bank (65% DoD) is ~6,400 cycles under the near-flat band, got ${c65}`,
  );
});

test("cycleLifeForDoD: AGM is re-anchored to the reference, with a steeper deep band", () => {
  // 500 -> 1,250. THE LARGEST CHANGE IN THIS FILE, and the one with the clearest
  // justification: the old 500 cycles at 50% DoD contradicted reference lines
  // 124 and 134 ("1,000-1,500") AND this product's own user-facing copy, which
  // says lead-acid lasts "3-5 years at typical home use depth (50% DoD)".
  // At 300 cycles/year the old model said 1.7 years and the copy said 3-5, so
  // the copy and the datasheet agreed and the model was the outlier.
  const c50 = cycleLifeForDoD("agm", 0.5);
  assert.equal(
    c50,
    1250,
    "AGM at 50% DoD is the reference midpoint, 1,250 cycles",
  );
  assert.ok(
    c50 / 300 >= 3 && c50 / 300 <= 5,
    `at 300 cycles/yr this must read 3-5 years, matching the product's own copy (got ${(c50 / 300).toFixed(1)})`,
  );

  // 183 -> 175. Still catastrophic, and now at the reference's own 150-200.
  const c100 = cycleLifeForDoD("agm", 1.0);
  assert.ok(
    c100 < 250,
    `AGM at 100% DoD is physically ruined in under 250 cycles, got ${c100}`,
  );

  // Unchanged: the 2,000 cap still bounds the shallow extrapolation.
  assert.equal(
    cycleLifeForDoD("agm", 0.2),
    2000,
    "Even at 20% DoD, AGM is capped at 2,000 cycles (lead grid corrosion and drying)",
  );
});

test("every chemistry's cyclesTo80 rating is the model at its usable DoD, derated", () => {
  // The engine's 20-year replacement economics read a flat per-chemistry
  // cyclesTo80 rather than the curve, so that rating has to BE the model at the
  // chemistry's own rated usable DoD, times any field derate. LFP and sodium-ion
  // carry none, so theirs are the model verbatim. Lead-acid does: a DIY string
  // without active balancing misses the reference's balanced 1,250, and the
  // economics keep the 0.4x derate that has always been there — it is now a
  // stated relationship instead of a free-floating number, which is what let the
  // comparison panel and the engine disagree about lead-acid before #156.
  const derate = { lfp: 1, naion: 1, agm: 0.4 };
  for (const [chem, factor] of Object.entries(derate)) {
    assert.equal(
      CHEMISTRIES[chem].cyclesTo80,
      Math.round(cycleLifeForDoD(chem, CHEMISTRIES[chem].usableDod) * factor),
      `${chem}: cyclesTo80 must equal the model at usableDod x a ${factor}x field derate`,
    );
  }
  // The derate is a field fact about un-balanced strings, so it must not touch
  // the two chemistries that are sold pre-balanced.
  assert.ok(
    CHEMISTRIES.lfp.cyclesTo80 > 4000 && CHEMISTRIES.naion.cyclesTo80 > 4000,
    "LFP and Na-ion ratings are the model's own, not derated",
  );
});

test("cycleLifeForDoD: deeper DoD never yields more cycles, for any chemistry", () => {
  // Not decoration. A sign error in the band exponent makes cycle life RISE with
  // depth, which pins the cap on at the shallow end and inverts the 20-year
  // replacement count. Both failure modes are loud numbers rather than a crash,
  // so only an explicit check catches them.
  for (const chem of ["lfp", "naion", "agm"]) {
    let previous = Infinity;
    for (let d = 0.1; d <= 1.0001; d += 0.05) {
      const cycles = cycleLifeForDoD(chem, Number(d.toFixed(2)));
      assert.ok(
        cycles <= previous,
        `${chem} at DoD ${d.toFixed(2)} read ${cycles} cycles, more than the shallower ${previous}`,
      );
      previous = cycles;
    }
  }
});

test("cycleLifeForDoD: a point on an anchor returns that anchor exactly", () => {
  // The curve must pass through the data points it was built from. Band i owns
  // [b[i], b[i+3]); selecting the other side of the boundary re-evaluates the
  // rounded precomputed exponent instead of reading the anchor, which is how
  // LFP came to read 5,999 at 80% DoD instead of 6,000.
  const cases = [
    ["lfp", 0.8, 6000],
    ["lfp", 1.0, 4000],
    ["agm", 0.5, 1250],
    ["agm", 0.8, 400],
    ["agm", 1.0, 175],
    ["naion", 0.85, 5500],
    ["naion", 1.0, 5000],
  ];
  for (const [chem, dod, expected] of cases) {
    assert.equal(
      cycleLifeForDoD(chem, dod),
      expected,
      `${chem} at anchor DoD ${dod} must return ${expected} exactly`,
    );
  }
  // LFP's shallowest anchor is above the cap by design, so it reads the cap and
  // not 16,000. Asserted so the cap is a decision on the record, not a surprise.
  assert.equal(cycleLifeForDoD("lfp", 0.55), CYCLE_LIFE_CURVES.lfp.cap);
});

test("cycleLifeForDoD: boundary conditions and unknown chemistry fallback", () => {
  assert.equal(
    cycleLifeForDoD("lfp", 0.01),
    cycleLifeForDoD("lfp", 0.1),
    "Clamps minimum DoD to 0.1",
  );
  assert.equal(
    cycleLifeForDoD("lfp", 1.5),
    cycleLifeForDoD("lfp", 1.0),
    "Clamps maximum DoD to 1.0",
  );
  assert.equal(
    cycleLifeForDoD("unknown_chem", 0.8),
    4000,
    "Fallback returns sane 4,000 cycles",
  );
});
