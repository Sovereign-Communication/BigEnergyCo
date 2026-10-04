import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_API_BASE,
  API_TARGET_ENV,
  API_TARGET_FILES,
  ApiTargetError,
  apiTarget,
  apiTargetTransform,
  assertNoDefaultRemains,
  productionBuildEnv,
  assertProductionArtifact,
  pointsExactlyAtProduction,
} from "../scripts/lib/api-target.mjs";
import { deployList } from "../scripts/lib/deploy-manifest.mjs";

const ROOT = new URL("..", import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  "$1",
);
const SHOWCASE = "https://bigenergyco-api-showcase.bigenergyco.workers.dev";

test("TARGET: an unconfigured build resolves production and changes nothing", () => {
  const t = apiTarget({});
  assert.equal(t.isDefault, true);
  assert.equal(t.base, DEFAULT_API_BASE);
  assert.equal(t.base, "https://bigenergyco-api.bigenergyco.workers.dev");

  // The default must be a no-op on every shipped file, so the unconfigured
  // build is byte-identical to what has always shipped.
  for (const f of API_TARGET_FILES) {
    const src = readFileSync(join(ROOT, f), "utf8");
    const r = apiTargetTransform(f, src, t.base);
    assert.equal(r.changed, false, `${f} must be untouched by a default build`);
    assert.equal(r.text, src, `${f} must be byte-identical by default`);
  }
});

test("TARGET: tracked client source still names production, never a showcase", () => {
  // The showcase worker must not appear anywhere in tracked source; the
  // separation has to live in configuration.
  for (const f of API_TARGET_FILES) {
    const src = readFileSync(join(ROOT, f), "utf8");
    assert.ok(
      src.includes(DEFAULT_API_BASE),
      `${f} must still carry the production default as its literal`,
    );
    assert.doesNotMatch(
      src,
      /bigenergyco-api-showcase/,
      `${f} must not hardcode the showcase worker in tracked source`,
    );
  }
});

test("TARGET: a configured build retargets the endpoint and its CSP together", () => {
  const t = apiTarget({ BEC_API_BASE: SHOWCASE });
  assert.equal(t.isDefault, false);
  assert.equal(t.base, SHOWCASE);

  for (const f of API_TARGET_FILES) {
    const src = readFileSync(join(ROOT, f), "utf8");
    const r = apiTargetTransform(f, src, t.base);
    assert.equal(r.changed, true, `${f} must be rewritten`);
    assert.ok(
      r.text.includes(SHOWCASE),
      `${f} must name the showcase worker after a retarget`,
    );
    assert.doesNotMatch(
      r.text,
      /bigenergyco-api\.bigenergyco\.workers\.dev/,
      `${f} must not still reach production after a retarget`,
    );
  }

  // The CSP must permit exactly the target and nothing wildcard-shaped.
  const headers = apiTargetTransform(
    "_headers",
    readFileSync(join(ROOT, "_headers"), "utf8"),
    t.base,
  ).text;
  const connectSrc = headers.split("connect-src ")[1].split(";")[0];
  assert.ok(
    connectSrc.split(/\s+/).includes(SHOWCASE),
    "connect-src must allow the retargeted worker",
  );
  assert.doesNotMatch(
    connectSrc,
    /\*/,
    "connect-src must not gain a wildcard host — that would trust every " +
      "origin matching it",
  );
});

test("TARGET: a half-retargeted build is refused, not published", () => {
  // The failure this whole module exists to prevent: chat retargeted, CSP and
  // sanity badge left on production. Publishing that looks configured while
  // still calling the live advisor.
  assert.throws(
    () =>
      assertNoDefaultRemains(
        ["_headers", "assets/js/sizing/validate.js"],
        SHOWCASE,
      ),
    (e) =>
      e instanceof ApiTargetError &&
      /partial retarget is worse than none/.test(e.message),
  );
  // All three rewritten is fine.
  assert.doesNotThrow(() => assertNoDefaultRemains([], SHOWCASE));
});

test("TARGET: the configuration cannot widen into a wildcard or a non-origin", () => {
  for (const bad of [
    "https://*.workers.dev",
    "https://*.bigenergyco.workers.dev",
    "http://bigenergyco-api-showcase.bigenergyco.workers.dev",
    "https://example.com/api",
    "https://example.com?x=1",
    "not-a-url",
    "https://user:pw@example.com",
  ]) {
    assert.throws(
      () => apiTarget({ BEC_API_BASE: bad }),
      ApiTargetError,
      `${bad} must be rejected`,
    );
  }
  // A trailing slash is a normal way to write an origin, not an attack.
  assert.equal(
    apiTarget({ BEC_API_BASE: SHOWCASE + "/" }).base,
    SHOWCASE,
    "a trailing slash normalises to the bare origin",
  );
  // Whitespace from a shell variable must not smuggle anything in.
  assert.equal(apiTarget({ BEC_API_BASE: `  ${SHOWCASE}  ` }).base, SHOWCASE);
});

