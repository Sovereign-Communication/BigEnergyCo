// The resilience gate is wired into CI and its report is published under a name
// the Jev evidence builder actually downloads.
//
// This is the same shape as tests/privacy-browser.test.mjs and for the same
// reason: a browser gate nobody ever wired is a gate that reports on one
// developer's machine, and the facet line the judge reads then comes from
// wherever that machine happened to be. The wiring IS the measurement's reach.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const yml = readFileSync(".github/workflows/test.yml", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("WIRING: the workflow runs the resilience gate", () => {
  assert.match(
    yml,
    /node scripts\/check-resilience\.mjs --stage _pages_resilience/,
    "the gate must run against the staged allowlisted build",
  );
  assert.match(
    yml,
    /node scripts\/deploy-pages-local\.mjs --check --stage _pages_resilience/,
    "the stage it measures must be built from the index, not from a stray " +
      "working-tree edit",
  );
});

test("WIRING: the step is recorded in the job result the judge reads", () => {
  // Without this the step runs, fails, and the job result still reads green for
  // that step — the exact ci_green defect #161 removed.
  assert.match(
    yml,
    /resilienceBrowser: "\$\{\{ steps\.resilience-browser\.outcome \}\}"/,
    "the step outcome must reach the job record the Jev gate reads",
  );
});

test("WIRING: the report is published under a name the builder downloads", () => {
  // `jev-complete` downloads `jev-results-*`; anything else is an artifact no
  // judge ever sees, which is how the Lighthouse report went unread for a cycle.
  assert.match(
    yml,
    /name: jev-results-resilience-report/,
    "the artifact name prefix is the wire",
  );
  assert.match(yml, /jev-artifacts\/resilience-report\.json/);
  assert.match(
    yml,
    /--out jev-artifacts\/resilience-report\.json/,
    "the gate must write the report the workflow uploads",
  );
  assert.match(
    yml,
    /pattern: jev-results-\*/,
    "the evidence builder's download pattern must still match this artifact",
  );
});

test("WIRING: an unmeasured facet is recorded, not skipped", () => {
  // `if: always()` so a browser that cannot start is recorded as unmeasured.
  // Without it, an earlier failure would silently skip the measurement and the
  // facet would arrive with no proof line and no explanation.
  const step = yml.slice(
    yml.indexOf("- name: Adversarial delivery measurement"),
    yml.indexOf("- name: Adversarial delivery measurement") + 400,
  );
  assert.match(step, /if: always\(\)/);
  assert.match(step, /id: resilience-browser/);
});

test("WIRING: package.json exposes the gate as a named script", () => {
  assert.equal(
    pkg.scripts["gate:resilience"],
    "node scripts/check-resilience.mjs",
  );
  // It needs a browser, so it must NOT be in `npm run seo` — that chain runs
  // without one on every machine and would make the gate unrunnable there.
  assert.doesNotMatch(
    pkg.scripts.seo,
    /check-resilience/,
    "a browser gate must not sit in the no-browser gate chain",
  );
});
