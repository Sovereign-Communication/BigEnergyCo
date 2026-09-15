import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createWizard,
  persistWizard,
  restoreWizard,
  WIZARD_ERRORS,
  WIZARD_STEPS,
} from "../assets/js/sizing/wizard.js";

class MemoryStorage {
  #data = new Map();
  getItem(key) {
    return this.#data.get(key) ?? null;
  }
  setItem(key, value) {
    this.#data.set(key, String(value));
  }
}

test("guided wizard follows location → load → tariff → result", () => {
  const wizard = createWizard();
  assert.deepEqual(WIZARD_STEPS, ["location", "load", "tariff", "result"]);
  assert.equal(wizard.state.step, "location");
  wizard.setValue("latitude", 21.31);
  wizard.setValue("longitude", -157.86);
  wizard.next();
  assert.equal(wizard.state.step, "load");
  wizard.setValue("dailyKwh", 10);
  wizard.next();
  assert.equal(wizard.state.step, "tariff");
  wizard.next({ allowNoTariff: true });
  assert.equal(wizard.state.step, "result");
});

test("guided wizard persists values and restores corrupted storage safely", () => {
  const storage = new MemoryStorage();
  const wizard = createWizard();
  wizard.setValue("dailyKwh", 7.5);
  wizard.setValue("tariff", null);
  wizard.next();
  persistWizard(wizard, storage);
  assert.deepEqual(restoreWizard(storage).state.values, {
    dailyKwh: 7.5,
    tariff: null,
  });

  storage.setItem("beco-wizard-state", "not-json");
  assert.equal(restoreWizard(storage).state.step, "location");
});

test("guided wizard exposes recovery copy for expected dead ends", () => {
  const wizard = createWizard();
  wizard.fail(
    WIZARD_ERRORS.nasaTimeout.code,
    WIZARD_ERRORS.nasaTimeout.message,
    WIZARD_ERRORS.nasaTimeout.recovery,
  );
  assert.equal(wizard.state.error.code, "nasa-timeout");
  assert.match(wizard.state.error.recovery, /continue/i);
  wizard.clearError();
  assert.equal(wizard.state.error, null);
});

test("calculator exposes the guided progress and optional map affordances", () => {
  const html = fs.readFileSync(
    new URL("../index.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /id="guidedProgress"/);
  assert.match(html, /id="btnOpenRoofMap"/);
  assert.match(html, /id="roofMapPanel"/);
  assert.match(html, /id="roofMapStatus"/);
});