test("TARGET: a production build ignores an ambient BEC_API_BASE", () => {
  // The leak this closes, measured: a child inherits the shell's environment,
  // so BEC_API_BASE exported for a showcase build rode into the artifact
  // scripts/promote.mjs ships, and chat.js, the sanity fallback and the CSP all
  // came out naming the showcase worker. Scrubbing is what stops it.
  const ambient = { PATH: "/usr/bin", BEC_API_BASE: SHOWCASE };
  const scrubbed = productionBuildEnv(ambient);
  assert.ok(
    !(API_TARGET_ENV in scrubbed),
    "the retarget variable must not survive into a production build",
  );
  assert.equal(scrubbed.PATH, "/usr/bin", "the rest of the environment does");
  assert.equal(
    apiTarget(scrubbed).base,
    DEFAULT_API_BASE,
    "a scrubbed environment resolves production",
  );
  assert.equal(
    apiTarget(scrubbed).isDefault,
    true,
    "and reports itself as the default target, not a retarget",
  );

  // The input must not be mutated: the caller's own environment is not ours to
  // rewrite, and the showcase path still needs to read the variable afterwards.
  assert.equal(
    ambient[API_TARGET_ENV],
    SHOWCASE,
    "the caller's environment must be left alone",
  );

  // With nothing set, the environment is returned as-is — no copy, no churn.
  const clean = { PATH: "/usr/bin" };
  assert.equal(productionBuildEnv(clean), clean);
});

test("TARGET: an artifact that does not name production is refused", () => {
  // The second layer. It reads what was BUILT, so it also catches a spawn site
  // that forgets the scrub entirely.
  const production = Object.fromEntries(
    API_TARGET_FILES.map((f) => [f, `// ${DEFAULT_API_BASE}\n`]),
  );
  assert.doesNotThrow(() => assertProductionArtifact((f) => production[f]));

  for (const f of API_TARGET_FILES) {
    const retargeted = { ...production, [f]: `// ${SHOWCASE}\n` };
    assert.throws(
      () => assertProductionArtifact((g) => retargeted[g]),
      (e) =>
        e instanceof ApiTargetError &&
        /does not point at production/.test(e.message) &&
        e.message.includes(f),
      `${f} pointing at the showcase worker must be refused`,
    );
  }

  // Every tracked file must still carry the production literal, or the check
  // above would pass vacuously on a file that never named any API host.
  for (const f of API_TARGET_FILES) {
    const src = readFileSync(join(ROOT, f), "utf8");
    assert.doesNotThrow(
      () => assertProductionArtifact(() => src),
      `${f} must name production in tracked source`,
    );
  }
});

test("TARGET: naming production EXACTLY is not the same as containing it", () => {
  // The last gate before deploy used `.includes(DEFAULT_API_BASE)`, which
  // accepts any string CONTAINING the production origin. That is a retarget
  // slipping through the one check that exists to stop it — and it is the same
  // incomplete-url-substring-sanitization shape CodeQL is configured to
  // suppress in this very repo. Measured before the fix: every row below
  // except the first two returned true and the deploy would have proceeded.
  const P = DEFAULT_API_BASE;
  const cases = [
    // [content, expected, why]
    [`// ${P}\n`, true, "the bare literal, as tracked source carries it"],
    [`const API = "${P}";`, true, "in a string literal"],
    [`connect-src ${P}`, true, "in a CSP directive"],
    [
      `https://evil.example.com/?x=${P}`,
      false,
      "production nested inside a longer URL",
    ],
    [`${P}:8443`, false, "a port suffix on the production host"],
    [`${P}.example.com`, false, "a subdomain suffix"],
    [`${P}@evil.example.com`, false, "production as userinfo of another host"],
    [
      `${P}@bigenergyco-api.evil.dev`,
      false,
      "production as userinfo, real host elsewhere",
    ],
    [`${P} ${SHOWCASE}`, false, "both the default and a retarget in one file"],
    [`${P}.workers.dev`, false, "a doubled suffix"],
  ];
  for (const [content, expected, why] of cases) {
    assert.equal(
      pointsExactlyAtProduction(content),
      expected,
      `${why}: ${JSON.stringify(content)}`,
    );
  }

  // The rule must survive the files that actually ship.
  for (const f of API_TARGET_FILES) {
    assert.equal(
      pointsExactlyAtProduction(readFileSync(join(ROOT, f), "utf8")),
      true,
      `${f} must name production exactly`,
    );
  }
});

test("TARGET: BEC_API_BASE pinned to production is a default, not a retarget", () => {
  // Measured before the fix: this returned isDefault:false, so the builder
  // rewrote nothing, assertNoDefaultRemains then fired, and the build aborted
  // with "partially retargeted" — describing a retarget that never happened,
  // for an operator who had explicitly asked for production.
  const t = apiTarget({ [API_TARGET_ENV]: DEFAULT_API_BASE });
  assert.equal(t.base, DEFAULT_API_BASE);
  assert.equal(t.isDefault, true);

  // Trailing slashes and a path must not smuggle it past the same check.
  assert.equal(
    apiTarget({ [API_TARGET_ENV]: `${DEFAULT_API_BASE}/` }).isDefault,
    true,
    "a trailing slash is the same origin",
  );

  // A genuinely different origin is still a retarget.
  assert.equal(apiTarget({ [API_TARGET_ENV]: SHOWCASE }).isDefault, false);
  assert.equal(
    apiTarget({ [API_TARGET_ENV]: `${DEFAULT_API_BASE}:8443` }).isDefault,
    false,
    "a different PORT is a different origin",
  );
});

