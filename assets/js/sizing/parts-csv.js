// The parts-list spreadsheet: rows, escaping, and the CSV document framing.
//
// This was ~150 lines inside the sizing controller, tangled with the download
// plumbing, so the only way to test a single row was to run the whole page and
// read a downloaded file. The data transformation is pure — a hardware list, a
// selected system, a site, and a date in; rows out — so it lives here, and the
// controller keeps only the mechanics (build the list, make a blob, click a
// link). Same shape as share-codec.js: policy in a pure module, DOM at the edge.

/**
 * One CSV cell. Always quoted, so a value containing a comma, a quote or a
 * newline cannot shift a column or break the row grid; embedded quotes are
 * doubled, which is the only escape RFC 4180 allows.
 */
export function csvField(v) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

/**
 * Rows -> one CSV document. The leading BOM is what makes Excel open the
 * non-ASCII notes (m2, V, the disclaimer) as UTF-8 instead of mojibake, and
 * CRLF is what its parser expects.
 */
export function csvDocument(rows) {
  return "\uFEFF" + rows.map((r) => r.map(csvField).join(",")).join("\r\n");
}

/**
 * The hardware list, as spreadsheet rows.
 *
 * Every branch is optional on purpose: a battery-only build has no panels, a
 * solar-only build has no bank, and only a site that needs 240V carries the
 * split-phase notice. Rows are appended in a fixed order so the exported file
 * reads the same way every time.
 */
export function partsListRows({
  bom,
  focus,
  meta,
  requiresSplitPhase = false,
  generatedOn,
}) {
  const rows = [
    ["BigEnergyCo hardware list - educational estimate, not a quote"],
    ["Generated", generatedOn],
    [
      "System",
      `${focus.pvKw || 0} kW PV + ${focus.battNameplateKwh || 0} kWh nameplate (${bom.chemLabel || "Solar"})`,
    ],
    ["Location", `${meta.latitude.toFixed(2)}, ${meta.longitude.toFixed(2)}`],
    [],
    ["Section", "Item", "Quantity / size", "Notes"],
  ];
  if (bom.panels) {
    rows.push([
      "Panels",
      `${bom.panels.panelWatts} W mono panels`,
      bom.panels.count,
      `${bom.panels.kwActual} kW array, about ${bom.panels.areaM2} sq m`,
    ]);
  } else {
    rows.push(["Panels", "None", 0, "Battery-only configuration"]);
  }
  if (bom.voltage && bom.battery) {
    rows.push(
      [
        "Bank",
        "System voltage",
        `${bom.voltage.volts} V`,
        bom.voltage.rationale,
      ],
      [
        "Bank (DIY)",
        bom.battery.diy.unitLabel,
        `${bom.battery.diy.stringsParallel} string(s), ${bom.battery.diy.blocksTotal} cells`,
        `${bom.battery.diy.stringKwh} kWh per string`,
      ],
      [
        "Bank (retail alt.)",
        bom.battery.retail.unitLabel,
        bom.battery.retail.modules,
        "BMS and enclosure included",
      ],
    );
  } else {
    rows.push(["Bank", "None", 0, "Solar-only configuration"]);
  }
  rows.push([
    "Inverter",
    `${bom.inverter.recommendedKw} kW class continuous`,
    1,
    bom.inverter.referenceUnit,
  ]);
  if (bom.controller) {
    rows.push(
      [
        "Charging",
        `MPPT controller capacity`,
        `${bom.controller.ampsRequired} A total`,
        bom.controller.suggestion,
      ],
      [
        "Protection",
        "Main battery fuse/breaker",
        `${bom.protection.mainFuseAmps} A`,
        `bank draws ~${bom.protection.batteryDischargeAmps} A at full load`,
      ],
      [
        "Protection",
        "PV disconnect/breaker",
        `${bom.protection.pvBreakerAmps} A`,
        "",
      ],
    );
  }
  if (bom.cable) {
    for (const c of bom.cable) {
      rows.push([
        "Cable",
        `Battery-to-inverter run ${c.meters} m`,
        c.mm2 ? `${c.awg} (${c.mm2} sq mm) copper` : `larger than ${c.awg}`,
        "2% max drop, conservative ampacity",
      ]);
    }
  }
  if (bom.panels && meta?.latitude != null) {
    const lat = meta.latitude;
    const absLat = Math.abs(lat);
    const facing = lat >= 0 ? "True South (180 deg)" : "True North (0 deg)";
    rows.push([
      "Mounting",
      "Array Tilt & Orientation",
      `Facing: ${facing}`,
      `Year-round fixed: ~${Math.round(absLat * 0.9)} deg | Winter steep: ~${Math.min(70, Math.round(absLat + 15))} deg`,
    ]);
  }
  rows.push(
    [
      "BOS Safety",
      "DC Battery Disconnect & Fuse",
      `Class-T fuse / DC breaker ${bom.protection?.mainFuseAmps || 200} A`,
      "Mandatory overcurrent protection near positive terminal",
    ],
    [
      "BOS Safety",
      "PV DC Isolator & Surge Device",
      "DC-rated breaker + SPD",
      "Protects charge controller / inverter from PV lightning surges",
    ],
    [
      "BOS Safety",
      "Battery Shunt / Monitor",
      "500 A precision current shunt",
      "Tracks true SoC via Coulomb counting",
    ],
    [
      "BOS Safety",
      "Equipment Grounding & Bonding",
      "Copper ground rod + bonding bus",
      "Single common earth bond for frame rails, SPDs, and inverter chassis",
    ],
  );
  if (requiresSplitPhase) {
    rows.push([
      "BOS Notice",
      "240V Split-Phase Required",
      "L1 + L2 + Neutral (120/240V)",
      "Required for 240V well pump, mini-split, or EV charger",
    ]);
  }
  rows.push(
    [],
    [
      "Disclaimer",
      "Educational estimate only. Verify everything with a licensed electrician or engineer before purchasing or energizing.",
    ],
  );
  return rows;
}
