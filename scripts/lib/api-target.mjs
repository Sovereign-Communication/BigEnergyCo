// Which worker a staged build talks to — one source of truth, resolved at
// staging time, applied to BOTH the client endpoint and the CSP that permits
// it.
//
// WHY THIS EXISTS. The client endpoint used to be a literal in
// assets/js/chat.js, and the matching `connect-src` entry a literal in
// _headers. Pointing a showcase build at its own worker therefore meant
// hand-editing the generated staging directory, which the next
// `npm run deploy:check` silently regenerates — so the second showcase deploy
// would have quietly retargeted the live advisor. The separation has to live
// in configuration, not in a build artifact nobody re-reads.
//
// The default is production, written literally in the tracked client source.
// A build with no configuration is therefore byte-for-byte the build that has
// always shipped. Setting BEC_API_BASE is the ONLY way to change it.
//
// This mirrors scripts/lib/lab-build.mjs: the staging builder owns what ships,
// so the builder owns the substitution, and it refuses to half-apply.

// Production. This is the default and is written literally in tracked source,
// so an unconfigured build needs no substitution at all.
export const DEFAULT_API_BASE =
  "https://bigenergyco-api.bigenergyco.workers.dev";

export class ApiTargetError extends Error {}

// The one environment variable that retargets a build. Named once so the
// builder, the production promote path and the tests cannot disagree about it.
export const API_TARGET_ENV = "BEC_API_BASE";

/**
 * Resolve the target from the environment.
 *
 * Refuses anything that is not a plain https origin: no wildcard host, no path,
 * no credentials, no query or fragment. A wildcard here would be handed to the
 * CSP verbatim, and `connect-src https://*.workers.dev` trusts every Worker on
 * the platform — the exact opposite of the per-origin allowlist the worker
 * enforces.
 */
export function apiTarget(env = process.env) {
  const raw = env[API_TARGET_ENV];
  if (raw === undefined || String(raw).trim() === "") {
    return { base: DEFAULT_API_BASE, isDefault: true };
  }
  const base = String(raw).trim();
  let u;
  try {
    u = new URL(base);
  } catch {
    throw new ApiTargetError(
      `BEC_API_BASE is not a URL: ${JSON.stringify(base)}. ` +
        "Expected an https origin such as " +
        "https://bigenergyco-api.bigenergyco.workers.dev",
    );
  }
  if (u.protocol !== "https:")
    throw new ApiTargetError(
      `BEC_API_BASE must be https, got ${JSON.stringify(u.protocol)}`,
    );
  if (u.pathname !== "/" || u.search || u.hash)
    throw new ApiTargetError(
      "BEC_API_BASE must be a bare origin — no path, query or fragment " +
        `(got ${JSON.stringify(base)})`,
    );
  if (u.username || u.password)
    throw new ApiTargetError("BEC_API_BASE must not carry credentials");
  if (base.includes("*"))
    throw new ApiTargetError(
      "BEC_API_BASE must not contain a wildcard: a wildcard host would be " +
        "written into the shipped CSP connect-src and would trust every " +
        "origin matching it",
    );
  // An operator who explicitly pins BEC_API_BASE at the production origin has
  // asked for the default, and gets exactly that. Reporting isDefault: false
  // here made the build retarget nothing, then trip assertNoDefaultRemains and
  // abort with a "partial retarget" message describing a retarget that never
  // happened. isDefault is a question about the VALUE, not about whether a
  // variable was set.
  return { base: u.origin, isDefault: u.origin === DEFAULT_API_BASE };
}

// Every shipped file that must agree about the endpoint. Missing one is the
// failure this module exists to make impossible: a build whose chat talks to
// the showcase worker while its sanity badge validates against production, or
// whose CSP blocks the host it just pointed at.
export const API_TARGET_FILES = [
  "assets/js/chat.js",
  "assets/js/sizing/validate.js",
  "_headers",
];

/**
 * Rewrite one staged file to `base`. Returns `{ changed, text }` and never
 * touches a file that does not carry the default.
 */
export function apiTargetTransform(relPath, text, base) {
  // Retargeting to the default is not a retarget. Without this, explicitly
  // setting BEC_API_BASE to the production URL would report every file as
  // "changed" and the build would claim a retarget it never performed.
  if (base === DEFAULT_API_BASE) return { changed: false, text };
  if (!text.includes(DEFAULT_API_BASE)) return { changed: false, text };
  return {
    changed: true,
    text: text.split(DEFAULT_API_BASE).join(base),
  };
}

/**
 * Fail loudly if any shipped file still names the default after a retargeted
 * build. A partial rewrite is worse than none: the site would look configured
 * while still calling production.
 */
