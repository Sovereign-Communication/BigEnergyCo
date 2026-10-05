// The four purchase paths (master plan D-01 §6.4, R-PATH-01..10).
//
// The facet this file serves asks whether a visitor can see the turnkey
// installer, the lease or PPA, self-purchase with a licensed electrician, and
// DIY mounting with an electrician connection, priced for the SAME system over
// the SAME twenty years under the SAME definitions — so the gap between them
// is a real gap rather than a difference in what each side counts.
//
// Before paths.js the answer was no, and the reason is worth keeping on
// record: the page showed a "typical installer quote" computed as 10x the
// cheapest hardware build and 5x the dearest, against a "do it yourself" figure
// computed as the same hardware plus a flat $1,500-$3,000 for an electrician.
// Both numbers were invented where they were displayed. The gap between them
// was therefore a gap between two COUNTING RULES, which is exactly what this
// facet disqualifies.
//
// The model itself is pure and Node-importable, so most of this is behaviour.
// The audit that makes "the same definitions" a checkable claim lives in
// scripts/lib/paths-integrity.mjs, NOT in the shipped bundle: no visitor
// triggers it, so it has no business on the wire.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PATH_IDS,
  DEFAULT_PATH_ID,
  HORIZON_YEARS,
  REGION_IDS,
  LEASE_INSTRUMENTS,
  INCENTIVES,
  INCLUDED_BY_PATH,
  LABEL_KEYS,
  DRIVER_KEYS,
  DEGRADATION,
  bandMid,
  bandEnd,
  energyByYear,
  leaseSchedule,
  priceAllPaths,
  explainRanking,
  describePaths,
  systemForPaths,
  blockedReasonKey,
  legalityFor,
  regionForCountry,
  registryFor,
  incentivesFor,
} from "../assets/js/sizing/paths.js";
import { comparisonIntegrity } from "../scripts/lib/paths-integrity.mjs";
import { LOCALES } from "../assets/js/shared/locales.js";
import { synthesizeFromProfile } from "../assets/js/sizing/nasa.js";
import {
  OFFLINE_PROFILES,
  PROFILE_YEAR,
} from "../assets/js/sizing/profiles.js";
import { runSizing } from "../assets/js/sizing/run.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// A deliberately ordinary whole-home system. The point is not to make the
// comparison flattering, it is to see whether it discriminates.
const SYSTEM = {
  pvKw: 6,
  battKwh: 13.5,
  annualServedKwh: 9200,
  replacements: 1,
  batteryLifeYears: 12,
  annualBaselineBillsUsd: 2400,
  annualResidualBillsUsd: 480,
  billCutPct: 80,
  tariff: 0.3,
};

const priced = (over = {}, ctx = { country: "US", instrument: "ppa" }) =>
  priceAllPaths({ ...SYSTEM, ...over }, ctx);

// ── 1. the four routes, one owner ───────────────────────────────────────────

test("D-01's four routes are declared once, in one registry", () => {
  assert.deepEqual(PATH_IDS, ["turnkey", "lease", "selfpurchase", "diy"]);
  assert.equal(DEFAULT_PATH_ID, "turnkey");
  // No route may be priced by a name the registry does not declare.
  for (const id of PATH_IDS) {
    assert.equal(INCLUDED_BY_PATH[id].length > 0, true, `${id} counts nothing`);
    assert.match(
      LABEL_KEYS[id],
      /^pathsLabel_/,
      `${id} has no static label key`,
    );
  }
  assert.deepEqual(Object.keys(LABEL_KEYS).sort(), [...PATH_IDS].sort());
});

test("the lease registry keeps PPA and lease apart (R-PATH-02)", () => {
  assert.deepEqual(LEASE_INSTRUMENTS, ["ppa", "lease"]);
  // A PPA buys ENERGY and never ends inside the horizon; a lease rents the
  // SYSTEM and ends. Conflating them is how "a lease costs nothing" happens.
  const ppa = leaseSchedule({
    installedUsd: 20000,
    annualServedKwh: 9200,
    tariff: 0.3,
    instrument: "ppa",
  });
  const lease = leaseSchedule({
    installedUsd: 20000,
    annualServedKwh: 9200,
    tariff: 0.3,
    instrument: "lease",
  });
  assert.notEqual(ppa.endOfTerm.noteKey, lease.endOfTerm.noteKey);
  assert.notEqual(
    ppa.terms.downPaymentPct.join(),
    lease.terms.downPaymentPct.join(),
  );
  // The two must actually price differently, or the toggle is decoration.
  const a = priced({}, { country: "US", instrument: "ppa" }).by.lease;
  const b = priced({}, { country: "US", instrument: "lease" }).by.lease;
  assert.notEqual(a.spend20, b.spend20);
});

