const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
for (const file of ["assets/vendor/leaflet/LICENSE", "assets/vendor/leaflet/README.md", "assets/vendor/leaflet/leaflet.css", "assets/vendor/leaflet/leaflet.js", "assets/vendor/leaflet/leaflet.js.map"]) {
  fs.writeFileSync(file, execFileSync("git", ["show", "HEAD:" + file]));
}