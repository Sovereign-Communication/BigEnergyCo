// The promote path decides what production runs, so every rule it rests on is
// tested in both directions here: verification must PASS on a faithful artifact
// and FAIL on a stale stamp, a missing asset and changed bytes — and the promote
// must REFUSE to deploy when verification fails, while a dry run must not touch
// production or the ledger.
//
// The local static server (the same one the smoke harness uses) stands in for
// the deployed surface, so this whole file runs offline.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import {
  appendFileSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

import { serveStatic } from "../scripts/serve-static.mjs";
import * as stamps from "../scripts/lib/stamps.mjs";
import { attachWorktree, detachWorktree } from "../scripts/lib/worktree.mjs";

const STAGE = "_pages_verify_test";
const LEDGER = join(STAGE, "ledger.jsonl"); // inside the throwaway stage dir

/** Build a faithful artifact copy once, then mutate copies per test. */
function buildStage() {
  rmSync(STAGE, { recursive: true, force: true });
  execFileSync(
    process.execPath,
    ["scripts/deploy-pages-local.mjs", "--check", "--stage", STAGE],
    { stdio: "pipe" },
  );
}

/**
 * Async on purpose: the stand-in surface is an in-process HTTP server, so a
 * synchronous spawn would block this event loop and the child's requests would
 * time out. Awaiting keeps the fake staging reachable while the real scripts run.
 */
async function runNode(args, opts = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, args, {
      encoding: "utf8",
      timeout: 10 * 60 * 1000,
      maxBuffer: 64 * 1024 * 1024,
      ...opts,
    });
    return { code: 0, out: `${stdout}${stderr}` };
  } catch (e) {
    // execFile reports the child's exit status as a NUMBER on `code`, while a
    // spawn failure reports a STRING there (`ENOENT`). Reading only `status`
    // silently defaulted every failing run to 1, which made the exit-code
    // assertions below pass for the wrong reason.
    const code = typeof e.code === "number" ? e.code : (e.status ?? 1);
    return { code, out: `${e.stdout || ""}${e.stderr || ""}` };
  }
}

const run = (script, args, opts) => runNode([script, ...args], opts);

const verify = (base, extra = []) =>
  run("scripts/verify-staging.mjs", [
    "--base",
    base,
    "--no-browser",
    "--json",
    ...extra,
  ]);

const promote = (base, extra = [], opts = {}) =>
  run(
    "scripts/promote.mjs",
    [
      "--base",
      base,
      "--pages",
      base,
      "--brand",
      base,
      "--no-browser",
      "--ledger",
      LEDGER,
      ...extra,
    ],
    opts,
  );

const parse = (out) => JSON.parse(out.slice(out.indexOf("{")));

async function withServer(fn) {
  const srv = await serveStatic({ dir: STAGE });
  try {
    return await fn(srv.url);
  } finally {
    await srv.close();
  }
}

buildStage();

// ── the pure helpers the whole path trusts ──────────────────────────────────

test("PROMOTE: artifact stamp must be single and present", () => {
  assert.equal(
    stamps.artifactStamp('<script src="./a.js?v=20260917h">').stamp,
    "20260917h",
  );
  const mixed = stamps.artifactStamp("a.js?v=20260917g b.js?v=20260917h");
  assert.equal(mixed.ok, false);
  assert.equal(mixed.mixed, true);
  assert.deepEqual(mixed.all, ["20260917g", "20260917h"]);
  assert.equal(stamps.artifactStamp("no stamp here").ok, false);
});

test("PROMOTE: surfaces are told apart, because a 404 means different things", () => {
  assert.equal(stamps.surfaceFor("https://x.github.io/Repo/"), "gh-pages");
  assert.equal(
    stamps.surfaceFor("https://bigenergyco.pages.dev/"),
    "cloudflare",
  );
  assert.equal(
    stamps.surfaceFor("https://freeoffgridcalculator.com/"),
    "cloudflare",
  );
  assert.equal(stamps.surfaceFor("http://127.0.0.1:8080/"), "local");
  assert.equal(stamps.surfaceFor("not a url"), "local");
  // Platform-owned files: asserted where a platform exists, silent locally.
  assert.equal(stamps.platformSpecialFiles("gh-pages")._headers, "present");
  assert.equal(stamps.platformSpecialFiles("cloudflare")._headers, "absent");
  assert.equal(stamps.platformSpecialFiles("local")._headers, "informational");
});

test("PROMOTE: the ledger is parsed strictly, and never mistakes a bad line for truth", () => {
  const rec = stamps.releaseRecord({
    sha: "abc1234",
    stamp: "20260917h",
    previousSha: "def5678",
  });
  const text = `# a comment\n${JSON.stringify(rec)}\n\n{bad json}\n`;
  const { records, badLines } = stamps.parseLedger(text);
  assert.equal(records.length, 1);
  assert.deepEqual(badLines, [4]);
  assert.equal(stamps.lastRelease(text).stamp, "20260917h");
  assert.equal(
    stamps.lastRelease(text).rollbackCommand,
    "node scripts/promote.mjs --to def5678 --apply",
    "a recorded release must always carry the way back",
  );
  assert.equal(stamps.lastRelease(""), null);
});

