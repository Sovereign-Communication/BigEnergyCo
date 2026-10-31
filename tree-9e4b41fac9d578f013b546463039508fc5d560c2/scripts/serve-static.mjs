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
import { constants, createBrotliCompress, createGzip } from "node:zlib";
import {
  headersFor,
  parseHeadersFile,
  resolveRequestPath,
} from "./lib/gates.mjs";
import {
  API_PREFIX,
  handleWorkerRequest,
  loadWorker,
} from "./lib/worker-bridge.mjs";

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
 * Extensions worth compressing. The MIME table above is not the filter: a
 * `.png` or `.woff2` is already compressed, and running it through gzip only
 * buys CPU and a slightly larger body. Text, markup, script, style and JSON
 * are what actually shrink.
 */
const COMPRESSIBLE = new Set([
  ".html",
  ".js",
  ".mjs",
  ".css",
  ".json",
  ".webmanifest",
  ".xml",
  ".txt",
  ".svg",
  ".wasm",
]);

/** Below this size the compression header costs more than it saves. */
const COMPRESS_MIN_BYTES = 1024;

/**
 * Pick a content coding from the request's `Accept-Encoding`, or null.
 *
 * brotli first, gzip as the universal fallback. An `identity` token is present
 * on essentially every request and is deliberately NOT treated as a veto: a
 * client that also accepts `br` is served brotli, and a client that sends only
 * `identity` matches neither pattern and is served the raw bytes.
 */
export function negotiateEncoding(acceptEncoding, compressible) {
  if (!compressible) return null;
  const header = String(acceptEncoding || "");
  if (!header) return null;
  // Parse the offered codings with their quality values. `q=0` means
  // "explicitly not acceptable" and is dropped, and the highest q wins rather
  // than a fixed preference: a client that writes `gzip;q=1.0, br;q=0.5` has
  // told us it would rather have gzip, and serving brotli anyway would be
  // ignoring an explicit statement. Ties go to brotli, the better ratio.
  const offered = new Map();
  for (const part of header.split(",")) {
    const [rawToken, ...params] = part.split(";");
    const token = rawToken.trim().toLowerCase();
    if (!token) continue;
    let q = 1;
    for (const p of params) {
      const m = p.trim().match(/^q\s*=\s*([0-9.]+)$/i);
      if (m) q = Number(m[1]);
    }
    if (q <= 0) continue;
    if (!offered.has(token) || q > offered.get(token)) offered.set(token, q);
  }
  let best = null;
  for (const [token, q] of offered) {
    if (token !== "br" && token !== "gzip") continue;
    if (!best || q > best.q || (q === best.q && token === "br"))
      best = { token, q };
  }
  return best ? best.token : null;
}

/**
 * Stream a file to the response, compressing text bodies when the client asked
 * for it.
 *
 * WHY THIS EXISTS HERE AND NOT IN THE PLATFORM: the static server exists so
 * the browser gates measure the surface production serves. Cloudflare Pages
 * applies Brotli and gzip automatically, so a build that is only ever measured
 * through this server would report `uses-text-compression` as a failure for a
 * thing production already does — the measurement would be wrong about the
 * product in the pessimistic direction, which is the direction that quietly
 * justifies "optimising" something that is already fine. Mirroring the
 * platform's compression makes the local reading match the deployed one.
 */
function sendFile(res, file, status, { ext, mime }, req, byteLength) {
  res.setHeader("Content-Type", mime);
  const encoding = negotiateEncoding(
    req?.headers?.["accept-encoding"],
    COMPRESSIBLE.has(ext) && (byteLength ?? 1) >= COMPRESS_MIN_BYTES,
  );
  const stream = createReadStream(file);
  if (!encoding) {
    res.writeHead(status);
    stream.pipe(res);
    return;
  }
  res.setHeader("Content-Encoding", encoding);
  res.setHeader("Vary", "Accept-Encoding");
  res.writeHead(status);
  const compressor =
    encoding === "br"
      ? createBrotliCompress({
          params: {
            [constants.BROTLI_PARAM_QUALITY]: 5,
            [constants.BROTLI_PARAM_SIZE_HINT]: byteLength ?? 0,
          },
        })
      : createGzip({ level: 6 });
  stream.on("error", () => res.destroy());
  compressor.on("error", () => res.destroy());
  stream.pipe(compressor).pipe(res);
}

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
  // Mount the real API worker on this same origin. Default ON: the deployed
  // product is one origin serving both the static site and /api/*, and a
  // server that answers /api/health but 404s /api/chat is not a faithful
  // stand-in for it. `wrangler dev` is not an option here — the web-smoke job
  // runs on zero dependencies by design (see scripts/lib/worker-bridge.mjs).
  mountWorker = true,
  workerEnv = {},
} = {}) {
  const root = resolve(dir);
  if (!existsSync(root))
    throw new Error(`serve-static: no such build dir: ${root}`);

  const worker = mountWorker ? await loadWorker() : null;

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

    // The API surface. With the worker mounted, /api/* is the REAL worker:
    // its routing, its validation, and its degraded-reply contract. That is
    // what makes the smoke's advisor gates mean something.
    if (urlPath.startsWith(API_PREFIX)) {
      if (!worker) {
        // LOUD, not a 404. A missing endpoint and a wrongly-mounted worker
        // look identical from the client (both are "Chat API error: 404"),
        // and that ambiguity is what let this gate sit red for weeks. Say
        // which one it is.
        res.writeHead(501, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error:
              "API worker not mounted: serveStatic({ mountWorker: false }) — this server has no worker behind /api/*",
          }),
        );
        return;
      }
      handleWorkerRequest(worker, req, res, {
        env: workerEnv,
        host,
        port: server.address()?.port ?? 0,
      }).catch((e) => {
        // A bridge that throws must not leave the request hanging, and must
        // not look like a passing run.
        //
        // The cause goes to stderr, not into the response body. Reflecting an
        // internal error message to the client is an information disclosure
        // (js/stack-trace-exposure), and the diagnostic is worth exactly as
        // much on the terminal that is running the gate as it is in the reply —
        // while the reply travels to whatever asked.
        console.error(
          `serve-static: worker bridge failed: ${String((e && e.stack) || e).slice(0, 800)}`,
        );
        if (res.headersSent) return res.end();
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "worker bridge failed",
          }),
        );
      });
      return;
    }

    const file = resolveRequestPath(root, urlPath);
    if (!file) {
      const notFound = join(root, "404.html");
      applyPolicy();
      if (existsSync(notFound)) {
        sendFile(
          res,
          notFound,
          404,
          { ext: ".html", mime: MIME[".html"] },
          req,
          statSync(notFound).size,
        );
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
    sendFile(
      res,
      file,
      200,
      { ext: type, mime: MIME[type] || "application/octet-stream" },
      req,
      statSync(file).size,
    );
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
    else if (a === "--no-worker") out.mountWorker = false;
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
    mountWorker: args.mountWorker !== false,
  });
  console.log(`SERVING ${srv.url}`);
  const stop = async () => {
    await srv.close();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
