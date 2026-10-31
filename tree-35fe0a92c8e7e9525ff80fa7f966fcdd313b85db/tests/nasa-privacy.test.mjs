import { test } from "node:test";
import assert from "node:assert/strict";
import { buildUrl } from "../assets/js/sizing/nasa.js";

// Privacy: metre-accurate GPS coordinates must never hit the wire.
// NASA POWER's grid is ~55 km (0.5°), so 2-decimal rounding (~1.1 km)
// has zero impact on returned data — but keeps precise location private.
test("buildUrl rounds coordinates to 2 decimals before egress", () => {
  const url = buildUrl(19.123456, -155.123456, "20200101", "20201231");
  assert.match(url, /latitude=19\.12\b/, "latitude rounded to 2 decimals");
  assert.match(url, /longitude=-155\.12\b/, "longitude rounded to 2 decimals");
  assert.doesNotMatch(url, /19\.123456/, "raw latitude must not appear");
  assert.doesNotMatch(url, /155\.123456/, "raw longitude must not appear");
});

test("buildUrl handles already-rounded coordinates", () => {
  const url = buildUrl(21.31, -157.86, "20200101", "20201231");
  assert.match(url, /latitude=21\.31\b/);
  assert.match(url, /longitude=-157\.86\b/);
});
