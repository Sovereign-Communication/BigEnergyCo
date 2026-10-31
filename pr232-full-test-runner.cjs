const fs = require("node:fs");
const { spawnSync, execFileSync } = require("node:child_process");
const path = "robots.txt";
const original = fs.readFileSync(path);
const committed = execFileSync("git", ["cat-file", "blob", "HEAD:robots.txt"]);
const log = "C:/tmp/pr232-full-test.log";
let result;
try {
  fs.writeFileSync(path, committed);
  result = spawnSync("npm.cmd", ["test"], {
    cwd: process.cwd(), shell: true, encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024
  });
  fs.writeFileSync(log, (result.stdout || "") + (result.stderr || ""));
} finally {
  fs.writeFileSync(path, original);
}
const output = fs.readFileSync(log, "utf8");
console.log(output.split(/\r?\n/).slice(-38).join("\n"));
console.log("npm test exit=" + (result?.status ?? 1));
process.exitCode = result?.status ?? 1;
