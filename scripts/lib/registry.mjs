// The data registry: schema, grades, licences and freshness windows (P2.1).
//
// WHY A REGISTRY AND NOT MORE CONSTANTS. The site shipped tariffs, hardware
// prices, labour rates and degradation curves as hand-set constants with their
// sources living in code comments (F-07, F-08). A visitor could not tell which
// number was a regulator's statistic and which was our guess, and nothing tied
// any value to a date, so nothing could ever go stale loudly. This module is the
// schema half of the answer: every value carries where it came from, how well it
// matches, and when it must be looked at again.
//
// THREE RULES, AND EACH ONE IS A TESTABLE FUNCTION HERE:
//
//   1. GRADES (R-DATA-03). A is an official statistic, B an industry report, C a
//      market sample, D our own derivation. There is deliberately no "trust me"
//      grade, and D is not a way to smuggle a guess in: a grade-D value must
//      name the formula it came from, because the plan puts that formula on the
//      methodology page.
//   2. LICENCES (R-DATA-04). A value is embedded only when its source's licence
//      permits redistribution. The decision is recorded once per source as
//      `redistribution`, with its basis, rather than re-litigated per value; the
//      licence text is the guard on that decision, so a source that says NC or
//      ND cannot be declared embeddable even by mistake.
//   3. FRESHNESS (R-DATA-07). Prices and everything commercial get 12 months;
//      policy - export regimes and path legality - get 6, because a tariff
//      drifting is a number being slightly wrong and an export rule drifting is
//      advice being wrong. "Unknown" is a permitted value everywhere and is
//      never silently guessed.
//
// Nothing here fetches a URL, and nothing here decides what a value should be.
// It decides whether a value is allowed to be shipped at all.

/** Grade vocabulary (R-DATA-03), with the plain words a visitor sees. */
export const GRADES = Object.freeze({
  A: "Official data - an official statistic, regulator or national lab",
  B: "Industry report - an industry report or price index",
  C: "Market sample - retail catalogues, installer aggregators, consumer advisories",
  D: "Our estimate - our own derivation, with the formula on the methodology page",
});

/** The short label for a grade, as shown to visitors (R-DATA-03). */
export const GRADE_WORDS = Object.freeze({
  A: "Official data",
  B: "Industry report",
  C: "Market sample",
  D: "Our estimate",
});

/** Fields whose staleness is a policy risk, not a price risk: 6 months (R-DATA-07). */
export const POLICY_FIELDS = Object.freeze([
  "export_regime",
  "legality_gridtie",
  "legality_offgrid",
  "legality_battery_only",
  "legality_portable",
  "incentives",
]);

/** Months a value may go unreviewed. Policy is 6, everything else 12 (R-DATA-07). */
export function reviewWindowMonths(field) {
  return POLICY_FIELDS.includes(field) ? 6 : 12;
}

/**
 * Every field R-DATA-02 requires for a country. A country file must carry all of
 * them; any one may be `unknown`, which is the point - a known-unknown is a
 * disclosure, an absent row is a silent guess.
 */
export const REQUIRED_FIELDS = Object.freeze([
  "currency",
  "tariff",
  "fixed_charge",
  "export_regime",
  "legality_gridtie",
  "legality_offgrid",
  "legality_battery_only",
  "legality_portable",
  "turnkey_benchmark",
  "hardware_landed_factor",
  "electrician_rate",
  "permit_fees",
  "lease_available",
  "lease_term_years",
  "lease_buyout_pct",
  "inflation_rate",
  "real_discount_rate",
  "pv_degradation_d1",
  "pv_degradation_ann",
]);

/** R-DATA-01's ceiling for one country's emitted bundle. */
export const MAX_BUNDLE_BYTES = 6144;

/**
 * Fields that are a word rather than a number: a currency, an export regime, a
 * legality flag. R-DATA-01's {lo,mid,hi} shape describes NUMERIC values, so
 * these get a `code` branch with the same citation rules. The allowed words are
 * enumerated here because a free-text legality field is how a site quietly
 * ends up advising someone to build something illegal.
 */
