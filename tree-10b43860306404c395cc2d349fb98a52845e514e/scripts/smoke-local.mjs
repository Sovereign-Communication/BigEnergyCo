// Pre-merge browser smoke: build the allowlisted artifact, serve it under the
// real `_headers` policy on a free local port, and drive the approved smoke
// script against it.
//
// This is the gate that stops UI/worker/asset regressions from reaching main.
// It exercises the same code path users get, because it serves the same
// allowlist build the deploy workflows publish — not the working tree.
//
// Usage:
//   npm run smoke:local                  # build + serve + smoke, exit 0/1
//   node scripts/smoke-local.mjs --keep  # leave _pages_smoke/ behind
import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { ROOT, serveStatic } from "./serve-static.mjs";

const KEEP = process.argv.includes("--keep");
const STAGE = join(ROOT, "_pages_smoke");
const SMOKE = join(ROOT, "scripts", "browser-smoke.mjs");

function run(cmd, args, opts = {}) {
  return new Promise((ok) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: "inherit", ...opts });
    child.on("exit", (code) => ok(code ?? 1));
  });
}

const stageCode = await run(process.execPath, [
  join(ROOT, "scripts", "deploy-pages-local.mjs"),
  "--check",
  "--stage",
  "_pages_smoke",
]);
if (stageCode !== 0) {
  console.error("SMOKE FAIL  could not build the allowlisted staging output");
  process.exit(stageCode || 1);
}

if (!existsSync(SMOKE)) {
  console.error(`SMOKE FAIL  missing ${SMOKE}`);
  process.exit(1);
}

const srv = await serveStatic({ dir: STAGE });
console.log(
  `SMOKE       local build served at ${srv.url} (with _headers policy)`,
);

let code = 1;
try {
  code = await run(process.execPath, [SMOKE, srv.url]);
} finally {
  await srv.close();
  if (!KEEP) rmSync(resolve(STAGE), { recursive: true, force: true });
}

console.log(
  code === 0
    ? `\nLOCAL BROWSER SMOKE PASSED (${srv.url})`
    : "\nLOCAL BROWSER SMOKE FAILED — see the gates above",
);
process.exit(code);
