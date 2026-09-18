// Verify the DEPLOYED staging artifact — through the surface users actually
// hit, not a localhost copy.
//
// Why this exists: `smoke:local` proves the build in the repo works, and the
// staging-drift probes prove five files match. Neither answers the question a
// promote depends on: "is what staging serves exactly what main built, and does
// it work in a real browser?" So this verifier:
//
//   1. STAMP  — the served HTML declares one asset stamp, and it is the stamp
//               the checkout produces. A missing or mixed stamp fails here.
//   2. PARITY — every file in the deploy allowlist is fetched from staging and
//               byte-compared (line-ending normalized) with the local build.
//               A 404 (missing asset) or any difference fails, so a partial or
//               stale deploy cannot look green. HTML on a surface that is known
//               to rewrite it at the edge (Cloudflare's email obfuscation) is
//               compared in a canonical form that undoes exactly that rewrite
//               — reported as a tolerated rewrite, never hidden — so any other
//               byte still has to match.
//   3. SURFACE— platform expectations: `_headers`/`_redirects` are inert files
//               on GitHub Pages (200) and are CONSUMED by Cloudflare (404). On
//               Cloudflare the security headers are required for real
//               (including script-src without 'unsafe-inline'); on GitHub Pages
//               they are reported as unavailable BY DESIGN, never as a pass.
//   4. BROWSER— the approved real-browser smoke runs against the staging URL
//               (a full sizing flow, the heatmap, the service worker, and a
//               no-CSP-violations gate).
//
// Usage:
//   node scripts/verify-staging.mjs [--base <url>] [--no-browser] [--json]
//                                   [--wait <seconds>] [--surface <name>]
// Environment: STAGING_BASE overrides the default base.
//
// `--surface` overrides what the URL is assumed to be, for checking a local
// stand-in against the production policy. It only ever ADDS assertions (a
// stricter surface against a lax URL fails), so it cannot be used to fake a
// pass; the default is inferred from the URL.
//
// Exit: 0 = verified, 1 = verification failed, 2 = could not verify.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { deployedFiles, securityPolicyVerdict } from "./lib/gates.mjs";
import { exitWhenDrained } from "./lib/graceful-exit.mjs";
import { canonicalizeHtml } from "./lib/platform-rewrites.mjs";
import {
  artifactStamp,
  normalizeText,
  platformSpecialFiles,
  sha256,
  surfaceFor,
} from "./lib/stamps.mjs";

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const JSON_MODE = process.argv.includes("--json");
const SKIP_BROWSER = process.argv.includes("--no-browser");
const WAIT_SECONDS = Number(arg("--wait", "0")) || 0;
const BASE = (arg("--base") || process.env.STAGING_BASE || "").trim();
const BASE_URL =
  BASE || "https://sovereign-communication.github.io/BigEnergyCo/";
const base = BASE_URL.endsWith("/") ? BASE_URL : BASE_URL + "/";

const SURFACES = ["gh-pages", "cloudflare", "local"];
const SURFACE_ARG = arg("--surface", null);
if (SURFACE_ARG && !SURFACES.includes(SURFACE_ARG)) {
  // Nothing has touched the network yet, so failing hard is safe and honest.
  console.error(
    `FAIL unknown --surface ${SURFACE_ARG} — expected one of ${SURFACES.join(", ")}`,
  );
  process.exit(2);
}
const SURFACE = SURFACE_ARG || surfaceFor(base);
const CONCURRENCY = 8;
const FETCH_TIMEOUT_MS = 30000;

const failures = [];
const notes = [];
const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
  if (!JSON_MODE)
    console.log(
      (ok ? "VERIFY OK  " : "VERIFY FAIL") +
        ` ${name}` +
        (detail ? ` — ${detail}` : ""),
    );
};

const fetchText = async (url) => {
  const res = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  return {
    status: res.status,
    ok: res.ok,
    text: res.ok ? await res.text() : "",
  };
};

/** Bust caches with a query that cannot collide with a real file. */
const probeUrl = (path) =>
  `${base}${path}${path.includes("?") ? "&" : "?"}verify=${Date.now()}`;

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    },
  );
  await Promise.all(workers);
  return out;
}

// ── 1. the checkout's stamp ─────────────────────────────────────────────────
const files = deployedFiles();
if (!files.length) {
  // Safe to exit hard here: nothing has touched the network yet.
  console.error(
    "FAIL could not read the deploy allowlist — refusing to verify",
  );
  process.exit(2);
}
const expected = artifactStamp(readFileSync("index.html", "utf8"));
if (!expected.ok) {
  record(
    "checkout declares exactly one asset stamp",
    false,
    expected.mixed
      ? `mixed stamps: ${expected.all.join(", ")}`
      : "no ?v= stamp found",
  );
} else {
  record("checkout declares exactly one asset stamp", true, expected.stamp);
}