// ── verification: positive control, then three real regressions ─────────────

test("VERIFY: a faithful artifact verifies (positive control)", async () => {
  await withServer(async (base) => {
    const r = await verify(base);
    assert.equal(r.code, 0, r.out);
    const report = parse(r.out);
    assert.equal(report.verified, true);
    assert.ok(
      report.filesChecked > 300,
      `checked ${report.filesChecked} files`,
    );
    assert.equal(report.matched, report.filesChecked);
    assert.equal(report.servedStamp, report.expectedStamp);
  });
});

test("VERIFY: a stale asset stamp fails, and says both stamps", async () => {
  const indexPath = join(STAGE, "index.html");
  const original = readFileSync(indexPath);
  await withServer(async (base) => {
    const good = await verify(base);
    assert.equal(
      good.code,
      0,
      `control run must pass before the mutation: ${good.out}`,
    );
  });
  try {
    const html = readFileSync(indexPath, "utf8");
    const stale = html.replace(/\?v=[0-9a-z]+/gi, "?v=20250101a");
    assert.notEqual(
      stale,
      html,
      "the mutation must actually change the artifact",
    );
    writeFileSync(indexPath, stale);
    await withServer(async (base) => {
      const r = await verify(base);
      assert.equal(r.code, 1, "a wrong stamp must fail verification");
      assert.match(r.out, /staging serves the checkout's stamp/);
      assert.match(r.out, /20250101a/);
      assert.match(r.out, /stale or the wrong artifact/);
    });
  } finally {
    writeFileSync(indexPath, original);
  }
});

test("VERIFY: a missing asset fails instead of passing vacuously", async () => {
  const asset = join(STAGE, "assets/js/sizing/lead-acid.js");
  const original = readFileSync(asset);
  rmSync(asset);
  try {
    await withServer(async (base) => {
      const r = await verify(base);
      assert.equal(
        r.code,
        1,
        `a missing deployed file must fail verification: ${r.out}`,
      );
      assert.match(r.out, /parity assets\/js\/sizing\/lead-acid\.js/);
      assert.match(r.out, /missing: HTTP 404/);
    });
  } finally {
    writeFileSync(asset, original);
  }
});

test("VERIFY: changed bytes fail even when the file is present and the stamp matches", async () => {
  const asset = join(STAGE, "assets/site.css");
  const original = readFileSync(asset);
  try {
    appendFileSync(asset, "\n/* drifted */\n");
    await withServer(async (base) => {
      const r = await verify(base);
      assert.equal(r.code, 1, `byte drift must fail verification: ${r.out}`);
      assert.match(r.out, /parity assets\/site\.css/);
      assert.match(r.out, /differs:/);
    });
  } finally {
    writeFileSync(asset, original);
  }
});

// ── the promote gate itself ────────────────────────────────────────────────

test("PROMOTE: refuses to promote when verification fails", async () => {
  rmSync(LEDGER, { force: true });
  const asset = join(STAGE, "assets/js/sizing/ui.js");
  const original = readFileSync(asset);
  try {
    appendFileSync(asset, "\n/* regression */\n");
    await withServer(async (base) => {
      const r = await promote(base);
      assert.notEqual(
        r.code,
        0,
        "a failing verification must block the promote",
      );
      assert.equal(
        r.code,
        1,
        `expected the verification refusal, got ${r.code}: ${r.out}`,
      );
      assert.match(r.out, /refusing to promote/);
      assert.equal(
        existsSync(LEDGER),
        false,
        "a refused promote must record nothing",
      );
    });
  } finally {
    writeFileSync(asset, original);
  }
});

test("PROMOTE: a dry run verifies, plans, deploys nothing and writes no ledger", async () => {
  rmSync(LEDGER, { force: true });
  await withServer(async (base) => {
    const r = await promote(base);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /DRY RUN — nothing deployed/);
    assert.match(
      r.out,
      /wrangler pages deploy/,
      "the plan states the exact deploy command",
    );
    assert.match(r.out, /what would be recorded/);
    assert.equal(
      existsSync(LEDGER),
      false,
      "a dry run must not touch the release ledger",
    );
  });
});

test("PROMOTE: apply without Cloudflare credentials refuses instead of pretending", async () => {
  rmSync(LEDGER, { force: true });
  const env = { ...process.env };
  delete env.CLOUDFLARE_API_TOKEN;
  delete env.CF_API_TOKEN;
  await withServer(async (base) => {
    const { code, out } = await promote(base, ["--apply"], { env });
    // The boundary reached depends on the checkout (a local dirty tree, or CI's
    // clean detached one), so assert the SHAPE of the refusal: a precondition
    // (2) or the credential check (3), never a success and never a crash (1).
    assert.ok(
      code === 2 || code === 3,
      `an apply without credentials must stop at a boundary, got ${code}: ${out}`,
    );
    assert.match(
      out,
      /no Cloudflare credentials|working tree is not clean|is not origin\/main|cannot resolve origin\/main/,
      out,
    );
    assert.equal(existsSync(LEDGER), false, "nothing may be recorded");
  });
});

