// Syntax-check every tracked JS module. Portable replacement for
// `git ls-files '*.js' '*.mjs' | xargs -n1 node --check` (xargs is absent on
// Windows dev machines). Run: node scripts/check-syntax.mjs
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const out = execFileSync("git", ["ls-files", "*.js", "*.mjs"], {
  encoding: "utf8",
});
const files = out
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);
if (!files.length) {
  console.error("FAIL check-syntax: no tracked .js/.mjs files found");
  process.exit(1);
}
let failures = 0;
await Promise.all(
  files.map(async (f) => {
    try {
      await execFileAsync(process.execPath, ["--check", f]);
    } catch {
      console.error(`FAIL syntax: ${f}`);
      failures++;
    }
  }),
);
console.log(
  failures
    ? `syntax check FAILED (${failures} files)`
    : `syntax check OK (${files.length} files)`,
);
process.exit(failures ? 1 : 0);
