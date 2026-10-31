// Full-surface parity probe: every file the deploy manifest names, fetched from
// the Pages production base and compared byte-for-byte against the git index
// blob of the working tree's HEAD. Prints a per-file verdict and a summary.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
const { deployList } = await import(
  pathToFileURL("C:/tmp/gate-freshness/scripts/lib/deploy-manifest.mjs").href,
);

const BASE = process.argv[2] || "https://bigenergyco.pages.dev";
const ROOT = "C:/tmp/gate-freshness";
const sha = (b) => createHash("sha256").update(b).digest("hex");

const list = deployList();
// local blob bytes, from the git index/HEAD, not the working tree
const local = new Map();
for (const p of list) {
  try {
    const buf = execFileSync("git", ["show", `HEAD:${p}`], {
      cwd: ROOT,
      maxBuffer: 64 * 1024 * 1024,
    });
    local.set(p, sha(buf));
  } catch (e) {
    local.set(p, `ERR:${e.status}`);
  }
}

const mismatches = [];
const errors = [];
let matched = 0;
let i = 0;
const workers = Array.from({ length: 10 }, async () => {
  while (i < list.length) {
    const p = list[i++];
    try {
      const r = await fetch(`${BASE}/${p}`, { redirect: "follow" });
      if (!r.ok) {
        errors.push(`${p}: HTTP ${r.status}`);
        continue;
      }
      const buf = Buffer.from(await r.arrayBuffer());
      if (sha(buf) === local.get(p)) matched += 1;
      else mismatches.push(`${p}: remote ${sha(buf).slice(0, 12)} vs local ${String(local.get(p)).slice(0, 12)}`);
    } catch (e) {
      errors.push(`${p}: ${e.message}`);
    }
  }
});
await Promise.all(workers);

console.log(`base: ${BASE}`);
console.log(`files: ${list.length}, matched: ${matched}, mismatched: ${mismatches.length}, errors: ${errors.length}`);
for (const m of mismatches.slice(0, 20)) console.log("DIFF " + m);
for (const e of errors.slice(0, 20)) console.log("ERR  " + e);