// ── 2. every route can refuse ───────────────────────────────────────────────

test("a route that cannot be priced says so, with a reason", () => {
  const none = priced({ pvKw: 0, battKwh: 0 });
  for (const p of none.paths) {
    assert.equal(
      p.available,
      false,
      `${p.id} priced a system that does not exist`,
    );
    assert.equal(p.blockedBy, "no-system");
    assert.ok(blockedReasonKey(p.blockedBy), "a refusal must carry a message");
  }
  // A PPA discounts against the utility rate; with no rate there is nothing to
  // discount and the card says that rather than inventing a number.
  const noTariff = priced({ tariff: null });
  assert.equal(noTariff.by.lease.available, false);
  assert.equal(noTariff.by.lease.blockedBy, "no-tariff");
  // ...while the cash routes, which do not need a rate, still price.
  assert.equal(noTariff.by.turnkey.available, true);
  assert.equal(noTariff.by.selfpurchase.available, true);
});

test("legality removes the DIY route rather than offering it quietly (D-10)", () => {
  // Unknown is neither permitted nor forbidden, and must not render as a
  // green light — so it REMOVES the card. `legalityFor` answers null, not a
  // third state string: there is no jurisdiction record, and inventing one
  // ("mostly allowed") is how a green light appears by default.
  const unknown = legalityFor("AQ");
  assert.equal(unknown.diyMounting, null);
  assert.equal(unknown.electricalDiy, null);
  assert.ok(
    unknown.source,
    "an unknown jurisdiction must still state its source",
  );
  const r = priced({}, { country: "AQ" });
  assert.equal(r.by.diy.available, false);
  assert.equal(r.by.diy.blockedBy, "diy-unknown");
  // A jurisdiction that requires a licensed electrician for the electrical
  // work is not the jurisdiction R-PATH-04 describes either.
  const us = priced({}, { country: "US" });
  assert.equal(us.by.diy.available, false);
  assert.equal(us.by.diy.blockedBy, "diy-not-permitted");
  // A refusal still has to be explainable.
  for (const p of r.paths.filter((x) => !x.available))
    assert.ok(p.notes.length > 0, `${p.id} refuses without saying why`);
});

// ── 3. one system, one horizon, one set of definitions ──────────────────────

test("all four routes are priced against ONE system (R-PATH-07)", () => {
  const r = priced();
  assert.deepEqual(comparisonIntegrity(r), []);
  // Physics cannot differ between payment routes. If it does, one of them was
  // priced against a different system, which is the whole defect.
  const cuts = new Set(
    r.paths.filter((p) => p.available).map((p) => p.billCutPct),
  );
  assert.equal(cuts.size, 1);
  const residual = new Set(
    r.paths.filter((p) => p.available).map((p) => p.residualBills20),
  );
  assert.equal(residual.size, 1);
  // 20-year spend IS year0 - incentives + recurring, on every route.
  for (const p of r.paths.filter((x) => x.available)) {
    assert.equal(p.spend20, p.year0 - p.incentives + p.recurringTotal, p.id);
    assert.equal(p.horizonYears, HORIZON_YEARS);
    assert.equal(p.recurringByYear.length, HORIZON_YEARS);
    // Grid bills are excluded from the system figure and reported separately:
    // they are a property of the system, not of the payment route.
    assert.equal(p.baselineBills20, SYSTEM.annualBaselineBillsUsd * 20);
    assert.equal(p.residualBills20, SYSTEM.annualResidualBillsUsd * 20);
    assert.equal(
      p.net20,
      p.baselineBills20 - p.residualBills20 - p.spend20,
      `${p.id} net is baseline bills - residual bills - system spend`,
    );
  }
});

