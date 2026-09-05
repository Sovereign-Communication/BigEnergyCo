// BigEnergyCo hardware bill-of-materials helper.
// Pure functions only: no DOM, no network, no globals. Turns a sized system
// (PV kW + battery kWh) into the parts list a builder actually shops for:
// panel count, system voltage, battery series/parallel layout, inverter
// class, charge-controller amps, fuse/breaker ratings, and cable gauge.
//
// Every number here is an EDUCATIONAL estimate with documented assumptions.
// Real designs must be verified by a licensed electrician or engineer.

import { CHEMISTRIES } from "./engine.js";
import { POWMR_CATALOG } from "./pricing.js";

// ── Constants (shown in the UI's arithmetic panel) ──────────────────────────

export const PANEL_WATTS_DEFAULT = 550;
// Modern mono-PERC modules run ~210-220 W/m² STC; dividing by 200 also
// absorbs the walk/gap spacing on a typical rooftop layout.
export const PANEL_AREA_W_PER_M2 = 200;

export const INVERTER_STANDARD_KW = [1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 15];

export const FUSE_STANDARD_AMPS = [60, 80, 100, 125, 150, 175, 200, 250, 300, 400];

// Copper resistivity at operating temperature, Ω·mm²/m (20 °C value is
// 0.0172; warm DC wiring in an enclosure runs hotter — 0.0175 is the usual
// planning figure).
export const CU_RESISTIVITY = 0.0175;
export const CABLE_DROP_FRACTION = 0.02; // 2% allowed drop, battery-to-inverter
export const CABLE_RUN_METERS = [2, 5, 10];

// Cross-section mm² → AWG, plus conservative continuous ampacity (75 °C
// column, copper, free air reduced for bundling). Deliberately coarse.
export const WIRE_TABLE = [
  { awg: "14", mm2: 2.08, ampacity: 20 },
  { awg: "12", mm2: 3.31, ampacity: 25 },
  { awg: "10", mm2: 5.26, ampacity: 35 },
  { awg: "8", mm2: 8.37, ampacity: 50 },
  { awg: "6", mm2: 13.3, ampacity: 65 },
  { awg: "4", mm2: 21.2, ampacity: 85 },
  { awg: "2", mm2: 33.6, ampacity: 115 },
  { awg: "1", mm2: 42.4, ampacity: 130 },
  { awg: "1/0", mm2: 53.5, ampacity: 150 },
  { awg: "2/0", mm2: 67.4, ampacity: 175 },
  { awg: "3/0", mm2: 85.0, ampacity: 200 },
  { awg: "4/0", mm2: 107.0, ampacity: 230 },
];
export const HOT_DERATE_ABOVE_C = 40; // ambient above this → ampacity × 0.88
export const HOT_DERATE_FACTOR = 0.88;

// DIY cell formats (the common large-prismatic buys of 2025-2026):
const DIY_CELLS = {
  lfp: { cellV: 3.2, cellAh: 314 },          // 16S = 51.2 V, ~16.1 kWh/string
  naion: { cellV: 3.1, cellAh: 314 },        // 16S = 49.6 V, ~15.6 kWh/string
};
const AGM_BLOCK = { blockV: 12, blockAh: 200 }; // 12 V × 200 Ah = 2.4 kWh each
export const RETAIL_MODULE_KWH = 5.12;          // PowMr-class 51.2 V rack unit

// ── Small helpers ────────────────────────────────────────────────────────────

function ceilTo(x, list) {
  for (const v of list) if (x <= v) return v;
  return list[list.length - 1];
}

/** Smallest standard inverter class that covers `kw`, capped at the largest. */
export function nextInverterSize(kw) {
  return ceilTo(kw, INVERTER_STANDARD_KW);
}

/** Smallest standard fuse/breaker rating at or above `amps`. */
export function nextFuseSize(amps) {
  return ceilTo(amps, FUSE_STANDARD_AMPS);
}

/**
 * System voltage heuristic: the whole market splits at roughly 1.5 kW
 * continuous / small banks (12 V RV-class), mid builds at 24 V, and
 * anything house-scale at 48 V (least copper, every serious inverter).
 */
export function pickSystemVoltage(battNameplateKwh, inverterKw) {
  const kwh = Math.max(0, battNameplateKwh || 0);
  const kw = Math.max(0, inverterKw || 0);
  if (kw <= 1.5 && kwh <= 3) return 12;
  if (kw <= 3.5 && kwh <= 10) return 24;
  return 48;
}

