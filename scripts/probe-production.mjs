#!/usr/bin/env node
// Probe production: record what the deployed surfaces actually serve.
//
// Usage: node scripts/probe-production.mjs [--no-browser] [--out FILE]
//
// WHY THIS EXISTS. The Jev record used to state, in prose, what production was
// serving ("358/358 byte-identical at servedStamp 20260925c", "PRODUCTION IS
// BEHIND THIS TREE"). Nothing measured it, so the sentence was true on the day
// it was typed and false three releases later, while every gate stayed green —
// and the one surface that could confirm or deny it, bigenergyco.pages.dev, was
// one command away the whole time.
//
// So the fact is measured here and committed as an artifact
// (evidence/production-probe.json), and scripts/check-evidence-freshness.mjs
// refuses a record whose production block disagrees with it or whose stamp no
// longer describes this tree. Re-running this script is how the claim is
// refreshed; it is not run by CI, because it measures a deployment rather than
// building one.
//
// TWO SURFACES, MEASURED AS FAR AS EACH CAN BE:
//
//   bigenergyco.pages.dev — the Pages deployment itself. Everything is
//     measurable by a non-browser client: the served asset stamp, byte parity
//     over the whole deploy allowlist (edge rewrites canonicalised), the
//     platform surface rules, and a real-browser smoke of the app.
//
//   freeoffgridcalculator.com — the user-facing domain, proxied by the same
//     Pages project. A non-browser client is answered with a managed challenge
//     (HTTP 403, `cf-mitigated: challenge`); a spoofed browser User-Agent is
//     refused the same way, so this is not a header gate and no Node-side
//     verifier can fetch its bytes. Its FUNCTIONAL half is still measured, in
//     the one client the zone admits: a real browser smoke against the domain.
//     Its byte parity is therefore NOT measured, and the artifact says so
//     rather than leaving a reader to assume parity was covered.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { SMOKE_ATTEMPT_TIMEOUT_MS, retryDelayFromEnv } from "./lib/budgets.mjs";
import { artifactStamp } from "./lib/stamps.mjs";
import { deadlineFrom, retryTransient } from "./lib/transient-retry.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const NO_BROWSER = process.argv.includes("--no-browser");
const OUT = arg("--out", join(ROOT, "evidence", "production-probe.json"));

const PAGES_BASE = "https://bigenergyco.pages.dev/";
const BRAND_BASE = "https://freeoffgridcalculator.com/";

const run = (args, { allowFailure = false, timeout = 0 } = {}) => {
  try {
    const stdout = execFileSync(process.execPath, args, {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeout || undefined,
    });
    return { ok: true, stdout };
  } catch (e) {
    if (!allowFailure) throw e;
    return { ok: false, stdout: e.stdout || "", stderr: e.stderr || "" };
  }
};

const tail = (s, lines = 2) =>
  String(s || "")
    .trim()
    .split("\n")
    .filter(Boolean)
    .slice(-lines)
    .join(" / ")
    .slice(0, 300);

/**
 * Can a non-browser client read this surface at all?
 *
 * Checked before the verifier is pointed at it: a 366-file parity run that can
 * only ever fetch 403s would take minutes and report "drift" for a refusal,
 * which is the opposite of the truth.
 */
async function reachability(base) {
  try {
    const res = await fetch(base, { cache: "no-store", redirect: "follow" });
    return {
      ok: res.ok,
      status: res.status,
      mitigated: res.headers.get("cf-mitigated"),
    };
  } catch (e) {
    return { ok: false, status: null, mitigated: null, error: e.message };
  }
}

async function probePages() {
  const args = ["scripts/verify-staging.mjs", "--json", "--base", PAGES_BASE];
  if (NO_BROWSER) args.push("--no-browser");
  const r = run(args, { allowFailure: true });
  let payload = null;
  try {
    payload = JSON.parse(r.stdout);
  } catch {
    payload = null;
  }
  if (!payload) {
    return {
      name: "pages",
      base: PAGES_BASE,
      reachable: true,
      verified: false,
      parity: false,
      browser_smoke: false,
      failures: [
        `the staging verifier produced no JSON verdict: ${tail(r.stdout || r.stderr) || "no output"}`,
      ],
      notes: [],
    };
  }
  // The two halves are measured on their own terms, because they fail
  // differently and a reader has to be able to tell which one did. Parity is
  // "every allowlist file was compared and matched" — a skipped or failed
  // comparison is not parity. The functional half is "the real-browser smoke
  // ran AND passed": `--no-browser` is not a pass, and neither is a run whose
  // smoke leg is sitting in `failures`.
  const parity =
    payload.filesChecked > 0 && payload.matched === payload.filesChecked;
  const smokeFailed = (payload.failures || []).some((f) =>
    /real-browser smoke/.test(f),
  );
  const smokeSkipped = (payload.notes || []).some((n) =>
    /browser smoke skipped/.test(n),
  );
  return {
    name: "pages",
    base: payload.base,
    surface: payload.surface,
    reachable: true,
    served_stamp: payload.servedStamp,
    files_checked: payload.filesChecked,
    matched: payload.matched,
    platform_rewrites: payload.platformRewrites,
    parity,
    browser_smoke: !NO_BROWSER && !smokeFailed && !smokeSkipped,
    // The verifier's own end-to-end verdict for this surface, unchanged and not
    // redefined here: it is false when any leg of it failed.
    verified: payload.verified === true,
    failures: payload.failures || [],
    notes: payload.notes || [],
  };
}

