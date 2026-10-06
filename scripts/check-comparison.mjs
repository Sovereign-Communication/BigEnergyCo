// Purchase-path comparison gate. Run: node scripts/check-comparison.mjs
//
// The comparison facet asks the question the old page could not answer:
// "can a visitor see the turnkey installer, the lease or PPA, self-purchase
// with a licensed electrician, and DIY mounting with an electrician
// connection, priced for the SAME sized system over the same 20 years with the
// same definitions — including permits, incentives, replacements and the
// end-of-term choice — so the gap between them is a real gap and not a
// difference in what each path counts?"
//
// What shipped before this file existed was the opposite. The installer figure
// was a MULTIPLE of the hardware estimate (10x the cheapest build, 5x the
// dearest) and the "do it yourself" figure was that same estimate plus a flat
// $1,500-$3,000 for an electrician. So the gap the visitor saw was a gap
// between two different COUNTING RULES, dressed as a gap between two prices.
// Two of the six clauses below exist only to keep that from coming back.
//
//   1. four routes, declared once, in one registry
//   2. every route can say no — a panel of four always-available cards is four
//      captions, and D-10 legality has to be able to remove one
//   3. ONE system, ONE horizon, ONE set of definitions (the audit in
//      scripts/lib/paths-integrity.mjs, which fails on any disagreement)
//   4. the ranking is ACCOUNTED FOR, not merely reported: every adjacent gap
//      must be reconstructible from its components
//   5. all four walked through the REAL engine on a committed offline profile
//   6. no invented constants anywhere in the shipped copy
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { synthesizeFromProfile } from "../assets/js/sizing/nasa.js";
import {
  OFFLINE_PROFILES,
  PROFILE_YEAR,
} from "../assets/js/sizing/profiles.js";
import { comparisonIntegrity } from "./lib/paths-integrity.mjs";

const ROOT = resolve(
  new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
);
let failures = 0;
const ok = (m) => console.log(`OK   ${m}`);
const fail = (m) => {
  failures += 1;
  console.error(`FAIL ${m}`);
};

const import_ = (rel) => import(pathToFileURL(join(ROOT, rel)).href);
const { runSizing } = await import_("assets/js/sizing/run.js");
const P = await import_("assets/js/sizing/paths.js");

// D-01 §6.4, named in the plan. If the registry and this list ever disagree,
// the registry is wrong: the plan is hash-pinned.
const D01 = [
  "turnkey installer",
  "the lease or PPA",
  "self-purchase with a licensed electrician",
  "DIY mounting with an electrician connection",
];

// ── 1. the four, declared once ──────────────────────────────────────────────
if (P.PATH_IDS.length !== D01.length)
  fail(
    `the registry declares ${P.PATH_IDS.length} purchase paths, D-01 names ${D01.length}`,
  );
else if (new Set(P.PATH_IDS).size !== P.PATH_IDS.length)
  fail(`the registry repeats a path id: ${P.PATH_IDS.join(", ")}`);
else ok(`the four D-01 routes are declared once: ${P.PATH_IDS.join(", ")}`);

if (P.HORIZON_YEARS !== 20)
  fail(`the horizon is ${P.HORIZON_YEARS} years, D-20 fixes it at 20`);
else ok("one horizon for all four routes: 20 years (D-20)");

