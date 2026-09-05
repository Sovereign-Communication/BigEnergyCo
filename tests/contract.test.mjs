// Regression guard: the renderer (ui.js) and the engine (run.js) each carry a
// PAYLOAD_CONTRACT version. They MUST match — a drift (ui.js behind run.js)
// made every sizing run show a false "older engine version" warning in
// production. This test fails the build instead.
// Run: node --test tests/contract.test.mjs (or node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PAYLOAD_CONTRACT } from "../assets/js/sizing/run.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ui.js is a browser module (DOM at load time), so read its constant from
// source rather than importing it. It's a static literal.
function readUiContract() {
  const src = fs.readFileSync(
    path.join(__dirname, "..", "assets/js/sizing/ui.js"),
    "utf8",
  );
  const match = src.match(/const PAYLOAD_CONTRACT = (\d+);/);
  assert.ok(match, "ui.js must declare PAYLOAD_CONTRACT as a literal");
  return Number(match[1]);
}

test("ui.js PAYLOAD_CONTRACT matches run.js PAYLOAD_CONTRACT", () => {
  const ui = readUiContract();
  assert.equal(
    ui,
    PAYLOAD_CONTRACT,
    `ui.js PAYLOAD_CONTRACT (${ui}) drifted from run.js PAYLOAD_CONTRACT (${PAYLOAD_CONTRACT}) — ` +
      "every sizing run would show the stale-engine warning. Bump both together.",
  );
});

test("sizing payload actually carries the contract version", async () => {
  const { runSizing } = await import("../assets/js/sizing/run.js");
  const { synthesizeFromProfile } = await import("../assets/js/sizing/nasa.js");
  const { OFFLINE_PROFILES, PROFILE_YEAR } =
    await import("../assets/js/sizing/profiles.js");
  const city = OFFLINE_PROFILES.find((p) => p.name.includes("Honolulu"));
  const fakeWeather = async () => ({
    hours: synthesizeFromProfile(city),
    meta: {
      latitude: 21.31,
      longitude: -157.86,
      startYear: PROFILE_YEAR,
      endYear: PROFILE_YEAR,
      years: 1,
      source: "test fixture",
      offline: false,
    },
  });
  const p = await runSizing(
    {
      latitude: 21.31,
      longitude: -157.86,
      dailyKwh: 10,
      tariff: 0.42,
      chemistry: "lfp",
      mode: "offgrid",
    },
    { fetchWeather: fakeWeather },
  );
  assert.equal(
    p.contract,
    PAYLOAD_CONTRACT,
    "payload carries the current contract version",
  );
});
