// Car 2 (#197): fail-closed at the three boundaries where an untrusted
// response becomes product state.
//
// Every test here fails on the tree it was written against. The three findings
// are one shape — a boundary that accepted whatever arrived — in three
// different languages of input:
//
//   1. worker/index.js  a 200 whose body is not a reply made `json()` throw
//                       out of the handler: a 500 with no CORS headers, which
//                       the browser shows as an opaque network failure with the
//                       chat box stuck on "Thinking…".
//   2. cities.js        `Number("")` is 0, and 0,0 is a finite, in-range
//                       coordinate, so a blank lat/lon in a partition row or a
//                       geocoder response became a plausible place in the Gulf
//                       of Guinea. An absent one became NaN and reached the
//                       coordinate boxes.
//   3. smoke/privacy.mjs the coordinate-precision finding compared a
//                       coordinate's MAGNITUDE with 1, not its decimal places
//                       with the two the product ships — flagging every correct
//                       request outside ±1° and staying blind near the equator.
import { test } from "node:test";
import assert from "node:assert/strict";

import worker, {
  DEGRADED_LABEL,
  resetRateLimitsForTest,
} from "../worker/index.js";
import { lookupCityOnline, parseCityRows } from "../assets/js/sizing/cities.js";
import { coordinateFindingsFor } from "../scripts/smoke/privacy.mjs";

const ORIGIN = "https://freeoffgridcalculator.com";

const postChat = (env, body = { message: "How big a battery?" }) =>
  worker.fetch(
    new Request("https://api.test/api/chat", {
      method: "POST",
      headers: { Origin: ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    env,
  );

/** A response whose status says 200 and whose body is not the reply we expect. */
const notJson = (text = "<html>captive portal</html>") => ({
  ok: true,
  status: 200,
  json: async () => {
    throw new SyntaxError(`Unexpected token '<' in JSON: ${text}`);
  },
});

// ══ 1. the worker's body read ═════════════════════════════════════════════

test("car2: a 200 that is not a reply degrades instead of throwing a bare 500", async () => {
  resetRateLimitsForTest();
  const env = { GROQ_API_KEY: "test-key", fetch: async () => notJson() };

  // The unfixed tree escaped as a Worker exception here, so this call rejected
  // rather than returning anything at all.
  const res = await postChat(env);
  assert.equal(res.status, 200);
  // A thrown handler produces a 500 with NO CORS headers, which is why the
  // browser could not even read the failure. The header is the assertion.
  assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);
  const body = await res.json();
  assert.equal(body.label, DEGRADED_LABEL);
  assert.match(body.reply, new RegExp(DEGRADED_LABEL));
});

test("car2: an unreadable continuation keeps the text already streamed", async () => {
  resetRateLimitsForTest();
  let call = 0;
  const env = {
    GROQ_API_KEY: "test-key",
    fetch: async () => {
      call += 1;
      if (call === 1)
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: { content: "Keep the well. " },
                finish_reason: "length",
              },
            ],
          }),
        };
      return notJson();
    },
  };

  const res = await postChat(env);
  assert.equal(res.status, 200);
  const body = await res.json();
  // The half that arrived is real and complete enough to show; the degraded
  // reply would have discarded it. Same rule the `fullReply.length > 0` branch
  // above applies to an upstream status.
  assert.match(body.reply, /Keep the well\./);
  assert.equal(body.label, undefined);
});

// ══ 2. coordinates from the two untrusted sources ═════════════════════════

test("car2: every blank form is absent, not 0,0", () => {
  // `Number("")`, `Number("   ")` and `Number(null)` are all 0, and 0,0 is a
  // finite, in-range coordinate. Each spelling must resolve to no city.
  for (const blank of ["", "   ", null])
    assert.deepEqual(
      parseCityRows([{ name: "Blank", country: "XX", lat: blank, lon: blank }]),
      [],
      `${JSON.stringify(blank)} must not become a coordinate`,
    );
  // A genuine 0 survives: the equator and the prime meridian are real places.
  const quito = parseCityRows([
    { name: "Quito", country: "EC", lat: 0, lon: 0 },
  ]);
  assert.equal(quito.length, 1);
  assert.equal(quito[0].lat, 0);
  assert.equal(quito[0].lon, 0);
  assert.equal(
    parseCityRows([
      { name: "Paris", country: "FR", lat: "48.86", lon: "2.35" },
    ])[0].lat,
    48.86,
  );
});