// ── 2. the served page declares the same stamp ──────────────────────────────
let served = null;
const fetchHome = async () => {
  // A network failure is a verification failure, not a crash: an uncaught
  // AbortSignal timeout used to kill the run with a stack trace and no report.
  try {
    const r = await fetchText(probeUrl(""));
    if (!r.ok)
      return { ok: false, reason: `HTTP ${r.status}`, status: r.status };
    return { ok: true, stamp: artifactStamp(r.text), html: r.text };
  } catch (e) {
    return { ok: false, reason: `network: ${e.message}` };
  }
};

if (expected.ok) {
  const deadline = Date.now() + WAIT_SECONDS * 1000;
  do {
    served = await fetchHome();
    if (served.ok && served.stamp.stamp === expected.stamp) break;
    if (Date.now() >= deadline) break;
    if (!JSON_MODE)
      console.log(
        `VERIFY       waiting for ${base} to serve stamp ${expected.stamp} (${served.ok ? served.stamp.stamp || "none" : served.reason}) ...`,
      );
    await new Promise((r) => setTimeout(r, 15000));
  } while (Date.now() < deadline);

  if (!served.ok) {
    record("staging serves a page", false, served.reason);
  } else if (!served.stamp.ok) {
    record(
      "staging serves a single asset stamp",
      false,
      served.stamp.all.length ? served.stamp.all.join(", ") : "none",
    );
  } else if (served.stamp.stamp !== expected.stamp) {
    record(
      "staging serves the checkout's stamp",
      false,
      `staging ${served.stamp.stamp} vs checkout ${expected.stamp} — staging is stale or the wrong artifact was deployed`,
    );
  } else {
    record("staging serves the checkout's stamp", true, expected.stamp);
  }
}

// ── 3. full parity: every deployed file, byte for byte ──────────────────────
const special = platformSpecialFiles(SURFACE);
const parityTargets = files.filter((f) => !(f in special));
// Text files are compared after line-ending normalization (a Windows checkout
// is CRLF, the CI build is LF); binary files are compared as raw bytes, where
// any utf8 round-trip would be lossy on both sides and hide a real difference.
const TEXT_FILE =
  /\.(html|js|mjs|css|txt|xml|json|jsonl|webmanifest|svg|md|csv|yml|yaml)$/i;
const isText = (f) =>
  TEXT_FILE.test(f) || f === "_headers" || f === "_redirects";

const HTML_FILE = /\.html$/i;

