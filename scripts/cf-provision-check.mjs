// Provisioning gate for the Cloudflare showcase worker.
//
// Usage: node scripts/cf-provision-check.mjs [--json]
//
// Fails (exit 1) when worker/wrangler.json is missing showcase configuration,
// printing the exact provisioning checklist from docs/cloudflare-showcase.md.
// This is the fail-loud counterpart to the worker's runtime 503
// provisioning errors: CI catches the missing step before deploy does.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WRANGLER = join(ROOT, "worker", "wrangler.json");

const REQUIRED_CONFIGURATION = [
  {
    key: "worker.name",
    step: "Worker: set name to bigenergyco-api-showcase (the isolated showcase worker)",
  },
  {
    key: "SHARE_KV",
    step: "KV: wrangler kv namespace create SHARE_KV (and --preview), paste both ids",
  },
  {
    key: "USAGE_DB",
    step: "D1: wrangler d1 create bigenergyco-usage-showcase, paste id (+ preview id)",
  },
  {
    key: "EVIDENCE_BUCKET",
    step: "R2: create bucket bigenergyco-evidence-showcase and bind it as EVIDENCE_BUCKET",
  },
  {
    key: "TURNSTILE_SITE_KEY",
    step: "Turnstile: Cloudflare dashboard -> Turnstile -> add site, paste site key; then wrangler secret put TURNSTILE_SECRET_KEY",
  },
];

const isRealString = (value) =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  !/(?:REPLACE_WITH|PLACEHOLDER|CHANGEME|TODO|YOUR[_ -])/i.test(value);

const findBinding = (list, name) =>
  Array.isArray(list)
    ? list.find((item) => item && item.binding === name)
    : null;

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
  {
    name: "EVIDENCE_UPLOAD_TOKEN",
    step: "wrangler secret put EVIDENCE_UPLOAD_TOKEN (required to authorize POST /api/evidence uploads)",
  },
];

// Local alias kept so the rest of this file reads unchanged.
const SECRETS = REQUIRED_SECRETS;

export function checkProvisioning(wranglerJsonText) {
  let config;
  try {
    config = JSON.parse(wranglerJsonText);
  } catch {
    return REQUIRED_CONFIGURATION.slice();
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return REQUIRED_CONFIGURATION.slice();
  }

  const kv = findBinding(config.kv_namespaces, "SHARE_KV");
  const d1 = findBinding(config.d1_databases, "USAGE_DB");
  const r2 = findBinding(config.r2_buckets, "EVIDENCE_BUCKET");
  const vars =
    config.vars && typeof config.vars === "object" ? config.vars : {};
  const valid = {
    "worker.name": config.name === "bigenergyco-api-showcase",
    SHARE_KV: !!kv && /^[a-f0-9]{32}$/i.test(kv.id || ""),
    USAGE_DB:
      !!d1 &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        d1.database_id || "",
      ),
    EVIDENCE_BUCKET: !!r2 && isRealString(r2.bucket_name),
    TURNSTILE_SITE_KEY: isRealString(vars.TURNSTILE_SITE_KEY),
  };
  const missing = REQUIRED_CONFIGURATION.filter((item) => !valid[item.key]);
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
    console.log(
      "cf-provision-check: showcase worker configuration is complete.",
    );
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
