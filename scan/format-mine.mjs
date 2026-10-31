// Format ONLY the files this pass changed, with the repo's pinned prettier
// (scripts/check-format.mjs: prettier@3.9.6 over LF-normalised bytes), and write
// them back with the working tree's own line endings so the working copy does
// not get its whole file flipped.
//
// `npm run format` would also rewrite .github/workflows/cf-pages-deploy.yml,
// which is unformatted at HEAD (verified by checking HEAD's stored bytes through
// the same prettier) and is not this pass's to touch.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = "C:/tmp/gate-freshness";
const FILES = [
  "evidence/advisor-and-release.json",
  "tests/evidence-freshness.test.mjs",
  "scripts/check-evidence-freshness.mjs",
  "scripts/probe-production.mjs",
  "scripts/build-jev-evidence.mjs",
  "docs/DEPLOY_RUNBOOK.md",
  "package.json",
];

const dir = mkdtempSync(join(tmpdir(), "beco-fmt-"));
const before = new Map();
for (const rel of FILES) {
  const text = readFileSync(join(ROOT, rel), "utf8");
  before.set(rel, { crlf: /\r\n/.test(text), lf: text.replace(/\r\n/g, "\n") });
  writeFileSync(join(dir, rel.replace(/\//g, "__")), before.get(rel).lf, "utf8");
}
try {
  execFileSync(
    "npx",
    ["--yes", "prettier@3.9.6", "--write", "."],
    { cwd: dir, stdio: "inherit", shell: process.platform === "win32" },
  );
  for (const rel of FILES) {
    const fixed = readFileSync(join(dir, rel.replace(/\//g, "__")), "utf8");
    const { crlf, lf } = before.get(rel);
    if (fixed === lf) {
      console.log(`unchanged  ${rel}`);
      continue;
    }
    writeFileSync(
      join(ROOT, rel),
      crlf ? fixed.replace(/\n/g, "\r\n") : fixed,
      "utf8",
    );
    console.log(`reformatted ${rel}${crlf ? " (kept CRLF)" : ""}`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
