import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  JARGON,
  JARGON_TERMS,
  JARGON_LOCALES,
} from "../assets/js/shared/jargon-dict.js";
import {
  readSimpleMode,
  writeSimpleMode,
  SIMPLE_MODE_KEY,
} from "../assets/js/shared/simple-mode.js";
import {
  climateClass,
  climateSummary,
  soilingFactor,
  thermalBatteryFactor,
  worstMonth,
} from "../assets/js/sizing/climate.js";
import {
  panelCapFromArea,
  pvCapKwFromArea,
  createMapProviderRegistry,
  optionalMapPolicy,
} from "../assets/js/sizing/map-provider.js";
import {
  createWizard,
  WIZARD_ERRORS,
  WIZARD_STEPS,
  persistWizard,
  restoreWizard,
} from "../assets/js/sizing/wizard.js";

const ROOT = new URL("..", import.meta.url);

class MemoryStorage {
  #data = new Map();
  getItem(key) {
    return this.#data.get(key) ?? null;
  }
  setItem(key, value) {
    this.#data.set(key, String(value));
  }
}

test("GATE: every glossary entry has a short and long plain-language explanation", () => {
  assert.ok(JARGON_TERMS.length >= 24);
  for (const term of JARGON_TERMS) {
    assert.equal(
      typeof JARGON[term].short,
      "string",
      `${term}: short explanation`,
    );
    assert.equal(
      typeof JARGON[term].long,
      "string",
      `${term}: long explanation`,
    );
    assert.ok(
      JARGON[term].short.length > 3 && JARGON[term].long.length > 20,
      `${term}: explanation is useful`,
    );
  }
  for (const locale of ["es", "pt", "fr", "de", "ar"]) {
    for (const [term, entry] of Object.entries(JARGON_LOCALES[locale])) {
      assert.ok(JARGON[term], `${locale}/${term}: registered English fallback`);
      assert.ok(
        entry.short && entry.long,
        `${locale}/${term}: translated entry`,
      );
    }
  }
  const html = fs.readFileSync(new URL("index.html", ROOT), "utf8");
  for (const term of ["kWh", "tariff", "inverter", "usableCapacity"]) {
    assert.match(html, new RegExp(`data-jargon="${term}"`));
  }
});

test("Simple mode defaults on and survives storage changes", () => {
  const storage = new MemoryStorage();
  assert.equal(readSimpleMode(storage), true);
  writeSimpleMode(false, storage);
  assert.equal(storage.getItem(SIMPLE_MODE_KEY), "technical");
  assert.equal(readSimpleMode(storage), false);
  writeSimpleMode(true, storage);
  assert.equal(readSimpleMode(storage), true);
});

test("climate helpers classify deterministically and expose honest derates", () => {
  const desert = Array.from({ length: 48 }, (_, i) => ({
    ghi: i % 24 >= 7 && i % 24 <= 17 ? 900 : 0,
    tAmb: 35,
  }));
  assert.equal(climateClass(desert), "desert");
  assert.equal(soilingFactor(desert), 0.91);
  assert.equal(soilingFactor(desert, 0.96), 0.96);
  assert.equal(thermalBatteryFactor("lfp", [{ tAmb: -4 }]).chargeMinC, 0);
  assert.ok(thermalBatteryFactor("lfp", [{ tAmb: -4 }]).warning);
  assert.equal(climateSummary(desert).soiling, 0.91);
});

test("worst-month identifies the lowest 30-day solar window", () => {
  const hours = Array.from({ length: 365 * 24 }, (_, i) => {
    const day = Math.floor(i / 24);
    return { ghi: day >= 150 && day < 180 ? 50 : 500, tAmb: 20 };
  });
  const worst = worstMonth(hours);
  assert.ok(worst);
  assert.ok(worst.startDay >= 120 && worst.startDay <= 180);
  assert.ok(worst.averageDailyGhi <= 1200);
});

test("optional map math is deterministic and cleanup-safe", async () => {
  assert.equal(panelCapFromArea(30), 5);
  assert.equal(pvCapKwFromArea(30, 400), 2);
  assert.equal(panelCapFromArea(-1), 0);
  assert.equal(optionalMapPolicy.lazy, true);
  let cleaned = false;
  const registry = createMapProviderRegistry([
    {
      available: () => true,
      init: async () => "ready",
      cleanup: () => {
        cleaned = true;
      },
    },
  ]);
  assert.equal(await registry.init(), "ready");
  registry.cleanup();
  assert.equal(cleaned, true);
});

test("wizard reaches result in order, persists, and exposes recoverable errors", () => {
  const wizard = createWizard();
  assert.deepEqual(wizard.state.step, "location");
  for (const step of WIZARD_STEPS.slice(0, -1)) {
    assert.equal(wizard.state.step, step);
    wizard.next({ allowNoTariff: step === "tariff" });
  }
  assert.equal(wizard.state.step, "result");
  wizard.fail(
    WIZARD_ERRORS.infeasible.code,
    WIZARD_ERRORS.infeasible.message,
    WIZARD_ERRORS.infeasible.recovery,
  );
  assert.equal(wizard.state.error.code, "infeasible");
  wizard.clearError();
  const storage = new MemoryStorage();
  persistWizard(wizard, storage);
  assert.equal(restoreWizard(storage).state.step, "result");
});