test("PROMOTE: a verify-skipping flag is refused, not quietly ignored", async () => {
  // The rule has to be behavioural: a flag that is accepted but ignored would
  // pass any text search. Break the artifact, ask for a skip, expect a refusal.
  const asset = join(STAGE, "assets/js/sizing/ui.js");
  const original = readFileSync(asset);
  try {
    appendFileSync(asset, "\n/* regression */\n");
    await withServer(async (base) => {
      const r = await promote(base, ["--skip-verify"]);
      assert.equal(r.code, 1, `a bypass attempt must still be gated: ${r.out}`);
      assert.match(r.out, /refusing to promote/);
    });
  } finally {
    writeFileSync(asset, original);
  }
});

test("ROLLBACK WORKTREE: rolling back twice must work, not fail on a stale registration", () => {
  // The rollback rebuilds an old commit in a detached worktree. If a previous
  // attempt was interrupted (or its directory cleaned up), git still has the
  // path REGISTERED and `worktree add` refuses it — on the one command that has
  // to work when production is already broken. The raw command is asserted to
  // fail first, so this cannot pass by accident.
  const dir = "_pages_promote_wt_test";
  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  try {
    attachWorktree(dir, head);
    assert.ok(
      existsSync(join(dir, "index.html")),
      "the worktree must contain the commit's tree",
    );

    rmSync(dir, { recursive: true, force: true });
    assert.throws(
      () =>
        execFileSync("git", ["worktree", "add", "--detach", dir, head], {
          stdio: "pipe",
        }),
      "the raw command is what fails, so the helper is doing real work",
    );

    attachWorktree(dir, head);
    assert.ok(
      existsSync(join(dir, "index.html")),
      "the second attempt must succeed",
    );
  } finally {
    detachWorktree(dir);
  }
  const registered = execFileSync("git", ["worktree", "list"], {
    encoding: "utf8",
  });
  assert.doesNotMatch(
    registered,
    /_pages_promote_wt_test/,
    "no registration may be left behind",
  );
});

test("ROLLBACK: a rollback to HEAD is refused in both modes, and an unknown sha is refused", async () => {
  // These two refusals are what stops `--to` being a way to redeploy the running
  // release by accident, or to deploy a commit nobody can resolve. Both are
  // checked before any network call, so this test is offline and deterministic.
  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

  const noop = await run("scripts/promote.mjs", [
    "--to",
    head,
    "--base",
    "http://127.0.0.1:1/",
    "--no-browser",
  ]);
  assert.equal(noop.code, 2, noop.out);
  assert.match(noop.out, /nothing to roll back to/);

  const noopApply = await run("scripts/promote.mjs", [
    "--to",
    head,
    "--apply",
    "--base",
    "http://127.0.0.1:1/",
    "--no-browser",
  ]);
  assert.equal(noopApply.code, 2, noopApply.out);

  const unknown = await run("scripts/promote.mjs", [
    "--to",
    "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    "--base",
    "http://127.0.0.1:1/",
    "--no-browser",
  ]);
  assert.equal(unknown.code, 2, unknown.out);
  assert.match(unknown.out, /cannot resolve deadbeef/);
});

test("PROMOTE: the promote path is wired into the toolchain and the workflow", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  for (const name of ["verify:staging", "promote", "promote:apply", "rollback"])
    assert.ok(pkg.scripts[name], `package.json must expose ${name}`);

  const workflow = readFileSync(".github/workflows/verify-staging.yml", "utf8");
  assert.match(workflow, /workflows: \["Deploy to GitHub Pages"\]/);
  assert.match(workflow, /scripts\/verify-staging\.mjs/);
  assert.doesNotMatch(
    workflow,
    /--no-browser/,
    "the deployed-artifact job must exercise a real browser, not skip the functional half",
  );
});

test("EXIT: a verdict survives the network, on every platform", async () => {
  // Regression guard for a real bug: process.exit() right after a fetch aborts
  // the process on Windows (libuv async.c assertion), so the caller saw a crash
  // instead of the promote's exit code. A local server reproduces the socket
  // state, so this fails if the tools go back to tearing the loop down.
  const child = `
    import { exitWhenDrained } from "./scripts/lib/graceful-exit.mjs";
    const base = process.env.PROBE_BASE;
    const res = await fetch(base, { cache: "no-store" });
    await res.text();
    exitWhenDrained(Number(process.env.PROBE_CODE));
  `;
  await withServer(async (base) => {
    for (const code of [0, 1]) {
      const { code: got, out } = await runNode(
        ["--input-type=module", "-e", child],
        {
          env: { ...process.env, PROBE_BASE: base, PROBE_CODE: String(code) },
        },
      );
      assert.equal(got, code, `exit ${code} must survive: ${out}`);
      assert.doesNotMatch(out, /Assertion failed|UV_HANDLE_CLOSING/, out);
    }
  });
});

// Leave no artifact behind for the next test file / gate run.
process.on("exit", () => rmSync(STAGE, { recursive: true, force: true }));
