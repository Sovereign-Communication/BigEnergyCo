import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { EXPERIENCE_FACET_AXES } from "../scripts/lib/experience-budgets.mjs";
import { BYTE_BUDGET_FACET_AXES } from "../scripts/lib/byte-budgets.mjs";
import { FACET_EVIDENCE } from "../scripts/lib/jev-facet-evidence.mjs";
import { LIGHTHOUSE_FACET_AXES } from "../scripts/lib/lighthouse-budgets.mjs";
import { validateFacetEvidence } from "../scripts/check-facet-evidence.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const axes = Object.keys(
  JSON.parse(
    readFileSync(join(ROOT, "scripts/lib/jev-complete.pack.json"), "utf8"),
  ).axes,
);
const derivedAxes = [
  ...LIGHTHOUSE_FACET_AXES,
  ...EXPERIENCE_FACET_AXES,
  ...BYTE_BUDGET_FACET_AXES,
];
const workflow = readFileSync(join(ROOT, ".github/workflows/test.yml"), "utf8");
const packageJson = JSON.parse(
  readFileSync(join(ROOT, "package.json"), "utf8"),
);

test("EVIDENCE: all 21 Jev facets have a code line or a run-derived owner", () => {
  assert.equal(axes.length, 21);
  assert.equal(Object.isFrozen(FACET_EVIDENCE), true);
  assert.deepEqual(
    validateFacetEvidence({ axes, facetEvidence: FACET_EVIDENCE, derivedAxes }),
    {
      missing: [],
      invalid: [],
      unexpected: [],
      unknownDerived: [],
      legacyField: false,
    },
  );
});

test("GUARD: removing a static facet fails with its name", () => {
  const evidenceWithoutSpec = { ...FACET_EVIDENCE };
  delete evidenceWithoutSpec.spec;

  const result = validateFacetEvidence({
    axes,
    facetEvidence: evidenceWithoutSpec,
    derivedAxes,
  });
  assert.deepEqual(result.missing, ["spec"]);
});

test("EVIDENCE: the prose JSON cannot reintroduce a second facet source", () => {
  const prose = JSON.parse(
    readFileSync(join(ROOT, "evidence/advisor-and-release.json"), "utf8"),
  );
  assert.equal(Object.hasOwn(prose, "facet_evidence"), false);
  assert.equal(
    validateFacetEvidence({
      axes,
      facetEvidence: FACET_EVIDENCE,
      derivedAxes,
      prose,
    }).legacyField,
    false,
  );
});

test("CI: the all-facet guard runs in the required test workflow", () => {
  assert.equal(
    packageJson.scripts["gate:facet-evidence"],
    "node scripts/check-facet-evidence.mjs",
  );
  assert.match(workflow, /run: npm run gate:facet-evidence/);
});