const parity = await mapPool(parityTargets, CONCURRENCY, async (file) => {
  const localBuf = readFileSync(file);
  let res;
  try {
    res = await fetch(probeUrl(file), {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (e) {
    return { file, state: "network", detail: e.message };
  }
  if (!res.ok) return { file, state: "missing", detail: `HTTP ${res.status}` };

  // HTML on a rewriting surface: bring both sides into one canonical form that
  // undoes exactly the edge rewrite we have observed, and nothing else. The
  // rewrites tolerated for this file travel with the result so the report can
  // state them rather than implying the bytes matched.
  if (HTML_FILE.test(file) && SURFACE === "cloudflare") {
    const local = canonicalizeHtml(localBuf.toString("utf8"), SURFACE);
    const served = canonicalizeHtml(await res.text(), SURFACE);
    const localHash = sha256(local.text);
    const servedHash = sha256(served.text);
    if (localHash !== servedHash)
      return {
        file,
        state: "differs",
        detail: `local ${localHash.slice(0, 8)} vs served ${servedHash.slice(0, 8)}`,
        rewrites: served.tolerated,
      };
    return { file, state: "match", rewrites: served.tolerated };
  }

  const text = isText(file);
  const localHash = text
    ? sha256(normalizeText(localBuf.toString("utf8")))
    : sha256(localBuf.toString("binary"));
  const servedHash = text
    ? sha256(normalizeText(await res.text()))
    : sha256(Buffer.from(await res.arrayBuffer()).toString("binary"));
  if (localHash !== servedHash)
    return {
      file,
      state: "differs",
      detail: `local ${localHash.slice(0, 8)} vs served ${servedHash.slice(0, 8)}`,
    };
  return { file, state: "match" };
});

const bad = parity.filter((p) => p.state !== "match");
if (bad.length)
  for (const b of bad.slice(0, 12))
    record(`parity ${b.file}`, false, `${b.state}: ${b.detail}`);
else record(`parity: all ${parity.length} deployed files match`, true);
if (bad.length > 12)
  record(`parity: ${bad.length - 12} more file(s) differ`, false, "");

// What the comparison had to forgive, stated out loud. If a later platform
// change rewrites something we do not know about, it shows up here as a
// failure instead of being quietly absorbed.
const rewritten = parity.filter((p) => p.rewrites?.length);
const rewriteKinds = [...new Set(rewritten.flatMap((p) => p.rewrites))].sort();
if (rewritten.length) {
  const note = `surface ${SURFACE}: tolerated the edge rewrite of ${rewritten.length} HTML file(s) — ${rewriteKinds.join(", ")} — every other byte still had to match`;
  notes.push(note);
  if (!JSON_MODE) console.log(`VERIFY NOTE  ${note}`);
}

// Platform-owned files: assert the surface behaves the way it must, so a
// platform change (Pages starting to consume _headers, say) is noticed here.
for (const [file, want] of Object.entries(special)) {
  // A local server is not a platform: no rule to assert, so do not pretend.
  if (want === "informational") {
    notes.push(
      `surface ${SURFACE}: ${file} is not asserted (no platform involved)`,
    );
    if (!JSON_MODE) console.log(`VERIFY NOTE  ${notes[notes.length - 1]}`);
    continue;
  }
  let status = 0;
  try {
    const res = await fetch(probeUrl(file), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    status = res.status;
  } catch (e) {
    record(`surface ${file}`, false, `network: ${e.message}`);
    continue;
  }
  const got =
    status === 200 ? "present" : status === 404 ? "absent" : `HTTP ${status}`;
  record(
    `surface ${SURFACE}: ${file} is ${want}`,
    got === want,
    got === want ? "" : `expected ${want}, got ${got}`,
  );
}

// ── 4. security headers, surface-aware ──────────────────────────────────────
let homeRes;
try {
  homeRes = await fetch(base, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
} catch (e) {
  record("security headers readable", false, `network: ${e.message}`);
  homeRes = { headers: new Headers() };
}
// The policy the surface owes us, from the pure helper the tests drive
// directly — so "a dropped directive fails" is provable without a network.
const policy = securityPolicyVerdict(SURFACE, (name) =>
  homeRes.headers.get(name),
);
for (const c of policy.checks) record(c.name, c.ok, c.detail);
for (const n of policy.notes) {
  notes.push(n);
  if (!JSON_MODE) console.log(`VERIFY NOTE  ${n}`);
}

// ── 5. the real browser, against this exact URL ─────────────────────────────
if (SKIP_BROWSER) {
  notes.push(
    "browser smoke skipped (--no-browser): functional proof is missing",
  );
  if (!JSON_MODE) console.log(`VERIFY NOTE  ${notes[notes.length - 1]}`);
} else {
  if (!JSON_MODE)
    console.log(`VERIFY       real-browser smoke against ${base} ...`);
  try {
    const out = execFileSync(
      process.execPath,
      ["scripts/browser-smoke.mjs", base],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 15 * 60 * 1000,
      },
    );
    record("real-browser smoke passes on staging", true, tail(out));
  } catch (e) {
    const out = `${e.stdout || ""}${e.stderr || ""}`;
    const failed = out
      .split("\n")
      .filter((l) => l.includes("SMOKE FAIL"))
      .map((l) => l.replace(/^.*SMOKE FAIL\s*/, "").trim());
    record(
      "real-browser smoke passes on staging",
      false,
      failed.length ? failed.slice(0, 6).join(" | ") : tail(out) || e.message,
    );
  }
}

function tail(s, lines = 3) {
  const arr = String(s).trim().split("\n").filter(Boolean);
  return arr.slice(-lines).join(" / ").slice(0, 300);
}

// ── summary ─────────────────────────────────────────────────────────────────
const payload = {
  base,
  surface: SURFACE,
  expectedStamp: expected.ok ? expected.stamp : null,
  servedStamp: served && served.ok ? (served.stamp.stamp ?? null) : null,
  filesChecked: parity.length,
  matched: parity.filter((p) => p.state === "match").length,
  // Not a footnote: the canonical comparison and what it forgave, so "parity
  // passed" can never be read as "every byte is identical" when it is not.
  platformRewrites: { files: rewritten.length, kinds: rewriteKinds },
  failures,
  notes,
  verified: failures.length === 0,
};

if (JSON_MODE) console.log(JSON.stringify(payload, null, 2));
else {
  console.log(
    failures.length
      ? `\nSTAGING VERIFICATION FAILED (${failures.length}): ${failures.slice(0, 5).join(" ; ")}`
      : `\nSTAGING VERIFIED — ${base} serves stamp ${payload.servedStamp}, ${payload.matched}/${payload.filesChecked} files match` +
          (rewritten.length
            ? ` (${rewritten.length} HTML file(s) compared with the edge's email obfuscation canonicalised; everything else byte-identical)`
            : " byte-identical to the checkout"),
  );
}
// Drain before exiting: this process has just fetched hundreds of files, and
// process.exit() mid-close aborts libuv on Windows, losing the verdict.
exitWhenDrained(failures.length ? 1 : 0);
