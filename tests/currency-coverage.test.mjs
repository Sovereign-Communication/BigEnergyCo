// Country -> currency: the mapping, its coverage, and the cases that were wrong.
//
// The defect this pins. `TARIFF_BOXES` in pricing.js are GEOGRAPHIC: one box
// covers several countries and names ONE currency, the one belonging to the
// first country in its label. So picking a city produced a currency that
// country does not use, with nothing anywhere reporting an error:
//
//   Dublin      -> GBP   ("United Kingdom / Ireland")   Ireland uses EUR
//   Wellington  -> AUD   ("Australia / New Zealand")    New Zealand uses NZD
//   Quito       -> PEN   ("Peru / Ecuador")             Ecuador uses USD
//   Seoul       -> JPY   ("Japan / South Korea")        Korea uses KRW
//   Prague      -> PLN   ("Poland / Czechia / Slovakia") Czechia uses CZK
//   Montevideo  -> CLP   ("Chile / Uruguay")            Uruguay uses UYU
//   Amman       -> ILS   ("Israel / Jordan")            Jordan uses JOD
//   Dubai       -> USD   (box currency is null)         UAE uses AED
//   Jakarta     -> USD   (box currency is null)         Indonesia uses IDR
//   Stockholm   -> USD   (the "Europe" box is null)     Sweden uses SEK
//
// Every multi-country box is wrong for all but its first country, and every
// box with `currency: null` is wrong everywhere. That is roughly forty
// countries. The table in country-currency.js replaces the inference with a
// lookup; these tests are what stop it drifting back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  COUNTRY_CURRENCY,
  currencyForCountry,
  normalizeCountry,
} from "../assets/js/sizing/country-currency.js";
import { CURRENCIES, estimateTariff } from "../assets/js/sizing/pricing.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ── the regressions, named ────────────────────────────────────────────────
//
// Each of these is a country a real visitor could select, with the currency its
// own country actually uses. The old value is what the box produced.

