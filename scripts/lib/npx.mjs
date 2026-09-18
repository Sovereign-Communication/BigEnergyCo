// Cross-platform `npx`, for the one step of the release that shells out to a
// tool we deliberately do not vendor (wrangler).
//
// Why this exists: `execFileSync("npx", args)` is silently Windows-broken. The
// Windows shim is `npx.cmd`, and CreateProcess neither finds the bare name
// (ENOENT) nor accepts the `.cmd` file directly (EINVAL); the usual workaround,
// `shell: true` with an args array, makes Node concatenate the arguments
// unescaped and emit DEP0190. That combination meant the gated promote could
// pass every gate, build the artifact, and then die before it could deploy —
// on the maintainer's only machine.
//
// So instead of a shell, resolve npm's own `npx-cli.js` and run it with the
// node binary we are already executing under: one code path, identical
// argument semantics on every platform, nothing to escape. The cmd.exe path
// below is a fallback for a node install whose npm layout we do not recognise,
// and it quotes explicitly rather than trusting `shell: true`.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { posix, win32 } from "node:path";

// cmd.exe expands `%VAR%` even inside double quotes, so an argument containing
// it cannot be passed through the fallback faithfully; newlines and NUL cannot
// survive a command line at all. Refusing is the honest option — a mangled
// project name must not turn into a deployment to somewhere else.
const CMD_UNQUOTABLE = /[\r\n\0%]/;
const CMD_NEEDS_QUOTING = /[\s"&|<>^()]/;

/** Quote one argument for a cmd.exe command line (CommandLineToArgvW rules). */
export function quoteWinArg(arg) {
  const s = String(arg);
  if (CMD_UNQUOTABLE.test(s))
    throw new Error(
      `cannot pass ${JSON.stringify(s)} through cmd.exe safely (contains a character cmd expands or truncates)`,
    );
  if (s !== "" && !CMD_NEEDS_QUOTING.test(s)) return s;
  let out = '"';
  let backslashes = 0;
  for (const ch of s) {
    if (ch === "\\") {
      backslashes++;
      continue;
    }
    if (ch === '"') {
      out += "\\".repeat(backslashes * 2 + 1) + '"';
      backslashes = 0;
      continue;
    }
    out += "\\".repeat(backslashes) + ch;
    backslashes = 0;
  }
  return out + "\\".repeat(backslashes * 2) + '"';
} /**
 * Where npm may keep its npx CLI, most likely first. Ordered so that a normal
 * install resolves on the first candidate: alongside node (official Windows
 * installer, nvm-windows), then the posix prefix layout (/usr, Homebrew, nvm),
 * then Debian/Ubuntu's split layout.
 *
 * Paths are built with the path module of the TARGET platform, not the host's.
 * Otherwise asking for "what would this do on Windows" from a posix host
 * resolves `dirname("C:\\...\\node.exe")` to `.` and examines a fiction — which
 * is exactly how a green-looking Windows test passed while the real Windows
 * path went untested.
 */
export function npxCliCandidates({
  platform = process.platform,
  execPath = process.execPath,
  env = process.env,
} = {}) {
  const p = platform === "win32" ? win32 : posix;
  const dir = p.dirname(execPath);
  const list = [];
  if (env.BECO_NPX_CLI) list.push(env.BECO_NPX_CLI);
  // When we are running under npm, npm tells us where its own CLI lives.
  if (env.npm_execpath)
    list.push(p.join(p.dirname(env.npm_execpath), "npx-cli.js"));
  list.push(
    p.join(dir, "node_modules", "npm", "bin", "npx-cli.js"),
    p.join(dir, "..", "lib", "node_modules", "npm", "bin", "npx-cli.js"),
    p.join(dir, "..", "share", "nodejs", "npm", "bin", "npx-cli.js"),
  );
  return [...new Set(list)];
}

/**
 * The spawn plan for an npx invocation. Pure and injectable so the Windows
 * branch is testable on any machine the suite runs on.
 * @returns {{command: string, args: string[], options: {shell: boolean}, via: string}}
 */
export function npxPlan(
  args,
  {
    platform = process.platform,
    execPath = process.execPath,
    env = process.env,
    exists = existsSync,
  } = {},
) {
  for (const cli of npxCliCandidates({ platform, execPath, env })) {
    if (exists(cli))
      return {
        command: execPath,
        args: [cli, ...args],
        options: { shell: false },
        via: `node ${cli}`,
      };
  }
  if (platform === "win32") {
    const line = [env.npx_shim || "npx", ...args].map(quoteWinArg).join(" ");
    return {
      command: env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", line],
      options: { shell: false },
      via: "cmd.exe",
    };
  }
  return { command: "npx", args, options: { shell: false }, via: "npx" };
}

/** Run npx and return stdout. `spawn` overrides execFileSync options. */
export function runNpx(args, { spawn = {}, ...plan } = {}) {
  const p = npxPlan(args, plan);
  return execFileSync(p.command, p.args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...spawn,
  });
}
