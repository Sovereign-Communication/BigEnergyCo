// Which worker does a deploy resolve to?
//
// WHY THIS EXISTS. `worker/wrangler.json` used to be the PRODUCTION config
// (`bigenergyco-api`, rate-limit namespace 9001). The showcase branch replaced
// it with the showcase config — different worker, different namespace, and the
// showcase's D1 and KV ids — so after that merge the production config existed
// nowhere in the repo and both production deploy paths ran a bare
// `wrangler deploy` from `worker/`. Wrangler resolves a bare deploy to
// `wrangler.json`, so `deploy_worker.bat` would have shipped the showcase
// worker and then written GROQ_API_KEY to it, while printing "Your Worker is
// live at". Verified by dry-run: a bare deploy resolves to
// `bigenergyco-api-showcase`, carrying env.SHARE_KV and env.USAGE_DB.
//
// Production is now `worker/wrangler.production.json`, byte-identical to what
// `main` carried, and every production deploy path names it explicitly.
//
// These assertions are the structural half. A comment cannot stop a future
// edit from renaming the showcase config back to `bigenergyco-api` and
// binding production to the showcase's database — the second-order trap. This
// can.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  "$1",
);

const PRODUCTION_WORKER = "bigenergyco-api";
const SHOWCASE_WORKER = "bigenergyco-api-showcase";
const PRODUCTION_NAMESPACE = "9001";
const SHOWCASE_NAMESPACE = "19002";
const SHOWCASE_D1 = "b99aa7ea-bd4d-43ad-b312-37d0fc2608e8";
const SHOWCASE_KV = "352d6d3f9d634f729a31a0b2a7dc0176";

// Both configs, and ONLY these two. A third wrangler config in worker/ is
// exactly the ambiguity this exists to remove, so it is refused outright.
const CONFIGS = {
  showcase: "worker/wrangler.json",
  production: "worker/wrangler.production.json",
};

const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));

const rateLimitNamespaces = (cfg) =>
  (cfg.ratelimits ?? []).map((r) => String(r.namespace_id));

test("TARGET: there are exactly two worker configs, and each names one worker", () => {
  // Exactly one config may claim the production name. Two would make
  // "which worker does this deploy" a question again.
  const claimingProduction = Object.values(CONFIGS).filter(
    (rel) => read(rel).name === PRODUCTION_WORKER,
  );
  assert.deepEqual(
    claimingProduction,
    [CONFIGS.production],
    "exactly one config may name the production worker, and it must be the production config",
  );

  const claimingShowcase = Object.values(CONFIGS).filter(
    (rel) => read(rel).name === SHOWCASE_WORKER,
  );
  assert.deepEqual(
    claimingShowcase,
    [CONFIGS.showcase],
    "the showcase config must keep its own worker name",
  );

  // The default file is the showcase, deliberately: `cd worker && wrangler
  // deploy` — the one-command showcase path — must keep working exactly as it
  // does today, and must not be the one that reaches production.
  assert.equal(
    read(CONFIGS.showcase).name,
    SHOWCASE_WORKER,
    "worker/wrangler.json must remain the showcase, so a bare deploy is harmless",
  );
});

test("TARGET: the two workers do not share a rate-limit namespace", () => {
  // A shared namespace means showcase traffic and production traffic draw on
  // one budget — the accidental-collision version of the same mistake.
  assert.deepEqual(rateLimitNamespaces(read(CONFIGS.production)), [
    PRODUCTION_NAMESPACE,
  ]);
  assert.deepEqual(rateLimitNamespaces(read(CONFIGS.showcase)), [
    SHOWCASE_NAMESPACE,
  ]);
});

test("TARGET: showcase bindings appear in the showcase config and nowhere else", () => {
  // The second-order trap: rename the showcase config to `bigenergyco-api`
  // and production is now bound to the showcase's D1 and KV, so the production
  // usage ledger writes into the showcase database.
  for (const [label, rel] of Object.entries(CONFIGS)) {
    const raw = readFileSync(join(ROOT, rel), "utf8");
    const hasD1 = raw.includes(SHOWCASE_D1);
    const hasKv = raw.includes(SHOWCASE_KV);
    assert.equal(
      hasD1 || hasKv,
      label === "showcase",
      `${rel} must ${label === "showcase" ? "" : "not "}carry the showcase D1/KV ids`,
    );
  }
});

test("TARGET: the production config binds only the rate limiter", () => {
  // Production's live binding surface. Adding a D1, KV, R2 bucket or vars
  // entry here is a decision about production, and it should have to be a
  // decision someone makes on purpose.
  const prod = read(CONFIGS.production);
  for (const key of [
    "d1_databases",
    "kv_namespaces",
    "r2_buckets",
    "vars",
    "durable_objects",
    "queues",
  ]) {
    assert.equal(
      prod[key],
      undefined,
      `the production config must not declare ${key} without a deliberate decision`,
    );
  }
  assert.equal(prod.main, "index.js");
  assert.equal(prod.workers_dev, true);
});

test("TARGET: the production deploy path cannot resolve to the showcase", () => {
  // deploy_worker.bat is executable, so this is the path that actually runs.
  const bat = readFileSync(join(ROOT, "deploy_worker.bat"), "utf8");
  const invocations = bat
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^(rem\s*)?wrangler\s+(deploy|secret\s+put)\b/i.test(l));

  assert.ok(
    invocations.length >= 2,
    "the batch file should still deploy and still set the key",
  );
  for (const line of invocations) {
    assert.match(
      line,
      /--config\s+wrangler\.production\.json\b/,
      `every deploy/secret invocation must name the production config: "${line}"`,
    );
  }

  // And no bare deploy anywhere in it, including in a comment that someone
  // might later uncomment.
  for (const line of bat.split(/\r?\n/)) {
    if (/^\s*rem\b/i.test(line)) continue;
    assert.doesNotMatch(
      line,
      /wrangler\s+deploy\s*$/i,
      `a bare \`wrangler deploy\` would resolve to the showcase worker: "${line.trim()}"`,
    );
  }
});

test("TARGET: the documented production deploy instructions name the config", () => {
  // Prose cannot be enforced into correctness, but an instruction that still
  // says "npx wrangler deploy" is an instruction that ships the showcase.
  //
  // Matched as an INSTRUCTION, not a mention: the command must start a line
  // or follow a shell separator or `npx `. A sentence that explains the trap
  // ("a bare `wrangler deploy` picks up worker/wrangler.json") is exactly the
  // text this change should add, and flagging it would make the gate push
  // toward silence rather than correctness.
  const INSTRUCTION = /(?:^|[;&|]\s*|\bnpx\s+)wrangler\s+deploy\b[^\n]*/gm;
  for (const doc of ["README.md", "docs/DOMAIN_MIGRATION_PLAN.md"]) {
    const text = readFileSync(join(ROOT, doc), "utf8");
    const found = [...text.matchAll(INSTRUCTION)].map((m) => m[0].trim());
    assert.ok(
      found.length,
      `${doc} should still document a production worker deploy — if it stopped, delete this expectation rather than the instruction`,
    );
    for (const line of found) {
      assert.match(
        line,
        /--config\s+wrangler\.production\.json/,
        `${doc} still tells a reader to run a bare deploy: "${line}"`,
      );
    }
  }
});
