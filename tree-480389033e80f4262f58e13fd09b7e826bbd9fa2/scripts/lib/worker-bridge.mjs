// Run the REAL API worker behind the local static server, in-process.
//
// Why this exists: `serve-static.mjs` used to hand-write stand-ins for
// `/api/health` and `/api/jev` and had no route at all for `/api/chat`. The
// browser smoke therefore drove a surface where the advisor endpoint did not
// exist, so every chat call 404'd. That made two gates permanently red on
// every PR — a gate that can never pass stops being read as a signal, which is
// the same defect `scripts/verify-staging.mjs` had (a retry loop that could be
// killed instead of returning a verdict).
//
// Why not `wrangler dev`: the `web-smoke` job deliberately runs on ZERO
// dependencies (no `npm ci`), because the smoke drives the runner's own Chrome
// over raw CDP. Adding workerd/wrangler would either need a heavy install or a
// downloaded binary, and would test a *bundled* worker rather than the module
// in the repo. The worker is already a plain `fetch(request, env, ctx)`
// module — the same shape `tests/worker-i18n.test.mjs` drives directly — so
// mounting it costs one adapter and zero dependencies.
//
// The mount is SAME-ORIGIN (the worker is mounted on the static server's own
// port), which is also how the deployed product works: Pages serves the site,
// the route forwards `/api/*` to the Worker, and the browser sees one origin.
// Cloudflare sets `CF-Connecting-IP` on every Worker request, so the bridge
// sets it too and the in-isolate rate limiter keeps its real semantics
// instead of collapsing every caller into one "unknown" bucket.
//
// NOT a substitute for a deployed-surface check: this proves the worker's
// routing, validation, and degraded-reply contract, not Cloudflare's bindings
// (KV/R2/D1/rate limiting), which do not exist here. Those stay the job of the
// staging verifier.
/** Paths the worker owns. Anything else on this server is static. */
export const API_PREFIX = "/api/";

/**
 * Hard read cap for the bridge, deliberately LOOSER than the worker's own
 * 20 KB ceiling. The bridge must be able to read a body the worker will then
 * reject with its own 413, so that the client sees the worker's real answer
 * rather than the harness inventing one. This is a backstop against a
 * runaway upload, not a policy.
 */
const BRIDGE_READ_CAP = 1_000_000;

/** Load the shipped worker module. One instance, reused per server. */
export async function loadWorker() {
  const mod = await import("../../worker/index.js");
  if (!mod.default || typeof mod.default.fetch !== "function")
    throw new Error(
      "worker-bridge: worker/index.js has no default export with fetch()",
    );
  return mod.default;
}

/**
 * The bindings a local run provides.
 *
 * Deliberately EMPTY of secrets: with no GROQ_API_KEY the advisor serves its
 * degraded reply, which is the path a visitor hits when upstream is down and
 * the one the contest demo's failure surface depends on. Injecting a fake key
 * would make the smoke call a real paid upstream from CI, which is exactly the
 * kind of surprise this repo's D-21 carve-out exists to prevent.
 */
export function localWorkerEnv(overrides = {}) {
  return { ...overrides };
}

function readBody(req, cap) {
  return new Promise((ok, fail) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > cap) {
        // Stop reading; the worker's own 413 check never sees a giant body.
        req.destroy();
        fail(Object.assign(new Error("payload too large"), { tooLarge: true }));
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => ok(Buffer.concat(chunks).toString("utf8")));
    req.on("error", fail);
  });
}

/**
 * Adapt one Node request/response pair to the worker's fetch contract.
 *
 * Returns the Response it produced, or null if the request never reached the
 * worker (a throw is turned into a loud 500 naming the cause, because a gate
 * that cannot reach a verdict must say why rather than look green).
 */
export async function handleWorkerRequest(worker, req, res, opts = {}) {
  const {
    env = {},
    host = "127.0.0.1",
    port = 0,
    maxBodyBytes = BRIDGE_READ_CAP,
  } = opts;

  const url = new URL(req.url || "/", `http://${host}:${port}`);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) for (const one of v) headers.append(k, one);
    else headers.set(k, String(v));
  }
  // Mirror the platform: the Worker only ever sees a client IP because
  // Cloudflare sets this header on its side.
  if (!headers.has("CF-Connecting-IP"))
    headers.set("CF-Connecting-IP", "127.0.0.1");

  const method = (req.method || "GET").toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  let body;
  if (hasBody) {
    try {
      body = await readBody(req, maxBodyBytes);
    } catch (e) {
      if (e && e.tooLarge) {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Request too large" }));
        return null;
      }
      throw e;
    }
  }

  const request = new Request(url, {
    method,
    headers,
    ...(hasBody ? { body } : {}),
  });

  // ExecutionContext stub. Nothing in the current worker calls waitUntil, but
  // an absent ctx would throw the moment a future route uses it — and a smoke
  // that dies on a missing stub teaches nothing.
  const ctx = {
    waitUntil: () => {},
    passThroughOnException: () => {},
  };

  const response = await worker.fetch(request, env, ctx);

  const outHeaders = {};
  response.headers.forEach((value, key) => {
    outHeaders[key] = value;
  });
  const payload = Buffer.from(await response.arrayBuffer());
  res.writeHead(response.status, outHeaders);
  res.end(payload);
  return response;
}
