// The privacy facet's RUNTIME half.
//
// scripts/check-privacy.mjs is a static gate and its six clauses are all
// statements about source. Every one of them has a runtime version, and the
// runtime is where privacy claims break, because the mechanisms that break them
// are exactly the ones a grep cannot see: an HttpOnly cookie is invisible to
// `document.cookie` AND to any source scan, a third-party request from injected
// markup or a CSS url() never appears in a JavaScript string, and storage
// written by a worker never appears at all.
//
// These tests are mostly about WIRING. A privacy measurement that only one
// person can run by hand is not a gate — it is a habit, and the facet's own
// standard is that "an unrun adversarial or live check is not proven". So the
// browser gate must run in CI, its outcome must be recorded in the artifact the
// Jev gate reads, and the evidence line must name it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { cookieGateDecision } from "../scripts/cold-start-preflight.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

// Assertions below run against COMMENTS STRIPPED source. Half of them are
// "this text must not exist", and a file that explains the rule it once broke
// would fail its own guard — and a guard that punishes the explanation gets
// deleted rather than obeyed. Same reason scripts/check-comparison.mjs scans
// rendered copy rather than the source around it.
const readCode = (rel) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

// ── the measurement is real, and it looks where a cookie actually hides ─────

test("the browser flow asks the browser for cookies, not the page", () => {
  const flow = readCode("scripts/smoke/privacy.mjs");
  // Network.getCookies is the browser's own store and includes HttpOnly
  // cookies. document.cookie alone would pass a page setting a session cookie,
  // which is the whole reason this flow exists.
  assert.match(flow, /Network\.getCookies/);
  assert.match(flow, /document\.cookie/);
  // Both, not either.
  assert.match(flow, /httpOnlyCount/);
  assert.match(flow, /localStorage/);
  assert.match(flow, /sessionStorage/);
  // And it reads the wire the runtime already collects rather than asserting a
  // number typed somewhere else.
  assert.match(flow, /b\.requests/);
});

test("the browser gate fails closed when nothing was measured", () => {
  const gate = readCode("scripts/check-privacy-browser.mjs");
  // The facet standard is explicit: an unrun check is not a proven one. A gate
  // that reports "no breaches observed" when the browser never started is
  // worse than no gate, because it reads as a pass.
  assert.match(gate, /if \(!measured\)/);
  assert.match(
    gate,
    /nothing was measured — an unmeasured risk is not a passed gate/,
  );
  assert.match(gate, /process\.exit\(1\)/);
});

test("third-party egress is checked against the shipped policy, not a guess", () => {
  const gate = readCode("scripts/check-privacy-browser.mjs");
  // This clause was originally a hand-written allowlist of one host, and it
  // failed on its first real run, correctly: the page fetches
  // open.er-api.com/v6/latest/USD to keep the per-country currency table
  // current. A hardcoded list here would be a THIRD declaration of the same
  // fact, free to drift from the CSP that actually ships. Reading the CSP
  // means a new origin can only pass if somebody deliberately added it.
  assert.match(gate, /connect-src/);
  assert.match(gate, /_headers/);
  assert.doesNotMatch(
    gate,
    /nasa\.gov\.i\.test\(o\)/,
    "the hardcoded NASA-only allowlist is back",
  );
  // The declaration is allowed to be small but not unbounded.
  assert.match(gate, /declared\.length <= 8/);
  // And the wire itself is inspected for identifiers, which no source scan can
  // do: a coordinate finer than 0.01 deg is ~1.1 km of location, so the gate
  // looks for three or more decimal places in a coordinate query parameter.
  assert.ok(
    gate.includes("\\d{3,}"),
    "the gate must reject a coordinate finer than 0.01 deg on the wire",
  );
  assert.match(gate, /free-text query/);
});