export const CATEGORICAL_FIELDS = Object.freeze({
  currency: /^[A-Z]{3}$/,
  export_regime:
    /^(net_metering|net_billing|gross_metering|buy_all_sell_all|none)$/,
  legality_gridtie: /^(allowed|conditional|banned)$/,
  legality_offgrid: /^(allowed|conditional|banned)$/,
  legality_battery_only: /^(allowed|conditional|banned)$/,
  legality_portable: /^(allowed|conditional|banned)$/,
  lease_available: /^(yes|limited|no)$/,
});

/** Is this field a word instead of a number? */
export function isCategorical(field) {
  return Object.hasOwn(CATEGORICAL_FIELDS, field);
}

/** Licences that can never be embedded, whatever a source declares. */
const NON_EMBEDDABLE_LICENCE =
  /\b(NC|ND)\b|non-?commercial|no-?deriv|all rights reserved/i;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value) {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Add whole months to an ISO date, clamping to the month's last day. */
export function addMonths(isoDate, months) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0),
  ).getUTCDate();
  base.setUTCDate(Math.min(d, lastDay));
  return base.toISOString().slice(0, 10);
}

/**
 * The latest date a value may be reviewed by, given when it was retrieved.
 * R-DATA-07's budget, expressed as a date so it can be compared, not argued.
 */
export function latestReviewBy(field, retrieved) {
  return addMonths(retrieved, reviewWindowMonths(field));
}

/** A unit like "USD/kWh" names its currency; a unit like "fraction/yr" does not. */
export function unitNeedsCurrency(unit) {
  return typeof unit === "string" && /^[A-Z]{3}(\/|$)/.test(unit);
}

/** Is this source's licence one that can never be embedded? */
export function licenceLooksNonEmbeddable(license) {
  return typeof license === "string" && NON_EMBEDDABLE_LICENCE.test(license);
}

/**
 * Can this source's values be embedded in a shipped bundle?
 * The decision is recorded per source; a licence that forbids it overrides.
 */
export function canEmbed(source) {
  if (!source) return false;
  if (licenceLooksNonEmbeddable(source.license)) return false;
  return source.redistribution === "permitted";
}

/** Validate one source record. Returns a list of error strings. */
export function validateSource(id, source) {
  const errors = [];
  const at = `sources.${id}`;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return [`${at}: must be an object`];
  }
  for (const key of ["publisher", "title", "url", "license", "as_of"]) {
    if (typeof source[key] !== "string" || !source[key].trim()) {
      errors.push(`${at}.${key}: must be a non-empty string`);
    }
  }
  if (typeof source.url === "string" && !/^https:\/\//.test(source.url)) {
    errors.push(`${at}.url: must be an https URL a visitor can open`);
  }
  // V-09 asks where a licence was READ, not merely cited. A source may record
  // that page, and when it does it must be openable for the same reason.
  if (source.verified_url !== undefined) {
    if (
      typeof source.verified_url !== "string" ||
      !/^https:\/\//.test(source.verified_url)
    ) {
      errors.push(`${at}.verified_url: must be an https URL`);
    }
  }
  if (source.as_of !== undefined && !isIsoDate(source.as_of)) {
    errors.push(`${at}.as_of: must be a YYYY-MM-DD date`);
  }
  const allowed = ["permitted", "link_only"];
  if (!allowed.includes(source.redistribution)) {
    errors.push(
      `${at}.redistribution: must be one of ${allowed.join("|")}, got ${JSON.stringify(source.redistribution)}`,
    );
  }
  if (typeof source.basis !== "string" || !source.basis.trim()) {
    errors.push(
      `${at}.basis: must state why this licence does or does not permit embedding`,
    );
  }
  if (
    source.redistribution === "permitted" &&
    licenceLooksNonEmbeddable(source.license)
  ) {
    errors.push(
      `${at}: licence ${JSON.stringify(source.license)} forbids redistribution, so it cannot be declared "permitted"`,
    );
  }
  if (source.embed !== undefined) {
    errors.push(
      `${at}.embed: not allowed - embeddability is derived from licence + redistribution, so a second flag would be a second source of truth`,
    );
  }
  return errors;
}

