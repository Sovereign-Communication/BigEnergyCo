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
import { securityPolicyVerdict } from "../scripts/lib/gates.mjs";
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

// ── the served policy: what production owes us, provable offline ───────────

// Captured from freeoffgridcalculator.com after the promote that landed stamp
// 20260917h. Mutation of a copy of this map is what proves each rule bites.
const PRODUCTION_HEADERS = new Map(
  Object.entries({
    "content-security-policy":
      "default-src 'self'; script-src 'self' https://unpkg.com https://static.cloudflareinsights.com; " +
      "style-src 'self' 'unsafe-inline' https://unpkg.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=()",
    "strict-transport-security": "max-age=31536000; includeSubDomains; preload",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
  }),
);
const headerReader = (map) => (name) =>
  map.get(String(name).toLowerCase()) ?? null;

const withCsp = (csp) => {
  const m = new Map(PRODUCTION_HEADERS);
  m.set("content-security-policy", csp);
  return m;
};

const failingChecks = (map) =>
  securityPolicyVerdict("cloudflare", headerReader(map)).checks.filter(
    (c) => !c.ok,
  );

const assertFails = (map, pattern, label) => {
  const bad = failingChecks(map);
  assert.ok(bad.length, `expected ${label} to fail the policy`);
  assert.ok(
    bad.some((c) => pattern.test(`${c.name} ${c.detail}`)),
    `${label} must be named in the report: ${JSON.stringify(bad)}`,
  );
};

test("POLICY: the live header set passes, and every loosening of it fails", () => {
  const ok = securityPolicyVerdict(
    "cloudflare",
    headerReader(PRODUCTION_HEADERS),
  );
  assert.ok(ok.checks.length >= 3);
  assert.deepEqual(
    ok.checks.filter((c) => !c.ok),
    [],
    JSON.stringify(ok.checks, null, 1),
  );
  assert.deepEqual(ok.notes, []);

  for (const name of [
    "content-security-policy",
    "x-content-type-options",
    "x-frame-options",
    "referrer-policy",
    "permissions-policy",
    "strict-transport-security",
    "cross-origin-opener-policy",
    "cross-origin-resource-policy",
  ]) {
    const dropped = new Map(PRODUCTION_HEADERS);
    dropped.delete(name);
    assertFails(dropped, new RegExp(name, "i"), `a dropped ${name}`);
  }

  const csp = PRODUCTION_HEADERS.get("content-security-policy");
  assertFails(
    withCsp(
      csp.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"),
    ),
    /unsafe-inline/,
    "'unsafe-inline' back in script-src",
  );
  assertFails(
    withCsp(
      csp.replace("script-src 'self'", "script-src 'self' 'unsafe-eval'"),
    ),
    /unsafe-eval/,
    "'unsafe-eval' in script-src",
  );
  assertFails(
    withCsp(csp.replace("script-src 'self'", "script-src 'self' *")),
    /any host/,
    "a wildcard script-src",
  );
  assertFails(
    withCsp(csp.replace("frame-ancestors 'none'", "frame-ancestors *")),
    /frame-ancestors/,
    "a reopened frame-ancestors",
  );
  assertFails(
    withCsp(csp.replace("object-src 'none'", "object-src *")),
    /object-src/,
    "a reopened object-src",
  );
  assertFails(
    withCsp(csp.replace("base-uri 'self'", "base-uri *")),
    /base-uri/,
    "a reopened base-uri",
  );
  assertFails(
    withCsp("default-src 'self'"),
    /script-src/,
    "no script-src at all",
  );

  // Surfaces that do not apply `_headers` must SAY so rather than pass silently.
  const gh = securityPolicyVerdict(
    "gh-pages",
    headerReader(PRODUCTION_HEADERS),
  );
  assert.deepEqual(gh.checks, []);
  assert.match(gh.notes[0], /ignores `_headers`/);
  assert.deepEqual(
    securityPolicyVerdict("local", headerReader(new Map())).checks,
    [],
  );
});

/**
 * The same rules, end to end, through the real verifier against the local
 * stand-in declaring itself the production surface. This is the check that
 * would otherwise only be exercisable against a live Cloudflare account.
 */
const withStagePolicy = async (fn) => {
  const srv = await serveStatic({
    dir: STAGE,
    headersFile: join(STAGE, "_headers"),
  });
  try {
    return await fn(srv.url);
  } finally {
    await srv.close();
  }
};