test("the declared FX egress is declared, and the site still needs it", () => {
  // The decision this pass made explicitly: open.er-api.com stays.
  const headers = read("_headers");
  assert.match(
    headers,
    /connect-src[^;]*https:\/\/open\.er-api\.com/,
    "the FX origin must be in the shipped CSP",
  );
  const ui = read("assets/js/sizing/ui.js");
  assert.match(ui, /open\.er-api\.com/);
  // Removing the call would silently revert per-country currency to a stale
  // static table, so if it ever goes it must go with a replacement, not by
  // accident. This test fails loudly if the feature is half-removed.
  assert.match(ui, /refreshFxRates/);
  assert.match(ui, /perUSD/);
  // And the request must stay a parameterless GET of a public table: nothing
  // about the visitor may ride along in it.
  assert.match(ui, /fetch\("https:\/\/open\.er-api\.com\/v6\/latest\/USD"/);
});

// ── the wiring: a measurement only one person can run by hand is not a gate ──

test("GATE: the browser privacy gate runs in CI, in a job with a browser", () => {
  const yml = read(".github/workflows/test.yml");
  // web-smoke is the job that already drives real Chrome on the staged build.
  assert.match(yml, /node scripts\/check-privacy-browser\.mjs/);
  // It must record its outcome, or the Jev gate cannot see it.
  assert.match(
    yml,
    /privacyBrowser: "\$\{\{ steps\.privacy-browser\.outcome \}\}"/,
  );
  // And upload the measurement itself.
  assert.match(yml, /jev-privacy-browser/);
  assert.match(yml, /jev-artifacts\/privacy-browser\.json/);
  // `if: always()` so an unmeasured privacy facet is recorded as unmeasured
  // rather than skipped, which would read as a pass.
  const step = yml.slice(
    yml.indexOf("node scripts/check-privacy-browser.mjs") - 400,
    yml.indexOf("node scripts/check-privacy-browser.mjs") + 80,
  );
  assert.match(step, /if: always\(\)/);
});

test("GATE: the browser privacy gate has its own npm script", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(
    pkg.scripts["gate:privacy-browser"],
    "node scripts/check-privacy-browser.mjs",
  );
  // It is deliberately NOT in `npm run seo`: that chain is the offline
  // preflight and needs no browser, and adding one would make every local
  // preflight depend on a Chrome install.
  assert.doesNotMatch(pkg.scripts.seo, /check-privacy-browser/);
});

// ── the decision the measurement feeds ──────────────────────────────────────

test("cookieGateDecision treats an unmeasured run as a refusal", () => {
  const unmeasured = cookieGateDecision({ ok: false });
  assert.equal(unmeasured.provision, false);
  assert.equal(unmeasured.action, "do_not_provision");
  assert.match(unmeasured.why, /unmeasured risk is not a passed gate/);
  // A measurement with no cookieCount is unmeasured, however ok:true says.
  assert.equal(cookieGateDecision({ ok: true }).provision, false);
  assert.equal(cookieGateDecision(null).provision, false);
  // Zero cookies is the only thing that provisions.
  assert.equal(
    cookieGateDecision({ ok: true, cookieCount: 0 }).provision,
    true,
  );
  // One cookie is a refusal that names the cookie.
  const one = cookieGateDecision({
    ok: true,
    cookieCount: 1,
    cookieNames: ["__cf_bm"],
  });
  assert.equal(one.provision, false);
  assert.match(one.why, /__cf_bm/);
});

// ── the evidence line ───────────────────────────────────────────────────────

test("EVIDENCE: the privacy facet line names both gates and the measurement", () => {
  const ev = JSON.parse(read("evidence/advisor-and-release.json"));
  const line = ev.facet_evidence.privacy;
  assert.ok(line && line.length > 40, "the facet line is a measurement");
  // Both halves: the source claims and the runtime measurement.
  assert.match(line, /check-privacy\.mjs/);
  assert.match(line, /check-privacy-browser\.mjs/);
  // The runtime numbers, not "we checked".
  assert.match(line, /0 cookies/i);
  assert.match(line, /HttpOnly/);
  assert.match(line, /0\.01 deg/);
  // And it must not assert the negation of what the gates prove. Note that
  // "unmeasured" is NOT in this list: the line legitimately says an unmeasured
  // run returns do_not_provision, which is the gate's own rule, not its
  // negation. A negation list too crude to distinguish those two stops meaning
  // anything.
  for (const bad of [
    "cookies are set",
    "no browser measurement",
    "privacy is not measured",
    "third-party egress is undisclosed",
  ])
    assert.ok(
      !line.includes(bad),
      `the line asserts the gate's negation: ${bad}`,
    );
  // The egress that the browser gate found must be named, or the finding is
  // invisible to the reader.
  assert.match(line, /open\.er-api\.com/);
});
