const fs = require('node:fs');
function replaceOnce(path, pattern, replacement) {
  const value = fs.readFileSync(path, 'utf8');
  const matches = value.match(pattern) || [];
  if (matches.length !== 1) throw new Error(`Expected one match in ${path}, got ${matches.length}`);
  fs.writeFileSync(path, value.replace(pattern, replacement), 'utf8');
}
replaceOnce(
  'solar-heatmap/index.html',
  /href="https:\/\/unpkg\.com\/leaflet@1\.9\.4\/dist\/leaflet\.css"[\s\S]*?crossorigin=""/,
  'href="../assets/vendor/leaflet/leaflet.css?v=20261022l"',
);
replaceOnce(
  'solar-heatmap/index.html',
  /<script\s+defer\s+src="https:\/\/unpkg\.com\/leaflet@1\.9\.4\/dist\/leaflet\.js"[\s\S]*?<\/script>/,
  '<script defer src="../assets/vendor/leaflet/leaflet.js?v=20261022l"></script>',
);
replaceOnce(
  'assets/js/heatmap.js',
  /  function init\(\) \{\r?\n/,
  `  function init() {\n    if (!window.L || typeof window.L.map !== "function") {\n      var loading = document.getElementById("loading");\n      if (loading) {\n        loading.textContent =\n          "The interactive map library failed to load. Reload this page to try again.";\n        loading.setAttribute("role", "alert");\n      }\n      return;\n    }\n`,
);
fs.writeFileSync(
  'assets/vendor/leaflet/README.md',
  [
    'Leaflet 1.9.4 production assets',
    '',
    'Source: the Leaflet 1.9.4 npm release published by the Leaflet project at https://github.com/Leaflet/Leaflet/releases/tag/v1.9.4.',
    'The CSS, production JavaScript, and referenced images are copied unchanged from dist; the upstream license is included as LICENSE.',
    'The CSS and JavaScript SHA-256 digests match the page\'s former subresource-integrity values.',
    '',
  ].join('\n'),
  'utf8',
);
fs.writeFileSync(
  'tests/heatmap-leaflet-selfhost.test.mjs',
  [
    'import { test } from "node:test";',
    'import assert from "node:assert/strict";',
    'import { existsSync, readFileSync } from "node:fs";',
    '',
    'const html = readFileSync("solar-heatmap/index.html", "utf8");',
    'const script = readFileSync("assets/js/heatmap.js", "utf8");',
    '',
    'test("the heatmap loads Leaflet from versioned same-origin assets", () => {',
    '  assert.match(html, /\\.\\.\\/assets\\/vendor\\/leaflet\\/leaflet\\.css\\?v=/);',
    '  assert.match(html, /\\.\\.\\/assets\\/vendor\\/leaflet\\/leaflet\\.js\\?v=/);',
    '  assert.doesNotMatch(html, /https:\\/\\/unpkg\\.com\\/leaflet/);',
    '  assert.ok(',
    '    html.indexOf("assets/vendor/leaflet/leaflet.js") <',
    '      html.indexOf("assets/js/heatmap.js"),',
    '    "Leaflet must run before the heatmap module",',
    '  );',
    '});',
    '',
    'test("the vendored release includes its license and stylesheet assets", () => {',
    '  assert.match(readFileSync("assets/vendor/leaflet/README.md", "utf8"), /Leaflet 1\\.9\\.4/);',
    '  assert.match(readFileSync("assets/vendor/leaflet/LICENSE", "utf8"), /BSD/);',
    '  for (const file of [',
    '    "layers.png",',
    '    "layers-2x.png",',
    '    "marker-icon.png",',
    '    "marker-icon-2x.png",',
    '    "marker-shadow.png",',
    '  ]) {',
    '    assert.equal(',
    '      existsSync("assets/vendor/leaflet/images/" + file),',
    '      true,',
    '      "missing Leaflet CSS image: " + file,',
    '    );',
    '  }',
    '});',
    '',
    'test("a missing Leaflet global produces an accessible map failure message", () => {',
    '  const guard = script.indexOf(',
    '    \'if (!window.L || typeof window.L.map !== "function")\',',
    '  );',
    '  assert.notEqual(guard, -1);',
    '  assert.ok(guard < script.indexOf("var boot = Promise.all"));',
    '  assert.ok(guard < script.indexOf(\'map = L.map("map"\'));',
    '  assert.match(script, /loading\\.setAttribute\\("role", "alert"\\)/);',
    '  assert.match(script, /interactive map library failed to load/i);',
    '});',
    '',
  ].join('\n'),
  'utf8',
);