test("VERIFY: policy regressions fail through the real verifier, not just the helper", async () => {
  const headersPath = join(STAGE, "_headers");
  assert.ok(
    existsSync(headersPath),
    "the build must ship _headers for this stand-in to mean anything",
  );
  const original = readFileSync(headersPath, "utf8");

  try {
    await withStagePolicy(async (base) => {
      const r = await verify(base, ["--surface", "cloudflare"]);
      assert.equal(r.code, 0, `the control run must pass: ${r.out}`);
      const report = parse(r.out);
      assert.equal(report.surface, "cloudflare");
      assert.equal(report.verified, true);
      assert.equal(
        report.platformRewrites.files,
        0,
        "a local stand-in applies no edge rewrite, so nothing may be tolerated",
      );
    });

    // Self-verifying on purpose. The first version of this compared a
    // lower-cased line against a mixed-case needle, so it matched nothing and
    // the "mutation" only rewrote the line endings — which passed a
    // `notEqual` check and made the verifier look like it had no teeth.
    const withoutHeader = (name) => {
      const lines = original.split(/\r?\n/);
      const needle = `${name.toLowerCase()}:`;
      const kept = lines.filter(
        (l) => !l.trim().toLowerCase().startsWith(needle),
      );
      assert.equal(
        lines.length - kept.length,
        1,
        `the ${name} mutation must drop exactly one line`,
      );
      return kept.join("\n");
    };

    // Each case carries its own proof that the mutation reached the wire. A
    // verifier that passed on a file edit that never took effect would be
    // vacuous, so the wire is checked before the verdict is read.
    const mutations = [
      [
        "a dropped COOP header",
        withoutHeader("Cross-Origin-Opener-Policy"),
        /cross-origin-opener-policy/i,
        (h) => assert.equal(h.get("cross-origin-opener-policy"), null),
      ],
      [
        "a dropped HSTS header",
        withoutHeader("Strict-Transport-Security"),
        /strict-transport-security/i,
        (h) => assert.equal(h.get("strict-transport-security"), null),
      ],
      [
        "'unsafe-inline' back in script-src",
        original.replace(
          "script-src 'self'",
          "script-src 'self' 'unsafe-inline'",
        ),
        /unsafe-inline/,
        (h) =>
          assert.match(
            h.get("content-security-policy") || "",
            /script-src 'self' 'unsafe-inline'/,
          ),
      ],
      [
        "a reopened frame-ancestors",
        original.replace("frame-ancestors 'none'", "frame-ancestors *"),
        /frame-ancestors/,
        (h) =>
          assert.match(
            h.get("content-security-policy") || "",
            /frame-ancestors \*/,
          ),
      ],
    ];

    for (const [label, mutated, pattern, onWire] of mutations) {
      assert.notEqual(
        mutated,
        original,
        `${label} must actually change _headers`,
      );
      writeFileSync(headersPath, mutated);
      assert.equal(
        readFileSync(headersPath, "utf8"),
        mutated,
        `${label} must be on disk before the stand-in is started`,
      );
      await withStagePolicy(async (base) => {
        const probe = await fetch(base, { cache: "no-store" });
        onWire(probe.headers);
        const r = await verify(base, ["--surface", "cloudflare"]);
        assert.equal(r.code, 1, `${label} must fail verification: ${r.out}`);
        assert.match(r.out, pattern, label);
      });
    }
  } finally {
    writeFileSync(headersPath, original);
  }

  // The mutations were the only variable: restored policy passes again.
  await withStagePolicy(async (base) => {
    const r = await verify(base, ["--surface", "cloudflare"]);
    assert.equal(r.code, 0, `the restored policy must pass: ${r.out}`);
  });
});

// ── the way back: how a first release gets a rollback target ───────────────

// Trimmed from real `wrangler pages deployment list --json` output, with the
// banner wrangler/npx prints kept in front of it.
const WRANGLER_JSON = `
 ⛅️ wrangler 4.124.0 (update available 4.134.0)
─────────────────────────────────────
[
  { "Id": "preview", "Environment": "Preview", "Branch": "feat/x", "Source": "7fb1051", "Deployment": "https://preview.bigenergyco.pages.dev", "Status": "1 day ago" },
  { "Id": "0d4ea9a1", "Environment": "Production", "Branch": "main", "Source": "503540c", "Deployment": "https://0d4ea9a1.bigenergyco.pages.dev", "Status": "6 minutes ago" },
  { "Id": "36b2946b", "Environment": "Production", "Branch": "main", "Source": "3f4bc5d", "Deployment": "https://36b2946b.bigenergyco.pages.dev", "Status": "1 day ago" }
]
`;

test("LEDGER: deployment history parses, and garbage parses to nothing", () => {
  const list = stamps.parseDeployments(WRANGLER_JSON);
  assert.ok(
    Array.isArray(list),
    "a banner before the JSON must not break parsing",
  );
  assert.equal(list.length, 3);
  assert.equal(list[1].environment, "Production");
  assert.equal(list[1].source, "503540c");
  for (const junk of [null, "", "no json here", "[not json", '{"a":1}'])
    assert.equal(stamps.parseDeployments(junk), null, `${junk} must not parse`);
});

