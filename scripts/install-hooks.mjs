// Install the versioned hooks into .git/hooks.
//
// Deliberately a copy, not `git config core.hooksPath`: changing repository
// config from a script is a side effect nobody asked for and it silently
// disables hooks for anyone who expects the default location. Run after
// cloning:
//
//   npm run hooks:install
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(
  new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
);
const SRC = join(ROOT, ".githooks");

if (!existsSync(SRC)) {
  console.error("install-hooks: .githooks/ is missing");
  process.exit(1);
}

let hooksDir;
try {
  hooksDir = execFileSync("git", ["rev-parse", "--git-path", "hooks"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
} catch {
  console.error("install-hooks: not a git checkout");
  process.exit(1);
}
if (!existsSync(hooksDir)) mkdirSync(hooksDir, { recursive: true });

let installed = 0;
for (const name of readdirSync(SRC)) {
  const from = join(SRC, name);
  const to = join(hooksDir, name);
  copyFileSync(from, to);
  try {
    chmodSync(to, 0o755);
  } catch {
    /* Windows has no mode bits; git runs the shebang anyway */
  }
  console.log(`installed ${name} → ${to}`);
  installed++;
}

console.log(
  installed
    ? `\n${installed} hook(s) installed. Docs-only pushes to main stay allowed; anything else must go through a PR.`
    : "\nno hooks found in .githooks/",
);