const WAS_WRONG = [
  ["AG", "XCD", "USD", "Antigua and Barbuda uses the East Caribbean dollar"],
  ["CW", "XCG", "ANG", "Curaçao adopted the Caribbean guilder in 2025"],
  [
    "ZW",
    "ZWG",
    "ZWL",
    "Zimbabwe replaced the Zimbabwe dollar with ZiG in 2024",
  ],
  ["IE", "EUR", "GBP", "Ireland is in the eurozone, not the UK box"],
  ["IE", "EUR", "GBP", "Ireland by name, not by ISO code"],
  ["NZ", "NZD", "AUD", "New Zealand has its own dollar"],
  ["EC", "USD", "PEN", "Ecuador is dollarised; the sol is Peru's"],
  ["KR", "KRW", "JPY", "South Korea's won is not the yen"],
  ["CZ", "CZK", "PLN", "Czechia does not use the złoty"],
  ["SK", "EUR", "PLN", "Slovakia joined the eurozone in 2023"],
  ["UY", "UYU", "CLP", "Uruguay's peso is not the Chilean peso"],
  ["JO", "JOD", "ILS", "Jordan's dinar is not the shekel"],
  ["DZ", "DZD", "MAD", "Algeria's dinar is not the Moroccan dirham"],
  ["TN", "TND", "MAD", "Tunisia's dinar is not the Moroccan dirham"],
  ["LY", "LYD", "EGP", "Libya's dinar is not the Egyptian pound"],
  ["SD", "SDG", "EGP", "Sudan's pound is not the Egyptian pound"],
  ["UG", "UGX", "KES", "Uganda's shilling is not the Kenyan one"],
  ["TZ", "TZS", "KES", "Tanzania's shilling is not the Kenyan one"],
  ["RW", "RWF", "KES", "Rwanda's franc is not the Kenyan shilling"],
  ["NA", "NAD", "ZAR", "Namibia's dollar is not the rand"],
  ["BW", "BWP", "ZAR", "Botswana's pula is not the rand"],
  ["CI", "XOF", "GHS", "Côte d'Ivoire uses the CFA franc, not the cedi"],
  ["TG", "XOF", "GHS", "Togo uses the CFA franc, not the cedi"],
  ["NE", "XOF", "NGN", "Niger uses the CFA franc, not the naira"],
  ["CM", "XAF", "NGN", "Cameroon uses the Central African CFA franc"],
  ["AE", "AED", "USD", "the Gulf box carried no currency at all"],
  ["SA", "SAR", "USD", "the Gulf box carried no currency at all"],
  ["QA", "QAR", "USD", "the Gulf box carried no currency at all"],
  ["ID", "IDR", "USD", "Indonesia was on the null-currency box"],
  ["MY", "MYR", "USD", "Malaysia was on the null-currency box"],
  ["SG", "SGD", "USD", "Singapore was on the null-currency box"],
  ["SE", "SEK", "USD", "Sweden fell through the null 'Europe' box"],
  ["NO", "NOK", "USD", "Norway fell through the null 'Europe' box"],
  ["DK", "DKK", "USD", "Denmark fell through the null 'Europe' box"],
  ["GR", "EUR", "USD", "Greece fell through the null 'Europe' box"],
  ["HU", "HUF", "USD", "Hungary fell through the null 'Europe' box"],
  ["RO", "RON", "USD", "Romania fell through the null 'Europe' box"],
  ["RS", "RSD", "USD", "Serbia fell through the null 'Europe' box"],
  ["PK", "PKR", "INR", "Pakistan does not use the rupee"],
  ["BD", "BDT", "INR", "Bangladesh does not use the rupee"],
  ["NP", "NPR", "INR", "Nepal does not use the rupee"],
  ["MM", "MMK", "THB", "Myanmar does not use the baht"],
  ["LA", "LAK", "THB", "Laos does not use the baht"],
  ["VE", "VES", "COP", "Venezuela does not use the Colombian peso"],
  ["GT", "GTQ", "USD", "the Central America box carried no currency"],
  ["CR", "CRC", "USD", "the Central America box carried no currency"],
  ["JM", "JMD", "USD", "the Caribbean box carried no currency"],
  ["TT", "TTD", "USD", "the Caribbean box carried no currency"],
  ["FJ", "FJD", "USD", "the Pacific box carried no currency"],
];

for (const [country, expected, wasWrong, why] of WAS_WRONG) {
  test(`${country} resolves to ${expected}, not ${wasWrong} — ${why}`, () => {
    assert.equal(
      currencyForCountry(country),
      expected,
      `${country} must use its own currency`,
    );
    assert.notEqual(currencyForCountry(country), wasWrong);
  });
}

test("replacement currencies have usable offline fallback rows", () => {
  assert.equal(CURRENCIES.XCD.perUSD, 2.7);
  assert.equal(CURRENCIES.XCG.perUSD, 1.79);
  assert.equal(CURRENCIES.ZWG.perUSD, 26.7813);
});

// ── coverage: the table must be able to answer for the data we ship ───────

test("every shipped country partition resolves to a currency", () => {
  const partitions = readdirSync(
    join(ROOT, "assets", "js", "sizing", "city-data"),
  )
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
  assert.ok(partitions.length > 200, "the partition set looks wrong");

  // The direction that matters: a country we can resolve must never fall
  // through to USD. Adding a partition without adding it here is caught here.
  const unknown = partitions.filter((cc) => !currencyForCountry(cc));
  assert.deepEqual(
    unknown,
    [],
    `these shipped countries resolve to no currency and would fall back to USD: ${unknown.join(", ")}`,
  );
});

test("every currency the table names exists in CURRENCIES", () => {
  // A country that maps to a code the display layer does not know is the same
  // failure wearing a different hat: the currency is right and unselectable.
  const missing = [...new Set(Object.values(COUNTRY_CURRENCY))].filter(
    (code) => !CURRENCIES[code],
  );
  assert.deepEqual(
    missing,
    [],
    `country-currency.js names currencies CURRENCIES does not define: ${missing.join(", ")}`,
  );
});