test("car2: a partition row with a blank lat is dropped, not moved to 0,0", () => {
  const rows = parseCityRows([
    { name: "Blank", country: "Nowhere", lat: "", lon: "" },
    { name: "Missing", country: "Nowhere" },
    { name: "Null island", country: "Nowhere", lat: null, lon: null },
    { name: "Accra", country: "GH", lat: "5.56", lon: "-0.2" },
    { name: "Quito", country: "EC", lat: 0, lon: 0 },
  ]);
  assert.deepEqual(
    rows.map((c) => c.name),
    ["Accra", "Quito"],
    "only rows carrying a real coordinate may resolve to a place",
  );
  assert.equal(rows[1].lat, 0, "a genuine 0 latitude is kept");
  assert.equal(rows[1].lon, 0);
});

test("car2: a geocoder that cannot place the result returns no match", async () => {
  const reply = (row) => async () => ({
    ok: true,
    json: async () => [row],
  });
  const base = {
    name: "Nowhere",
    address: { country_code: "nz", state: "Nowhere" },
  };

  // Unfixed: lat "" → Number("") → 0, and 0,0 passed every downstream check.
  for (const bad of [
    { ...base, lat: "", lon: "" },
    { ...base, lat: null, lon: null },
    { ...base },
    { ...base, lat: "95", lon: "10" },
    { ...base, lat: "10", lon: "190" },
    { ...base, lat: "north", lon: "east" },
  ])
    assert.equal(
      await lookupCityOnline("Nowhere", reply(bad)),
      null,
      `a result carrying ${JSON.stringify({ lat: bad.lat, lon: bad.lon })} must not resolve`,
    );

  // The valid case still converts, at the same shape the picker expects.
  assert.deepEqual(
    await lookupCityOnline(
      "Testville",
      reply({
        name: "Testville",
        address: { country_code: "nz", state: "Test State" },
        lat: "1.25",
        lon: "2.5",
      }),
    ),
    { name: "Testville", country: "NZ", r: "Test State", lat: 1.25, lon: 2.5 },
  );
});

// ══ 3. the privacy gate's precision measurement ═══════════════════════════

test("car2: the shipped rounding is not a privacy finding", () => {
  // `roundCoord` ships String(Number(toFixed(2))): one or two decimal places.
  assert.deepEqual(
    coordinateFindingsFor([
      "https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=T2M&latitude=51.51&longitude=-0.13",
      "https://power.larc.nasa.gov/x?latitude=5.6&longitude=0",
      "https://nominatim.openstreetmap.org/reverse?lat=21.31&lon=-157.86",
      "https://power.larc.nasa.gov/x?latitude=-33&longitude=151",
    ]),
    [],
    "a correctly rounded request must not be reported as a leak",
  );
});

test("car2: a coordinate finer than the shipped rounding is a finding at any magnitude", () => {
  // The magnitude predicate missed every one of these: the value after the
  // decimal point is what says a house was sent, not the degrees before it.
  const nearEquator =
    "https://power.larc.nasa.gov/x?latitude=0.512345&longitude=36.821945";
  const atZeroLon =
    "https://nominatim.openstreetmap.org/x?lat=51.507351&lon=0.001";
  // The latitude is correctly rounded; only the longitude has four places.
  const longitudeOnly =
    "https://power.larc.nasa.gov/x?latitude=21.31&longitude=-157.8597";

  for (const url of [nearEquator, atZeroLon, longitudeOnly])
    assert.deepEqual(
      coordinateFindingsFor([url]).length,
      1,
      `${url} carries more than two decimal places and must be a finding`,
    );

  // The value is reported verbatim so the reader can see what left the device.
  assert.match(coordinateFindingsFor([nearEquator])[0], /^0\.512345 in /);
  assert.match(coordinateFindingsFor([longitudeOnly])[0], /^-157\.8597 in /);
});

test("car2: a query parameter that merely ends in lat is not a coordinate", () => {
  assert.deepEqual(
    coordinateFindingsFor([
      "https://example.test/x?translate=0.512345",
      "https://example.test/x?flat=1.234567",
    ]),
    [],
  );
});

test("car2: identical URLs are not double-counted per coordinate", () => {
  const url =
    "https://power.larc.nasa.gov/x?latitude=0.512345&longitude=36.821945";
  assert.equal(coordinateFindingsFor([url]).length, 1);
  assert.deepEqual(coordinateFindingsFor([]), []);
});
