// P2.1: the data registry's schema, grades, licences and freshness windows.
//
// These are the rules that decide whether a number MAY be shipped, so each test
// is written as the failure it prevents rather than as a happy path: a licence
// that likely forbids redistribution permanently bound (R-DATA-04), a grade-D
// guess with no formula behind it, an unknown value that is silent about why,
// and a review date outside its field's window (R-DATA-07).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { brotliCompressSync, constants } from "node:zlib";

import {
  GRADES,
  GRADE_WORDS,
  MAX_BUNDLE_BYTES,
  POLICY_FIELDS,
  REQUIRED_FIELDS,
  addMonths,
  canEmbed,
  countryBundle,
  latestReviewBy,
  licenceLooksNonEmbeddable,
  reviewWindowMonths,
  validateCountry,
  validateRegistry,
  validateSource,
  validateValue,
} from "../scripts/lib/registry.mjs";

const TODAY = "2026-11-05";

/** A source record that passes, so each test can vary exactly one thing. */
const goodSource = (over = {}) => ({
  publisher: "Example Regulator",
  title: "Annual electricity price report",
  url: "https://example.gov/prices",
  license: "US Government public domain",
  as_of: "2026-10-05",
  redistribution: "permitted",
  basis: "Public domain, redistribution needs no permission.",
  ...over,
});

/** A cited numeric value that passes, so each test can vary exactly one thing. */
const goodValue = (over = {}) => ({
  lo: 0.13,
  mid: 0.14,
  hi: 0.15,
  unit: "USD/kWh",
  currency: "USD",
  year: 2026,
  grade: "B",
  source: "eia",
  retrieved: "2026-10-05",
  review_by: "2027-10-05",
  ...over,
});

const ctx = (over = {}) => ({ sources: { eia: goodSource() }, ...over });

test("grades are exactly the four the plan names, with visitor words", () => {
  assert.deepEqual(Object.keys(GRADES).sort(), ["A", "B", "C", "D"]);
  assert.deepEqual(GRADE_WORDS, {
    A: "Official data",
    B: "Industry report",
    C: "Market sample",
    D: "Our estimate",
  });
});

test("policy gets 6 months and everything else 12", () => {
  assert.equal(reviewWindowMonths("export_regime"), 6);
  assert.equal(reviewWindowMonths("legality_offgrid"), 6);
  assert.equal(reviewWindowMonths("tariff"), 12);
  assert.ok(POLICY_FIELDS.includes("export_regime"));
});

test("the review budget is a date, and month-ends clamp instead of rolling over", () => {
  assert.equal(latestReviewBy("export_regime", "2026-08-31"), "2027-02-28");
  assert.equal(latestReviewBy("tariff", "2026-10-05"), "2027-10-05");
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
});

test("a licence that forbids redistribution can never be declared embeddable", () => {
  for (const license of [
    "CC BY-NC-ND 4.0",
    "CC BY-NC 4.0",
    "CC BY-ND 4.0",
    "All rights reserved",
    "NonCommercial use only",
  ]) {
    assert.equal(licenceLooksNonEmbeddable(license), true, license);
    const errors = validateSource(
      "x",
      goodSource({ license, redistribution: "permitted" }),
    );
    assert.ok(
      errors.some((e) => e.includes("forbids redistribution")),
      `declaring ${license} permitted must fail`,
    );
  }
});

test("a source may record WHERE its licence was read, and that page must be openable", () => {
  // V-09 is about reading the licence at the licence page, not citing the
  // publisher's homepage. The field is optional so an unverified source stays
  // honest rather than acquiring a plausible-looking URL.
  assert.deepEqual(
    validateSource(
      "eia",
      goodSource({ verified_url: "https://example.gov/copyrights_reuse" }),
    ),
    [],
  );
  assert.ok(
    validateSource(
      "eia",
      goodSource({ verified_url: "http://example.gov/x" }),
    ).some((e) => e.includes("verified_url: must be an https URL")),
  );
});