test("the installer's all-in price is not charged twice", () => {
  const t = priced().by.turnkey;
  // The turnkey band already contains hardware, labour, permits and margin.
  // Adding fees on top of it would double-count them, which is how a "gap"
  // stops being real.
  assert.equal(t.labour, 0);
  assert.equal(t.fees, 0);
  assert.equal(t.year0, t.hardware);
});

test("hardware wears out on a clock, not on who paid for it", () => {
  const r = priced({}, { country: "IN" });
  const owners = ["turnkey", "selfpurchase", "diy"].map((id) => r.by[id]);
  for (const p of owners) {
    assert.equal(p.available, true, `${p.id} must be available in IN`);
  }
  // The SAME replacement schedule on all three routes that leave the visitor
  // holding the system, and none on the one that does not.
  const totals = owners.map((p) => p.replacementsTotal);
  assert.equal(new Set(totals).size, 1, `replacements differ: ${totals}`);
  assert.ok(totals[0] > 0, "a 13.5 kWh bank over 20 years costs something");
  const lease = r.by.lease;
  assert.equal(
    lease.replacementsTotal,
    0,
    "the provider's hardware is the provider's",
  );
  assert.equal(lease.omTotal, 0);
});

test("incentives follow the OWNER, and a zero carries its reason (R-PATH-05)", () => {
  const r = priced();
  const lease = r.by.lease;
  assert.equal(lease.incentives, 0);
  assert.equal(lease.incentiveNoteKey, "pathsIncentivesToProvider");
  // The incentive registry names the paths it applies to, which is what stops
  // two cards being compared with different things counted.
  for (const [region, entries] of Object.entries(INCENTIVES))
    for (const e of entries)
      assert.ok(
        Array.isArray(e.eligiblePaths) && e.eligiblePaths.length > 0,
        `${region}/${e.id} claims an incentive with no eligible path`,
      );
  // Where an incentive IS available, the owner's routes take it and the
  // lease does not.
  for (const id of ["turnkey", "selfpurchase", "diy"]) {
    const got = incentivesFor("us", id);
    if (got.length)
      assert.ok(r.by[id].incentives > 0, `${id} ignored its incentives`);
  }
});

test("the lease's end-of-term choice is INSIDE its 20-year figure (R-PATH-06)", () => {
  const r = priced({}, { country: "US", instrument: "lease" });
  const l = r.by.lease;
  assert.ok(l.endOfTerm, "a lease must state what happens at the end");
  assert.equal(l.endOfTerm.choice, "buyout-modelled");
  assert.ok(l.endOfTerm.termYears < HORIZON_YEARS);
  assert.ok(l.endOfTerm.buyoutUsd > 0);
  // The buyout has to be inside the schedule, not merely mentioned beside it.
  const year = l.recurringByYear[l.endOfTerm.termYears - 1];
  assert.ok(year > 0, `year ${l.endOfTerm.termYears} carries no buyout`);
  // A term that runs past the horizon has no buyout to model, and says so.
  const ppa = priced({}, { country: "US", instrument: "ppa" }).by.lease;
  assert.equal(ppa.endOfTerm.choice, "still-leasing-at-horizon");
  assert.equal(ppa.endOfTerm.buyoutUsd, null);
});

// ── 4. the ranking is accounted for ─────────────────────────────────────────

test("every adjacent price gap reconstructs from its components", () => {
  const r = priced();
  assert.ok(r.rankingExplained.length > 0, "nothing was ordered");
  for (const e of r.rankingExplained) {
    assert.equal(e.explained, true, `${e.cheaper} vs ${e.dearer} unexplained`);
    // The components are ADDITIVE, which is the check: a story that does not
    // add up is not an explanation.
    const sum = Object.values(e.components).reduce((x, y) => x + y, 0);
    assert.ok(
      Math.abs(sum - e.gap) <= 1,
      `components sum to ${sum}, gap ${e.gap}`,
    );
    assert.ok(Math.abs(e.residual) <= 1);
    assert.ok(DRIVER_KEYS[e.driver], `unlabelled driver: ${e.driver}`);
  }
});

test("the ranking is sorted by the same number the cards print", () => {
  const r = priced();
  const spends = r.ranking.map((id) => r.by[id].spend20);
  for (let i = 1; i < spends.length; i++)
    assert.ok(spends[i - 1] <= spends[i], "ranking disagrees with spend20");
  // cheapest is the head of that ordering, not a separate computation.
  assert.equal(r.cheapest, r.ranking[0]);
  // And the premiums are differences between model prices, not estimates.
  assert.equal(
    r.premiums.installer,
    r.by.turnkey.year0 - r.by.selfpurchase.year0,
  );
  assert.equal(
    r.premiums.lease,
    r.by.lease.spend20 - r.by.selfpurchase.spend20,
  );
});

