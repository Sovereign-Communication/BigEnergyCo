// Canonical site content shared by the internet page and (via a build-time
// the public calculator. Prices are DATED and SCOPE-LABELED.

export const PRICES_CHECKED = "Aug 2026";
export const PRICES_CHECKED_AT = "2026-08-01";

export const DONATIONS = [
  { label: "PayPal", href: "https://www.paypal.me/LBallek" },
  {
    label: "Venmo \u2014 @lucas-ballek",
    href: "https://venmo.com/u/lucas-ballek",
  },
  { label: "Cash App \u2014 $luball", href: "https://cash.app/$luball" },
];

// Hardware reference: what a ~100 kWh DIY build is made of. One row per card.
export const BOM_ITEMS = [
  {
    badgeKey: "bomCellBadge",
    nameKey: "bomCellTitle",
    descKey: "bomCellsDescription",
    priceKey: "bomCellPrice",
    priceUsd: 43.5,
    unitKey: "bomUnitCell",
    scopeKey: "bomExwDetails",
  },
  {
    badgeKey: "bomBmsBadge",
    nameKey: "bomBmsTitle",
    descKey: "bomBmsDescription",
    priceKey: "bomBmsPrice",
    priceUsd: 92,
    unitKey: "bomUnitItem",
    scopeKey: "bomExwDetails",
  },
  {
    badgeKey: "bomFuseBadge",
    nameKey: "bomFuseTitle",
    descKey: "bomFuseDescription",
    priceKey: "bomFusePrice",
    priceUsd: 14.5,
    unitKey: "bomUnitItem",
    scopeKey: "bomIndicativeDetails",
  },
  {
    badgeKey: "bomRackBadge",
    nameKey: "bomRackTitle",
    descKey: "bomRackDescription",
    priceKey: "bomRackPrice",
    priceUsd: 28,
    unitKey: "bomUnitRack",
    scopeKey: "bomIndicativeDetails",
  },
];
