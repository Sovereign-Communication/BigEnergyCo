// The lead-acid reference is the one cross-chemistry claim the site makes, and
// it shipped a sentence that contradicted itself ("lead-acid ~€1,926.36 less —
// but needs ~0 swaps · not recommended") for a design with no battery at all.
// These tests pin every branch of the copy, and the guards that decide whether
// a comparison may be drawn at all.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  leadAcidChipCopy,
  leadAcidComparison,
  leadAcidReferenceCopy,
} from "../assets/js/sizing/lead-acid.js";

const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;

const pick = (over = {}) => ({
  chemistry: "lfp",
  solvable: true,
  battKwh: 10,
  lifetimeCostMid: 6000,
  replacementsHorizon: 0,
  ...over,
});
const agm = (over = {}) => ({
  chemistry: "agm",
  solvable: true,
  battKwh: 24,
  lifetimeCostMid: 20000,
  replacementsHorizon: 8,
  ...over,
});

test("LEAD-ACID: a real comparison states the saving and the swaps skipped", () => {
  const cmp = leadAcidComparison(pick(), agm());
  assert.equal(cmp.direction, "save");
  assert.equal(cmp.deltaUsd, 14000);
  const copy = leadAcidChipCopy(cmp, money);
  assert.equal(copy.big, "save ~$14,000");
  assert.equal(copy.small, "vs lead-acid · skips ~8 swaps");
});

test("LEAD-ACID: when lead-acid really is cheaper, the copy says so and names the cost", () => {
  const cmp = leadAcidComparison(pick(), agm({ lifetimeCostMid: 4000 }));
  assert.equal(cmp.direction, "cheaper");
  assert.equal(cmp.deltaUsd, 2000);
  const copy = leadAcidChipCopy(cmp, money);
  assert.equal(
    copy.big,
    "lead-acid ~$2,000 cheaper",
    "never the bare word 'less' with no basis",
  );
  assert.match(copy.small, /needs ~8 swaps and acid upkeep · not recommended/);
});

test("LEAD-ACID: a no-swap lead-acid bank is explained, never sold as a free pass", () => {
  // Regression: this branch used to read "needs ~0 swaps · not recommended".
  const cmp = leadAcidComparison(pick(), agm({ replacementsHorizon: 0 }));
  const copy = leadAcidChipCopy(cmp, money);
  assert.doesNotMatch(copy.small, /0 swaps/);
  assert.match(copy.small, /2\.4× the bank for the same usable kWh/);

  const cheaper = leadAcidChipCopy(
    leadAcidComparison(
      pick(),
      agm({ replacementsHorizon: 0, lifetimeCostMid: 4000 }),
    ),
    money,
  );
  assert.doesNotMatch(cheaper.small, /0 swaps/);
  assert.match(cheaper.small, /2\.4× the bank and the shortest life/);
});

test("LEAD-ACID: a bank-free design draws no chemistry comparison at all", () => {
  // Regression: the reported contradiction was a PV-sizing delta between two
  // systems that had no battery between them.
  assert.equal(
    leadAcidComparison(pick({ battKwh: 0 }), agm({ battKwh: 0 })),
    null,
  );
  assert.equal(
    leadAcidComparison(pick({ battKwh: 0 }), agm()),
    null,
    "one side bank-free is still not a chemistry comparison",
  );
  assert.equal(leadAcidComparison(pick(), agm({ battKwh: 0 })), null);
});

test("LEAD-ACID: lead-acid is never compared with itself, or with missing data", () => {
  assert.equal(leadAcidComparison(pick({ chemistry: "agm" }), agm()), null);
  assert.equal(leadAcidComparison(null, agm()), null);
  assert.equal(leadAcidComparison(pick(), null), null);
  assert.equal(leadAcidComparison(pick(), agm({ solvable: false })), null);
  assert.equal(leadAcidComparison(pick(), agm({ lifetimeCostMid: NaN })), null);
  assert.equal(leadAcidComparison(pick({ lifetimeCostMid: NaN }), agm()), null);
  assert.equal(
    leadAcidComparison(pick(), agm({ replacementsHorizon: undefined })),
    null,
    "an unknown swap count is not a claim we can make",
  );
  // A figure from the comparison tab's nameplate model must never be
  // subtracted from a simulated reference.
  assert.equal(
    leadAcidComparison(pick({ estimatedFromTab: true }), agm()),
    null,
    "no cross-model deltas",
  );
  assert.equal(
    leadAcidComparison(pick(), agm({ estimatedFromTab: true })),
    null,
  );
  // Identical economics in every respect is not a comparison either.
  assert.equal(
    leadAcidComparison(
      pick({ lifetimeCostMid: 5000 }),
      agm({ lifetimeCostMid: 5000, replacementsHorizon: 0 }),
    ),
    null,
  );
});

test("LEAD-ACID: the footnote refuses a bank-free reference too", () => {
  assert.deepEqual(leadAcidReferenceCopy(agm()), {
    lifetimeCostUsd: 20000,
    swaps: 8,
    battKwh: 24,
  });
  assert.equal(
    leadAcidReferenceCopy(agm({ battKwh: 0 })),
    null,
    "a lead-acid reference with no bank references nothing",
  );
  assert.equal(leadAcidReferenceCopy(null), null);
  assert.equal(leadAcidReferenceCopy(agm({ solvable: false })), null);
  assert.equal(leadAcidReferenceCopy(agm({ lifetimeCostMid: NaN })), null);
});

test("LEAD-ACID: ui.js renders both places from the shared helper", () => {
  const ui = readFileSync("assets/js/sizing/ui.js", "utf8");
  assert.match(ui, /leadAcidComparison\(entry, p\.agmReference\)/);
  assert.match(ui, /leadAcidReferenceCopy\(agm\)/);
  // Tab-adopted entries say where their money came from, and the tab tells the
  // visitor which model it used.
  assert.match(ui, /estimatedFromTab: true/);
  assert.match(ui, /nameplate model<\/strong>/);
  // The old inline copy is gone: it is what disagreed with itself.
  assert.doesNotMatch(ui, /but needs ~\$\{agm\.replacementsHorizon\} swaps/);
  assert.doesNotMatch(ui, /with no swaps`\)/);
});
