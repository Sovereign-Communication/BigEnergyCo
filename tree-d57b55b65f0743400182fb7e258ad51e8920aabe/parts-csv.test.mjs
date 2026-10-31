// The parts-list spreadsheet seam, extracted from the sizing controller.
//
// The GOLDEN below was produced by the pre-refactor implementation (the row
// builder as it stood in ui.js before it moved), then replayed through the
// module — byte for byte, including the BOM and the CRLF framing. It is the
// evidence that moving ~150 lines out of the controller changed nothing a
// visitor can observe; the branch cases pin the shapes that never appear in a
// default run (battery-only, solar-only, southern hemisphere, split-phase).
// Run: node --test tests/parts-csv.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  csvField,
  csvDocument,
  partsListRows,
} from "../assets/js/sizing/parts-csv.js";

// Quoting hazards on purpose: a quote, a comma and parentheses inside values
// that must not shift a column.
const RICH = {
  bom: {
    chemLabel: "LFP (LiFePO4)",
    panels: { panelWatts: 550, count: 6, kwActual: 3.3, areaM2: 19.8 },
    voltage: {
      volts: 48,
      rationale:
        '48 V fits a 3.3 kW-class inverter, and the "quoted" run is 5 m',
    },
    battery: {
      diy: {
        unitLabel: "16S strings of 314 Ah prismatic cells",
        stringsParallel: 2,
        blocksTotal: 32,
        stringKwh: 16.1,
      },
      retail: {
        unitLabel: "5.12 kWh rack modules (51.2 V, BMS included)",
        modules: 4,
      },
    },
    inverter: {
      recommendedKw: 5,
      referenceUnit: "5 kW low-frequency split-phase (~$449, 48V)",
    },
    controller: { ampsRequired: 90, suggestion: "two 60 A MPPT controllers" },
    protection: {
      mainFuseAmps: 150,
      batteryDischargeAmps: 63,
      pvBreakerAmps: 100,
    },
    cable: [
      { meters: 2, awg: "6", mm2: 13.3 },
      { meters: 5, awg: "4", mm2: 21.2 },
      { meters: 10, awg: "2/0" },
    ],
  },
  focus: { pvKw: 3.3, battNameplateKwh: 16.1 },
  meta: { latitude: -33.87, longitude: 151.21 },
  requiresSplitPhase: true,
  generatedOn: "2026-09-25",
};

const GOLDEN_LINES = [
  '"BigEnergyCo hardware list - educational estimate, not a quote"',
  '"Generated","2026-09-25"',
  '"System","3.3 kW PV + 16.1 kWh nameplate (LFP (LiFePO4))"',
  '"Location","-33.87, 151.21"',
  "",
  '"Section","Item","Quantity / size","Notes"',
  '"Panels","550 W mono panels","6","3.3 kW array, about 19.8 sq m"',
  '"Bank","System voltage","48 V","48 V fits a 3.3 kW-class inverter, and the ""quoted"" run is 5 m"',
  '"Bank (DIY)","16S strings of 314 Ah prismatic cells","2 string(s), 32 cells","16.1 kWh per string"',
  '"Bank (retail alt.)","5.12 kWh rack modules (51.2 V, BMS included)","4","BMS and enclosure included"',
  '"Inverter","5 kW class continuous","1","5 kW low-frequency split-phase (~$449, 48V)"',
  '"Charging","MPPT controller capacity","90 A total","two 60 A MPPT controllers"',
  '"Protection","Main battery fuse/breaker","150 A","bank draws ~63 A at full load"',
  '"Protection","PV disconnect/breaker","100 A",""',
  '"Cable","Battery-to-inverter run 2 m","6 (13.3 sq mm) copper","2% max drop, conservative ampacity"',
  '"Cable","Battery-to-inverter run 5 m","4 (21.2 sq mm) copper","2% max drop, conservative ampacity"',
  '"Cable","Battery-to-inverter run 10 m","larger than 2/0","2% max drop, conservative ampacity"',
  '"Mounting","Array Tilt & Orientation","Facing: True North (0 deg)","Year-round fixed: ~30 deg | Winter steep: ~49 deg"',
  '"BOS Safety","DC Battery Disconnect & Fuse","Class-T fuse / DC breaker 150 A","Mandatory overcurrent protection near positive terminal"',
  '"BOS Safety","PV DC Isolator & Surge Device","DC-rated breaker + SPD","Protects charge controller / inverter from PV lightning surges"',
  '"BOS Safety","Battery Shunt / Monitor","500 A precision current shunt","Tracks true SoC via Coulomb counting"',
  '"BOS Safety","Equipment Grounding & Bonding","Copper ground rod + bonding bus","Single common earth bond for frame rails, SPDs, and inverter chassis"',
  '"BOS Notice","240V Split-Phase Required","L1 + L2 + Neutral (120/240V)","Required for 240V well pump, mini-split, or EV charger"',
  "",
  '"Disclaimer","Educational estimate only. Verify everything with a licensed electrician or engineer before purchasing or energizing."',
];

test("the extracted seam reproduces the pre-refactor output byte for byte", () => {
  const csv = csvDocument(partsListRows(RICH));
  // The BOM is part of the document, so the golden carries it too.
  assert.equal(csv, "\uFEFF" + GOLDEN_LINES.join("\r\n"));
  assert.equal(csv.length, 2104, "the byte length the old builder produced");
});

