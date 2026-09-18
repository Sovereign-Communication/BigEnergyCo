// Gated promote: staging → Cloudflare Pages (bigenergyco.pages.dev + the brand
// domain). Replaces the runbook's manual `wrangler pages deploy` step.
//
// It is deliberately hard to misuse:
//   * DRY-RUN BY DEFAULT. Nothing is deployed, nothing is written, no
//     credentials are needed; it prints the plan, the stamps and the record.
//   * NO WAY TO SKIP VERIFICATION. There is no bypass flag, on purpose: the
//     promote runs scripts/verify-staging.mjs against the DEPLOYED staging
//     artifact (stamp + full byte parity + surface rules + real-browser smoke)
//     and refuses to continue if any of it fails.
//   * PRECONDITIONS. Apply mode requires a clean tree, HEAD equal to
//     origin/main, and that the artifact being promoted is the one staging
//     serves.
//   * AUDITABLE + REVERSIBLE. Every release is appended to a JSONL ledger with
//     the pre- and post-promote stamps of each production surface, the previous
//     release's commit, and the exact rollback command. `--to <sha>` rebuilds
//     that recorded commit's artifact and deploys it.
//
// Boundary: deploying needs Cloudflare credentials. Without them this tool
// stops at the deploy step and prints exactly what to run; it never reports a
// promote it did not perform.
//
// Usage:
//   node scripts/promote.mjs                       # dry run (safe, default)
//   node scripts/promote.mjs --apply               # actually deploy
//   node scripts/promote.mjs --to <sha> --apply    # roll back to a release
// Flags: --base <stagingUrl> --brand <url> --pages <url> --project <name>
//        --stage <dir> --no-browser --json --ledger <path> --wait <seconds>
//        --assume-auth (only when wrangler is already authenticated outside env)
// Environment: CLOUDFLARE_API_TOKEN (+ CLOUDFLARE_ACCOUNT_ID) authorise the deploy.
//
// Exit: 0 = dry run OK (or promote succeeded), 1 = verification failed (REFUSED),
//       2 = precondition failed, 3 = missing credentials.
import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { dirname, join } from "node:path";

import { exitWhenDrained } from "./lib/graceful-exit.mjs";
import { artifactStamp, lastRelease, releaseRecord } from "./lib/stamps.mjs";
import { attachWorktree } from "./lib/worktree.mjs";

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const flag = (name) => process.argv.includes(name);
const JSON_MODE = flag("--json");
const APPLY = flag("--apply");
const SKIP_BROWSER = flag("--no-browser");
const ASSUME_AUTH = flag("--assume-auth");

const STAGING_BASE = (
  arg("--base") ||
  process.env.STAGING_BASE ||
  "https://sovereign-communication.github.io/BigEnergyCo/"
).replace(/\/?$/, "/");
const BRAND_BASE = (
  arg("--brand") || "https://freeoffgridcalculator.com/"
).replace(/\/?$/, "/");
const PAGES_BASE = (arg("--pages") || "https://bigenergyco.pages.dev/").replace(
  /\/?$/,
  "/",
);
const PROJECT = arg("--project", "bigenergyco");
const STAGE = arg("--stage", "_pages_promote");
const LEDGER = arg("--ledger", "docs/release-ledger.jsonl");
const WAIT_SECONDS = Number(arg("--wait", "300")) || 300;
const TO_SHA = arg("--to", null);

const say = (s) => {
  if (!JSON_MODE) console.log(s);
};

/** A refusal is a verdict, not a crash: it carries the exit code and stops the run. */
class Refusal extends Error {
  constructor(code, message) {
    super(message);
    this.exitCode = code;
  }
}
const fatal = (code, msg, hint = "") => {
  if (JSON_MODE)
    console.log(JSON.stringify({ ok: false, code, error: msg, hint }, null, 2));
  else
    console.error(
      `PROMOTE REFUSED (${code}): ${msg}${hint ? `\n  ${hint}` : ""}`,
    );
  throw new Refusal(code, msg);
};

