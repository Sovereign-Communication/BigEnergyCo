// Gate-net drift test: this repo's gate CLAIMS and its AUTOMATION must agree.
//
// Every rule below exists because the repo drifted in exactly that way:
//   • docs presented `scripts/verify-cumulative-flow.mjs` as mandatory
//     preflight while CI never ran it;
//   • `scripts/verify-polish.mjs` and `scripts/verify-chart-contract.mjs` sat
//     crashed for weeks because nothing executed them;
//   • the protected path had no code-scanning rule, so CodeQL FINDINGS (as
//     opposed to a failed analysis) could reach main unchallenged.
//
// So: no validator may be an orphan, no doc may name a script that does not
// exist, and the ruleset must keep requiring the gates that can actually fail.
//
// Run: node --test tests/gate-net.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CODE_SCANNING_TOOLS,
  REQUIRED_CHECKS,
  analyzerIdentity,
  desiredRuleset,
} from "../scripts/lib/ruleset.mjs";

const url = (rel) => new URL(`../${rel}`, import.meta.url);
const read = (rel) => readFileSync(url(rel), "utf8");
const exists = (rel) => existsSync(url(rel));
const list = (rel) => readdirSync(fileURLToPath(url(rel)));

const pkg = JSON.parse(read("package.json"));

const workflowFiles = list(".github/workflows").filter((f) =>
  f.endsWith(".yml"),
);
const workflows = Object.fromEntries(
  workflowFiles.map((f) => [f, read(`.github/workflows/${f}`)]),
);
const allWorkflows = Object.values(workflows).join("\n");

// Every markdown file that speaks about how this repo is verified.
const DOCS = [
  ...list(".").filter((f) => f.endsWith(".md") && exists(f)),
  ...list("docs")
    .filter((f) => f.endsWith(".md"))
    .map((f) => `docs/${f}`),
];
const docText = Object.fromEntries(DOCS.map((f) => [f, read(f)]));
const allDocs = Object.values(docText).join("\n");

// Validators that genuinely cannot run in CI, each with the reason why.
// Adding to this list is a deliberate, reviewable act — that is the point: a
// new validator has to be wired or justified, never merely forgotten.
const MANUAL_VALIDATORS = new Map([
  [
    "scripts/validate-live.mjs",
    "live sweep of the deployed API and NASA endpoints; needs the network",
  ],
  [
    "scripts/validate-against-sheet.mjs",
    "blocked on the owner's spreadsheet export (PHASE2_PLAN.md tracks it)",
  ],
]);

// The two scripts this repo deliberately removed, with where their coverage
// lives now. If someone resurrects one, this test asks why.
const RETIRED = new Map([
  [
    "scripts/verify-polish.mjs",
    "crashed (its mirror list missed climate.js) with a stale contract pin; " +
      "covered by tests/run.test.mjs, tests/contract.test.mjs, tests/rescale.test.mjs, " +
      "tests/breakeven.test.mjs, tests/consistency.test.mjs and npm run verify:staging",
  ],
  [
    "scripts/verify-chart-contract.mjs",
    "replicated a worker payload the worker no longer builds, and its served-bytes " +
      "tail could not fail; the chart-gate invariant lives in tests/run.test.mjs",
  ],
]);

const npmRunNames = (text) =>
  [...text.matchAll(/npm run [\w:-]+/g)].map((m) =>
    m[0].slice("npm run ".length),
  );

test("docs never name a script that does not exist", () => {
  const missing = [];
  for (const [file, text] of Object.entries(docText)) {
    for (const m of text.matchAll(/scripts\/[\w./-]+\.mjs/g)) {
      if (!exists(m[0])) missing.push(`${file} → ${m[0]}`);
    }
  }
  assert.deepEqual(
    missing,
    [],
    `documentation promises scripts that do not exist:\n${missing.join("\n")}`,
  );
});

test("docs never name an `npm run` script that does not exist", () => {
  const missing = [];
  for (const [file, text] of Object.entries(docText)) {
    for (const name of npmRunNames(text)) {
      // `npm run` with no script name is prose, and placeholders are ignored.
      if (name && !(name in pkg.scripts))
        missing.push(`${file} → npm run ${name}`);
    }
  }
  assert.deepEqual(
    missing,
    [],
    `documentation prescribes npm scripts that do not exist:\n${missing.join("\n")}`,
  );
});

test("no validator is an orphan: each is wired into CI, a hook, or declared manual", () => {
  const reachable = new Set();
  const addScriptRefs = (text) => {
    for (const m of text.matchAll(/scripts\/[\w./-]+\.mjs/g))
      reachable.add(m[0]);
  };
  addScriptRefs(allWorkflows);
  const hooks = list(".githooks").filter(
    (f) => !f.startsWith(".") || f.endsWith(".sh"),
  );
  for (const h of hooks) addScriptRefs(read(`.githooks/${h}`));
  // A workflow that calls `npm run X` reaches every script in X's body — and
  // transitively, any npm script that body calls.
  const expand = (name, depth = 0) => {
    const body = pkg.scripts?.[name];
    if (!body || depth > 4) return;
    addScriptRefs(body);
    for (const nested of npmRunNames(body)) expand(nested, depth + 1);
  };
  for (const name of npmRunNames(allWorkflows)) expand(name);

  // Anything that is a CHECK: the validator prefixes plus the `*-test.mjs`
  // scripts, which assert and exit non-zero just like the others. Batch
  // generators and `probe-*` diagnostics are not checks and are out of scope.
  const validators = list("scripts").filter((f) =>
    /^((check|verify|validate)-[\w-]+|[\w-]+-test)\.mjs$/.test(f),
  );
  assert.ok(
    validators.length >= 10,
    `expected the validator suite to still be found (saw ${validators.length})`,
  );

  const orphans = validators
    .map((f) => `scripts/${f}`)
    .filter((p) => !reachable.has(p) && !MANUAL_VALIDATORS.has(p));
  assert.deepEqual(
    orphans,
    [],
    `validators nothing runs — wire them into a workflow/hook or list them in ` +
      `MANUAL_VALIDATORS with a reason:\n${orphans.join("\n")}`,
  );
});

