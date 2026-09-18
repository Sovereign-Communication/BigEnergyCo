// The release path shells out to npx for exactly one thing (wrangler), and it
// was broken on Windows: the gated promote passed every gate, built the
// artifact, then died at `spawnSync npx ENOENT` before it could deploy.
//
// These tests are behavioural on purpose — the useful assertion is that an npx
// invocation actually RUNS here, not that a helper returns an object with the
// right shape.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { test } from "node:test";

import {
  npxCliCandidates,
  npxPlan,
  quoteWinArg,
  runNpx,
} from "../scripts/lib/npx.mjs";

test("npx actually runs through the resolved plan", () => {
  // Offline and instant: npx --version needs no registry and no cache.
  const out = runNpx(["--version"]).trim();
  assert.match(
    out,
    /^\d+\.\d+\.\d+/,
    `expected a version, got ${JSON.stringify(out)}`,
  );
});

test("the pre-fix invocation is what breaks on Windows", () => {
  if (process.platform !== "win32") return;
  // Documents the defect this helper exists to fix. If a future Node starts
  // resolving the bare name, this test tells us the shim assumption changed
  // rather than silently passing.
  assert.throws(
    () =>
      execFileSync("npx", ["--version"], { stdio: ["ignore", "pipe", "pipe"] }),
    (e) => e.code === "ENOENT" || e.code === "EINVAL",
    "expected the bare name to be unresolvable on Windows",
  );
});

test("every plan is shell-free, and spawning one warns nothing", () => {
  // `shell: true` with an args array concatenates arguments unescaped (DEP0190).
  // Node emits that warning on THIS process, not the child, so it is observed
  // here by interception — reading the child's stderr would prove nothing.
  const variants = [
    npxPlan(["--version"]),
    npxPlan(["--version"], {
      platform: "win32",
      execPath: "C:\\node\\node.exe",
      env: {},
      exists: () => false,
    }),
    npxPlan(["--version"], {
      platform: "linux",
      execPath: "/usr/bin/node",
      env: {},
      exists: () => false,
    }),
  ];
  for (const p of variants)
    assert.equal(p.options.shell, false, `${p.via} plan asks for a shell`);

  const plan = variants[0];
  const emitted = [];
  const realEmit = process.emitWarning;
  process.emitWarning = (w) => emitted.push(String(w));
  let status;
  let stderr;
  try {
    const r = spawnSync(plan.command, plan.args, { encoding: "utf8" });
    status = r.status;
    stderr = r.stderr;
  } finally {
    process.emitWarning = realEmit;
  }
  assert.equal(status, 0, `spawn failed: ${stderr}`);
  assert.deepEqual(emitted, [], `a deprecated spawn warning was emitted`);
});

test("candidates follow the TARGET platform's path rules, not the host's", () => {
  // This is the regression CI caught: the win32 branch was simulated with the
  // host's path module, so on Linux `dirname("C:\\...\\node.exe")` collapsed to
  // "." and the whole Windows candidate list was fictional.
  const win = npxCliCandidates({
    platform: "win32",
    execPath: "C:\\Program Files\\nodejs\\node.exe",
    env: {},
  });
  assert.ok(
    win.every((p) => p.includes("\\") && !p.includes("/")),
    `win32 candidates must use win32 separators: ${win.join(" | ")}`,
  );
  assert.ok(
    win.some((p) => p.startsWith("C:\\Program Files\\nodejs\\")),
    `the execPath directory must survive dirname(): ${win.join(" | ")}`,
  );

  const linux = npxCliCandidates({
    platform: "linux",
    execPath: "/usr/bin/node",
    env: {},
  });
  assert.ok(
    linux.includes("/usr/lib/node_modules/npm/bin/npx-cli.js"),
    linux.join(" | "),
  );
});

test("a resolved npx CLI is preferred, and its path survives spaces", () => {
  const cli = "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npx-cli.js";
  const plan = npxPlan(["--yes", "wrangler", "pages", "deploy"], {
    platform: "win32",
    execPath: "C:\\Program Files\\nodejs\\node.exe",
    env: {},
    exists: (p) => p === cli,
  });
  assert.equal(plan.command, "C:\\Program Files\\nodejs\\node.exe");
  assert.deepEqual(plan.args, [cli, "--yes", "wrangler", "pages", "deploy"]);
  assert.equal(plan.options.shell, false);
});

test("the Windows fallback quotes instead of trusting the shell", () => {
  const plan = npxPlan(["--project-name", "my project", "--yes"], {
    platform: "win32",
    execPath: "C:\\node\\node.exe",
    env: { npx_shim: "C:\\Program Files\\nodejs\\npx" },
    exists: () => false,
  });
  assert.match(plan.command, /cmd\.exe$/i);
  assert.deepEqual(plan.args.slice(0, 3), ["/d", "/s", "/c"]);
  assert.equal(
    plan.args.length,
    4,
    "the command must be one string, not an arg vector",
  );
  assert.match(plan.args[3], /^"C:\\Program Files\\nodejs\\npx" /);
  assert.match(plan.args[3], /"my project"/);
  assert.equal(plan.options.shell, false);
});

test("non-Windows falls back to a direct, shell-free spawn", () => {
  const plan = npxPlan(["--version"], {
    platform: "linux",
    execPath: "/usr/bin/node",
    env: {},
    exists: () => false,
  });
  assert.deepEqual(plan, {
    command: "npx",
    args: ["--version"],
    options: { shell: false },
    via: "npx",
  });
});

test("quoteWinArg follows the cmd/CRT rules", () => {
  assert.equal(quoteWinArg("plain"), "plain");
  assert.equal(quoteWinArg(""), '""');
  assert.equal(quoteWinArg("a b"), '"a b"');
  assert.equal(quoteWinArg("a&b"), '"a&b"');
  assert.equal(quoteWinArg('say "hi"'), '"say \\"hi\\""');
  assert.equal(
    quoteWinArg("C:\\Program Files\\x\\"),
    '"C:\\Program Files\\x\\\\"',
  );
  // cmd would expand this before the child ever saw it, so it must not be passed.
  assert.throws(() => quoteWinArg("100%done"), /cmd\.exe safely/);
});
