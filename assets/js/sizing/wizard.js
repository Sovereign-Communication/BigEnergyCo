// Small state machine for the first-time flow. The existing full form remains
// available as the expert path; this module keeps the short path deterministic.
export const WIZARD_STEPS = Object.freeze([
  "location",
  "load",
  "tariff",
  "result",
]);
export const WIZARD_STORAGE_KEY = "beco-wizard-state";

const NEXT = Object.freeze({
  location: "load",
  load: "tariff",
  tariff: "result",
});
const PREVIOUS = Object.freeze({
  load: "location",
  tariff: "load",
  result: "tariff",
});

export function createWizard(initial = {}) {
  let state = {
    step: WIZARD_STEPS.includes(initial.step) ? initial.step : "location",
    values: { ...(initial.values || {}) },
    error: null,
  };
  return {
    get state() {
      return {
        step: state.step,
        values: { ...state.values },
        error: state.error,
      };
    },
    setValue(key, value) {
      state.values[key] = value;
      state.error = null;
      return this.state;
    },
    next({ allowNoTariff = false } = {}) {
      if (state.step === "tariff" && allowNoTariff && !state.values.tariff) {
        state.values.tariff = null;
      }
      const next = NEXT[state.step];
      if (next) state.step = next;
      return this.state;
    },
    back() {
      const previous = PREVIOUS[state.step];
      if (previous) state.step = previous;
      return this.state;
    },
    fail(code, message, recovery) {
      state.error = { code, message, recovery };
      return this.state;
    },
    clearError() {
      state.error = null;
      return this.state;
    },
  };
}

export function persistWizard(wizard, storage = globalThis.localStorage) {
  try {
    storage?.setItem(WIZARD_STORAGE_KEY, JSON.stringify(wizard.state));
  } catch {
    // Storage is optional; the flow must work in private mode and offline.
  }
}

export function restoreWizard(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(WIZARD_STORAGE_KEY);
    return raw ? createWizard(JSON.parse(raw)) : createWizard();
  } catch {
    return createWizard();
  }
}

export const WIZARD_ERRORS = Object.freeze({
  nasaTimeout: {
    code: "nasa-timeout",
    message:
      "Weather data took too long, so typical-year weather is being used.",
    recovery: "You can continue; results will be close, or try again later.",
  },
  emptyLoad: {
    code: "empty-load",
    message: "Tell us at least one appliance or your daily energy use.",
    recovery: "Choose a load option above to continue.",
  },
  noTariff: {
    code: "no-tariff",
    message: "Without an electricity price, payback cannot be shown.",
    recovery:
      "You can still size an off-grid system, or add your local price later.",
  },
  infeasible: {
    code: "infeasible",
    message: "This combination cannot reach the selected goal.",
    recovery:
      "Try a lower target, add the missing hardware, or keep a generator/grid connection as backup.",
  },
});