test("a gap driven by two components is real, not unexplained", () => {
  // The model reports `dominance: "combined"` rather than dressing a mixed
  // ordering up as one dominant cause.
  const all = [];
  for (const country of REGION_IDS)
    for (const instrument of LEASE_INSTRUMENTS) {
      const r = priced({}, { country, instrument });
      for (const e of r.rankingExplained) {
        assert.ok(["single-component", "combined"].includes(e.dominance));
        all.push(e);
      }
    }
  assert.ok(all.length > 0);
  for (const e of all) assert.equal(e.explained, true);
});

// ── 5. through the REAL engine ──────────────────────────────────────────────

test("all four routes walk through the real sizing engine, comparable", async () => {
  const site = OFFLINE_PROFILES.find((p) => p.name.includes("Honolulu"));
  const fakeWeather = async () => ({
    hours: synthesizeFromProfile(site),
    meta: {
      latitude: site.lat,
      longitude: site.lon,
      startYear: PROFILE_YEAR,
      endYear: PROFILE_YEAR,
      years: 1,
      source: "offline profile (test)",
      offline: false,
    },
  });
  const payload = await runSizing(
    {
      latitude: site.lat,
      longitude: site.lon,
      dailyKwh: 20,
      tariff: 0.42,
      exportRate: 0.1,
      years: 1,
      chemistry: "lfp",
      mode: "gridtie",
      customCut: 0.8,
    },
    { fetchWeather: fakeWeather },
  );
  const entry = payload.targets.find((t) => t.solvable) || payload.best;
  assert.ok(entry, "the engine produced no system to price");

  // The adapter is the page's adapter, not a re-derivation of it.
  const system = systemForPaths(entry, {
    annualBaselineBillsUsd: payload.annualGridSpendUsd,
    tariff: payload.tariff,
  });
  assert.ok(system.pvKw > 0, "the sized array did not reach the comparison");
  assert.ok(system.annualBaselineBillsUsd > 0, "the visitor's bill did not");
  assert.ok(system.annualResidualBillsUsd !== null);

  for (const country of ["US", "DE", "AU", "BR", "IN"]) {
    const r = priceAllPaths(system, { country, instrument: "ppa" });
    assert.deepEqual(
      comparisonIntegrity(r),
      [],
      `${country} is not comparable`,
    );
    assert.equal(r.paths.length, PATH_IDS.length);
    // Every id the ranking names must be a card the page can actually render.
    for (const id of r.ranking) assert.equal(r.by[id].available, true, `${id}`);
  }
});

test("the adapter is the only seam, and it refuses rather than guesses", () => {
  // Missing fields become nulls, not zeros: a zero baseline bill reads as
  // "this system pays for itself immediately".
  const s = systemForPaths({});
  assert.equal(s.annualBaselineBillsUsd, null);
  assert.equal(s.annualResidualBillsUsd, null);
  assert.equal(s.pvKw, 0);
  // The residual bill comes off the entry's own post-solar figure PLUS the
  // export credit that figure was already net of.
  const s2 = systemForPaths({
    pvKw: 5,
    battKwh: 10,
    billAfterMonthlyUsd: 20,
    exportValueAnnualUsd: 60,
  });
  assert.equal(s2.annualResidualBillsUsd, 20 * 12 + 60);
  // An explicit context value wins, so a caller can override.
  assert.equal(
    systemForPaths({ billAfterMonthlyUsd: 20 }, { annualResidualBillsUsd: 999 })
      .annualResidualBillsUsd,
    999,
  );
});

// ── 6. the audit catches tampering (mutation checks) ────────────────────────
//
// A comparability claim that cannot fail is a caption. Each clause below
// breaks the model on purpose and requires the audit to notice.

const tamper = (mutate) => {
  const r = priced();
  mutate(r);
  return comparisonIntegrity(r);
};

