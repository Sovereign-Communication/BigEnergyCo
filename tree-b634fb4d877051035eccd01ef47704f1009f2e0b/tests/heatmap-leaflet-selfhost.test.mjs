import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import {
  LEAFLET_SCRIPT_SRI,
  LEAFLET_STYLE_SRI,
  LEAFLET_STYLE_URL,
} from "../assets/js/sizing/map-provider.js?v=20261022p";

const html = readFileSync("solar-heatmap/index.html", "utf8");
const script = readFileSync("assets/js/heatmap.js", "utf8");
const provider = readFileSync("assets/js/sizing/map-provider.js", "utf8");

test("the heatmap loads Leaflet from versioned same-origin assets", () => {
  assert.match(html, /\.\.\/assets\/vendor\/leaflet\/leaflet\.js\?v=/);
  assert.doesNotMatch(html, /leaflet\.css|https:\/\/unpkg\.com\/leaflet/);
  assert.match(provider, /LEAFLET_STYLE_URL = versionedLocalAsset/);
  assert.match(provider, /\.\.\/\.\.\/vendor\/leaflet\/leaflet\.css/);
  const integrity = (path) =>
    "sha256-" +
    createHash("sha256").update(readFileSync(path)).digest("base64");
  assert.equal(
    LEAFLET_STYLE_SRI,
    integrity("assets/vendor/leaflet/leaflet.css"),
    "Leaflet stylesheet integrity must match the vendored file",
  );
  assert.equal(
    LEAFLET_SCRIPT_SRI,
    integrity("assets/vendor/leaflet/leaflet.js"),
    "Leaflet script integrity must match the vendored file",
  );
  assert.ok(
    LEAFLET_STYLE_URL.includes("/assets/vendor/leaflet/leaflet.css?v="),
  );
  assert.ok(
    html.indexOf("assets/vendor/leaflet/leaflet.js") <
      html.indexOf("assets/js/heatmap.js"),
    "Leaflet must run before the heatmap module",
  );
  assert.match(script, /applyLeafletStyles/);
});

test("the vendored release includes its license and stylesheet assets", () => {
  assert.match(
    readFileSync("assets/vendor/leaflet/README.md", "utf8"),
    /Leaflet 1\.9\.4/,
  );
  assert.match(readFileSync("assets/vendor/leaflet/LICENSE", "utf8"), /BSD/);
  for (const file of [
    "layers.png",
    "layers-2x.png",
    "marker-icon.png",
    "marker-icon-2x.png",
    "marker-shadow.png",
  ]) {
    assert.ok(existsSync(`assets/vendor/leaflet/images/${file}`), file);
  }
});

test("a missing Leaflet global produces an accessible map failure message", () => {
  assert.match(
    script,
    /The interactive map library failed to load\. Reload this page to try again\./,
  );
  assert.match(script, /loading\.setAttribute\("role", "alert"\)/);
});
