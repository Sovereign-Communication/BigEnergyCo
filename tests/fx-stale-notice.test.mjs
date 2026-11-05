// P1.4 / F-10: the FX provenance line.
//
// The defect this pins is not a missing label, it is a silent one: before this
// change the page said nothing about which rates produced a visitor's money
// figures, or how old they were. Offline - or on a network that blocks the FX
// host - the conversion came from the hand-kept fallback table with no source
// and no date on screen at all, and even a successful fetch aged silently until
// the next load. So the tests below are about the STATES (static, live, stale)
// and about the words carrying the date, because a stale rate presented without
// its age is a wrong number wearing a right number's clothes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  FX_SOURCE,
  FX_STALE_DAYS,
  fxFreshness,
} from "../assets/js/sizing/pricing.js";
import { LOCALES } from "../assets/js/shared/locales.js";

const DAY = 86400000;
const NOW = Date.parse("2026-11-05T12:00:00Z");
const daysAgo = (n) => new Date(NOW - n * DAY).toUTCString();

test("a rate with no usable date is static, never fresh", () => {
  // "static" is the honest state for the built-in table: it is a fallback with
  // no publish date, so it must not borrow the live wording.
  assert.equal(fxFreshness({ asOf: null, now: NOW }).state, "static");
  assert.equal(fxFreshness({ now: NOW }).state, "static");
  assert.equal(fxFreshness({ asOf: "not a date", now: NOW }).state, "static");
  assert.equal(fxFreshness({ asOf: "", now: NOW }).state, "static");
});

test("the stale threshold is a week, and the boundary belongs to stale", () => {
  assert.equal(FX_STALE_DAYS, 7);
  assert.equal(fxFreshness({ asOf: daysAgo(0), now: NOW }).state, "live");
  assert.equal(fxFreshness({ asOf: daysAgo(6), now: NOW }).state, "live");
  assert.equal(fxFreshness({ asOf: daysAgo(7), now: NOW }).state, "stale");
  assert.equal(fxFreshness({ asOf: daysAgo(6), now: NOW }).days, 6);
  assert.equal(fxFreshness({ asOf: daysAgo(30), now: NOW }).days, 30);
  // A provider clock slightly ahead of ours is not a negative age on screen.
  assert.equal(fxFreshness({ asOf: daysAgo(-2), now: NOW }).days, 0);
  assert.equal(fxFreshness({ asOf: daysAgo(-2), now: NOW }).state, "live");
});

test("the live and stale wordings always carry the source and the date", () => {
  const en = LOCALES.en;
  assert.equal(FX_SOURCE, "open.er-api.com");
  for (const key of ["fxSourceLive", "fxSourceStale"]) {
    assert.match(en[key], /open\.er-api\.com/, `${key} must name the source`);
    assert.match(en[key], /\{asOf\}/, `${key} must carry the date`);
  }
  // Only the stale wording carries an age, and it is the whole point of the
  // stale state: the visitor is told how far behind the rate is.
  assert.match(en.fxSourceStale, /\{days\}/);
  assert.doesNotMatch(en.fxSourceLive, /\{days\}/);
  // The two undated states must not imply a date they do not have.
  for (const key of ["fxSourceStatic", "fxSourceFailed"]) {
    assert.doesNotMatch(en[key], /\{asOf\}|\{days\}/, `${key} invents a date`);
    assert.match(en[key], /open\.er-api\.com/, `${key} must name the source`);
  }
});

test("every locale carries the provenance strings with the same placeholders", () => {
  const placeholders = (s) =>
    [...String(s).matchAll(/\{(\w+)\}/g)]
      .map((m) => m[1])
      .sort()
      .join(",");
  for (const key of [
    "fxSourceStatic",
    "fxSourceLive",
    "fxSourceStale",
    "fxSourceFailed",
  ]) {
    for (const [code, dict] of Object.entries(LOCALES)) {
      assert.ok(dict[key], `${code} is missing ${key}`);
      assert.equal(
        placeholders(dict[key]),
        placeholders(LOCALES.en[key]),
        `${code}.${key} placeholders differ from English`,
      );
      assert.match(
        dict[key],
        /open\.er-api\.com/,
        `${code}.${key} names no source`,
      );
    }
  }
  // The retired key must be gone from every dictionary: it was the old
  // undated line, and leaving it behind would let a later edit resurrect it.
  for (const [code, dict] of Object.entries(LOCALES)) {
    assert.equal(
      dict.fxAsOfNote,
      undefined,
      `${code} still carries fxAsOfNote`,
    );
  }
});

test("the shipped markup renders a provenance line, not an empty element", () => {
  const html = readFileSync("index.html", "utf8");
  const block = html.match(/<p[\s\S]{0,600}?id="fxAsOf"[\s\S]{0,600}?<\/p>/);
  assert.ok(block, "index.html has no #fxAsOf block");
  const el = block[0];
  assert.match(el, /role="status"/, "#fxAsOf is not announced as a status");
  assert.match(
    el,
    /data-i18n="fxSourceStatic"/,
    "#fxAsOf has no translatable default",
  );
  const text = el
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]*>/g, "")
    .trim();
  assert.ok(
    text.length > 20,
    "the default provenance text is empty, so a JS-less visitor learns nothing",
  );
  assert.match(text, /open\.er-api\.com/);
});

test("the sizing UI classifies through the helper and paints before it fetches", () => {
  const ui = readFileSync("assets/js/sizing/ui.js", "utf8");
  // Staleness is decided in one place (pricing.js), not re-derived at the call
  // site: a second threshold is how the label drifts from the data.
  assert.match(ui, /fxFreshness\(\{ asOf: fxMeta\.asOf \}\)/);
  assert.doesNotMatch(ui, /fxMeta\.asOf\s*&&\s*new Date/);
  // The line is painted on init BEFORE the network call, so the in-flight
  // window cannot show converted money with no provenance at all.
  const init = ui.match(/renderFxStatus\(\);[\s\S]{0,200}?refreshFxRates\(\);/);
  assert.ok(init, "init does not paint the provenance line before refreshing");
  // Every path that leaves the visitor on the fallback table says so.
  const failures = ui.match(
    /fxMeta\.failed = true;\s*\n\s*renderFxStatus\(\);/g,
  );
  assert.ok(
    failures && failures.length >= 3,
    `expected the three failure paths (non-ok, bad payload, thrown) to mark and repaint, found ${failures ? failures.length : 0}`,
  );
  // A live rate must clear the failure flag, or a recovered page keeps claiming
  // the fetch failed.
  assert.match(ui, /fxMeta\.live = true;\s*\n\s*fxMeta\.failed = false;/);
  // The date the UI prints is the provider's own, not the browser's clock.
  assert.match(ui, /json\.time_last_update_utc/);
});