test("the audit catches a spend20 that is not its own definition", () => {
  const problems = tamper((r) => {
    r.by.turnkey.spend20 += 500;
  });
  assert.ok(
    problems.some((p) => /spend20/.test(p)),
    `a doctored spend20 slipped through: ${JSON.stringify(problems)}`,
  );
});

test("the audit catches two paths priced against different systems", () => {
  const problems = tamper((r) => {
    r.by.selfpurchase.billCutPct = 95;
  });
  assert.ok(
    problems.some((p) => /disagree on billCutPct/.test(p)),
    `a split-system comparison slipped through: ${JSON.stringify(problems)}`,
  );
});

test("the audit catches a horizon that is not twenty years", () => {
  // Tamper an AVAILABLE route: the audit skips unavailable cards by design, so
  // a test aimed at `diy` would pass vacuously in the US.
  const problems = tamper((r) => {
    r.by.turnkey.horizonYears = 25;
  });
  assert.ok(problems.some((p) => /horizon/.test(p)));
});

test("the audit catches a ranking nobody can account for", () => {
  const problems = tamper((r) => {
    const e = r.rankingExplained[0];
    e.gap += 4000;
    e.explained = false;
  });
  assert.ok(problems.some((p) => /cannot be accounted for/.test(p)));
});

test("the audit catches four identical prices", () => {
  const problems = tamper((r) => {
    for (const p of r.paths) if (p.available) p.spend20 = 1000;
  });
  assert.ok(problems.some((p) => /prices identically/.test(p)));
});

test("the audit catches a year-0 range that does not contain its own mid", () => {
  const problems = tamper((r) => {
    r.by.turnkey.year0Low = r.by.turnkey.year0 + 1;
  });
  assert.ok(problems.some((p) => /year-0 range/.test(p)));
});

test("the audit runs on the real model, not only on tampered copies", () => {
  // Otherwise every clause above could pass by catching everything.
  for (const country of REGION_IDS)
    for (const instrument of LEASE_INSTRUMENTS)
      assert.deepEqual(
        comparisonIntegrity(priced({}, { country, instrument })),
        [],
        `${country}/${instrument}`,
      );
});

// ── the presentation layer never recomputes ─────────────────────────────────

test("describePaths reports the model's own numbers, in the model's shape", () => {
  const r = priced();
  const money = (u) => `$${Math.round(u).toLocaleString("en-US")}`;
  const cards = describePaths(r, money, (k) => k);
  assert.equal(cards.length, PATH_IDS.length);
  for (const [i, c] of cards.entries()) {
    assert.equal(c.id, PATH_IDS[i]);
    assert.equal(c.labelKey, LABEL_KEYS[PATH_IDS[i]]);
    if (!c.available) {
      assert.equal(c.reasonKey, blockedReasonKey(r.paths[i].blockedBy));
      continue;
    }
    const p = r.paths[i];
    assert.equal(c.spend20Text, money(p.spend20));
    // The card's break-even text follows the model's own verdict, including
    // the honest "not within 20 years" \u2014 it never prints a year the model
    // does not have.
    assert.equal(
      c.breakEvenText,
      p.breakEvenYear === null ? "pathsNotWithinHorizon" : "pathsBreakEvenYear",
      `${p.id}: break-even text must follow the model`,
    );
    assert.deepEqual(c.included, INCLUDED_BY_PATH[p.id]);
  }
});

test("break-even is measured against the bill the visitor actually pays", () => {
  const r = priced();
  for (const p of r.paths.filter((x) => x.available)) {
    if (!SYSTEM.annualBaselineBillsUsd) continue;
    // Cumulative (system spend + residual bills) at or below cumulative
    // baseline bills. Null means "not within 20 years", which the card states.
    let cum = p.year0 - p.incentives;
    let expected = null;
    for (let y = 0; y < HORIZON_YEARS; y++) {
      cum += p.recurringByYear[y];
      if (
        cum + SYSTEM.annualResidualBillsUsd * (y + 1) <=
        SYSTEM.annualBaselineBillsUsd * (y + 1)
      ) {
        expected = y + 1;
        break;
      }
    }
    assert.equal(p.breakEvenYear, expected, p.id);
  }
  // No baseline bill at all means no break-even can be claimed, not a fast one.
  const blind = priced({
    annualBaselineBillsUsd: null,
    annualResidualBillsUsd: null,
  });
  for (const p of blind.paths.filter((x) => x.available))
    assert.equal(p.breakEvenYear, null, p.id);
});

