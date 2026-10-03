// Build the committed site for the isolated showcase Pages project.
// This stages locally only; it never deploys or modifies tracked files.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "./lib/deploy-manifest.mjs";

export const SHOWCASE_API_BASE =
  "https://bigenergyco-api-showcase.bigenergyco.workers.dev";
export const TURNSTILE_SITE_KEY_ENV = "BEC_TURNSTILE_SITE_KEY";
export const TURNSTILE_META = '<meta name="bec-turnstile-site-key" content="';

export class ShowcaseStageError extends Error {}

export function validateTurnstileSiteKey(value) {
  const key = String(value ?? "").trim();
  // Cloudflare keys use a 0x/1x prefix and an opaque alphanumeric token.
  // Keep the minimum practical so obvious placeholders/short values fail.
  if (!/^(?:0x|1x)[A-Za-z0-9_-]{6,}$/.test(key)) {
    throw new ShowcaseStageError(
      "Turnstile site key must be a public Cloudflare key beginning with 0x or 1x",
    );
  }
  return key;
}

export function escapeHtmlAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("'", "&#39;");
}

export function injectTurnstileSiteKey(html, rawKey) {
  const key = escapeHtmlAttribute(validateTurnstileSiteKey(rawKey));
  const meta = `${TURNSTILE_META}${key}" />`;
  const existing =
    /<meta\b(?=[^>]*\bname\s*=\s*(["'])bec-turnstile-site-key\1)[^>]*\/?>/i;
  if (existing.test(html)) return html.replace(existing, meta);
  const head = /<head\b[^>]*>/i;
  if (!head.test(html))
    throw new ShowcaseStageError(
      "Staged homepage has no <head> for Turnstile site key",
    );
  return html.replace(head, (tag) => `${tag}\n  ${meta}`);
}

export function resolveOutputDirectory(rawPath, root = ROOT) {
  if (typeof rawPath !== "string" || !rawPath.trim()) {
    throw new ShowcaseStageError(
      "Pass an explicit --output directory inside the repository",
    );
  }
  if (isAbsolute(rawPath)) {
    throw new ShowcaseStageError(
      "Showcase output directory must be a relative repository path",
    );
  }
  const output = resolve(root, rawPath);
  const rel = relative(resolve(root), output);
  if (
    isAbsolute(rel) ||
    !rel ||
    rel === ".." ||
    rel.startsWith(`..${sep}`) ||
    resolve(root) === output
  ) {
    throw new ShowcaseStageError(
      "Showcase output directory must be below the repository root",
    );
  }
  const firstComponent = rel.split(sep)[0];
  if (!["_pages_showcase", "_showcase_staging"].includes(firstComponent)) {
    throw new ShowcaseStageError(
      "Showcase output must be inside the dedicated _pages_showcase or _showcase_staging directory",
    );
  }
  return { output, stageArgument: rel };
}

export function createPagesWorkerSource() {
  return `const API_ORIGIN = ${JSON.stringify(SHOWCASE_API_BASE)};

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    if (incoming.pathname.startsWith("/api/")) {
      const upstream = new URL(incoming.pathname + incoming.search, API_ORIGIN);
      return fetch(new Request(upstream, request));
    }
    return env.ASSETS.fetch(request);
  },
};
`;
}

export function createPagesRoutes() {
  return (
    JSON.stringify({ version: 1, include: ["/api/*"], exclude: [] }, null, 2) +
    "\n"
  );
}

function parseArgs(args) {
  let output;
  let key;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--output" && args[i + 1]) output = args[++i];
    else if (arg === "--turnstile-site-key" && args[i + 1]) key = args[++i];
    else throw new ShowcaseStageError(`Unknown or incomplete argument: ${arg}`);
  }
  return { output, key };
}

export async function stageShowcase({ output, key } = {}) {
  const target = resolveOutputDirectory(output);
  const siteKey = validateTurnstileSiteKey(
    key ?? process.env[TURNSTILE_SITE_KEY_ENV],
  );
  const builder = resolve(ROOT, "scripts/deploy-pages-local.mjs");
  execFileSync(
    process.execPath,
    [builder, "--check", "--stage", target.stageArgument],
    {
      cwd: ROOT,
      env: { ...process.env, BEC_API_BASE: SHOWCASE_API_BASE },
      stdio: "inherit",
    },
  );

  const homepage = resolve(target.output, "index.html");
  writeFileSync(
    homepage,
    injectTurnstileSiteKey(readFileSync(homepage, "utf8"), siteKey),
  );
  writeFileSync(
    resolve(target.output, "_worker.js"),
    createPagesWorkerSource(),
  );
  writeFileSync(resolve(target.output, "_routes.json"), createPagesRoutes());
  console.log(
    `Showcase Pages output ready at ${relative(ROOT, target.output)} (not deployed).`,
  );
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  await stageShowcase(parsed);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