test("every currency is usable: a symbol and a positive fallback rate", () => {
  const broken = [];
  for (const [code, c] of Object.entries(CURRENCIES)) {
    if (typeof c.symbol !== "string" || !c.symbol.trim()) broken.push(code);
    if (!Number.isFinite(c.perUSD) || c.perUSD <= 0) broken.push(code);
    if (typeof c.name !== "string" || !c.name.trim()) broken.push(code);
  }
  assert.deepEqual(broken, [], `unusable currency rows: ${broken.join(", ")}`);
});

test("the table is keyed by ISO 3166-1 alpha-2 and nothing else", () => {
  const badKeys = Object.keys(COUNTRY_CURRENCY).filter(
    (k) => !/^[A-Z]{2}$/.test(k),
  );
  assert.deepEqual(
    badKeys,
    [],
    `malformed country keys: ${badKeys.join(", ")}`,
  );
});

// ── the three spellings of one place must agree ───────────────────────────
//
// The app carries the same country three ways: the seed catalogue says "United
// Kingdom", the partitions say "GB", and reverse geocoding says "United Kingdom
// of Great Britain and Northern Ireland". If those disagree, the currency
// depends on which path happened to resolve the location.

test("catalogue, partition and geocoder spellings resolve alike", () => {
  const agree = [
    [
      "United Kingdom",
      "GB",
      "United Kingdom of Great Britain and Northern Ireland",
    ],
    ["United States", "US", "United States of America"],
    ["New Zealand", "NZ", "New Zealand"],
    ["Ireland", "IE", "Ireland"],
    ["Turkiye", "TR", "Turkiye"],
    ["Türkiye", "TR", "Türkiye"],
    ["Mexico", "MX", "Mexico"],
    ["South Korea", "KR", "Korea, Republic of"],
    ["Russia", "RU", "Russian Federation"],
    ["Vietnam", "VN", "Viet Nam"],
    ["Netherlands", "NL", "Netherlands"],
  ];
  for (const [catalogue, code, geocoder] of agree) {
    const a = currencyForCountry(catalogue);
    assert.equal(a, currencyForCountry(code), `${catalogue} vs ${code}`);
    assert.equal(
      a,
      currencyForCountry(geocoder),
      `${catalogue} vs ${geocoder}`,
    );
  }
});

test("lookup is case, accent and punctuation insensitive", () => {
  for (const spelling of ["ireland", "IRELAND", "  Ireland  "])
    assert.equal(currencyForCountry(spelling), "EUR", `spelling: ${spelling}`);

  // The apostrophe and the accent both have to fold, and this is the country
  // where it matters twice: "Côte d'Ivoire" is the catalogue spelling and
  // "Cote dIvoire" is what an unaccented source produces.
  for (const spelling of ["Côte d'Ivoire", "Cote dIvoire", "cote divoire"])
    assert.equal(currencyForCountry(spelling), "XOF", `spelling: ${spelling}`);
});

test("an unknown country answers null rather than a guess", () => {
  // Null is the honest answer, and it falls back to the box. A wrong currency
  // is what this whole change exists to remove.
  for (const junk of [
    null,
    undefined,
    "",
    "   ",
    "Atlantis",
    "XX",
    "Not A Country",
  ])
    assert.equal(
      currencyForCountry(junk),
      null,
      `input: ${JSON.stringify(junk)}`,
    );
});

test("normalizeCountry folds accents and punctuation", () => {
  assert.equal(normalizeCountry("Türkiye"), "turkiye");
  assert.equal(normalizeCountry("Côte d'Ivoire"), "cote divoire");
  assert.equal(normalizeCountry("  United   Kingdom  "), "united kingdom");
});

// ── the override must be load-bearing, and it must be wired ───────────────
//
// A correct table that nothing consults is the same defect wearing a better
// coat. These two pin both halves of that: that the boxes really are wrong for
// these coordinates (so overriding them changes the answer), and that the
// currency actually comes from the country rather than from the box.