test("TARGET: the promote path builds production in a scrubbed environment", () => {
  // Source-level wiring, cheap and non-flaky: the real build proof lives in
  // scripts/gate-api-target.mjs, which runs the actual builder. What is pinned
  // HERE is that promote routes BOTH of its build spawns through the scrub and
  // asserts the result — a third spawn, or one that skips the scrub, must fail
  // this rather than pass silently.
  const src = readFileSync(join(ROOT, "scripts/promote.mjs"), "utf8");

  // One owner of the spawn: promote must reach the builder through exactly one
  // helper. Two spawns would mean a second, unscrubbed call site.
  const inlineSpawns =
    src.match(
      /execFileSync\(\s*process\.execPath,\s*\[\s*"scripts\/deploy-pages-local\.mjs"/g,
    ) || [];
  assert.equal(
    inlineSpawns.length,
    1,
    "exactly one place in promote may spawn the builder",
  );

  assert.ok(
    src.includes("buildProductionStage("),
    "promote must build through the production helper",
  );
  const helperCalls = src.match(/buildProductionStage\(/g) || [];
  assert.equal(
    helperCalls.length,
    3,
    "one definition plus both build sites (rollback artifact and apply)",
  );
  assert.ok(
    src.includes("env: BUILD_ENV"),
    "the production build must be spawned with the scrubbed environment",
  );
  assert.ok(
    src.includes("productionBuildEnv()"),
    "and that environment must come from the one shared scrub",
  );

  // Both artifacts are asserted, not just built: the check that reads the files
  // back is what catches a spawn site that never got the scrub.
  assert.equal(
    (src.match(/assertProduction\(/g) || []).length,
    3,
    "one definition plus both build sites must assert what they built",
  );
  assert.ok(
    src.includes("IGNORED_API_TARGET"),
    "an ignored ambient variable must be announced, not silently dropped",
  );
});

test("TARGET: the builder derives endpoint, fallback and CSP from one source", () => {
  // The heavy end-to-end check — the real builder, run twice, on the real
  // allowlist — lives in scripts/gate-api-target.mjs, NOT here, and that is a
  // deliberate result rather than a convenience. This file is one worker among
  // ~40 run in parallel by `node --test`, and promote-gates is the long pole
  // that holds the shared mutation lock for 11-22s while it builds its own
  // throwaway stage by spawning this same builder. Measured: with a staging
  // build spawned from this file, promote-gates failed 1 run in 4 and 1 in 6
  // under load, against 10 clean runs without it. Serialising the end-to-end
  // check into its own gate keeps the claim and removes the contention.
  //
  // What is asserted HERE is the part that would silently rot: that the builder
  // actually calls the one transform, over the whole file set, and that it
  // refuses to publish a half-retargeted build. Those are source-level facts,
  // they cost nothing, and no scheduling change can make them flaky.
  const builder = readFileSync(
    join(ROOT, "scripts/deploy-pages-local.mjs"),
    "utf8",
  );
  // Plain string matching, deliberately: these are literal source facts, and a
  // regex here would only add escaping that can rot silently.
  assert.ok(
    builder.includes("if (!target.isDefault)"),
    "the builder must skip the rewrite unless a target is configured",
  );
  assert.ok(
    builder.includes("apiTargetTransform("),
    "the builder must apply the one shared transform",
  );
  assert.ok(
    builder.includes("assertNoDefaultRemains("),
    "the builder must refuse a partial retarget",
  );
  assert.ok(
    builder.includes("for (const f of deployList())"),
    "the builder must sweep the whole allowlist, not a hand-listed few files",
  );

  // And the file set that transform has to cover is pinned, so a new shipped
  // file that names the API host cannot join the build without joining here.
  for (const f of API_TARGET_FILES) {
    assert.ok(deployList().includes(f), `${f} must be in the deploy allowlist`);
  }

  // The transform, over the real tracked sources, must produce all three files
  // coherently for a retarget — the same work the builder performs.
  for (const f of API_TARGET_FILES) {
    const tracked = readFileSync(join(ROOT, f), "utf8");
    const r = apiTargetTransform(f, tracked, SHOWCASE);
    assert.equal(r.changed, true, `${f} must be rewritten for a retarget`);
    assert.ok(r.text.includes(SHOWCASE), `${f} must name the target`);
    assert.doesNotMatch(
      r.text,
      /bigenergyco-api.bigenergyco.workers.dev/,
      `${f} must not still reach production after a retarget`,
    );
  }
});
