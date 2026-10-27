// Zero-dependency static server for the allowlisted deploy build.
//
// Why this exists: the approved browser smoke (scripts/browser-smoke.mjs)
// must be able to run against a build BEFORE it reaches main, and it must run
// under the SAME security policy production serves — otherwise a CSP
// regression (or a new inline handler) would only surface after deploy. This
// server therefore applies the real `_headers` rules to every response.
//
// Usage:
//   node scripts/serve-static.mjs                       # serve _pages_staging on a free port
//   node scripts/serve-static.mjs --dir _pages_smoke --port 8123
//   node scripts/serve-static.mjs --no-headers          # ignore _headers (debugging only)
//
// Prints `SERVING <base-url>` on stdout once listening, so callers (and CI)
// can parse the port instead of hard-coding one.
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  headersFor,
  parseHeadersFile,
  resolveRequestPath,
} from "./lib/gates.mjs";

export const ROOT = resolve(
  new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
);

/** Files the platform applies rather than serves. */
const PLATFORM_FILES = new Set(["/_headers", "/_redirects"]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".wasm": "application/wasm",
};

/**
 * Start the server. Returns `{ url, port, close }`.
 * `port: 0` (default) asks the OS for a free port, so parallel runs and CI
 * jobs never collide with a developer's own server.
 */
export async function serveStatic({
  dir = join(ROOT, "_pages_staging"),
  port = 0,
  host = "127.0.0.1",
  headersFile = join(ROOT, "_headers"),
  applyHeaders = true,
} = {}) {
  const root = resolve(dir);
  if (!existsSync(root))
    throw new Error(`serve-static: no such build dir: ${root}`);

  const rules =
    applyHeaders && existsSync(headersFile)
      ? parseHeadersFile(await readFile(headersFile, "utf8"))
      : [];

  const server = createServer((req, res) => {
    const urlPath = (req.url || "/").split("?")[0];
    const applyPolicy = () => {
      for (const [name, value] of headersFor(urlPath, rules))
        res.setHeader(name, value);
    };

    // Cloudflare CONSUMES `_headers`/`_redirects`: it applies them and does not
    // serve them. Mirroring that is what lets this server stand in for the
    // production surface, where "the platform file is absent" is itself an
    // assertion the verifier makes.
    if (applyHeaders && rules.length && PLATFORM_FILES.has(urlPath)) {
      applyPolicy();
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404");
      return;
    }

    // The static server stands in for the API boundary too: it mirrors the
    // worker's no-key reality — /api/health says the Jev route is off (so the
    // client never even asks), and a direct /api/jev POST gets the same 503
    // the deployed worker without a key returns. Quiet degradation, no
    // console-404 noise in smoke sessions.
    if (urlPath === "/api/health" && req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(
        JSON.stringify({
          status: "ok",
          service: "local static mirror (no API worker here)",
          jevSanity: false,
        }),
      );
      return;
    }
    if (urlPath === "/api/jev" && req.method === "POST") {
      let raw = "";
      req.on("data", (c) => {
        raw += c;
        if (raw.length > 20000) req.destroy();
      });
      req.on("end", () => {
        res.writeHead(503, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify({ available: false, reason: "key_missing" }));
      });
      return;
    }

    const file = resolveRequestPath(root, urlPath);
    if (!file) {
      const notFound = join(root, "404.html");
      applyPolicy();
      if (existsSync(notFound)) {
        res.setHeader("Content-Type", MIME[".html"]);
        res.writeHead(404);
        createReadStream(notFound).pipe(res);
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404");
      return;
    }
    applyPolicy();
    const type = extname(file).toLowerCase();
    // Cloudflare Pages serves HTML with `max-age=0, must-revalidate` unless a
    // `_headers` rule overrides it. Mirroring that default keeps the local
    // smoke run faithful — `/*.html` does not match the bare `/` path, so
    // without this the root document would look immutable-cached locally and
    // fresh in production.
    if (type === ".html" && !res.getHeader("Cache-Control"))
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.setHeader("Content-Type", MIME[type] || "application/octet-stream");
    res.writeHead(200);
    createReadStream(file).pipe(res);
  });

  await new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(port, host, ok);
  });
  const actual = server.address().port;
  return {
    port: actual,
    url: `http://${host}:${actual}/`,
    close: () => new Promise((ok) => server.close(() => ok())),
  };
}

function cliArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dir") out.dir = argv[++i];
    else if (a === "--port") out.port = Number(argv[++i]);
    else if (a === "--host") out.host = argv[++i];
    else if (a === "--no-headers") out.applyHeaders = false;
  }
  return out;
}

const invokedDirectly =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const args = cliArgs(process.argv.slice(2));
  const srv = await serveStatic({
    dir: args.dir ? resolve(args.dir) : undefined,
    port: Number.isFinite(args.port) ? args.port : 0,
    host: args.host,
    applyHeaders: args.applyHeaders !== false,
  });
  console.log(`SERVING ${srv.url}`);
  const stop = async () => {
    await srv.close();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