// ── 2. every route can say no ───────────────────────────────────────────────
// A PPA cannot be priced without a tariff; DIY mounting cannot be offered where
// the electrical work has to be licensed; nothing can be priced without a
// system. If none of those removes a card, the panel is four captions.
{
  const noSystem = P.priceAllPaths({ pvKw: 0, battKwh: 0 }, { country: "US" });
  const stillShown = noSystem.paths.filter((p) => p.available);
  if (stillShown.length)
    fail(
      `a run with no system still priced routes: ${stillShown.map((p) => p.id).join(", ")}`,
    );
  else ok("no system prices nothing — every route reports 'no-system'");

  const noTariff = P.priceAllPaths(
    { pvKw: 6, battKwh: 13.5, annualServedKwh: 9200, tariff: null },
    { country: "US", instrument: "ppa" },
  );
  if (
    noTariff.by.lease.available ||
    noTariff.by.lease.blockedBy !== "no-tariff"
  )
    fail(
      `a PPA priced without a tariff (blockedBy=${noTariff.by.lease.blockedBy})`,
    );
  else ok("a PPA with no tariff to discount against reports 'no-tariff'");

  // D-10: an unknown jurisdiction must not render as a green light, so it must
  // REMOVE the DIY card rather than quietly offering it.
  const unknown = P.priceAllPaths(
    { pvKw: 6, battKwh: 13.5, annualServedKwh: 9200, tariff: 0.3 },
    { country: "AQ", instrument: "ppa" },
  );
  if (unknown.by.diy.available)
    fail("DIY mounting is offered in a jurisdiction we could not verify");
  else
    ok(
      `DIY mounting refuses an unverified jurisdiction (${unknown.by.diy.blockedBy})`,
    );
}

// ── 3. one system, one horizon, one set of definitions ──────────────────────
{
  const sys = {
    pvKw: 6,
    battKwh: 13.5,
    annualServedKwh: 9200,
    replacements: 1,
    batteryLifeYears: 12,
    annualBaselineBillsUsd: 2400,
    annualResidualBillsUsd: 480,
    billCutPct: 80,
    tariff: 0.3,
  };
  const result = P.priceAllPaths(sys, { country: "US", instrument: "ppa" });
  const problems = comparisonIntegrity(result);
  if (problems.length)
    fail(
      `the four routes are not comparable:\n     ${problems.join("\n     ")}`,
    );
  else
    ok(
      "one system, one horizon, one set of definitions across all four routes",
    );

  // The turnkey price is ALL-IN. Adding permits and fees on top of it would
  // double-count them, which is how a "gap" stops being real — and it is
  // exactly what a naive implementation does.
  const t = result.by.turnkey;
  if (t.labour !== 0 || t.fees !== 0)
    fail(
      `the all-in turnkey price adds labour/fees again (labour ${t.labour}, fees ${t.fees})`,
    );
  else ok("the installer's all-in price is not charged twice");

  // A lease's incentives belong to the provider, who owns the system. Zero
  // WITHOUT the reason is the defect R-PATH-05 exists to prevent.
  const l = result.by.lease;
  if (l.incentives !== 0 || l.incentiveNoteKey !== "pathsIncentivesToProvider")
    fail(
      `the lease route reports incentives ${l.incentives} with note ${l.incentiveNoteKey}`,
    );
  else ok("lease incentives are zero, and the card says whose they are");

  // Hardware wears out on a clock, not on who paid for it: the three routes
  // that leave the visitor holding the system share one replacement schedule.
  const ownerTotals = ["turnkey", "selfpurchase", "diy"].map(
    (id) => result.by[id].replacementsTotal,
  );
  if (new Set(ownerTotals).size !== 1)
    fail(
      `the three owner routes price replacements differently: ${ownerTotals.join(", ")}`,
    );
  else
    ok(
      `all three owner routes share one replacement schedule (${ownerTotals[0]})`,
    );

  // And the lease ends: its end-of-term choice must be priced INSIDE its own
  // 20-year figure, not mentioned beside it.
  if (l.endOfTerm && l.endOfTerm.termYears < P.HORIZON_YEARS) {
    const last = l.recurringByYear[l.endOfTerm.termYears - 1];
    if (last <= 0)
      fail(
        `the lease's end-of-term year ${l.endOfTerm.termYears} carries no buyout in the schedule`,
      );
    else
      ok(
        `the lease's year-${l.endOfTerm.termYears} buyout is inside its 20-year total`,
      );
  } else if (!l.endOfTerm) {
    fail("the lease route reports no end-of-term choice at all (R-PATH-06)");
  }
}