export function assertNoDefaultRemains(remaining, base) {
  const stale = [...remaining];
  if (stale.length)
    throw new ApiTargetError(
      `BEC_API_BASE was set to ${base}, but ${stale.length} shipped file(s) ` +
        `still point at ${DEFAULT_API_BASE}: ${stale.join(", ")}. A partial ` +
        "retarget is worse than none — the site would appear configured while " +
        "still calling production. Refusing to publish this build.",
    );
}

/**
 * The environment a PRODUCTION build must run under.
 *
 * WHY. `BEC_API_BASE` retargets a build, and a child process inherits the
 * ambient environment by default. So a variable exported for a showcase build
 * leaked into every production build that spawned a builder — including
 * `scripts/promote.mjs`, whose artifact is what production serves. Measured:
 * with BEC_API_BASE set to the showcase worker, a promote-style build reported
 * `API target: … (3 file(s))` and shipped chat.js, the sanity-check fallback
 * and the CSP `connect-src` all pointing at the showcase worker. The showcase
 * separation would have been undone by one stray shell variable, invisibly.
 *
 * THIS IS A SCRUB, NOT A REFUSAL, and deliberately so: the build still runs and
 * still resolves production, which is what the caller asked for. Refusing would
 * also protect production, but it would block a legitimate promote on the
 * strength of a variable the operator set for a different surface, and the
 * honest response to "your shell is configured for another deployment" is to
 * say so and build what was asked for. Callers announce the ignored value so
 * the operator is never left guessing.
 *
 * The showcase path is untouched: it calls the builder with the variable SET,
 * and the builder's own `apiTarget()` is the only thing that reads it.
 */
export function productionBuildEnv(env = process.env) {
  if (!(API_TARGET_ENV in env)) return env;
  const scrubbed = { ...env };
  delete scrubbed[API_TARGET_ENV];
  return scrubbed;
}

/**
 * Does this file name the production origin EXACTLY?
//
// A bare `.includes(DEFAULT_API_BASE)` also accepts any origin that merely
// CONTAINS it — `…workers.dev:8443`, `…workers.dev.example.com`, or a path
// suffix — so a retargeted build could pass the last check before deploy. That
// is the same `js/incomplete-url-substring-sanitization` shape this repo
// suppresses in its own build tooling, so the guard that is supposed to catch
// a bad retarget must not commit it here.
//
// Three conditions, all required:
//   1. the production origin is preceded by a real boundary — start of string,
//      quote, backtick, whitespace, `=`, `,` or `(` — so it STARTS a URL rather
//      than sitting inside a longer one (`https://x.com/<production>`);
//   2. it is followed by a real terminator — quote, backtick, whitespace, `,`,
//      `;`, `)` or end of string — so no more URL follows it (`:8443`,
//      `.example.com`);
//   3. NO other workers.dev origin appears, so a file carrying the production
//      host AND a second host is rejected too.
 */
export function pointsExactlyAtProduction(content) {
  const text = String(content);
  const exact = new RegExp(
    `(^|["'\`\\s=,(])${escapeRe(DEFAULT_API_BASE)}(?=["'\`\\s,;)]|$)`,
    "g",
  );
  // A match only counts if the production origin STARTS a URL. `=` is a legal
  // leading boundary (CSP directives, `const API = "…"`) but it is also a query
  // separator, so `https://evil.example.com/?x=<production>` satisfies every
  // character rule and still names the wrong host. The discriminator is what
  // precedes it: if the text so far already ends inside a live URL, this match
  // is a parameter of that URL, not the endpoint.
  const insideAnotherUrl = /(?:^|[^a-z0-9+.-])[a-z][a-z0-9+.-]*:\/\/[^"'\s]*$/i;
  let startsOne = false;
  for (const m of text.matchAll(exact)) {
    const before = text.slice(0, m.index + m[1].length);
    if (insideAnotherUrl.test(before)) continue;
    startsOne = true;
    break;
  }
  if (!startsOne) return false;
  const other = text.match(/https:\/\/[a-z0-9.-]*workers\.dev/gi) || [];
  return other.every((u) => u === DEFAULT_API_BASE);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Prove a BUILT artifact names production, before anything deploys it.
 *
 * The scrub above is the fix; this is the check that the fix held. It reads the
 * built files rather than trusting the environment, so it also catches a spawn
 * site that forgot to pass `productionBuildEnv()` — the failure this exists to
 * make impossible, one unscrubbed call site away.
 *
 * @param {(rel: string) => string} read reader for a repo-relative path
 */
export function assertProductionArtifact(
  read,
  { files = API_TARGET_FILES } = {},
) {
  const wrong = [];
  for (const f of files) {
    if (!pointsExactlyAtProduction(read(f))) wrong.push(f);
  }
  if (wrong.length)
    throw new ApiTargetError(
      `this artifact does not point at production (${DEFAULT_API_BASE}): ` +
        `${wrong.join(", ")}. A production build must never carry another ` +
        "deployment's API host — refusing to deploy it.",
    );
}