async function probeBrand() {
  const reach = await reachability(BRAND_BASE);
  const target = {
    name: "brand",
    base: BRAND_BASE,
    surface: "cloudflare",
    reachable: reach.ok,
    http_status: reach.status,
    cf_mitigated: reach.mitigated ?? null,
    // Byte parity over the allowlist needs a non-browser fetch, so it is
    // reported as unmeasured whenever the zone refuses one — never as a pass.
    parity: null,
    files_checked: 0,
    matched: 0,
    browser_smoke: false,
    verified: false,
    failures: [],
    notes: [],
  };
  if (!reach.ok) {
    target.refusal =
      `a non-browser client is answered HTTP ${reach.status}` +
      (reach.mitigated ? ` (cf-mitigated: ${reach.mitigated})` : "") +
      "; a spoofed browser User-Agent is refused the same way, so no Node-side " +
      "verifier can fetch its bytes";
    target.notes.push(
      "byte parity on this surface is NOT measured; only the functional half is",
    );
  }
  if (NO_BROWSER) {
    target.notes.push(
      "browser smoke skipped (--no-browser), so this surface is measured by nothing",
    );
    return target;
  }
  // Retried ONLY on the repo's transport rule (lib/transient-retry.mjs), and
  // every retry is recorded: a CDP timeout on a loaded machine is a false red
  // this repository has already paid for once, while an assertion a page really
  // fails every time and still fails here.
  const retries = [];
  try {
    await retryTransient(
      (attempt, remainingMs) => {
        const r = run(["scripts/browser-smoke.mjs", BRAND_BASE], {
          allowFailure: true,
          timeout: Math.max(1, Math.min(SMOKE_ATTEMPT_TIMEOUT_MS, remainingMs)),
        });
        if (r.ok) return r;
        const err = new Error(`attempt ${attempt} exited non-zero`);
        err.stdout = r.stdout;
        err.stderr = r.stderr;
        throw err;
      },
      {
        attempts: 2,
        delayMs: retryDelayFromEnv(),
        deadline: deadlineFrom(2 * SMOKE_ATTEMPT_TIMEOUT_MS),
        onRetry: (info) =>
          retries.push({
            attempt: info.attempt,
            detail: String(info.text).replace(/\s+/g, " ").trim().slice(0, 140),
          }),
      },
    );
    target.browser_smoke = true;
  } catch (e) {
    target.browser_smoke = false;
    const failed = String(e.stdout || e.stderr || e.message || "")
      .split("\n")
      .filter((l) => l.includes("SMOKE FAIL"))
      .map((l) => l.replace(/^.*SMOKE FAIL\s*/, "").trim());
    target.failures.push(
      failed.length
        ? failed.slice(0, 6).join(" | ")
        : `the browser smoke exited non-zero: ${tail(e.stdout || e.stderr || e.message)}`,
    );
  }
  if (retries.length)
    target.notes.push(
      `retried the brand smoke ${retries.length} time(s) on a transport error: ` +
        retries.map((r) => `attempt ${r.attempt}: ${r.detail}`).join(" ; "),
    );
  target.transient_retries = retries;
  // FULLY verified means both halves: the bytes were compared AND the app
  // worked. A surface whose bytes cannot be fetched is functional-only, and
  // saying so here is the whole point of the field — a `verified: true` that
  // quietly stood for "the smoke ran" is how the record came to claim a
  // production build nobody had measured.
  target.verified = false;
  target.verified_scope = target.browser_smoke
    ? "functional only: a real browser is served the app and the smoke passes, but byte parity was NOT measured"
    : "not verified";
  return target;
}

const expected = artifactStamp(readFileSync(join(ROOT, "index.html"), "utf8"));
const probe = {
  // The UTC instant this run STARTED, and the artifact is that one run: the
  // record's block may only carry this timestamp, so a probe cannot be dated
  // later than the measurement it reports.
  measured_at: new Date().toISOString(),
  command: "node scripts/probe-production.mjs",
  tree_stamp: expected.ok ? expected.stamp : null,
  targets: [await probePages(), await probeBrand()],
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(probe, null, 2)}\n`, "utf8");

for (const t of probe.targets) {
  console.log(
    `PROBE ${t.name.padEnd(6)} ${t.base} — ` +
      (t.name === "pages"
        ? `stamp ${t.served_stamp}, parity ${t.matched}/${t.files_checked}, ` +
          `browser smoke ${t.browser_smoke ? "ran" : "skipped"}, verified ${t.verified}`
        : `reachable ${t.reachable}${t.http_status ? ` (HTTP ${t.http_status})` : ""}, ` +
          `parity not measured, browser smoke ${t.browser_smoke ? "ran" : "skipped"}` +
          `${t.verified_scope ? `, ${t.verified_scope}` : ""}, verified ${t.verified}`) +
      (t.failures.length ? ` | FAILURES: ${t.failures.join(" ; ")}` : ""),
  );
}
console.log(`PROBE wrote ${OUT} (tree stamp ${probe.tree_stamp})`);

// The pages surface is the one this probe exists to measure: a probe that
// cannot verify it is a red probe, and the artifact still records what it saw.
const pages = probe.targets.find((t) => t.name === "pages");
process.exit(pages?.verified ? 0 : 1);
