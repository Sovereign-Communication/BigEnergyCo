// Format evidence/production-probe.json the way the runner will read it.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FILE = "C:/tmp/gate-freshness/evidence/production-probe.json";
const dir = mkdtempSync(join(tmpdir(), "beco-probe-fmt-"));
const before = readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");
const staged = join(dir, "production-probe.json");
writeFileSync(staged, before, "utf8");
try {
  execFileSync("npx", ["--yes", "prettier@3.9.6", "--write", "."], {
    cwd: dir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  const fixed = readFileSync(staged, "utf8");
  JSON.parse(fixed);
  if (fixed !== before) {
    writeFileSync(FILE, fixed, "utf8"); // LF, which is what git stores
    console.log(`reformatted evidence/production-probe.json (${before.length} -> ${fixed.length})`);
  } else {
    console.log("already formatted");
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