test("a link-only source cannot back an embedded value", () => {
  const sources = {
    ise: goodSource({
      license: "Freely downloadable",
      redistribution: "link_only",
      basis: "A download is not a redistribution licence.",
    }),
  };
  const errors = validateValue("tariff", goodValue({ source: "ise" }), {
    sources,
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /link_only or its licence forbids redistribution/);
  // The same source may still be NAMED by an unknown value, so the visitor can
  // go and confirm the figure themselves (R-DATA-04).
  assert.deepEqual(
    validateValue(
      "tariff",
      {
        unknown: true,
        note: "Licence does not permit embedding; check the report.",
        source: "ise",
        review_by: "2027-02-01",
      },
      { sources },
    ),
    [],
  );
});

test("unknown is permitted but never silent", () => {
  const sources = {};
  const silent = validateValue(
    "tariff",
    { unknown: true, review_by: "2027-02-01" },
    { sources },
  );
  assert.ok(silent.some((e) => e.includes("must carry a note")));

  const withNumbers = validateValue(
    "tariff",
    { unknown: true, note: "why", review_by: "2027-02-01", mid: 0.14 },
    { sources },
  );
  assert.ok(withNumbers.some((e) => e.includes("must not carry mid")));

  const noDate = validateValue(
    "tariff",
    { unknown: true, note: "why" },
    { sources },
  );
  assert.ok(noDate.some((e) => e.includes("review_by")));
});

test("a numeric value must be a coherent band and name its money", () => {
  assert.deepEqual(validateValue("tariff", goodValue(), ctx()), []);

  const inverted = validateValue(
    "tariff",
    goodValue({ lo: 0.2, hi: 0.1 }),
    ctx(),
  );
  assert.ok(inverted.some((e) => e.includes("lo <= mid <= hi")));

  const noCurrency = validateValue(
    "tariff",
    goodValue({ currency: undefined }),
    ctx(),
  );
  assert.ok(noCurrency.some((e) => e.includes("currency: required")));

  const badGrade = validateValue("tariff", goodValue({ grade: "E" }), ctx());
  assert.ok(badGrade.some((e) => e.includes("grade: must be one of")));
});

test("grade D is our derivation: no publisher, and the formula is named", () => {
  const withSource = validateValue(
    "electrician_rate",
    goodValue({
      grade: "D",
      source: "eia",
      derivation: "rate x region factor",
    }),
    ctx(),
  );
  assert.ok(withSource.some((e) => e.includes("must not cite a publisher")));

  const noFormula = validateValue(
    "electrician_rate",
    goodValue({ grade: "D", source: undefined }),
    ctx(),
  );
  assert.ok(noFormula.some((e) => e.includes("must name its formula")));

  assert.deepEqual(
    validateValue(
      "electrician_rate",
      goodValue({
        grade: "D",
        source: undefined,
        derivation: "elecBaseH + elecPerKwH*pvKw, priced at the regional rate",
      }),
      ctx(),
    ),
    [],
  );
});

test("a review date outside the field's window is refused", () => {
  const policyTooLate = validateValue(
    "export_regime",
    {
      code: "net_metering",
      grade: "B",
      source: "eia",
      retrieved: "2026-10-05",
      review_by: "2027-10-05",
    },
    ctx(),
  );
  assert.ok(
    policyTooLate.some((e) => e.includes("6-month window")),
    "policy may not ride a 12-month window",
  );

  const priceOk = validateValue("tariff", goodValue(), ctx());
  assert.deepEqual(priceOk, []);
});

test("categorical fields take a word, not a band", () => {
  const good = validateValue(
    "legality_offgrid",
    {
      code: "conditional",
      grade: "B",
      source: "eia",
      retrieved: "2026-10-05",
      review_by: "2027-03-01",
    },
    ctx(),
  );
  assert.deepEqual(good, []);

  const invented = validateValue(
    "legality_offgrid",
    {
      code: "probably fine",
      grade: "B",
      source: "eia",
      retrieved: "2026-10-05",
      review_by: "2027-03-01",
    },
    ctx(),
  );
  assert.ok(invented.some((e) => e.includes("not a permitted value")));

  const banded = validateValue(
    "legality_offgrid",
    {
      code: "allowed",
      lo: 1,
      grade: "B",
      source: "eia",
      retrieved: "2026-10-05",
      review_by: "2027-03-01",
    },
    ctx(),
  );
  assert.ok(banded.some((e) => e.includes("must not carry lo")));
});

test("a country file must carry every R-DATA-02 field and nothing invented", () => {
  const full = Object.fromEntries(
    REQUIRED_FIELDS.map((f) => [
      f,
      { unknown: true, note: "pending", review_by: "2027-02-01" },
    ]),
  );
  const doc = { iso: "US", name: "United States", values: full };
  assert.deepEqual(validateCountry("US", doc, { sources: {} }), []);

  const missing = { ...full };
  delete missing.inflation_rate;
  assert.ok(
    validateCountry("US", { ...doc, values: missing }, { sources: {} }).some(
      (e) => e.includes("missing inflation_rate"),
    ),
  );

  const extra = {
    ...full,
    moon_phase: { unknown: true, note: "no", review_by: "2027-02-01" },
  };
  assert.ok(
    validateCountry("US", { ...doc, values: extra }, { sources: {} }).some(
      (e) => e.includes("unknown field moon_phase"),
    ),
  );

  assert.ok(
    validateCountry("usa", doc, { sources: {} }).some((e) =>
      e.includes("alpha-2"),
    ),
  );
});

test("past-due is reported as staleness, not as a broken schema", () => {
  const full = Object.fromEntries(
    REQUIRED_FIELDS.map((f) => [
      f,
      { unknown: true, note: "pending", review_by: "2027-02-01" },
    ]),
  );
  full.tariff = {
    unknown: true,
    note: "pending",
    review_by: "2026-01-01",
  };
  const { errors, pastDue } = validateRegistry(
    {
      sources: {},
      countries: { US: { iso: "US", name: "United States", values: full } },
    },
    { today: TODAY },
  );
  assert.deepEqual(errors, []);
  assert.equal(pastDue.length, 1);
  assert.match(pastDue[0], /US\.json tariff: review_by 2026-01-01/);
});

test("canEmbed follows the licence guard, not the declared flag alone", () => {
  assert.equal(canEmbed(goodSource()), true);
  assert.equal(canEmbed(goodSource({ redistribution: "link_only" })), false);
  assert.equal(
    canEmbed(
      goodSource({ license: "CC BY-ND 4.0", redistribution: "permitted" }),
    ),
    false,
  );
});

test("the shipped registry passes its own gate", () => {
  const sources = JSON.parse(
    readFileSync("assets/data/registry/sources.json", "utf8"),
  ).sources;
  const dir = "assets/data/registry/countries";
  const countries = {};
  for (const file of readdirSync(dir).filter((f) =>
    /^[A-Z]{2}\.json$/.test(f),
  )) {
    countries[file.slice(0, 2)] = JSON.parse(
      readFileSync(`${dir}/${file}`, "utf8"),
    );
  }
  const { errors, pastDue } = validateRegistry(
    { sources, countries },
    { today: TODAY },
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(pastDue, []);
  assert.ok(Object.keys(countries).length >= 1);
});

test("every shipped country bundle fits the 6 KB ceiling", () => {
  const dir = "assets/data/registry/countries";
  for (const file of readdirSync(dir).filter((f) =>
    /^[A-Z]{2}\.json$/.test(f),
  )) {
    const code = file.slice(0, 2);
    const doc = JSON.parse(readFileSync(`${dir}/${file}`, "utf8"));
    const json = JSON.stringify(countryBundle(code, doc));
    const size = brotliCompressSync(Buffer.from(json), {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 11,
        [constants.BROTLI_PARAM_SIZE_HINT]: json.length,
      },
    }).length;
    assert.ok(
      size <= MAX_BUNDLE_BYTES,
      `${code} bundle is ${size} B brotli, over ${MAX_BUNDLE_BYTES}`,
    );
  }
});

test("a nested region is a citation in its own right, never an inheritance", () => {
  const full = Object.fromEntries(
    REQUIRED_FIELDS.map((f) => [
      f,
      { unknown: true, note: "pending", review_by: "2027-02-01" },
    ]),
  );
  const region = { name: "Ohio", values: { tariff: goodValue() } };
  const doc = { iso: "US", name: "United States", values: full };
  assert.deepEqual(
    validateCountry("US", { ...doc, regions: { "US-OH": region } }, ctx()),
    [],
  );

  // No inheritance: the country's tariff cannot stand in for Ohio's, because a
  // visitor in Ohio would then be shown a national average wearing a state name.
  const unsourced = {
    name: "Ohio",
    values: { tariff: { ...goodValue(), source: undefined } },
  };
  assert.ok(
    validateCountry(
      "US",
      { ...doc, regions: { "US-OH": unsourced } },
      ctx(),
    ).some((e) => e.includes("US-OH") && e.includes("source")),
  );

  const inherited = {
    name: "Ohio",
    values: { tariff: { ...goodValue(), inherit: "US" } },
  };
  assert.ok(
    validateCountry(
      "US",
      { ...doc, regions: { "US-OH": inherited } },
      ctx(),
    ).some((e) => e.includes("never inherit")),
  );
});

test("a region key must be an ISO 3166-2 code belonging to this country", () => {
  const full = Object.fromEntries(
    REQUIRED_FIELDS.map((f) => [
      f,
      { unknown: true, note: "pending", review_by: "2027-02-01" },
    ]),
  );
  const doc = { iso: "US", name: "United States", values: full };
  const region = { name: "Ontario", values: { tariff: goodValue() } };

  // A Canadian province inside the US file is a filing mistake that would
  // surface to a visitor as a wrong price, so it fails at the schema.
  assert.ok(
    validateCountry("US", { ...doc, regions: { "CA-ON": region } }, ctx()).some(
      (e) => e.includes("does not belong to country US"),
    ),
  );
  assert.ok(
    validateCountry("US", { ...doc, regions: { Ohio: region } }, ctx()).some(
      (e) => e.includes("ISO 3166-2"),
    ),
  );
  assert.ok(
    validateCountry(
      "US",
      {
        ...doc,
        regions: { "US-OH": { ...region, name: "", values: {} } },
      },
      ctx(),
    ).some((e) => e.includes("no values is not worth nesting")),
  );
  assert.ok(
    validateCountry(
      "US",
      { ...doc, regions: { "US-OH": { ...region, emblem: "x" } } },
      ctx(),
    ).some((e) => e.includes("unknown key emblem")),
  );
});

test("the shipped US file nests a cited tariff for every state and DC", () => {
  const doc = JSON.parse(
    readFileSync("assets/data/registry/countries/US.json", "utf8"),
  );
  const codes = Object.keys(doc.regions ?? {});
  // 50 states plus the District of Columbia: EIA publishes all 51 and the file
  // may not quietly drop one, because a dropped state falls back to the national
  // average without telling the visitor.
  assert.equal(codes.length, 51);
  assert.ok(codes.every((c) => /^US-[A-Z]{2}$/.test(c)));
  for (const [code, region] of Object.entries(doc.regions)) {
    const tariff = region.values.tariff;
    assert.ok(region.name, `${code} has no name`);
    assert.equal(tariff.grade, "A", `${code} tariff is not grade A`);
    assert.equal(tariff.source, "eia_retail", `${code} cites ${tariff.source}`);
    assert.equal(tariff.lo, tariff.mid, `${code} invents a band`);
    assert.equal(tariff.hi, tariff.mid, `${code} invents a band`);
    assert.ok(
      tariff.mid > 0.05 && tariff.mid < 1,
      `${code} tariff ${tariff.mid} is not a plausible USD/kWh price`,
    );
    assert.equal(tariff.currency, "USD");
    assert.equal(tariff.unit, "USD/kWh");
  }
  // The bundle ships regions under the short key the runtime reads.
  const bundle = countryBundle("US", doc);
  assert.equal(Object.keys(bundle.r).length, 51);
  assert.equal(bundle.r["US-CA"].n, "California");
  assert.equal(bundle.r["US-CA"].v.tariff.mid, 0.2975);
});

test("a stale region value is reported as staleness, like any other", () => {
  const full = Object.fromEntries(
    REQUIRED_FIELDS.map((f) => [
      f,
      { unknown: true, note: "pending", review_by: "2027-02-01" },
    ]),
  );
  const doc = {
    iso: "US",
    name: "United States",
    values: full,
    regions: {
      "US-OH": {
        name: "Ohio",
        values: {
          tariff: goodValue({
            review_by: "2027-10-05",
            retrieved: "2026-10-05",
          }),
        },
      },
    },
  };
  const { pastDue } = validateRegistry(
    { sources: { eia: goodSource() }, countries: { US: doc } },
    { today: "2027-11-01" },
  );
  assert.ok(
    pastDue.some((row) => row.includes("US-OH") && row.includes("tariff")),
    `region staleness not reported: ${pastDue.join(" | ")}`,
  );
});