/**
 * Validate one value. `ctx` carries `sources` (id -> record), `field` and
 * `today`. Returns a list of error strings.
 */
export function validateValue(field, value, ctx = {}) {
  const errors = [];
  // `prefix` exists so a nested region's error names the region. Without it a
  // 51-region file reports "values.tariff" and the reader has to guess which
  // state is broken.
  const at = `${ctx.prefix ?? "values"}.${field}`;
  const { sources = {}, today } = ctx;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [`${at}: must be an object`];
  }

  // The unknown branch: permitted (R-DATA-02), but never silent.
  if (value.unknown === true) {
    if (typeof value.note !== "string" || !value.note.trim()) {
      errors.push(`${at}: unknown values must carry a note saying why`);
    }
    if (!isIsoDate(value.review_by)) {
      errors.push(`${at}.review_by: required even for unknown values`);
    }
    for (const numeric of ["lo", "mid", "hi", "grade"]) {
      if (value[numeric] !== undefined) {
        errors.push(`${at}: unknown values must not carry ${numeric}`);
      }
    }
    if (value.source !== undefined && value.source !== null) {
      const src = sources[value.source];
      if (!src) errors.push(`${at}.source: ${value.source} is not in sources`);
      // A link-only source may be named so the visitor can go and check it.
    }
    return errors;
  }

  // The categorical branch: a word, cited exactly like a number.
  if (isCategorical(field)) {
    if (typeof value.code !== "string" || !value.code.trim()) {
      return [`${at}.code: must be a non-empty string`];
    }
    const pattern = CATEGORICAL_FIELDS[field];
    if (!pattern.test(value.code)) {
      errors.push(
        `${at}.code: ${JSON.stringify(value.code)} is not a permitted value for ${field}`,
      );
    }
    for (const key of ["lo", "mid", "hi"]) {
      if (value[key] !== undefined) {
        errors.push(`${at}: a categorical value must not carry ${key}`);
      }
    }
    return [
      ...errors,
      ...validateCitation(at, value, { sources, field, today }),
    ];
  }

  // The numeric branch (R-DATA-01's shape).
  for (const key of ["lo", "mid", "hi"]) {
    if (typeof value[key] !== "number" || !Number.isFinite(value[key])) {
      errors.push(`${at}.${key}: must be a finite number`);
    }
  }
  if (
    typeof value.lo === "number" &&
    typeof value.mid === "number" &&
    typeof value.hi === "number" &&
    !(value.lo <= value.mid && value.mid <= value.hi)
  ) {
    errors.push(`${at}: must satisfy lo <= mid <= hi`);
  }
  if (typeof value.unit !== "string" || !value.unit.trim()) {
    errors.push(`${at}.unit: must be a non-empty string`);
  }
  if (
    unitNeedsCurrency(value.unit) &&
    !/^[A-Z]{3}$/.test(value.currency || "")
  ) {
    errors.push(
      `${at}.currency: required as an ISO 4217 code for a money unit like ${value.unit}`,
    );
  }
  if (!Number.isInteger(value.year)) {
    errors.push(`${at}.year: must be an integer year`);
  }
  return [...errors, ...validateCitation(at, value, { sources, field, today })];
}

/**
 * The citation rules shared by the numeric and categorical branches: a grade, a
 * dated retrieval, a review inside the field's window, and an embeddable source
 * unless the grade is D.
 */