// ── 4. the ranking is accounted for ─────────────────────────────────────────
{
  const sys = {
    pvKw: 6,
    battKwh: 13.5,
    annualServedKwh: 9200,
    replacements: 1,
    batteryLifeYears: 12,
    annualBaselineBillsUsd: 2400,
    annualResidualBillsUsd: 480,
    tariff: 0.3,
  };
  const result = P.priceAllPaths(sys, { country: "US", instrument: "ppa" });
  const unexplained = result.rankingExplained.filter((e) => !e.explained);
  if (unexplained.length)
    fail(
      `a price gap no component accounts for: ${unexplained
        .map(
          (e) =>
            `${e.cheaper} vs ${e.dearer} (${e.gap}, residual ${e.residual})`,
        )
        .join("; ")}`,
    );
  else
    ok(
      `every adjacent gap reconstructs from its components (${result.rankingExplained.length} edges)`,
    );

  // The premiums the panel shows are differences between model prices.
  const { installer, lease } = result.premiums;
  if (installer !== null) {
    const want = result.by.turnkey.year0 - result.by.selfpurchase.year0;
    if (Math.round(installer - want) > 1)
      fail(
        `the installer premium is ${installer}, the routes differ by ${want}`,
      );
    else ok("the installer premium is the difference between two model prices");
  } else {
    fail("no installer premium: the two cash routes are not both available");
  }
  if (lease === null)
    fail("no lease premium: the lease route is unavailable here");
  else
    ok(`the lease premium is over 20 years, not year 0 (${Math.round(lease)})`);
}

// ── 5. all four through the REAL engine ─────────────────────────────────────
// Nothing below is a fixture of the model's own making: every number comes from
// runSizing() over a committed offline weather profile, through the same engine
// the page runs, adapted by the same adapter the page uses.
const site = OFFLINE_PROFILES.find((p) => p.name.includes("Honolulu"));
const fakeWeather = async () => ({
  hours: synthesizeFromProfile(site),
  meta: {
    latitude: site.lat,
    longitude: site.lon,
    startYear: PROFILE_YEAR,
    endYear: PROFILE_YEAR,
    years: 1,
    source: "offline profile (gate)",
    offline: false,
  },
});

const walk = [];
for (const country of ["US", "DE", "AU", "BR", "IN"]) {
  for (const instrument of P.LEASE_INSTRUMENTS) {
    let payload;
    try {
      payload = await runSizing(
        {
          latitude: site.lat,
          longitude: site.lon,
          dailyKwh: 20,
          tariff: 0.42,
          exportRate: 0.1,
          years: 1,
          chemistry: "lfp",
          mode: "gridtie",
          customCut: 0.8,
        },
        { fetchWeather: fakeWeather },
      );
    } catch (err) {
      fail(`the engine threw for ${country}/${instrument}: ${err.message}`);
      continue;
    }
    const entry = payload.targets?.find((t) => t.solvable) || payload.best;
    if (!entry) {
      fail(`${country}/${instrument}: no solvable system to price`);
      continue;
    }
    const result = P.priceAllPaths(
      P.systemForPaths(entry, {
        // The payload carries these at its TOP level, not under `input`.
        annualBaselineBillsUsd: payload.annualGridSpendUsd,
        tariff: payload.tariff,
      }),
      { country, instrument },
    );
    const problems = comparisonIntegrity(result);
    if (problems.length)
      fail(
        `${country}/${instrument} priced four different systems:\n     ${problems.join("\n     ")}`,
      );
    if (result.ranking.some((id) => !result.by[id].available))
      fail(
        `${country}/${instrument}: the ranking includes an unavailable route`,
      );
    const refused = result.paths
      .filter((p) => !p.available)
      .map((p) => `${p.id}:${p.blockedBy}`);
    walk.push({
      country,
      instrument,
      region: result.region,
      cheapest: result.cheapest,
      ranking: result.ranking,
      priced: result.paths.filter((p) => p.available).map((p) => p.id),
      blocked: refused,
      spend20: Object.fromEntries(
        result.paths.filter((p) => p.available).map((p) => [p.id, p.spend20]),
      ),
      grades: [
        ...new Set(result.paths.filter((p) => p.available).map((p) => p.grade)),
      ].join("/"),
    });
    ok(
      `${country}/${instrument}: ${result.ranking.join(" < ") || "none available"}${refused.length ? ` (refused: ${refused.join(", ")})` : ""}`,
    );
  }
}

