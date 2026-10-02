// Provisioning gate for the Cloudflare showcase worker.
//
// Usage: node scripts/cf-provision-check.mjs [--json]
//
// Fails (exit 1) when worker/wrangler.json still carries REPLACE_WITH_*
// placeholders, printing the exact provisioning checklist from
// docs/cloudflare-showcase.md. Passes when every binding is real.
// This is the fail-loud counterpart to the worker's runtime 503
// provisioning errors: CI catches the missing step before deploy does.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WRANGLER = join(ROOT, "worker", "wrangler.json");

const PLACEHOLDERS = [
  {
    key: "REPLACE_WITH_KV_NAMESPACE_ID",
    step: "KV: wrangler kv namespace create SHARE_KV (and --preview), paste both ids",
  },
  {
    key: "REPLACE_WITH_D1_DATABASE_ID",
    step: "D1: wrangler d1 create bigenergyco-usage-showcase, paste id (+ preview id)",
  },
  {
    key: "REPLACE_WITH_TURNSTILE_SITE_KEY",
    step: "Turnstile: Cloudflare dashboard -> Turnstile -> add site, paste site key; then wrangler secret put TURNSTILE_SECRET_KEY",
  },
];

// Exported so a test can pin the list: this gate's whole job is to name the
// exact provisioning steps CI cannot see, and B5 was a secret that lived only
// in a PR description instead of here.
export const REQUIRED_SECRETS = [
  {
    name: "TURNSTILE_SECRET_KEY",
    step: "wrangler secret put TURNSTILE_SECRET_KEY (dashboard: Turnstile -> site -> secret key)",
  },
  {
    name: "GROQ_API_KEY",
    step: "wrangler secret put GROQ_API_KEY (already set on the production worker)",
  },
  {
    name: "TYPESAFE_API_KEY",
    step: "wrangler secret put TYPESAFE_API_KEY (the Jev truthfulness wire; same value as production)",
  },
];

// Local alias kept so the rest of this file reads unchanged.
const SECRETS = REQUIRED_SECRETS;

export function checkProvisioning(wranglerJsonText) {
  const missing = [];
  for (const p of PLACEHOLDERS) {
    if (wranglerJsonText.includes(p.key)) missing.push(p);
  }
  return missing;
}

function main() {
  const asJson = process.argv.includes("--json");
  if (!existsSync(WRANGLER)) {
    console.error("worker/wrangler.json not found");
    process.exit(2);
  }
  const text = readFileSync(WRANGLER, "utf8");
  const missing = checkProvisioning(text);
  const result = {
    ok: missing.length === 0,
    missingBindings: missing.map((m) => m.key),
    missingSecrets: SECRETS.map((s) => s.name),
    note: "Secrets cannot be checked from the repo; set them with wrangler secret put.",
  };
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.ok) {
    console.log("cf-provision-check: all wrangler.json bindings are real.");
    console.log(
      "Remember secrets (not visible here): " +
        SECRETS.map((s) => s.name).join(", "),
    );
  } else {
    console.log("cf-provision-check: UNPROVISIONED bindings remain:");
    for (const m of missing) console.log(`  - ${m.key}\n      -> ${m.step}`);
    console.log("Secrets to set (wrangler secret put):");
    for (const s of SECRETS) console.log(`  - ${s.name}\n      -> ${s.step}`);
    console.log("Full checklist: docs/cloudflare-showcase.md");
  }
  process.exit(result.ok ? 0 : 1);
}

// Import-safe: the test suite imports checkProvisioning without running main.
const invokedDirectly =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) main();