function validateCitation(at, value, { sources = {}, field, today }) {
  const errors = [];
  if (!GRADES[value.grade]) {
    errors.push(
      `${at}.grade: must be one of ${Object.keys(GRADES).join("|")}, got ${JSON.stringify(value.grade)}`,
    );
  }
  if (!isIsoDate(value.retrieved)) {
    errors.push(`${at}.retrieved: must be a YYYY-MM-DD date`);
  }
  if (!isIsoDate(value.review_by)) {
    errors.push(`${at}.review_by: must be a YYYY-MM-DD date`);
  }

  // Grade D is our own derivation, so it must not pretend to have a publisher,
  // and it must name the formula the methodology page will show.
  if (value.grade === "D") {
    if (value.source) {
      errors.push(
        `${at}: a grade-D value is our own derivation, so it must not cite a publisher`,
      );
    }
    if (typeof value.derivation !== "string" || !value.derivation.trim()) {
      errors.push(
        `${at}.derivation: a grade-D value must name its formula (shown on /methodology/)`,
      );
    }
  } else if (value.grade in GRADES) {
    const src = sources[value.source];
    if (!src) {
      errors.push(
        `${at}.source: ${JSON.stringify(value.source)} is not in sources`,
      );
    } else if (!canEmbed(src)) {
      errors.push(
        `${at}: source ${value.source} is link_only or its licence forbids redistribution, so this value cannot be embedded - make it unknown with a note naming the source`,
      );
    }
  }

  if (isIsoDate(value.retrieved) && isIsoDate(value.review_by)) {
    const latest = latestReviewBy(field, value.retrieved);
    if (value.review_by > latest) {
      errors.push(
        `${at}.review_by: ${value.review_by} is past the ${reviewWindowMonths(field)}-month window for this field (latest ${latest})`,
      );
    }
    if (value.review_by < value.retrieved) {
      errors.push(`${at}.review_by: cannot precede retrieved`);
    }
  }
  if (today && isIsoDate(value.review_by) && value.review_by < today) {
    errors.push(
      `${at}: past due - review_by ${value.review_by} is before ${today}`,
    );
  }
  return errors;
}

/**
 * Validate a country's nested sub-national regions (R-DATA-01: "with
 * sub-national regions nested where data exists").
 *
 * The point of nesting is that a visitor in Ohio sees Ohio's number, not the
 * national average wearing Ohio's name. That only stays true if a region value
 * is a citation in its own right: it must carry its own source, grade and dates
 * rather than reach up to the country's. So there is no inheritance path here - a
 * region value without a source is an error, not a lookup - and a region cannot
 * quietly become a derivation of the national figure (P2.3's rule: no value is
 * derived from another value unless the derivation says so).
 */
function validateRegions(code, regions, ctx = {}) {
  const errors = [];
  const at = `countries/${code}.json`;
  if (!regions || typeof regions !== "object" || Array.isArray(regions)) {
    return [`${at}.regions: must be an object of region code -> region`];
  }
  for (const [key, region] of Object.entries(regions)) {
    const rat = `${at}.regions.${key}`;
    // ISO 3166-2, and the prefix must be this country: a US file holding a
    // Canadian province is a filing mistake that would surface as a wrong price.
    if (!/^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(key)) {
      errors.push(`${rat}: key must be an ISO 3166-2 code like ${code}-XX`);
      continue;
    }
    if (!key.startsWith(`${code}-`)) {
      errors.push(`${rat}: region code does not belong to country ${code}`);
      continue;
    }
    if (!region || typeof region !== "object" || Array.isArray(region)) {
      errors.push(`${rat}: must be an object`);
      continue;
    }
    if (typeof region.name !== "string" || !region.name.trim()) {
      errors.push(`${rat}.name: must be a non-empty string`);
    }
    for (const extra of Object.keys(region)) {
      if (!["name", "values", "note"].includes(extra)) {
        errors.push(`${rat}: unknown key ${extra}`);
      }
    }
    const values = region.values;
    if (!values || typeof values !== "object" || Array.isArray(values)) {
      errors.push(`${rat}.values: must be an object`);
      continue;
    }
    if (!Object.keys(values).length) {
      errors.push(
        `${rat}.values: a region with no values is not worth nesting`,
      );
    }
    for (const [field, value] of Object.entries(values)) {
      if (!REQUIRED_FIELDS.includes(field)) {
        errors.push(`${rat}: unknown field ${field}`);
        continue;
      }
      if (value && typeof value === "object" && value.inherit !== undefined) {
        errors.push(
          `${rat}.${field}: regions never inherit a value - cite it or mark it unknown`,
        );
        continue;
      }
      errors.push(
        ...validateValue(field, value, {
          ...ctx,
          field,
          prefix: `${at}.regions.${key}`,
        }),
      );
    }
  }
  return errors;
}

