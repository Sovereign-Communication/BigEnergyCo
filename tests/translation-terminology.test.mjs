import test from "node:test";
import assert from "node:assert/strict";
import { LOCALES } from "../assets/js/shared/locales.js";
import { checkTerminology } from "../scripts/lib/translation-terminology.mjs";

test("all shipped locales pass 56 selected terminology checks", () => {
  const report = checkTerminology(LOCALES);
  assert.deepEqual(report.errors, []);
  assert.equal(report.checked, 56);
  assert.equal(report.passed, report.checked);
});

test("replacing a battery term is detected in every locale", () => {
  for (const locale of Object.keys(LOCALES)) {
    const changed = structuredClone(LOCALES);
    changed[locale].socChartTitle = "incorrect component";
    assert.ok(
      checkTerminology(changed).errors.some((e) =>
        e.startsWith(`${locale}.socChartTitle:`),
      ),
    );
  }
});

test("the shipped German truncation is rejected and a new locale cannot bypass the glossary", () => {
  const changed = structuredClone(LOCALES);
  changed.de.reserveLabel = "Notfall-Reservestand in der Batteri";
  assert.ok(
    checkTerminology(changed).errors.some((e) =>
      e.startsWith("de.reserveLabel:"),
    ),
  );
  const uncovered = checkTerminology({ ...LOCALES, it: LOCALES.en });
  assert.equal(uncovered.errors.filter((e) => e.startsWith("it.")).length, 8);
});

test("Unicode composition and case do not create false glossary failures", () => {
  const changed = structuredClone(LOCALES);
  changed.fr.infeasibleNeedsPanelsTitle = LOCALES.fr.infeasibleNeedsPanelsTitle
    .normalize("NFD")
    .toUpperCase();
  assert.deepEqual(checkTerminology(changed).errors, []);
});
