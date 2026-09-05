// Canonical site content shared by the internet page and (via a build-time
// the public calculator. Prices are DATED and SCOPE-LABELED.

export const PRICES_CHECKED = "Aug 2026";

export const DONATIONS = [
  { label: "PayPal", href: "https://www.paypal.me/LBallek" },
  { label: "Venmo \u2014 @lucas-ballek", href: "https://venmo.com/u/lucas-ballek" },
  { label: "Cash App \u2014 $luball", href: "https://cash.app/$luball" },
];

// Hardware reference: what a ~100 kWh DIY build is made of. One row per card.
export const BOM_ITEMS = [
  {
    badge: "Cells",
    name: "EVE MB31 3.2V 314Ah Cells",
    desc: "Brand new Grade-A prismatic LFP cells. 16S configuration per pack (51.2V nominal).",
    price: "~US$43.50 / cell",
    scope: "indicative ex-works China, Aug 2026",
  },
  {
    badge: "BMS",
    name: "JK 200A Active Balance BMS",
    desc: "Smart active balancing (2A balance current), dual temperature probes, RS485/CANbus comms with Sol-Ark & Victron.",
    price: "~US$92.00 / unit",
    scope: "indicative ex-works China, Aug 2026",
  },
  {
    badge: "Fusing",
    name: "Eaton Class-T 200A Fuses",
    desc: "20kA AIC interrupt rating @ 160V DC. Clears very high short-circuit DC currents in milliseconds \u2014 sized to protect the BMS and wiring.",
    price: "~US$14.50 / unit",
    scope: "indicative, Aug 2026",
  },
  {
    badge: "Rack & Compression",
    name: "300 kgf Compression Racks",
    desc: "Belleville spring washer endplates hold uniform compression (about 3,000 N). Manufacturers cite cycle-life benefits; treat specific gains as unverified.",
    price: "~US$28.00 / rack",
    scope: "indicative, Aug 2026",
  },
];