/** Validate one country document. Returns {errors}. */
export function validateCountry(code, doc, ctx = {}) {
  const errors = [];
  const at = `countries/${code}.json`;
  if (!/^[A-Z]{2}$/.test(code)) {
    errors.push(`${at}: filename must be an ISO 3166-1 alpha-2 code`);
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return [`${at}: must be an object`];
  }
  if (doc.iso !== code) {
    errors.push(`${at}.iso: must be ${code}, got ${JSON.stringify(doc.iso)}`);
  }
  if (typeof doc.name !== "string" || !doc.name.trim()) {
    errors.push(`${at}.name: must be a non-empty string`);
  }
  const values = doc.values;
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return [...errors, `${at}.values: must be an object`];
  }
  for (const field of REQUIRED_FIELDS) {
    if (!(field in values)) {
      errors.push(
        `${at}: missing ${field} - R-DATA-02 requires every field, with "unknown" as a permitted value`,
      );
    }
  }
  for (const field of Object.keys(values)) {
    if (!REQUIRED_FIELDS.includes(field)) {
      errors.push(`${at}: unknown field ${field}`);
      continue;
    }
    errors.push(...validateValue(field, values[field], { ...ctx, field }));
  }
  if (doc.regions !== undefined) {
    errors.push(...validateRegions(code, doc.regions, ctx));
  }
  return errors;
}

/**
 * Validate a whole registry. Returns {errors, pastDue} where `pastDue` lists
 * entries whose review_by has passed but which are otherwise well-formed - the
 * weekly job's list (R-DATA-07).
 */
export function validateRegistry(registry, opts = {}) {
  const errors = [];
  const pastDue = [];
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const sources = registry.sources ?? {};
  for (const [id, src] of Object.entries(sources)) {
    errors.push(...validateSource(id, src));
  }
  for (const [code, doc] of Object.entries(registry.countries ?? {})) {
    // Schema first, without a clock: a malformed file and a stale one are
    // different defects, and the weekly job needs to name the stale one without
    // calling every file in the registry broken.
    errors.push(...validateCountry(code, doc, { sources }));
    for (const [field, value] of Object.entries(doc?.values ?? {})) {
      if (isIsoDate(value?.review_by) && value.review_by < today) {
        pastDue.push(
          `countries/${code}.json ${field}: review_by ${value.review_by} is before ${today}`,
        );
      }
    }
    for (const [region, regionDoc] of Object.entries(doc?.regions ?? {})) {
      for (const [field, value] of Object.entries(regionDoc?.values ?? {})) {
        if (isIsoDate(value?.review_by) && value.review_by < today) {
          pastDue.push(
            `countries/${code}.json ${region} ${field}: review_by ${value.review_by} is before ${today}`,
          );
        }
      }
    }
  }
  return { errors, pastDue };
}

/** The compact bundle emitted for one country (R-DATA-01). */
export function countryBundle(code, doc) {
  const bundle = {
    iso: code,
    name: doc.name,
    v: doc.values,
  };
  // Regions ship under a short key: the bundle is a browser payload with a 6 KB
  // ceiling, and a repeated long key is exactly the sort of weight the ceiling
  // exists to catch.
  if (doc.regions && Object.keys(doc.regions).length) {
    bundle.r = Object.fromEntries(
      Object.entries(doc.regions).map(([key, region]) => [
        key,
        { n: region.name, v: region.values },
      ]),
    );
  }
  return bundle;
}