// ── Panels & feasibility ─────────────────────────────────────────────────────

export function panelLayout(pvKw, panelWatts = PANEL_WATTS_DEFAULT) {
  if (!(pvKw > 0) || !(panelWatts > 0)) return null;
  const count = Math.ceil((pvKw * 1000) / panelWatts);
  const kwActual = +((count * panelWatts) / 1000).toFixed(2);
  const areaM2 = Math.round(((count * panelWatts) / PANEL_AREA_W_PER_M2) / 5) * 5;
  return { panelWatts, count, kwActual, areaM2 };
}

// ── Battery configuration ────────────────────────────────────────────────────

// Market-standard series counts per bus voltage. These are NOT naive
// divisions: a "48 V" lithium bank is 16S (51.2 V nominal for LFP, 49.6 V
// for sodium-on-LFP-settings) because chargers and BMS windows target the
// old lead-acid charge profile. Same logic scales down the bus classes.
const SERIES_BY_VOLTS = {
  12: { lfp: 4, naion: 4, agm: 1 },
  24: { lfp: 8, naion: 8, agm: 2 },
  48: { lfp: 16, naion: 16, agm: 4 },
};

function diyConfig(chemistry, vBatt, nameplateKwh) {
  if (chemistry === "agm") {
    const series = SERIES_BY_VOLTS[vBatt]?.agm ?? Math.round(vBatt / AGM_BLOCK.blockV);
    const stringKwh = (series * AGM_BLOCK.blockV * AGM_BLOCK.blockAh) / 1000;
    const strings = Math.max(1, Math.ceil(nameplateKwh / stringKwh));
    return {
      unitLabel: `${series}S strings of 12 V ${AGM_BLOCK.blockAh} Ah AGM blocks`,
      seriesPerString: series,
      stringsParallel: strings,
      blocksTotal: series * strings,
      stringKwh: +stringKwh.toFixed(1),
    };
  }
  const cells = DIY_CELLS[chemistry] || DIY_CELLS.lfp;
  const series = SERIES_BY_VOLTS[vBatt]?.[chemistry] ?? Math.round(vBatt / cells.cellV);
  const stringKwh = (series * cells.cellV * cells.cellAh) / 1000;
  const strings = Math.max(1, Math.ceil(nameplateKwh / stringKwh));
  return {
    unitLabel: `${series}S strings of ${cells.cellAh} Ah prismatic cells`,
    seriesPerString: series,
    stringsParallel: strings,
    blocksTotal: series * strings,
    stringKwh: +stringKwh.toFixed(1),
  };
}

function retailConfig(nameplateKwh) {
  const modules = Math.max(1, Math.ceil(nameplateKwh / RETAIL_MODULE_KWH));
  return {
    unitLabel: `${RETAIL_MODULE_KWH} kWh rack modules (51.2 V, BMS included)`,
    modules,
  };
}

// ── Charge controller ────────────────────────────────────────────────────────

export function controllerSpec(pvKw, vBatt) {
  if (!(pvKw > 0) || !(vBatt > 0)) return null;
  const ampsRequired = Math.ceil(((pvKw * 1000) / vBatt) * 1.25);
  const trackers80A = Math.ceil(ampsRequired / 80);
  return {
    ampsRequired,
    suggestion:
      ampsRequired <= 80
        ? `one ${nextFuseSize(ampsRequired)} A-class MPPT controller`
        : `split across ${trackers80A} × 80 A MPPT trackers`,
    note: "Many low-frequency hybrid inverters have an MPPT charger built in — check its max PV input covers these amps before buying a separate controller.",
  };
}

// ── Protection ───────────────────────────────────────────────────────────────

export function protectionSpec(inverterKw, vBatt, pvKw) {
  const ctrl = controllerSpec(pvKw, vBatt);
  const dischargeAmps = inverterKw > 0 && vBatt > 0 ? (inverterKw * 1000) / vBatt : null;
  return {
    batteryDischargeAmps: dischargeAmps === null ? null : Math.ceil(dischargeAmps),
    mainFuseAmps: dischargeAmps ? nextFuseSize(dischargeAmps * 1.25) : null,
    pvBreakerAmps: ctrl ? nextFuseSize(ctrl.ampsRequired) : null,
  };
}

// ── Cable gauge ──────────────────────────────────────────────────────────────

