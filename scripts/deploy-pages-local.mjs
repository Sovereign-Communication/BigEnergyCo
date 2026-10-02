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
import {
  cpSync,
  mkdirSync,
  rmSync,
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { labTransform } from "./lib/lab-build.mjs";
import {
  API_TARGET_FILES,
  apiTarget,
  apiTargetTransform,
  assertNoDefaultRemains,
} from "./lib/api-target.mjs";
import { withMutationLock } from "./lib/mutation-lock.mjs";
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
// Lab builds strip `/next/`'s noindex in the staged tree so the SEO audit can
// see the preview (plan §8 P0.4). Refused on a push: a deploy that carried the
// strip would publish an unreleased app as indexable.
const LAB = process.argv.includes("--lab");
if (LAB && !CHECK)
  throw new Error(
    "--lab is a staging-only flag; it cannot be combined with a push",
  );

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
//
// Every branch below ends NATURALLY — the process must never be torn down
// mid-stream. The gates parse this script's piped stdout (gates.mjs, the
// CLI-parity test), and a hard process exit does not wait for a pipe to
// flush: under runner load it drops arbitrary middle chunks of the write
// queue (the FR..KP slice the CLI-parity test caught twice in one day).
// Natural exit drains stdout.
if (LIST) {
  console.log("Deployable files:");
  for (const f of deployList()) console.log("  " + f);
  console.log("\n--list: allowlist only, nothing staged, not pushing.");
} else {
  console.log(
    `Staging ${deployList().length} manifest files into ${STAGE.replace(ROOT + "/", "")}/ ...`,
  );
  rmSync(STAGE, { recursive: true, force: true });
  // The lock is taken HERE, in the one component every staging build goes
  // through, rather than in each test that happens to call it. Three separate
  // test files were patched one at a time before this, and the fourth reader
  // still raced: `tests/deploy-manifest.test.mjs` briefly deletes robots.txt
  // at the repo root, and a concurrent staging build ENOENTs on it. Excluding
  // the mutation at the reader is the fix that stops needing to remember.
  await withMutationLock(async () => {
    for (const f of deployList()) {
      const dest = join(STAGE, f);
      mkdirSync(dirname(dest), { recursive: true });
      cpSync(join(ROOT, f), dest);
    }
  }, ROOT);

  // API endpoint, from ONE source of truth (scripts/lib/api-target.mjs).
  //
  // Unset — the default — means this loop does nothing at all, and the staged
  // tree is byte-for-byte the build that has always shipped. Setting
  // BEC_API_BASE retargets the client endpoint AND the CSP `connect-src` entry
  // that permits it, together, so a showcase build can reach its own worker
  // without anyone hand-editing this generated directory: that edit used to
  // survive exactly one `deploy:check`, after which a second showcase deploy
  // would have quietly retargeted the live advisor.
  //
  // The origin lives in configuration, never in tracked client source, so this
  // file has no idea what a showcase is.
  const target = apiTarget();
  if (!target.isDefault) {
    const rewritten = [];
    for (const f of deployList()) {
      const dest = join(STAGE, f);
      const r = apiTargetTransform(f, readFileSync(dest, "utf8"), target.base);
      if (r.changed) {
        writeFileSync(dest, r.text);
        rewritten.push(f);
      }
    }
    // Refuse to publish a half-retargeted build: a site that looks configured
    // while still calling production is the exact failure this prevents.
    assertNoDefaultRemains(
      API_TARGET_FILES.filter((f) => !rewritten.includes(f)),
      target.base,
    );
    console.log(
      `API target: staged build points at ${target.base} ` +
        `(${rewritten.length} file(s): ${rewritten.join(", ")}).`,
    );
  }

  // Lab builds only (plan §8 P0.4): the `/next/` preview is noindex until the
  // P8 swap, and a noindexed page is excluded from SEO evaluation, so the
  // quality pass could not measure it. `--lab` removes the tag from the STAGED
  // tree the gates audit. It is never applied on the push path below, because
  // the push path is a deploy and a deploy must never carry an indexable
  // preview of an unreleased app. The transform itself also refuses any path
  // outside `/next/`; see scripts/lib/lab-build.mjs for why that is enforced
  // twice rather than once.
  if (LAB) {
    let stripped = 0;
    for (const f of deployList()) {
      const dest = join(STAGE, f);
      const r = labTransform(f, readFileSync(dest, "utf8"));
      if (r.changed) {
        writeFileSync(dest, r.html);
        stripped += 1;
      }
    }
    console.log(
      `Lab build: removed noindex from ${stripped} /next/ page(s) in the STAGED tree only. Not pushed.`,
    );
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
  } else {
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
  }
}
