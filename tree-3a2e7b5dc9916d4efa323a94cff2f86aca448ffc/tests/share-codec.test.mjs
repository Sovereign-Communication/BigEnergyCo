// Share-link codec contract: the pure half of shareable results (encode,
// decode, and the validation gate) lives in assets/js/sizing/share-codec.js
// so a malformed or hostile link is refused before any DOM state moves.
// Extraction follow-up to the ui.js seams in docs/ARCHITECTURE.md: policy in
// a pure module, mechanics stay with the DOM.
// Run: node --test tests/share-codec.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SHARE_PREFIX,
  b64urlEncode,
  b64urlDecode,
  parseShareHash,
} from "../assets/js/sizing/share-codec.js";

const VALID = {
  v: 1,
  la: 21.31,
  lo: -157.86,
  kw: 16,
  ch: "auto",
  g: 1,
  a: 1,
  ag: "cut80",
  cc: 0.8,
  sel: "best",
  tf: 0.44,
  t: [
    [2.98, 11],
    [2.98, 8],
  ],
};

const hashFor = (o) => SHARE_PREFIX + b64urlEncode(o);

test("codec round-trips the share state, including non-ASCII labels", () => {
  const state = { ...VALID, note: "Süd☀ 240V" };
  assert.deepEqual(b64urlDecode(b64urlEncode(state)), state);
  const parsed = parseShareHash(hashFor(state));
  assert.ok(parsed, "valid link parses");
  assert.equal(parsed.kw, 16);
  assert.equal(parsed.la, 21.31);
  assert.equal(parsed.lo, -157.86);
  assert.equal(
    parsed.note,
    "Süd☀ 240V",
    "unknown fields pass through untouched",
  );
});

test("parseShareHash normalizes la/lo/kw to numbers", () => {
  const parsed = parseShareHash(
    hashFor({ v: 1, la: "21.31", lo: "-157.86", kw: "16" }),
  );
  assert.equal(parsed.la, 21.31);
  assert.equal(parsed.lo, -157.86);
  assert.equal(parsed.kw, 16);
});

test("parseShareHash refuses malformed links before they reach the form", () => {
  const cases = [
    ["no prefix", "#x=" + b64urlEncode(VALID)],
    ["empty hash", ""],
    ["non-string", null],
    ["bad base64", "#s=%%%"],
    ["truncated json", hashFor(VALID).slice(0, 12)],
    ["json null", SHARE_PREFIX + b64urlEncode(null)],
    ["json array", SHARE_PREFIX + b64urlEncode([1, 2])],
    ["wrong version", hashFor({ ...VALID, v: 2 })],
    ["missing version", hashFor({ la: 1, lo: 1, kw: 16 })],
    ["latitude out of range", hashFor({ ...VALID, la: 91 })],
    ["longitude out of range", hashFor({ ...VALID, lo: 181 })],
    ["daily-kwh too large", hashFor({ ...VALID, kw: 501 })],
    ["daily-kwh too small", hashFor({ ...VALID, kw: 0.4 })],
    ["non-numeric latitude", hashFor({ ...VALID, la: "x" })],
  ];
  for (const [label, hash] of cases) {
    assert.equal(parseShareHash(hash), null, label);
  }
});

test("parseShareHash accepts the documented bounds exactly", () => {
  assert.ok(parseShareHash(hashFor({ v: 1, la: 90, lo: -180, kw: 500 })));
  assert.ok(parseShareHash(hashFor({ v: 1, la: -90, lo: 180, kw: 0.5 })));
  assert.equal(
    parseShareHash(hashFor({ v: 1, la: 90.01, lo: 0, kw: 16 })),
    null,
  );
});
