// Canonical site content shared by the internet page and (via a build-time
// the public calculator. Prices are DATED and SCOPE-LABELED.

export const PRICES_CHECKED = "Aug 2026";

// Hardware reference: what a ~100 kWh DIY build is made of. One row per card.
export const BOM_ITEMS = [
  {
    badge: "Cells",
    name: "EVE MB31 3.2V 314Ah Cells",
    descKey: "lfpCells",
    price: "~US$43.50 / cell",
    scope: "indicative ex-works China, Aug 2026",
  },
  {
    badge: "BMS",
    name: "JK 200A Active Balance BMS",
    descKey: "batteryManagementSpec",
    price: "~US$92.00 / unit",
    scope: "indicative ex-works China, Aug 2026",
  },
  {
    badge: "Fusing",
    name: "Eaton Class-T 200A Fuses",
    descKey: "breakerSpec",
    price: "~US$14.50 / unit",
    scope: "indicative, Aug 2026",
  },
  {
    badge: "Rack & Compression",
    name: "300 kgf Compression Racks",
    descKey: "endplateSpec",
    price: "~US$28.00 / rack",
    scope: "indicative, Aug 2026",
  },
];
