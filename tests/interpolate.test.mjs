// The locale string contract has one owner.
//
// Substitution used to be implemented twice — i18n.js for the markup pass and
// the sizing controller for runtime-rendered copy — so the same defect (a
// string replacer reading "$200" as the "$2" pattern and dropping the dollars)
// had to be found and fixed twice. These pin the rules to the single
// implementation, and pin that the second implementation is gone.
// Run: node --test tests/interpolate.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  interpolate,
  pickString,
  PLACEHOLDER_NAME,
} from "../assets/js/shared/interpolate.js";
import { translate } from "../assets/js/shared/i18n.js";
import { LOCALES } from "../assets/js/shared/locales.js";

test("interpolate: a formatted money value survives substitution intact", () => {
  // Through a STRING replacer, "$2" reads as a capture pattern: "$200" loses
  // its dollars. The replacement must be a function.
  assert.equal(
    interpolate("Starts at ~{bill} ({kwh} kWh/day)", { bill: "$200", kwh: 5 }),
    "Starts at ~$200 (5 kWh/day)",
  );
  for (const value of [
    "$200",
    "$1",
    "$&",
    "$'",
    "$`",
    "$1$$",
    "a$&b",
    "$999/mo",
  ]) {
    assert.equal(interpolate("{v}", { v: value }), value, `literal: ${value}`);
  }
});

test("interpolate: every occurrence is filled, not just the first", () => {
  assert.equal(interpolate("{a} and {a}", { a: "x" }), "x and x");
  const body = LOCALES.en.statusSuccess;
  const once = interpolate(body, {
    years: 5,
    dataYears: "2021-2025",
    yield: 1803,
    offline: "",
  });
  assert.doesNotMatch(once, /\{years\}|\{dataYears\}|\{yield\}|\{offline\}/);
});

test("interpolate: names are matched literally, never as a pattern", () => {
  // The controller's old RegExp implementation would have treated the "." in
  // "{a.b}" as "any character" and filled a value into "{aXb}".
  assert.equal(interpolate("{a.b}", { aXb: "wrong" }), "{a.b}");
  assert.equal(interpolate("{a.b}", { "a.b": "right" }), "right");
});

test("interpolate: placeholders with no value are left visible", () => {
  // A missing var is a wiring bug; leaving the slot readable beats silently
  // emptying a sentence.
  assert.equal(interpolate("Cost {bill}/mo", {}), "Cost {bill}/mo");
  assert.equal(interpolate("Cost {bill}/mo", null), "Cost {bill}/mo");
  assert.equal(interpolate("plain"), "plain");
});

test("interpolate: a nullish value renders as nothing, never as 'undefined'", () => {
  assert.equal(interpolate("[{v}]", { v: null }), "[]");
  assert.equal(interpolate("[{v}]", { v: undefined }), "[]");
  assert.equal(interpolate("[{v}]", { v: 0 }), "[0]");
  assert.equal(interpolate("[{v}]", { v: false }), "[false]");
});

test("pickString: active dictionary, then English, then the raw key", () => {
  const de = LOCALES.de;
  assert.equal(pickString(de, "navBlog", LOCALES.en), de.navBlog);
  // A key English carries and a translation is missing must read as English,
  // never as key-ese.
  assert.equal(pickString({}, "navBlog", LOCALES.en), LOCALES.en.navBlog);
  assert.equal(
    pickString({}, "noSuchKeyAnywhere", LOCALES.en),
    "noSuchKeyAnywhere",
  );
  assert.equal(
    pickString(undefined, "navBlog", LOCALES.en),
    LOCALES.en.navBlog,
  );
});

test("translate is the one implementation both readers share", () => {
  // The runtime path (ui.js renders through this) and the markup path agree by
  // construction now, so this equality is a contract rather than a coincidence.
  const rendered = translate("quickBillStarts", { bill: "$200", kwh: 5 });
  assert.equal(
    rendered,
    interpolate(LOCALES.en.quickBillStarts, { bill: "$200", kwh: 5 }),
  );
  assert.match(
    rendered,
    /\$200/,
    "the money figure reached the sentence whole",
  );
  assert.doesNotMatch(rendered, /\{bill\}|\{kwh\}/);
});

test("the controller no longer carries a second interpolation loop", () => {
  const ui = readFileSync(
    new URL("../assets/js/sizing/ui.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    ui,
    /function t\(key, params = \{\}\)/,
    "a local t() is a second implementation of the same contract",
  );
  assert.match(
    ui,
    /translate as t,/,
    "runtime copy must bind to the shared translate",
  );
  assert.doesNotMatch(
    ui,
    /new RegExp\(`\\\\\{/,
    "the regex placeholder loop is what drifted from the other owner",
  );
});

test("every placeholder name shipped in a locale is well formed", () => {
  const source = readFileSync(
    new URL("../assets/js/shared/locales.js", import.meta.url),
    "utf8",
  );
  const names = new Set(
    [...source.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]),
  );
  assert.ok(
    names.size > 40,
    `expected a broad placeholder surface, got ${names.size}`,
  );
  for (const name of names) {
    assert.match(name, PLACEHOLDER_NAME, `placeholder name: ${name}`);
  }
  // Names are matched literally, so a name with punctuation would only ever be
  // substituted by exact match — always a typo in the locale string.
  const raw = [...source.matchAll(/\{(.*?)\}/g)].map((m) => m[1]);
  const malformed = raw.filter((n) => n && !PLACEHOLDER_NAME.test(n));
  assert.deepEqual(malformed, [], "no locale string carries a malformed slot");
});