test("LEDGER: the first release derives its way back from what production serves", () => {
  const deployments = stamps.parseDeployments(WRANGLER_JSON);

  const first = stamps.rollbackBaseline({
    ledgerText: "",
    deployments,
    promotingSha: "deadbeefcafe",
  });
  assert.equal(
    first.sha,
    "503540c",
    "the newest PRODUCTION deployment, not a preview",
  );
  assert.equal(first.source, "cloudflare-deployment-history");

  // Re-promoting what is already live still names the release before it.
  const rePromote = stamps.rollbackBaseline({
    ledgerText: "",
    deployments,
    promotingSha: "503540c",
  });
  assert.equal(rePromote.sha, "3f4bc5d");

  // A full SHA on one side, an abbreviated one on the other: same commit.
  assert.equal(
    stamps.rollbackBaseline({
      ledgerText: "",
      deployments,
      promotingSha: "503540c0000000000000000000000000000000000",
    }).sha,
    "3f4bc5d",
  );

  // A recorded release wins over history.
  const ledger = `${JSON.stringify(
    stamps.releaseRecord({
      sha: "abc1234",
      stamp: "20260917h",
      previousSha: "def5678",
    }),
  )}\n`;
  // The ledger's most recent release IS what production is running, so that is
  // what a rollback must return to — not that release's own predecessor.
  const recorded = stamps.rollbackBaseline({
    ledgerText: ledger,
    deployments,
    promotingSha: "newsha",
  });
  assert.equal(recorded.sha, "abc1234");
  assert.equal(recorded.source, "ledger");

  // No history and no ledger: say why, never invent a target.
  const none = stamps.rollbackBaseline({
    ledgerText: "",
    deployments: null,
    promotingSha: "deadbeefcafe",
  });
  assert.equal(none.sha, null);
  assert.match(none.reason, /deployment history was not available/);

  const onlyPreview = stamps.rollbackBaseline({
    ledgerText: "",
    deployments: [deployments[0]],
    promotingSha: "deadbeefcafe",
  });
  assert.equal(
    onlyPreview.sha,
    null,
    "a preview is not a place to roll back to",
  );
});

test("LEDGER: amending a record recomputes the way back and is never silent", () => {
  const before = stamps.releaseRecord({
    sha: "503540c",
    stamp: "20260917h",
    previousSha: null,
    rollbackReason: "empty ledger",
  });
  assert.equal(before.rollbackCommand, null);
  assert.equal(before.rollbackUnavailable, "empty ledger");

  const after = stamps.amendRelease(
    before,
    {
      previousSha: "3f4bc5d",
      baselineSource: "cloudflare-deployment-history",
    },
    { reason: "the first release recorded no baseline" },
  );
  assert.equal(
    after.rollbackCommand,
    "node scripts/promote.mjs --to 3f4bc5d --apply",
  );
  assert.equal(after.rollbackUnavailable, null);
  assert.equal(after.baselineSource, "cloudflare-deployment-history");
  assert.equal(after.amended.length, 1);
  assert.match(after.amended[0].reason, /first release/);
  assert.deepEqual(after.amended[0].fields, ["previousSha", "baselineSource"]);
  assert.equal(
    before.rollbackCommand,
    null,
    "amending must not mutate the original record in place",
  );

  // A record amended twice keeps the whole trail.
  const twice = stamps.amendRelease(
    after,
    { stamp: "20260917i" },
    { reason: "second" },
  );
  assert.equal(twice.amended.length, 2);
  assert.equal(twice.rollbackCommand, after.rollbackCommand);
});

test("PROMOTE: a credential-free dry run claims no way back it has not read", async () => {
  rmSync(LEDGER, { force: true });
  const env = { ...process.env };
  delete env.CLOUDFLARE_API_TOKEN;
  delete env.CF_API_TOKEN;
  await withServer(async (base) => {
    const r = await promote(base, ["--json"], { env });
    assert.equal(r.code, 0, r.out);
    const payload = parse(r.out);
    assert.equal(payload.plan.previousSha, null);
    assert.match(
      payload.plan.rollbackReason,
      /deployment history was not available/,
      "the reason must be stated, not left blank",
    );
    assert.equal(
      payload.record.rollbackCommand,
      null,
      "no credential-free run may claim a way back it has not read",
    );
    assert.match(
      payload.record.rollbackUnavailable,
      /deployment history was not available/,
    );
  });
});

// Leave no artifact behind for the next test file / gate run.
process.on("exit", () => rmSync(STAGE, { recursive: true, force: true }));