/**
 * Battery-to-inverter cable for ≤2% drop AND conservative ampacity,
 * whichever demands more copper. Hot-enclosure derate applied above 40 °C.
 */
export function cableGauge(amps, vBatt, meters, meanTempC = null) {
  const requiredAmps = amps * 1.25 * (meanTempC !== null && meanTempC > HOT_DERATE_ABOVE_C ? 1 / HOT_DERATE_FACTOR : 1);
  const minMm2Drop = (CU_RESISTIVITY * 2 * meters * amps) / (vBatt * CABLE_DROP_FRACTION);
  for (const w of WIRE_TABLE) {
    if (w.mm2 >= minMm2Drop && w.ampacity >= requiredAmps) {
      return { meters, awg: w.awg, mm2: w.mm2 };
    }
  }
  const biggest = WIRE_TABLE[WIRE_TABLE.length - 1];
  return { meters, awg: `>${biggest.awg}`, mm2: null };
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * Build the full hardware picture for one sized system.
 *
 * @param {object} p
 * @param {number} p.pvKw            Array size from the sizer
 * @param {number} p.battNameplateKwh Nameplate bank size (usable / DoD)
 * @param {string} p.chemistry       "naion" | "lfp" | "agm"
 * @param {number} p.peakLoadW       Highest AC demand hour (from the load profile)
 * @param {string[]} [p.notes]       Extra context lines collected along the way
 * @returns object with panels, voltage, battery (diy + retail), inverter,
 *                  controller, protection, cable, feasibility, notes
 */
export function buildBom(p) {
  const notes = [];
  const chem = CHEMISTRIES[p.chemistry] || CHEMISTRIES.lfp;
  const chemistry = p.chemistry in CHEMISTRIES ? p.chemistry : "lfp";

  const peakKw = (p.peakLoadW || 0) / 1000;
  const invClassKw = nextInverterSize(Math.max(0.5, peakKw));

  // Reference catalog unit (informational only — nothing is sold here).
  const catalogUnit =
    [...POWMR_CATALOG.inverters].sort((a, b) => a.kw - b.kw).find((u) => u.kw >= invClassKw) || null;

  const hasBank = (p.battNameplateKwh || 0) >= 0.5;
  const volts = hasBank ? pickSystemVoltage(p.battNameplateKwh, invClassKw) : null;

  if (!hasBank) notes.push("No meaningful battery in this system, so voltage, bank layout, and DC protection are omitted.");
  if (volts === 12) notes.push("12 V class: fine for RV-scale loads. Above ~1.5 kW continuous, 24 V or 48 V wastes far less copper.");
  if (volts === 24) notes.push("24 V class: the middle road — workable up to about 3.5 kW continuous.");
  if (volts === 48) notes.push("48 V class: what any house-scale system uses — lowest current for the same power.");

  const battery = !hasBank ? null : {
    usableDod: chem.usableDod,
    diy: diyConfig(chemistry, volts, p.battNameplateKwh),
    retail: retailConfig(p.battNameplateKwh),
  };

  return {
    chemistry,
    chemLabel: chem.label,
    panels: panelLayout(p.pvKw, p.panelWatts ?? PANEL_WATTS_DEFAULT),
    voltage: volts ? { volts, rationale: `${volts} V fits a ${invClassKw} kW-class inverter and ${(p.battNameplateKwh || 0).toFixed(1)} kWh nameplate bank` } : null,
    battery,
    inverter: {
      peakLoadKw: +peakKw.toFixed(2),
      recommendedKw: invClassKw,
      surgeNote: "Pick a low-frequency unit with ~3× surge if the load includes fridges, pumps, or tools — motor start current hits hard for half a second.",
      referenceUnit: catalogUnit ? `${catalogUnit.model} (~$${catalogUnit.priceUsd}, ${catalogUnit.note}, ${POWMR_CATALOG.checkedDate})` : `above the ${POWMR_CATALOG.inverters[0].model.split(" ")[0]} kW reference class — expect multiple stacked units`,
    },
    controller: hasBank ? controllerSpec(p.pvKw, volts) : null,
    protection: hasBank ? protectionSpec(invClassKw, volts, p.pvKw) : null,
    cable: hasBank
      ? CABLE_RUN_METERS.map((m) => cableGauge((invClassKw * 1000) / volts, volts, m))
      : null,
    feasibility: panelLayout(p.pvKw, p.panelWatts ?? PANEL_WATTS_DEFAULT),
    notes,
  };
}