test("every string the panel can render exists in all six locales", () => {
  // The gate that refuses runtime-assembled keys (check-i18n.mjs) is why
  // LABEL_KEYS and DRIVER_KEYS are maps and not template literals. This test is
  // the other half, and it exists because that gate found the OTHER half
  // useless: it verifies every shipped key is rendered, but nothing verifies
  // that a key named inside a DATA STRUCTURE is translated. The lease card
  // shipped with `pathsIncludesIncentivesToProvider` untranslated \u2014 the raw
  // key name, to a visitor, in six languages.
  const keys = new Set();
  for (const [region, entries] of Object.entries(INCENTIVES))
    for (const e of entries) keys.add(e.labelKey);
  for (const id of PATH_IDS) {
    keys.add(LABEL_KEYS[id]);
    keys.add(blockedReasonKey(null));
    for (const k of INCLUDED_BY_PATH[id]) keys.add(k);
  }
  for (const k of Object.values(DRIVER_KEYS)) keys.add(k);
  keys.add("pathsTitle");
  keys.add("pathsSub");
  keys.add("pathsCheapest");
  keys.add("pathsSpend20");
  keys.add("pathsRowIncentives");
  keys.add("pathsRowBillCut");
  keys.add("pathsRowBreakEven");
  keys.add("pathsRowNet");
  keys.add("pathsRowOwnership");
  keys.add("pathsRowEndOfTerm");
  keys.add("pathsCountsHeading");
  keys.add("pathsInstrumentLabel");
  keys.add("pathsInstrumentPpa");
  keys.add("pathsInstrumentLease");
  keys.add("pathsGradeNote");
  keys.add("pathsWhy");
  keys.add("pathsWhyCombined");
  keys.add("pathsNotWithinHorizon");
  keys.add("pathsBreakEvenYear");
  keys.add("pathsUnknown");
  keys.add("pathsIncentivesToProvider");
  keys.add("pathsIncentivesGoToProvider");
  keys.add("pathsNoIncentive");
  keys.add("pathsNoVerifiedIncentive");
  keys.add("pathsNoteTurnkeyAllIn");
  keys.add("pathsEndOfTermBuyout");
  keys.add("pathsEndOfTermStillLeasing");
  for (const k of Object.values(DRIVER_KEYS)) keys.add(k);
  // And every ownership string, which the model picks per path.
  for (const k of [
    "pathsOwnershipTurnkey",
    "pathsOwnershipPpa",
    "pathsOwnershipLease",
    "pathsOwnershipSelf",
  ])
    keys.add(k);
  // Every refusal reason the model can name, not just the generic one.
  for (const b of [
    null,
    "no-system",
    "no-tariff",
    "diy-not-permitted",
    "diy-restricted",
    "diy-unknown",
  ])
    keys.add(blockedReasonKey(b));

  for (const locale of ["en", "es", "pt", "fr", "de", "ar"]) {
    for (const key of keys) {
      assert.equal(
        typeof LOCALES[locale]?.[key],
        "string",
        `${locale} is missing ${key} \u2014 a card would render the raw key name`,
      );
      // No locale may ship a key name as its own text.
      assert.notEqual(
        LOCALES[locale][key],
        key,
        `${locale}: ${key} is untranslated`,
      );
    }
  }
  // Placeholders must agree across languages or a sentence renders with a hole.
  const ph = (s) => (s.match(/\{[a-zA-Z]+\}/g) || []).sort().join(",");
  for (const key of keys)
    for (const locale of ["es", "pt", "fr", "de", "ar"])
      assert.equal(
        ph(LOCALES[locale][key]),
        ph(LOCALES.en[key]),
        `${locale}: ${key} lost or gained a placeholder`,
      );
});

// ── the gate and the evidence line ──────────────────────────────────────────