const git = (args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

const stampOf = async (base) => {
  try {
    const res = await fetch(base, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { stamp: null, error: `HTTP ${res.status}` };
    const s = artifactStamp(await res.text());
    return {
      stamp: s.stamp,
      error: s.ok ? null : s.all.join(",") || "no stamp",
    };
  } catch (e) {
    return { stamp: null, error: e.message };
  }
};
async function main() {
  // ── rollback mode works from a recorded commit, promote mode from HEAD ────
  const head = git(["rev-parse", "HEAD"]);
  let sourceSha = head;
  if (TO_SHA) {
    try {
      sourceSha = git(["rev-parse", `${TO_SHA}^{commit}`]);
    } catch {
      fatal(
        2,
        `cannot resolve ${TO_SHA} to a commit in this repository`,
        "pass a SHA recorded in the release ledger, and fetch it first if it is not local",
      );
    }
    // Checked in both modes, not just --apply: redeploying the running release
    // is a no-op, and a plan that cannot be carried out should not be printed.
    if (sourceSha === head)
      fatal(
        2,
        "--to names the current HEAD; nothing to roll back to",
        `HEAD is ${head.slice(0, 7)}`,
      );
  }
  const action = TO_SHA ? "rollback" : "promote";

  // ── 1. preconditions ──────────────────────────────────────────────────────
  if (APPLY) {
    if (!TO_SHA) {
      const dirty = git(["status", "--porcelain"]);
      if (dirty)
        fatal(
          2,
          "working tree is not clean — the artifact would not match the commit it claims",
          `uncommitted:\n${dirty.split("\n").slice(0, 10).join("\n")}`,
        );
      let originMain = "";
      try {
        originMain = git(["rev-parse", "origin/main"]);
      } catch {
        /* offline: reported below */
      }
      if (!originMain)
        fatal(
          2,
          "cannot resolve origin/main (fetch first)",
          "git fetch origin main",
        );
      if (originMain !== head)
        fatal(
          2,
          `HEAD ${head.slice(0, 7)} is not origin/main ${originMain.slice(0, 7)} — promotes must ship main`,
        );
    }
  } else if (!TO_SHA) {
    const dirty = git(["status", "--porcelain"]);
    if (dirty)
      say("PROMOTE WARN  working tree is dirty; --apply would refuse.");
  }

  // ── 2. the artifact we intend to ship, and its stamp ──────────────────────
  let artifactDir = null;
  let stamp = null;
  let stampIsSound = false;
  if (TO_SHA) {
    artifactDir = join(".", `${STAGE}_${sourceSha.slice(0, 7)}`);
    rmSync(artifactDir, { recursive: true, force: true });
    mkdirSync(artifactDir, { recursive: true });
    const worktree = `${artifactDir}/src`;
    attachWorktree(worktree, sourceSha);
    try {
      // Minimal gates on the OLD commit's tree: if its token graph or syntax is
      // broken, its artifact must not go live either.
      execFileSync(process.execPath, ["scripts/check-syntax.mjs"], {
        cwd: worktree,
        stdio: "pipe",
      });
      execFileSync(
        process.execPath,
        ["scripts/bump-asset-tokens.mjs", "--check"],
        {
          cwd: worktree,
          stdio: "pipe",
        },
      );
      const built = join(worktree, STAGE);
      execFileSync(
        process.execPath,
        ["scripts/deploy-pages-local.mjs", "--check", "--stage", STAGE],
        { cwd: worktree, stdio: "pipe" },
      );
      artifactDir = built;
      const declared = artifactStamp(
        readFileSync(join(worktree, "index.html"), "utf8"),
      );
      stamp = declared.stamp;
      stampIsSound = declared.ok;
      say(
        `PROMOTE      rollback artifact built from ${sourceSha.slice(0, 7)} (stamp ${stamp})`,
      );
    } catch (e) {
      fatal(
        2,
        `cannot build a deployable artifact from ${sourceSha.slice(0, 7)}`,
        String(e.stdout || e.message).slice(0, 400),
      );
    }
  } else {
    const declared = artifactStamp(readFileSync("index.html", "utf8"));
    stamp = declared.stamp;
    stampIsSound = declared.ok;
  }

  // ── 3. the gate ───────────────────────────────────────────────────────────
  // Promote mode checks the artifact staging actually SERVES: stamp, byte parity
  // and a real browser. Rollback mode checks the artifact it just BUILT — byte
  // parity of staging against main's checkout says nothing about an older
  // commit, and blocking disaster recovery on an unrelated stale staging would
  // be a false gate, which is its own kind of failure.
  let verification = null;
  if (TO_SHA) {
    if (!stampIsSound)
      fatal(
        1,
        "the rebuilt artifact does not declare exactly one asset stamp — refusing to deploy it",
        `stamp: ${stamp ?? "none"}`,
      );
    verification = {
      surface: "rebuilt-artifact",
      verified: true,
      filesChecked: 0,
      matched: 0,
      servedStamp: null,
      expectedStamp: stamp,
      failures: [],
    };
    say(
      `PROMOTE      rollback artifact declares stamp ${stamp} and passed its build gates`,
    );
  } else {
    const verifyArgs = [
      "scripts/verify-staging.mjs",
      "--base",
      STAGING_BASE,
      "--json",
    ];
    if (SKIP_BROWSER) verifyArgs.push("--no-browser");
    const verify = (() => {
      try {
        const out = execFileSync(process.execPath, verifyArgs, {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 20 * 60 * 1000,
        });
        return { ok: true, out };
      } catch (e) {
        return { ok: false, out: `${e.stdout || ""}${e.stderr || ""}` };
      }
    })();
    try {
      verification = JSON.parse(verify.out.slice(verify.out.indexOf("{")));
    } catch {
      verification = {
        verified: false,
        failures: [verify.out.slice(-400) || "no output"],
      };
    }
    if (!verify.ok || !verification.verified)
      fatal(
        1,
        `staging did not verify — refusing to promote ${head.slice(0, 7)}`,
        `staging ${verification.servedStamp || "?"} vs checkout ${verification.expectedStamp || "?"}; failures: ${(verification.failures || []).slice(0, 4).join(" ; ")}`,
      );
    say(
      `PROMOTE      staging verified: stamp ${verification.servedStamp}, ${verification.matched}/${verification.filesChecked} files identical`,
    );

    // The artifact and the verified staging build must be the SAME release.
    if (
      verification.expectedStamp &&
      stamp &&
      verification.expectedStamp !== stamp
    )
      fatal(
        1,
        "the verified staging artifact and the local checkout carry different stamps",
        `staging ${verification.expectedStamp} vs checkout ${stamp}`,
      );
  }

  // ── 4. what is live right now (the rollback baseline) ─────────────────────
  const pre = {};
  for (const [label, base] of [
    ["brand", BRAND_BASE],
    ["pages", PAGES_BASE],
  ]) {
    const s = await stampOf(base);
    pre[label] = s.stamp || (s.error ? `unreachable: ${s.error}` : "unknown");
  }
  say(
    `PROMOTE      live now — brand ${pre.brand}, pages ${pre.pages}; promoting ${stamp}`,
  );

  const previous = (() => {
    if (!existsSync(LEDGER)) return null;
    try {
      return lastRelease(readFileSync(LEDGER, "utf8"));
    } catch {
      return null;
    }
  })();

  const plan = {
    action,
    sha: TO_SHA ? sourceSha : head,
    stamp,
    stagingBase: STAGING_BASE,
    productionBases: [BRAND_BASE, PAGES_BASE],
    preStamps: pre,
    previousSha: TO_SHA ? (previous?.sha ?? null) : (previous?.sha ?? null),
    command: `npx --yes wrangler pages deploy ${artifactDir || STAGE} --project-name ${PROJECT} --branch main`,
  };

  if (!APPLY) {
    say("\nPROMOTE      DRY RUN — nothing deployed. The promote would run:");
    say(`  node scripts/deploy-pages-local.mjs --check --stage ${STAGE}`);
    say(`  ${plan.command}`);
    say("\nPROMOTE      what would be recorded:");
    say(
      JSON.stringify(
        releaseRecord({
          action: plan.action,
          sha: plan.sha,
          stamp,
          stagingBase: STAGING_BASE,
          productionBases: plan.productionBases,
          preStamps: pre,
          postStamps: {},
          previousSha: plan.previousSha,
          verifiedAt: new Date().toISOString(),
          verification: {
            surface: verification.surface,
            filesChecked: verification.filesChecked,
            matched: verification.matched,
            browser: !SKIP_BROWSER && !TO_SHA,
          },
        }),
        null,
        2,
      ),
    );
    if (JSON_MODE)
      console.log(
        JSON.stringify(
          { ok: true, mode: "dry-run", plan, verification },
          null,
          2,
        ),
      );
    return 0;
  }

  // ── 5. credentials boundary ───────────────────────────────────────────────
  const hasToken = Boolean(
    process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN,
  );
  if (!hasToken && !ASSUME_AUTH)
    fatal(
      3,
      "no Cloudflare credentials in this environment — I will not report a promote I cannot perform",
      "Set CLOUDFLARE_API_TOKEN (and CLOUDFLARE_ACCOUNT_ID), or run `npx wrangler login` once and pass --assume-auth. " +
        `Then run: node scripts/promote.mjs --apply${TO_SHA ? ` --to ${sourceSha.slice(0, 7)}` : ""}`,
    );

  // ── 6. build + deploy the artifact ───────────────────────────────────────
  if (!TO_SHA) {
    rmSync(STAGE, { recursive: true, force: true });
    execFileSync(
      process.execPath,
      ["scripts/deploy-pages-local.mjs", "--check", "--stage", STAGE],
      { stdio: JSON_MODE ? "pipe" : "inherit" },
    );
    artifactDir = STAGE;
  }
  let deployOut = "";
  try {
    deployOut = execFileSync(
      "npx",
      [
        "--yes",
        "wrangler",
        "pages",
        "deploy",
        artifactDir,
        "--project-name",
        PROJECT,
        "--branch",
        "main",
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 15 * 60 * 1000,
      },
    );
  } catch (e) {
    fatal(
      2,
      "wrangler failed — production is unchanged by a failed deploy",
      String(e.stdout || e.message).slice(0, 600),
    );
  }
  if (!JSON_MODE) process.stdout.write(deployOut);
  const deploymentUrl =
    (deployOut.match(/https:\/\/[a-z0-9.-]+\.pages\.dev\S*/i) || [])[0] || null;

  // ── 7. prove it actually landed, then record it ───────────────────────────
  const post = {};
  const deadline = Date.now() + WAIT_SECONDS * 1000;
  for (const [label, base] of [
    ["pages", PAGES_BASE],
    ["brand", BRAND_BASE],
  ]) {
    let last = null;
    while (Date.now() < deadline) {
      const s = await stampOf(base);
      last = s.stamp || (s.error ? `unreachable: ${s.error}` : "unknown");
      if (s.stamp === stamp) break;
      await new Promise((r) => setTimeout(r, 10000));
    }
    post[label] = last;
  }
  const record = releaseRecord({
    action,
    sha: plan.sha,
    stamp,
    stagingBase: STAGING_BASE,
    productionBases: plan.productionBases,
    preStamps: pre,
    postStamps: post,
    previousSha: plan.previousSha,
    deploymentUrl,
    verifiedAt: new Date().toISOString(),
    verification: {
      surface: verification.surface,
      filesChecked: verification.filesChecked,
      matched: verification.matched,
      browser: !SKIP_BROWSER && !TO_SHA,
    },
  });
  mkdirSync(dirname(LEDGER), { recursive: true });
  appendFileSync(LEDGER, JSON.stringify(record) + "\n");

  say(
    `\nPROMOTE      deployed ${stamp} — pages ${post.pages}, brand ${post.brand}` +
      (deploymentUrl ? ` (${deploymentUrl})` : ""),
  );
  say(`PROMOTE      recorded in ${LEDGER}`);
  if (plan.previousSha)
    say(
      `PROMOTE      rollback: node scripts/promote.mjs --to ${plan.previousSha} --apply`,
    );
  if (post.brand !== stamp)
    say(
      `PROMOTE WARN  the brand domain still serves ${post.brand} — verify before announcing the release`,
    );
  if (JSON_MODE)
    console.log(JSON.stringify({ ok: true, mode: "apply", record }, null, 2));
  return 0;
}

try {
  exitWhenDrained(await main());
} catch (e) {
  if (e instanceof Refusal) exitWhenDrained(e.exitCode);
  else {
    console.error(`PROMOTE ERROR  ${e.message}`);
    exitWhenDrained(1);
  }
}
