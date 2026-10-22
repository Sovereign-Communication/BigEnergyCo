import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const html = readFileSync("solar-heatmap/index.html", "utf8");
const script = readFileSync("assets/js/heatmap.js", "utf8");

test("the heatmap loads Leaflet from versioned same-origin assets", () => {
  assert.match(html, /\.\.\/assets\/vendor\/leaflet\/leaflet\.css\?v=/);
  assert.match(html, /\.\.\/assets\/vendor\/leaflet\/leaflet\.js\?v=/);
  assert.doesNotMatch(html, /https:\/\/unpkg\.com\/leaflet/);
  const integrity = (path) =>
    `sha256-${createHash("sha256").update(readFileSync(path)).digest("base64")}`;
  assert.ok(
    html.includes(
      `integrity="${integrity("assets/vendor/leaflet/leaflet.css")}"`,
    ),
    "Leaflet stylesheet integrity must match the vendored file",
  );
  assert.ok(
    html.includes(
      `integrity="${integrity("assets/vendor/leaflet/leaflet.js")}"`,
    ),
    "Leaflet script integrity must match the vendored file",
  );
  assert.ok(
    html.indexOf("assets/vendor/leaflet/leaflet.js") <
      html.indexOf("assets/js/heatmap.js"),
    "Leaflet must run before the heatmap module",
  );
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
    assert.equal(
      existsSync("assets/vendor/leaflet/images/" + file),
      true,
      "missing Leaflet CSS image: " + file,
    );
  }
});

test("a missing Leaflet global produces an accessible map failure message", () => {
  const guard = script.indexOf(
    'if (!window.L || typeof window.L.map !== "function")',
  );
  assert.notEqual(guard, -1);
  assert.ok(guard < script.indexOf("var boot = Promise.all"));
  assert.ok(guard < script.indexOf('map = L.map("map"'));
  assert.match(script, /loading\.setAttribute\("role", "alert"\)/);
  assert.match(script, /interactive map library failed to load/i);
});