test("GATE: the four-path comparison gate passes on the real tree", () => {
  const out = execFileSync(process.execPath, ["scripts/check-comparison.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.match(out, /COMPARISON OK/);
  // The walk must reach the engine and the four routes, not print constants.
  assert.match(out, /four-path walk \(probe site: Honolulu/);
  for (const id of PATH_IDS)
    assert.ok(out.includes(id), `gate never priced ${id}`);
});

test("GATE: the comparison gate is wired into the preflight, not merely present", () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
  );
  assert.match(pkg.scripts.seo, /check-comparison\.mjs/);
  assert.equal(
    pkg.scripts["gate:comparison"],
    "node scripts/check-comparison.mjs",
  );
});

test("EVIDENCE: the comparison facet line cannot contradict the gate", () => {
  const ev = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, "evidence/advisor-and-release.json"),
      "utf8",
    ),
  );
  const line = ev.facet_evidence.comparison;
  assert.ok(line && line.length > 40, "the facet line is a measurement");
  // It must name the gate that proves it, and the four routes it priced.
  assert.match(line, /check-comparison\.mjs/);
  for (const id of PATH_IDS)
    assert.ok(line.includes(id), `the line must report ${id}`);
  // And it must not assert the negation of the thing the gate proves.
  for (const bad of [
    "not comparable",
    "different counting",
    "no purchase-path",
    "estimated from a multiplier",
    "same definitions are not enforced",
  ])
    assert.ok(
      !line.includes(bad),
      `the line asserts the gate's negation: ${bad}`,
    );
  assert.match(line, /20[- ]year/i);
});

// ── the bands themselves ────────────────────────────────────────────────────

test("bandMid and bandEnd read a [low, mid, high] triple, defensively", () => {
  assert.equal(bandMid([1, 2, 3]), 2);
  assert.equal(bandMid([1, 2, 3]), 2);
  assert.equal(bandEnd([1, 2, 3], 0), 1);
  assert.equal(bandEnd([1, 2, 3], 2), 3);
  // A malformed registry row must read as zero, not throw and not NaN.
  assert.equal(bandMid(null), 0);
  assert.equal(bandMid([1, NaN, 3]), 0);
  assert.equal(bandEnd(undefined, 1), 0);
});

test("every region resolves to a registry with a stated grade and source", () => {
  assert.ok(REGION_IDS.length > 1, "one region cannot vary by market");
  for (const region of REGION_IDS) {
    const reg = registryFor(region);
    assert.ok(reg, `${region} has no registry`);
    assert.ok(
      reg.source && reg.source.length > 10,
      `${region} states no source`,
    );
    assert.ok(
      ["A", "B", "C"].includes(reg.grade),
      `${region} grade ${reg.grade}`,
    );
    for (const [band, name] of [
      [reg.tkPvPerW, "tkPvPerW"],
      [reg.hwBattPerKwh, "hwBattPerKwh"],
      [reg.elecRate, "elecRate"],
      [reg.permit, "permit"],
      [reg.omPct, "omPct"],
    ]) {
      assert.equal(
        band.length,
        3,
        `${region}.${name} is not a [low,mid,high] triple`,
      );
      assert.ok(
        band[0] <= band[1] && band[1] <= band[2],
        `${region}.${name} is not ordered low<=mid<=high`,
      );
    }
  }
  // country -> region must never be undefined, because an undefined region
  // silently falls back to the first row and prices a German array in US money.
  for (const country of ["US", "DE", "AU", "BR", "IN", "ZA", "JP"])
    assert.ok(REGION_IDS.includes(regionForCountry(country)), country);
});

test("energyByYear degrades the output, it does not repeat it", () => {
  // This is what makes a 20-year figure a 20-year figure rather than a year-0
  // number times twenty. The defaults are the cited PVWatts values and are
  // defaults, not a measurement of the visitor's own array.
  assert.equal(DEGRADATION.firstYear, 0.02);
  assert.ok(DEGRADATION.annual > 0 && DEGRADATION.annual < 0.02);
  const e = energyByYear(1000);
  assert.equal(e.length, HORIZON_YEARS);
  assert.ok(
    Math.abs(e[0] - 1000 * (1 - DEGRADATION.firstYear)) < 1e-6,
    `year 1 applies the first-year derate: ${e[0]}`,
  );
  assert.ok(
    e[19] < e[0],
    "degradation must reduce year-20 output against year 1 (D-01 §6.4)",
  );
  for (let i = 1; i < e.length; i++)
    assert.ok(e[i] <= e[i - 1], `year ${i + 1} outruns year ${i}`);
  // And a system that serves nothing serves nothing, not an amount that
  // escalates from zero into a positive figure.
  assert.deepEqual(energyByYear(0), new Array(HORIZON_YEARS).fill(0));
});