/** Cities the tariff boxes got WRONG, measured before the override existed. */
const WAS_WRONG_IN_A_BOX = [
  ["IE", "Dublin", 53.35, -6.26, "GBP"],
  ["NZ", "Wellington", -41.29, 174.78, "AUD"],
  ["EC", "Quito", -0.18, -78.47, null],
  ["KR", "Seoul", 37.57, 126.98, null],
  ["CZ", "Prague", 50.08, 14.44, "EUR"],
  ["UY", "Montevideo", -34.9, -56.16, "BRL"],
  ["JO", "Amman", 31.95, 35.93, null],
  ["AE", "Dubai", 25.2, 55.27, null],
  ["ID", "Jakarta", -6.21, 106.85, null],
  ["SE", "Stockholm", 59.33, 18.07, null],
  ["PK", "Karachi", 24.86, 67.01, null],
  ["TN", "Tunis", 36.8, 10.18, "EUR"],
  ["NA", "Windhoek", -22.56, 17.08, "ZAR"],
  ["BW", "Gaborone", -24.65, 25.91, "ZAR"],
  ["HU", "Budapest", 47.5, 19.04, null],
  ["GT", "Guatemala City", 14.63, -90.51, "MXN"],
  ["JM", "Kingston", 17.97, -76.79, null],
  ["FJ", "Suva", -18.14, 178.44, "AUD"],
];

/** Cities the boxes already had right: the override must agree with them. */
const BOX_WAS_ALREADY_RIGHT = [
  ["JP", "Tokyo", 35.68, 139.69],
  ["BR", "Sao Paulo", -23.55, -46.63],
  ["US", "New York", 40.71, -74.01],
  ["IN", "Delhi", 28.61, 77.21],
  ["TH", "Bangkok", 13.76, 100.5],
  ["VN", "Hanoi", 21.03, 105.85],
];

test("the tariff boxes were wrong for these cities, as measured", () => {
  // The defect stated as a measurement rather than an assertion of faith: for
  // each coordinate the box currency is NOT the country's, and `null` means it
  // fell through to USD. Prague and Tunis are the sharpest cases -- both landed
  // in a NEIGHBOURING country's box and were shown euros.
  const surprises = [];
  for (const [cc, city, lat, lon, was] of WAS_WRONG_IN_A_BOX) {
    const box = estimateTariff(lat, lon, undefined, undefined).currency;
    if (box !== was)
      surprises.push(`${city} (${cc}): expected ${was}, boxes now say ${box}`);
    assert.notEqual(
      box,
      currencyForCountry(cc),
      `${city} must not still resolve to the box currency`,
    );
  }
  assert.deepEqual(
    surprises,
    [],
    "a box changed underneath this test; re-measure before trusting it",
  );
});

test("cities the boxes had right are not disturbed by the override", () => {
  // The other direction, and the one that keeps this from being a regression:
  // if the country table disagreed with a box that was already correct, this
  // change would have broken Tokyo to fix Dublin.
  for (const [cc, city, lat, lon] of BOX_WAS_ALREADY_RIGHT) {
    assert.equal(
      currencyForCountry(cc),
      estimateTariff(lat, lon, undefined, undefined).currency,
      `${city} (${cc}) must keep its existing currency`,
    );
  }
});

test("the UI resolves the currency from the country, not from the box", () => {
  // Structural pin, and honestly labelled: it cannot observe a click. What it
  // does catch is someone reverting the call to `setCurrency(est.currency)`,
  // which is exactly the one-line change that would restore the defect while
  // leaving this file's other 54 tests green.
  const src = readFileSync(
    join(ROOT, "assets", "js", "sizing", "ui.js"),
    "utf8",
  );
  const start = src.indexOf("function applyEstimatedTariff");
  assert.notEqual(start, -1, "applyEstimatedTariff moved; update this pin");
  const body = src.slice(start, src.indexOf("\nfunction ", start + 10));

  assert.match(body, /currencyForCountry\(country\)/);
  assert.match(body, /setCurrency\(currency\)/);
  assert.doesNotMatch(
    body,
    /setCurrency\(est\.currency\)/,
    "the box currency must not be used directly again",
  );
});
