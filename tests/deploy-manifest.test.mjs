// The deploy manifest is the release path's ground truth: gates verify what
// `deployList()` returns, staging ships what it stages. Its enumeration must
// therefore be immune to transient working-tree state — the exact mechanism
// behind the 259-vs-353 CI flake, where a filesystem walk silently dropped
// ~92 city pages. These tests pin that immunity with mutation teeth: a stray
// or deleted file in the working tree must not move the contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import {
  existsSync,
  writeFileSync,
  rmSync,
  mkdirSync,
  readFileSync,
} from "node:fs";
import { dirname, join, normalize } from "node:path";
import {
  ALLOWLIST,
  ROOT,
  deployList,
  trackedFiles,
} from "../scripts/lib/deploy-manifest.mjs";

// Runs the CLI the gates actually shell out to, and parses it the same way
// scripts/lib/gates.mjs does.
function cliList() {
  const out = execSync("node scripts/deploy-pages-local.mjs --list", {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== "Deployable files:" && !l.startsWith("--"));
}

test("MANIFEST SIZE: the deploy contract stays within its known envelope", () => {
  const n = deployList().length;
  // 352 at time of writing. A drop means the enumeration broke; a big jump
  // means something unreviewed entered the allowlist dirs.
  assert.ok(n >= 340 && n <= 380, `deploy list = ${n}, expected ~352`);
});
test("MANIFEST CONTENT: every file it names is git-tracked", () => {
  const tracked = trackedFiles();
  for (const f of deployList()) {
    assert.ok(
      tracked.has(f),
      `${f} is deployable but not git-tracked — it would vanish in a fresh checkout`,
    );
  }
});

test("MANIFEST COVERAGE: dir entries account for every tracked file beneath them", () => {
  const tracked = trackedFiles();
  const named = new Set(deployList());
  for (const entry of ALLOWLIST) {
    const isDir = (function isDirEntry(e) {
      // Directory entries are bare names ("assets"); file entries carry a
      // filename with an extension (or a platform dotfile like _headers).
      return (
        !e.includes("/") ||
        ["solar-calculator", "solar-heatmap", "assets"].includes(e)
      );
    })(entry);
    if (!isDir) continue;
    const prefix = entry + "/";
    for (const f of tracked)
      if (f.startsWith(prefix))
        assert.ok(
          named.has(f),
          `tracked file ${f} is under allowlisted dir ${entry} but the manifest omits it`,
        );
  }
});

// The gap only a browser could see, until now. A new first-party module enters
// the manifest the moment it is git-tracked — which the contract above checks
// from the manifest side. Nothing checked the OTHER direction: the entry module
// imports `./share-codec.js`, the file is not tracked yet, the staged build has
// no such URL, the import 404s, and ui.js dies with it. The unit suite stayed
// green (it reads the working tree) while the served calculator was blank.
// This resolves the real ES-module graph from the shipped entry, exactly as a
// browser does, and demands every hop be deployable.
test("IMPORT GRAPH: every module the shipped entry loads is deployable", () => {
  const named = new Set(deployList());
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const entryMatch = html.match(
    /<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/i,
  );
  assert.ok(entryMatch, "index.html must load a type=module entry");
  const entry = entryMatch[1].replace(/^\.?\//, "").split("?")[0];

  const queue = [entry];
  const seen = new Set();
  const missing = [];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (!named.has(file)) missing.push(file);
    if (!existsSync(join(ROOT, file))) continue;
    const src = readFileSync(join(ROOT, file), "utf8");
    // Static + dynamic imports, and module workers. Only relative specifiers
    // are ours: a bare or absolute URL is served by someone else.
    // Static imports/exports resolve against the importing module; a Worker
    // URL resolves against the DOCUMENT (ui.js spawns
    // "./assets/js/sizing/sizing-worker.js", which is page-relative, not
    // module-relative). Both are walked, each with its own base.
    const moduleSpecs = [
      ...src.matchAll(
        /^\s*(?:import|export)\s[^;]*?from\s*["']([^"'\n]+)["']/gm,
      ),
      ...src.matchAll(/import\s*\(\s*["']([^"'\n]+)["']\s*\)/g),
    ].map((m) => m[1]);
    const workerSpecs = [
      ...src.matchAll(/new\s+Worker\s*\(\s*["']([^"'\n]+)["']/g),
    ].map((m) => m[1]);
    const clean = (p) => normalize(p).split("\\").join("/");
    for (const spec of moduleSpecs) {
      if (!spec.startsWith(".")) continue;
      queue.push(clean(join(dirname(file), spec.split("?")[0])));
    }
    for (const spec of workerSpecs) {
      if (!spec.startsWith(".")) continue;
      queue.push(clean(spec.split("?")[0]));
    }
  }
  assert.ok(
    seen.size > 20,
    `the entry graph resolved (${seen.size} modules) — a broken walk proves nothing`,
  );
  assert.deepEqual(
    missing,
    [],
    `module(s) the shipped entry loads but the manifest omits: ${missing.join(", ")}`,
  );
});

test("MUTATION TOOTH: a stray untracked file cannot enter the contract", () => {
  const stray = "assets/js/STRAY-MUTATION-CHECK.tmp";
  writeFileSync(join(ROOT, stray), "transient");
  try {
    assert.ok(
      !deployList().includes(stray),
      "untracked file leaked into the deploy list",
    );
  } finally {
    rmSync(join(ROOT, stray), { force: true });
  }
});

test("MUTATION TOOTH: an untracked file inside a nested dir cannot enter either", () => {
  const dir = "assets/js/sizing/STRAY-MUTATION-DIR";
  mkdirSync(join(ROOT, dir), { recursive: true });
  const stray = dir + "/x.json";
  writeFileSync(join(ROOT, stray), "{}");
  try {
    assert.ok(
      !deployList().some((f) => f.startsWith(dir)),
      "untracked nested file leaked into the deploy list",
    );
  } finally {
    rmSync(join(ROOT, dir), { recursive: true, force: true });
  }
});

test("MUTATION TOOTH: a deleted-but-tracked file fails loudly, not silently", () => {
  // The index still names the file, so the contract keeps it — but the copy
  // step would ENOENT. That must be a hard error, never a smaller site.
  const victim = "robots.txt";
  const backup = execSync(`git cat-file blob HEAD:${victim}`, {
    cwd: ROOT,
    encoding: "utf8",
  });
  rmSync(join(ROOT, victim), { force: true });
  try {
    assert.ok(
      deployList().includes(victim),
      "a working-tree deletion must not shrink the manifest (index is the truth)",
    );
    assert.throws(
      () =>
        execSync("test -f " + victim, {
          cwd: ROOT,
          shell: true,
        }),
      "the file must really be gone from the working tree during this test",
    );
  } finally {
    writeFileSync(join(ROOT, victim), backup);
  }
});

test("CLI PARITY: --list output equals deployList() exactly", () => {
  const cli = cliList();
  const manifest = deployList();
  if (cli.length !== manifest.length || cli.some((f, i) => f !== manifest[i])) {
    // Name the first divergence — a full 350-line deepEqual dump hid the
    // shape (a lost middle window of piped stdout) for two CI runs.
    const first = manifest.findIndex((f, i) => f !== cli[i]);
    assert.fail(
      `--list diverges from deployList() at index ${first}: cli=${JSON.stringify(cli[first])} manifest=${JSON.stringify(manifest[first])} (cli ${cli.length} vs manifest ${manifest.length})`,
    );
  }
  assert.deepEqual(cli, manifest);
});

// process.exit() does not wait for a piped stdout to flush — under runner
// load it drops arbitrary middle chunks of the write queue, and gates.mjs
// parses exactly that pipe. The enumeration itself is double-read-guarded;
// this pin closes the OUTPUT side of the same corruption class (the
// FR..KP slice CLI PARITY caught twice in one day).
test("PIN: the deploy CLI never exits before its piped stdout drains", () => {
  const src = readFileSync("scripts/deploy-pages-local.mjs", "utf8");
  assert.doesNotMatch(
    src,
    /process\.exit/,
    "deploy-pages-local.mjs must end every branch naturally so stdout drains",
  );
});