test("csvDocument frames the file the way a spreadsheet expects", () => {
  const csv = csvDocument([["a"], ["b"]]);
  // Blob.text() strips a leading BOM, so assert the bytes: the BOM is what
  // makes Excel read the sq m / V / degree columns as UTF-8 instead of mojibake.
  const bytes = new TextEncoder().encode(csv);
  assert.deepEqual(
    [...bytes.slice(0, 3)],
    [0xef, 0xbb, 0xbf],
    "a UTF-8 BOM must open the file",
  );
  assert.ok(csv.includes("\r\n"), "rows are CRLF separated");
  assert.equal(csv.split("\r\n").length, 2);
  assert.equal(csvDocument([]), "\uFEFF", "no rows still yields the BOM");
});

test("csvField quotes, doubles, and never invents a value", () => {
  assert.equal(csvField('a "b" c'), '"a ""b"" c"');
  assert.equal(csvField("a,b"), '"a,b"');
  assert.equal(csvField(0), '"0"');
  assert.equal(csvField(false), '"false"');
  assert.equal(csvField(null), '""');
  assert.equal(csvField(undefined), '""');
  assert.equal(csvField(""), '""');
  // A numeric cell is quoted too: the file must not depend on how a locale's
  // spreadsheet guesses types.
  assert.equal(csvField(150), '"150"');
});

test("a value carrying a quote cannot shift a column", () => {
  const rows = partsListRows({
    ...RICH,
    bom: { ...RICH.bom, chemLabel: 'LFP","injected","extra' },
  });
  const csv = csvDocument(rows);
  // The hostile text stays inside one cell: its quotes are doubled, so the
  // cell boundary count is unchanged by it.
  assert.ok(csv.includes('""injected""'));
  assert.equal(rows[2].length, 2, "the System row still has two cells");
  assert.equal(rows[2][1].match(/,(?![^"]*"(?:[^"]*"[^"]*")*[^"]*$)/g), null);
});

test("battery-only builds say so instead of omitting the section", () => {
  const rows = partsListRows({
    bom: {
      chemLabel: null,
      panels: null,
      voltage: { volts: 24, rationale: "24 V fits a 1 kW-class inverter" },
      battery: {
        diy: {
          unitLabel: "8S strings of 314 Ah prismatic cells",
          stringsParallel: 1,
          blocksTotal: 8,
          stringKwh: 8,
        },
        retail: {
          unitLabel: "5.12 kWh rack modules (51.2 V, BMS included)",
          modules: 2,
        },
      },
      inverter: {
        recommendedKw: 1,
        referenceUnit: "no 48 V reference applies",
      },
      controller: null,
      protection: {
        mainFuseAmps: 60,
        batteryDischargeAmps: 21,
        pvBreakerAmps: 60,
      },
      cable: null,
    },
    focus: { pvKw: 0, battNameplateKwh: 8 },
    meta: { latitude: 21.31, longitude: -157.86 },
    requiresSplitPhase: false,
    generatedOn: "2026-09-25",
  });
  const flat = rows.map((r) => r.join("|")).join("\n");
  assert.match(flat, /Panels\|None\|0\|Battery-only configuration/);
  assert.match(flat, /Bank\|System voltage\|24 V/);
  // No charge controller was chosen, so the charging/protection rows are
  // absent rather than blank — the same choice the old builder made.
  assert.doesNotMatch(flat, /MPPT controller capacity/);
  // The BOS block still carries the fuse figure, falling back to the 200 A
  // default only when protection is missing entirely.
  assert.match(flat, /Class-T fuse \/ DC breaker 60 A/);
  assert.doesNotMatch(flat, /BOS Notice/);
});

test("solar-only builds and the equator both stay sane", () => {
  const rows = partsListRows({
    bom: {
      chemLabel: "Solar",
      panels: { panelWatts: 550, count: 4, kwActual: 2.2, areaM2: 13.2 },
      voltage: null,
      battery: null,
      inverter: {
        recommendedKw: 1,
        referenceUnit: "no 48 V reference applies here - source a 24 V-class",
      },
      controller: { ampsRequired: 50, suggestion: "one 60 A MPPT controller" },
      protection: {
        mainFuseAmps: 60,
        batteryDischargeAmps: 21,
        pvBreakerAmps: 60,
      },
      cable: [{ meters: 2, awg: "8", mm2: 8.4 }],
    },
    focus: { pvKw: 2.2, battNameplateKwh: 0 },
    meta: { latitude: 0, longitude: 0 },
    requiresSplitPhase: false,
    generatedOn: "2026-09-25",
  });
  const flat = rows.map((r) => r.join("|")).join("\n");
  assert.match(flat, /Bank\|None\|0\|Solar-only configuration/);
  assert.doesNotMatch(flat, /Bank \(DIY\)/);
  // Latitude 0 is due north-facing territory by the >= 0 rule; the tilt line
  // must still render rather than divide or blank out at the equator.
  assert.match(flat, /Facing: True South \(180 deg\)/);
  assert.match(flat, /Year-round fixed: ~0 deg \| Winter steep: ~15 deg/);
});

test("the controller keeps only the download mechanics", () => {
  const ui = readFileSync(
    new URL("../assets/js/sizing/ui.js", import.meta.url),
    "utf8",
  );
  assert.match(
    ui,
    /import \{ csvDocument, partsListRows \} from "\.\/parts-csv\.js/,
    "the controller must render through the extracted module",
  );
  assert.doesNotMatch(
    ui,
    /function csvField\(v\)/,
    "the escaping rule has one owner; a second copy is how the money bug happened twice",
  );
  assert.doesNotMatch(
    ui,
    /BigEnergyCo hardware list/,
    "row assembly belongs to the module, not the controller",
  );
  assert.match(
    ui,
    /const csv = csvDocument\(\s*partsListRows\(\{/,
    "the controller assembles via the module",
  );
});
