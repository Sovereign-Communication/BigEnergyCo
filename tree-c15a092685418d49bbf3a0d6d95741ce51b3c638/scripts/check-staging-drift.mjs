// Staging-drift detector: does GitHub Pages serve what main actually builds?
//
// The Pages deploy is a queued workflow; when hosted runners saturate it can
// lag behind main indefinitely — and a smoke of staging would then silently
// verify a STALE build (nothing else notices). This script stages the deploy
// allowlist from the local checkout (same single source of truth as CI's
// deploy job), hashes a probe set of site files, and byte-compares them
// against the live Pages URL. Any difference — or a 404 — means main and
// staging have diverged.
//
// Usage:
//   node scripts/check-staging-drift.mjs            # check, exit 0/1
//   node scripts/check-staging-drift.mjs --json     # machine-readable
//
// Exit codes: 0 = in sync (or unavoidable-network failure in --json mode),
// 1 = drift detected (or hard failure).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join, posix, resolve } from "node:path";

const PAGES_BASE =
  process.env.STAGING_BASE ||
  "https://sovereign-communication.github.io/BigEnergyCo/";
const JSON_MODE = process.argv.includes("--json");

let failures = 0;
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failures++;
  if (!JSON_MODE)
    console.log(
      (ok ? "STAGE OK   " : "STAGE DRIFT") +
        " " +
        name +
        (detail ? " — " + detail : ""),
    );
}

// 1. Stage the allowlist exactly like the deploy job does.
//    deploy-pages-local.mjs resolves --stage relative to the repo root, so
//    the stage dir must be repo-relative (same pattern as CI's --stage _pages).
const stage = "_pages_drift_stage";
rmSync(resolve(stage), { recursive: true, force: true }); // clear crash residue
execFileSync(
  process.execPath,
  [join("scripts", "deploy-pages-local.mjs"), "--check", "--stage", stage],
  { stdio: "pipe" },
);

// 2. Probe set: files that prove the CURRENT implementation is what serves.
//    Version-agnostic on purpose — the token changes every release, so probe
//    the tokenLESS asset URLs Pages serves, plus structural markers in HTML.
const html = readFileSync(join(stage, "index.html"), "utf8");
const flat = html.replace(/\s+/g, " ");

const probes = [
  { name: "index.html served", path: "", localPath: join(stage, "index.html") },
  {
    name: "ui.js served (router fix present)",
    path: "assets/js/sizing/ui.js",
    localPath: join(stage, "assets/js/sizing/ui.js"),
    mustContain: "isAutoMode",
  },
  {
    name: "budget-span.js served",
    path: "assets/js/sizing/budget-span.js",
    localPath: join(stage, "assets/js/sizing/budget-span.js"),
    mustContain: "surplusAnchor",
  },
  {
    name: "run.js served (envelope diagnosis present)",
    path: "assets/js/sizing/run.js",
    localPath: join(stage, "assets/js/sizing/run.js"),
    mustContain: "envelope-limited",
  },
  {
    name: "sw.js served",
    path: "sw.js",
    localPath: join(stage, "sw.js"),
  },
];

// Loading-pipeline markers prove the responsiveness build is live.
// (budget-span.js is deliberately absent here: ui.js imports it as a module;
// the dedicated probe below covers it.)
for (const marker of ['id="loadingPipeline"', 'id="speedNote"']) {
  const ok = flat.includes(marker) || html.includes(marker);
  results.push({ name: `index.html marker: ${marker}`, ok, detail: "" });
  if (!ok) failures++;
  if (!JSON_MODE)
    console.log(
      (ok ? "STAGE OK   " : "STAGE DRIFT") + ` index.html marker: ${marker}`,
    );
}

for (const probe of probes) {
  if (!existsSync(probe.localPath)) {
    check(probe.name, false, "missing from local allowlist build");
    continue;
  }
  const local = readFileSync(probe.localPath, "utf8");
  let served;
  try {
    const url = new URL(posix.join(PAGES_BASE, probe.path));
    url.searchParams.set("drift", Date.now().toString());
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      check(probe.name, false, `HTTP ${res.status}`);
      continue;
    }
    served = await res.text();
  } catch (e) {
    check(probe.name, false, `network: ${e.message}`);
    continue;
  }
  // Normalize line endings before hashing: a Windows checkout is CRLF while
  // CI's staging build (ubuntu) is LF — the BYTES Pages serves are what
  // matter, not the checkout's autocrlf setting.
  const norm = (s) => s.replace(/\r\n/g, "\n");
  const localHash = createHash("sha256").update(norm(local)).digest("hex");
  const servedHash = createHash("sha256").update(norm(served)).digest("hex");
  if (localHash !== servedHash) {
    check(
      probe.name,
      false,
      `hash differs (local ${localHash.slice(0, 8)} vs served ${servedHash.slice(0, 8)})`,
    );
    continue;
  }
  if (probe.mustContain && !served.includes(probe.mustContain)) {
    check(probe.name, false, `served bytes lack "${probe.mustContain}"`);
    continue;
  }
  check(probe.name, true);
}

rmSync(resolve(stage), { recursive: true, force: true });

if (JSON_MODE) {
  console.log(
    JSON.stringify(
      { inSync: failures === 0, failures, results, pagesBase: PAGES_BASE },
      null,
      2,
    ),
  );
} else if (failures === 0) {
  console.log(
    "\nSTAGING IN SYNC with local main (" + probes.length + " probes)",
  );
} else {
  console.log(
    "\nSTAGING LAGS main: " +
      failures +
      " probe(s) differ. The Pages deploy is queued or stale — do not smoke-verify staging until it catches up.",
  );
}
process.exit(failures === 0 ? 0 : 1);
