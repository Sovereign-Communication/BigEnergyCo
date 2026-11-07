// V-02 and V-07: the lease escalator and the FX source's terms are seeds, not
// guesses.
//
// V-02 existed because planning research carried a "typical 2.9%" escalator that
// only ever appeared in secondary write-ups, and the shipped band (0-3.9%) had
// no named publisher behind it. One of the companies that actually writes these
// contracts publishes the range in its annual report, so the band now cites it -
// and, just as important, the "typical" figure is not asserted anywhere, because
// the publisher discloses no typical case.
//
// V-07 existed because the runtime FX source's terms had never been read. They
// turn out to require attribution and forbid redistribution, which is a
// compliance obligation a free public site cannot ignore. These tests pin both
// the citation and the attribution link, so losing either fails here rather than
// quietly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const provenance = JSON.parse(
  readFileSync("assets/data/provenance.json", "utf8"),
);
const pathsSrc = readFileSync("assets/js/sizing/paths.js", "utf8");
const html = readFileSync("index.html", "utf8");

const family = (id) => provenance.assumptions.find((a) => a.id === id);

// The escPct bands, read out of the shipped module rather than a copy of it.
function escPctBands() {
  const block = pathsSrc.slice(pathsSrc.indexOf("const LEASE_TERMS"));
  const out = {};
  for (const instrument of ["ppa", "lease"]) {
    const at = block.indexOf(`instrument: "${instrument}"`);
    const esc = block.slice(at).match(/escPct: \[([^\]]+)\]/);
    out[instrument] = esc[1].split(",").map((n) => Number(n.trim()));
  }
  return out;
}

test("V-02: the escalator cites the filing that discloses it", () => {
  const a = family("lease_escalator");
  assert.ok(a, "lease_escalator is not registered");
  assert.equal(a.source, "sunnova_10k");
  assert.equal(a.grade, "B");

  const src = provenance.sources.sunnova_10k;
  assert.ok(src, "sunnova_10k is not a source record");
  assert.match(src.publisher, /Sunnova/);
  assert.match(src.title, /10-K/i);
  assert.match(
    src.url,
    /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/1772695\//,
    "the citation must open the filing itself, not a summary of it",
  );
  assert.match(src.as_of, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(src.license.trim().length > 20, "the licence basis is missing");

  // The disclosure has to carry the publisher's own numbers and say what the
  // publisher does NOT say.
  assert.match(
    a.disclosure,
    /41%/,
    "the disclosed share of escalated agreements",
  );
  assert.match(a.disclosure, /0\.9% to 3\.9%/, "the disclosed range");
  assert.match(
    a.disclosure,
    /typical/i,
    "the disclosure must address the typical case",
  );
  assert.match(
    a.disclosure,
    /no .{0,20}typical|publisher discloses none/i,
    "the disclosure must state that no typical figure is asserted",
  );
});

test("V-02: the shipped band sits inside the published range, at a stated position", () => {
  const bands = escPctBands();
  for (const [instrument, band] of Object.entries(bands)) {
    assert.equal(
      band.length,
      3,
      `${instrument} escPct is not a lo/mid/hi band`,
    );
    const [lo, mid, hi] = band;
    assert.equal(
      lo,
      0,
      `${instrument} floor must be 0: a flat contract has no escalator`,
    );
    assert.equal(hi, 0.039, `${instrument} ceiling must be the published 3.9%`);
    assert.ok(
      mid > lo && mid < hi,
      `${instrument} mid is outside its own band`,
    );
    assert.equal(
      mid,
      (lo + hi) / 2,
      `${instrument} mid must be the disclosed band's midpoint, not an unsourced "typical"`,
    );
  }
  // The retired planning figure must not survive anywhere in the lease block.
  const block = pathsSrc.slice(pathsSrc.indexOf("const LEASE_TERMS"));
  assert.doesNotMatch(
    block.slice(0, 2000),
    /0\.029|2\.9%/,
    "a 2.9% typical escalator has no primary source and must not be asserted",
  );
});

test("V-02: the citation does not leak onto the figures nobody publishes", () => {
  const terms = family("lease_terms");
  assert.equal(
    terms.source,
    null,
    "the composite terms family must stay uncited",
  );
  assert.equal(terms.grade, "unknown");
  assert.match(
    terms.disclosure,
    /lease_escalator/,
    "it must point at the cited slice",
  );
  assert.doesNotMatch(
    terms.disclosure,
    /\bgraded?\s+[A-D]\b/i,
    "an unknown family must not claim a published grade",
  );
  // And the route's user-facing grade must stay the composite one, not the
  // escalator's B.
  const block = pathsSrc.slice(pathsSrc.indexOf("const LEASE_TERMS"));
  const grades = [
    ...block.slice(0, 2000).matchAll(/grade: "([A-Za-z]+)"/g),
  ].map((m) => m[1]);
  assert.deepEqual(
    grades.slice(0, 2),
    ["C", "C"],
    "the lease routes' grade was raised",
  );
});

test("V-07: the FX source records the terms that were read", () => {
  const a = family("fx_live");
  const src = provenance.sources[a.source];
  assert.equal(a.source, "open_er_api_fx");
  assert.match(
    src.url,
    /exchangerate-api\.com/,
    "the source must point at the provider's own terms page",
  );
  assert.match(src.license, /attribution required/i);
  assert.match(src.license, /redistribution NOT permitted/i);
  assert.match(src.license, /once per day/i);
  assert.match(src.as_of, /^\d{4}-\d{2}-\d{2}$/);

  // The disclosure has to state the obligations the terms create, including
  // why ECB rates are not a drop-in replacement.
  assert.match(a.disclosure, /attribution/i);
  assert.match(a.disclosure, /never written into shipped data/i);
  assert.match(
    a.disclosure,
    /153/,
    "the site's currency count is the coverage argument",
  );
  assert.match(a.disclosure, /ECB/);
});

test("V-07: the page carries the attribution the terms require", () => {
  const at = html.indexOf('data-provenance-link="open_er_api_fx"');
  assert.ok(at > 0, "index.html carries no FX attribution block");
  const block = html.slice(at, at + 700);
  assert.match(
    block,
    />Rates By Exchange Rate API</,
    "the terms specify this exact link text",
  );
  assert.match(block, /href="https:\/\/www\.exchangerate-api\.com"/);
  assert.match(block, /rel="noopener noreferrer"/);
  // It belongs with the rates, not buried in the footer.
  const fxLine = html.indexOf('id="fxAsOf"');
  assert.ok(
    fxLine > 0 && fxLine < at,
    "the attribution is not next to the rate line",
  );
});

test("V-09 respected: no figure is routed through GlobalPetrolPrices", () => {
  const pipeline = [
    "assets/data/provenance.json",
    "assets/data/registry/sources.json",
    "assets/js/sizing/paths.js",
    "assets/js/sizing/pricing.js",
  ];
  for (const f of pipeline) {
    assert.doesNotMatch(
      readFileSync(f, "utf8"),
      /globalpetrolprices/i,
      `${f} routes a value through a source whose licence forbids embedding`,
    );
  }
});

test("the seeding path accepts both new seeds", () => {
  const r = spawnSync(process.execPath, ["scripts/check-provenance.mjs"], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /lease_escalator <- Sunnova/);
  assert.match(r.stdout, /every value cited or explicitly unknown/);
});