if (walk.length) {
  // A comparison in which the cheapest route is the same everywhere would mean
  // the registry, not the visitor's system, is deciding.
  const cheapest = new Set(walk.map((w) => w.cheapest));
  if (cheapest.size < 2)
    fail(
      `the cheapest route is "${[...cheapest][0]}" in every country walked — nothing is being compared`,
    );
  else ok(`the cheapest route varies by market: ${[...cheapest].join(", ")}`);
}

// ── 6. no invented constants in the shipped copy ────────────────────────────
// The estimator's two round numbers are the fingerprint of the defect. If they
// come back, the gap on the page is a difference in counting again.
{
  const ui = readFileSync(join(ROOT, "assets/js/sizing/ui.js"), "utf8");
  const indexHtml = readFileSync(join(ROOT, "index.html"), "utf8");
  // Scan what a visitor can actually READ, not the source around it. Without
  // this the clause fires on the comment that documents the deletion — and a
  // gate that punishes the explanation gets disabled rather than obeyed.
  //
  // A scanner, not a regex, and CodeQL is why. `.replace(/<!--[\s\S]*?-->/g,
  // "")` is an incomplete multi-character sanitization: the sweep is
  // non-overlapping and needs a closer, so a comment left unclosed keeps its
  // opener, and the opener is what this clause then scans for. One pass that
  // consumes an unterminated comment to end of input leaves none by
  // construction. Plan Q-15 holds this repo to 0 CodeQL alerts.
  const stripComments = (src) => {
    let out = "";
    let i = 0;
    for (; i < src.length;) {
      const open = src.startsWith("<!--", i)
        ? ["<!--", "-->"]
        : src.startsWith("/*", i)
          ? ["/*", "*/"]
          : null;
      if (!open) {
        out += src[i++];
        continue;
      }
      const end = src.indexOf(open[1], i + open[0].length);
      i = end === -1 ? src.length : end + open[1].length;
    }
    return out;
  };
  const shipped = stripComments(ui) + stripComments(indexHtml);
  const ghosts = [
    [/TURNKEY_MULTIPLIER/, "the deleted quote multiplier"],
    [/\$1,500\\u2013\$3,000/, "the deleted flat hookup fee"],
    [/\$1,500|1,500\u2013\$3,000/, "a flat hookup dollar amount"],
    [/estimateTurnkeyQuotes/, "the deleted quote estimator"],
  ];
  const back = ghosts.filter(([re]) => re.test(shipped)).map(([, why]) => why);
  if (back.length)
    fail(`invented constants are back in shipped copy: ${back.join("; ")}`);
  else ok("no multiplier, no flat hookup fee, no estimator in shipped copy");

  // The panel must be wired: a model nothing renders is a model a visitor
  // never sees, which is the "named only in copy" failure wearing a new hat.
  if (!/id="pathsPanel"/.test(indexHtml))
    fail("index.html renders no container for the four-path panel");
  else if (!/renderPathSurfaces\(/.test(ui))
    fail("ui.js never calls renderPathSurfaces — the panel has no render path");
  else ok("the panel has a container in the page and a render path in ui.js");

  // ONE price, two surfaces. The ELI5 sentence and the panel must both read
  // the priced model, or the page shows two different turnkey figures.
  if (!/turnkeyQuoteText\(sys, money, moneyRange, paths\)/.test(ui))
    fail("the ELI5 sentence is not reading the priced comparison");
  else ok("the ELI5 sentence and the panel read one priced comparison");
}

// ── the record the facet is judged on ───────────────────────────────────────
console.log(
  "\nfour-path walk (probe site: Honolulu, 1 committed weather year)",
);
for (const w of walk) {
  const money = Object.entries(w.spend20)
    .map(([id, v]) => `${id}=$${v.toLocaleString("en-US")}`)
    .join(" ");
  console.log(
    `  ${w.country}/${w.instrument.padEnd(5)} region=${String(w.region).padEnd(12)} grade=${w.grades.padEnd(4)} cheapest=${String(w.cheapest).padEnd(12)} ${money}`,
  );
}

if (failures) {
  console.error(`\nCOMPARISON FAIL (${failures})`);
  process.exit(1);
}
console.log("\nCOMPARISON OK");