test("the runbook documents every manual validator", () => {
  const runbook = docText["docs/DEPLOY_RUNBOOK.md"];
  assert.ok(runbook, "the deployment runbook is the canonical gate index");
  for (const [path, reason] of MANUAL_VALIDATORS) {
    assert.ok(
      runbook.includes(path),
      `${path} is excluded from CI (${reason}) so docs/DEPLOY_RUNBOOK.md must say so`,
    );
  }
});

test("a manual validator fails loudly instead of passing vacuously", () => {
  const r = spawnSync(
    process.execPath,
    ["scripts/validate-against-sheet.mjs"],
    {
      encoding: "utf8",
    },
  );
  assert.notEqual(
    r.status,
    0,
    "a validator with no input must exit non-zero, never look green",
  );
  assert.match(
    `${r.stdout}${r.stderr}`,
    /usage/i,
    "and it must say what input it needs",
  );
});

test("the wired gates are actually wired", () => {
  assert.equal(
    pkg.scripts["verify:flow"],
    "node scripts/verify-cumulative-flow.mjs",
    "the offline flow gate is one command",
  );
  assert.ok(
    /npm run verify:flow/.test(workflows["test.yml"]),
    "PR CI must run the offline flow gate, not just document it",
  );
  assert.equal(
    pkg.scripts["verify:economics"],
    "node scripts/swap-strategy-test.mjs",
    "the oversize-vs-engine economics gate is one command",
  );
  assert.ok(
    /npm run verify:economics/.test(workflows["test.yml"]),
    "PR CI must run the economics gate too — it asserted real savings maths in " +
      "a script nothing executed",
  );
  assert.match(
    pkg.scripts["verify:live"] || "",
    /validate-modes\.mjs[\s\S]*validate-soc-pipeline\.mjs/,
    "the live gate runs both NASA-data model checks",
  );
  assert.ok(
    /npm run verify:live/.test(workflows["scheduled-smoke.yml"]),
    "the live NASA checks need the network, so the weekly sweep must run them",
  );
  assert.ok(
    /^ {2}live-models:/m.test(workflows["scheduled-smoke.yml"]),
    "and as its own job, so a NASA outage cannot be mistaken for production drift",
  );
});

test("the retired validators stay retired", () => {
  const resurrected = [...RETIRED.keys()].filter((p) => exists(p));
  assert.deepEqual(
    resurrected,
    [],
    `these were removed on purpose:\n${[...RETIRED].map(([p, why]) => `${p} — ${why}`).join("\n")}`,
  );
});

test("the protected path requires the analyzer gate, not just a green run", () => {
  const rules = desiredRuleset().rules;
  const ruleTypes = rules.map((r) => r.type);

  // A failed CodeQL *analysis* is already caught by requiring `analyze`; the
  // code_scanning rule is the only thing that stops reported ALERTS merging.
  assert.ok(
    REQUIRED_CHECKS.includes("analyze"),
    "a failing CodeQL analysis must block a merge",
  );
  assert.ok(
    ruleTypes.includes("code_scanning"),
    "new CodeQL findings must block a merge — that needs the code_scanning rule",
  );

  const tools = rules.find((r) => r.type === "code_scanning")?.parameters
    ?.code_scanning_tools;
  assert.deepEqual(
    tools?.map(analyzerIdentity),
    CODE_SCANNING_TOOLS.map(analyzerIdentity),
    "the live tools must match the declared ones",
  );
  for (const t of tools) {
    assert.equal(t.tool, "CodeQL", "the analyzer this repo actually runs");
    assert.ok(
      t.alerts_threshold && t.alerts_threshold !== "none",
      "a threshold of 'none' would make the rule decorative",
    );
    assert.ok(
      t.security_alerts_threshold && t.security_alerts_threshold !== "none",
      "security findings must have a real threshold",
    );
  }

  const contexts = new Set(
    rules
      .find((r) => r.type === "required_status_checks")
      ?.parameters?.required_status_checks.map((c) => c.context) || [],
  );
  for (const check of REQUIRED_CHECKS) {
    assert.ok(contexts.has(check), `${check} must be a required status check`);
  }
});

test("every required status check has a job that can report it", () => {
  const jobNames = new Set();
  for (const text of Object.values(workflows)) {
    const jobs = text.split(/^jobs:/m)[1] || "";
    for (const m of jobs.matchAll(/^ {2}([\w-]+):/gm)) jobNames.add(m[1]);
  }
  assert.ok(
    jobNames.size >= 5,
    `workflow jobs should be discoverable (found ${[...jobNames].join(", ")})`,
  );
  for (const check of REQUIRED_CHECKS) {
    assert.ok(
      jobNames.has(check),
      `required check "${check}" is not a job any workflow defines — every PR ` +
        `would wait forever on a status that can never be reported`,
    );
  }
});
