// Local GitHub Pages deployment (no GitHub Actions required).
//
// Builds the SAME allowlist as .github/workflows/deploy.yml and force-pushes
// it as a single orphan commit to the `gh-pages` branch. Point Pages source
// at gh-pages /root (legacy builder) while Actions is unavailable; when the
// billing lock is lifted, switch back to build_type=workflow and delete this
// branch.
//
// Usage: node scripts/deploy-pages-local.mjs [--check] [--list] [--stage <dir>]
//   --check: build only, print contents, do not push (deploy.yml and the
//     smoke harness rely on this BUILDING the staging dir)
//   --list: print the same file list without building anything — a pure query
//     for the gates, so several of them can ask concurrently without racing on
//     a shared staging directory
//   --stage <dir>: staging directory (default _pages_staging). The GitHub
//     workflow reuses this same script with --stage _pages, so the manifest
//     module is the SINGLE source of truth for both deploys.
import { cpSync, mkdirSync, rmSync, readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import {
  ALLOWLIST,
  ROOT,
  allowedTop,
  deployList,
} from "./lib/deploy-manifest.mjs";

const stageIdx = process.argv.indexOf("--stage");
const STAGE = join(
  ROOT,
  stageIdx >= 0 && process.argv[stageIdx + 1]
    ? process.argv[stageIdx + 1]
    : "_pages_staging",
);
const CHECK = process.argv.includes("--check");
const LIST = process.argv.includes("--list");

function sh(cmd, opts = {}) {
  return execSync(cmd, {
    cwd: ROOT,
    stdio: opts.quiet ? "pipe" : "inherit",
    encoding: "utf8",
  });
}

// Walks the STAGED tree for the build report — deliberately a directory walk
// here, because printing what was actually copied (not what we intended to
// copy) is what lets the QUERY test catch a silently incomplete copy.
function listFiles(dir, prefix = "") {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) listFiles(p, prefix + name + "/");
    else console.log("  " + prefix + name);
  }
}

// ── pure query: what would ship? ────────────────────────────────────────────
// No staging directory is touched, so any number of gates can ask at once.
// The set comes from the git-index-derived manifest — identical to a real
// build's by construction (both copy exactly these sources) — and the
// ORDER follows ALLOWLIST; consumers build sets.
if (LIST) {
  console.log("Deployable files:");
  for (const f of deployList()) console.log("  " + f);
  console.log("\n--list: allowlist only, nothing staged, not pushing.");
  process.exit(0);
}

console.log(
  `Staging ${deployList().length} manifest files into ${STAGE.replace(ROOT + "/", "")}/ ...`,
);
rmSync(STAGE, { recursive: true, force: true });
for (const f of deployList()) {
  const dest = join(STAGE, f);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(join(ROOT, f), dest);
}

// Safety net: the staged tree must contain only what the allowlist put there.
for (const name of readdirSync(STAGE)) {
  if (!allowedTop.has(name))
    throw new Error(`Unexpected file in staging: ${name}`);
}

console.log("Deployable files:");
listFiles(STAGE);

if (CHECK) {
  console.log("\n--check: built staging only, not pushing.");
  process.exit(0);
}

console.log("\nCreating orphan commit on gh-pages ...");
const idxFile = join(ROOT, ".git", "pages-index-tmp");
const idxEnv = {
  ...process.env,
  GIT_INDEX_FILE: idxFile,
  GIT_WORK_TREE: STAGE,
};
execSync("git add -A", { cwd: ROOT, env: idxEnv, stdio: "pipe" });
const tree = execSync("git write-tree", {
  cwd: ROOT,
  env: idxEnv,
  encoding: "utf8",
}).trim();
const commitEnv = { ...process.env };
delete commitEnv.GIT_INDEX_FILE;
delete commitEnv.GIT_WORK_TREE;
const commit = execSync(
  `git commit-tree ${tree} -m "Publish site (local allowlist build, ${new Date().toISOString()})"`,
  {
    cwd: ROOT,
    env: commitEnv,
    encoding: "utf8",
  },
).trim();
rmSync(idxFile, { force: true });

console.log(`Commit ${commit.slice(0, 10)} -> refs/heads/gh-pages (force)`);
sh(`git push origin ${commit}:refs/heads/gh-pages --force`);
console.log(
  "\nPushed. If Pages source = gh-pages /root, the site updates in ~30-60s.",
);
