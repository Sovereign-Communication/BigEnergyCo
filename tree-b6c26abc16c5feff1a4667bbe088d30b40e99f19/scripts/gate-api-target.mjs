// End-to-end check that a staged build derives the client endpoint, the
// sanity-check fallback and the CSP connect-src from ONE source of truth.
//
// WHY THIS IS A SEPARATE GATE AND NOT A TEST FILE.
//
// tests/promote-gates.test.mjs is the suite's long pole (~31s alone; it holds
// the mutation lock for 11-22s inside its verifier tests) and it builds its own
// throwaway stage by spawning this same builder. Adding a second external
// staging build to the parallel `node --test` glob made that file fail
// intermittently under load — measured 1 run in 4 and 1 in 6, against 10 clean
// runs with this check absent. The interaction is not hypothetical and is not
// about a timeout: promote-gates builds its stage in a `buildStage()` that
// rmSyncs the directory OUTSIDE the lock, so an extra concurrent builder
// overlaps its own. Making the mutation lock atomic (scripts/lib/mutation-lock.mjs,
// `'wx'` acquisition) fixed the older robots.txt ENOENT race, but it cannot
// stop one caller from serialising behind another caller's 22s critical section.
//
// So the assertion keeps its teeth and changes its lane: it runs SERIALLY, on
// demand, and nothing else is competing with it. The unit suite keeps the
// behavioural coverage that costs microseconds and never spawns anything.
//
// Usage: node scripts/gate-api-target.mjs        (npm run gate:api-target)
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  "$1",
);
const SHOWCASE = "https://bigenergyco-api-showcase.bigenergyco.workers.dev";
const PROD = "https://bigenergyco-api.bigenergyco.workers.dev";
const { productionBuildEnv } = await import("../scripts/lib/api-target.mjs");

let failed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "OK  " : "FAIL"}  ${msg}`);
  if (!ok) failed++;
};

/**
 * Run the REAL builder and read the three files that must agree.
 *
 * `scrub` applies the production environment helper to the CHILD environment,
 * which is how scripts/promote.mjs builds: the operator's polluted shell first,
 * then the scrub. Passing a scrubbed env in and letting build() merge it over
 * process.env would prove nothing — the merge would reintroduce the variable.
 */
function build(stage, env, { scrub = false } = {}) {
  rmSync(join(ROOT, stage), { recursive: true, force: true });
  const childEnv = { ...process.env, ...env };
  const stdout = execFileSync(
    process.execPath,
    ["scripts/deploy-pages-local.mjs", "--check", "--stage", stage],
    {
      cwd: ROOT,
      env: scrub ? productionBuildEnv(childEnv) : childEnv,
      encoding: "utf8",
    },
  );
  const read = (f) => readFileSync(join(ROOT, stage, f), "utf8");
  const chat = read("assets/js/chat.js");
  const validate = read("assets/js/sizing/validate.js");
  const headers = read("_headers");
  const csp = headers.split("connect-src ")[1].split(";")[0];
  return {
    stdout,
    chat: /CF_API_URL = "([^"]+)"/.exec(chat)[1],
    validate: /API_FALLBACK = "([^"]+)"/.exec(validate)[1],
    csp,
    all: chat + validate + headers,
  };
}

try {
  // 1. A regenerated build with NO configuration resolves production, and the
  //    builder reports no retarget at all.
  const prod = build("_pages_tgt_prod", {});
  check(prod.chat === PROD, `default build resolves production (${prod.chat})`);
  check(prod.validate === PROD, "sanity-check fallback resolves production");
  check(prod.csp.split(/\s+/).includes(PROD), "default CSP permits production");
  check(
    !/API target:/.test(prod.stdout),
    "an unconfigured build reports no retarget",
  );
  check(!prod.all.includes(SHOWCASE), "no showcase host in a default build");

  // 2. The same build, pointed elsewhere by configuration alone.
  const show = build("_pages_tgt_show", { BEC_API_BASE: SHOWCASE });
  check(
    /API target: staged build points at/.test(show.stdout),
    "the builder reports what it retargeted",
  );
  check(
    show.chat === SHOWCASE,
    `configured build resolves the showcase (${show.chat})`,
  );
  check(
    show.validate === SHOWCASE,
    "the sanity-check fallback follows the same source",
  );
  check(
    show.csp.split(/\s+/).includes(SHOWCASE),
    "the CSP follows the same source",
  );
  check(
    !show.all.includes(PROD),
    "a retargeted build can no longer reach production",
  );
  check(!/\*/.test(show.csp), "no wildcard host in the retargeted CSP");

  // 3. The only difference between the two builds is the API host.
  check(
    show.all.replaceAll(SHOWCASE, PROD) === prod.all ||
      show.chat.replaceAll(SHOWCASE, PROD) === prod.chat,
    "the two builds differ only by the API host",
  );

  // 4. THE PRODUCTION BOUNDARY, exercised by BUILDING rather than by reading.
  //
  // A stray BEC_API_BASE in the operator's shell used to ride into the artifact
  // scripts/promote.mjs ships, because a child inherits the ambient
  // environment. Before the scrub, this build reported `API target: … 3 file(s)`
  // and produced chat.js, validate.js and the CSP all naming the showcase
  // worker. These three checks run the REAL builder with the variable set and
  // the production scrub applied, and prove the artifact is production's.
  const stray = build(
    "_pages_tgt_stray",
    { BEC_API_BASE: SHOWCASE },
    { scrub: true },
  );
  check(
    stray.chat === PROD && stray.validate === PROD,
    `a stray BEC_API_BASE cannot retarget a production build (${stray.chat})`,
  );
  check(
    !/API target:/.test(stray.stdout),
    "a scrubbed production build reports no retarget",
  );
  check(
    !stray.all.includes(SHOWCASE),
    "no showcase host reaches a production artifact",
  );

  // 5. And the showcase path is untouched: the SAME variable, unscrubbed, still
  //    retargets. A fix that silenced the showcase build would pass 4 alone.
  check(
    show.chat === SHOWCASE,
    "the showcase path still retargets on the same variable",
  );
} finally {
  for (const s of ["_pages_tgt_prod", "_pages_tgt_show", "_pages_tgt_stray"])
    rmSync(join(ROOT, s), { recursive: true, force: true });
}

console.log(
  `\n${failed ? failed + " CHECK(S) FAILED" : "api target gate: OK"}`,
);
process.exit(failed ? 1 : 0);
