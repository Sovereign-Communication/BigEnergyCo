import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  buildScopeQualityEvidence,
  collectScopeQualityEvidence,
  P97_QUALITY_RUBRIC,
} from "../scripts/lib/jev-scope-quality.mjs";
import { buildStateText } from "../scripts/lib/jev-complete.mjs";

function git(cwd, ...args) {
  const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test("P9.7 quality evidence pairs the approved rubric with measured PR changes", () => {
  const evidence = buildScopeQualityEvidence("P9.7", {
    files: ["blog/nl/example.md", "scripts/lib/jev-scope.mjs"],
    additions: 12,
    deletions: 3,
    patch:
      "diff --git a/blog/nl/example.md b/blog/nl/example.md\n+Nieuwe tekst voor lezers.\ndiff --git a/scripts/lib/jev-scope.mjs b/scripts/lib/jev-scope.mjs\n+return { scope, how: 'explicit' };",
  });

  assert.ok(evidence);
  assert.match(evidence.context, /byte-identical shared style blocks/);
  assert.match(evidence.context, /no cannibalization/);
  assert.match(evidence.context, /official sources for news hooks/);
  assert.match(evidence.context, /second person/);
  assert.match(evidence.context, /2 files, \+12\/-3/);
  assert.match(evidence.context, /blog\/nl\/example\.md/);
  assert.match(evidence.context, /Nieuwe tekst/);
  assert.match(evidence.facet_line, /actual-diff evidence/);
  assert.ok(evidence.context.length <= 1250);
});

test("other scopes do not replace the repository's quality evidence", () => {
  assert.equal(
    buildScopeQualityEvidence("P9.1", { files: ["assets/js/i18n.js"] }),
    null,
  );
});

test("scope-specific quality evidence reaches Jev alongside its quality facet", () => {
  const evidence = buildScopeQualityEvidence("P9.7", {
    files: ["docs/plan/MASTER_PLAN.md"],
    additions: 1,
    deletions: 0,
    patch:
      "diff --git a/docs/plan/MASTER_PLAN.md b/docs/plan/MASTER_PLAN.md\n+| P9.7 | Content quality gate |",
  });
  const state = buildStateText(
    { facet_evidence: { quality: evidence.facet_line } },
    { target: "pr @ head", sha: "head", treeClean: true, secretsClean: true },
    ["quality"],
    evidence.context,
  );

  assert.match(state, /quality: For P9\.7/);
  assert.match(state, /scope_quality_evidence: P9\.7 approved criteria/);
  assert.match(state, /Actual PR diff: 1 files, \+1\/-0/);
});

test("live P9.7 evidence is measured from the exact base-to-head diff", () => {
  const repo = mkdtempSync(join(tmpdir(), "jev-p97-diff-"));
  try {
    git(repo, "init", "-q");
    git(repo, "config", "user.name", "Jev scope test");
    git(repo, "config", "user.email", "jev-scope-test@example.invalid");
    mkdirSync(join(repo, "blog", "nl"), { recursive: true });
    writeFileSync(join(repo, "blog", "nl", "example.md"), "# Origineel\n");
    git(repo, "add", ".");
    git(repo, "commit", "-qm", "base");
    const base = git(repo, "rev-parse", "HEAD");
    writeFileSync(
      join(repo, "blog", "nl", "example.md"),
      "# Zonnepanelen kiezen\nKies de maat die bij uw verbruik past.\n",
    );
    git(repo, "add", ".");
    git(repo, "commit", "-qm", "head");
    const head = git(repo, "rev-parse", "HEAD");

    const evidence = collectScopeQualityEvidence(repo, "P9.7", base, head);
    assert.deepEqual(evidence.changed_files, ["blog/nl/example.md"]);
    assert.equal(evidence.additions, 2);
    assert.equal(evidence.deletions, 1);
    assert.match(evidence.context, /Kies de maat/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("P9.7 diff evidence refuses missing or malformed commit identities", () => {
  assert.throws(
    () => collectScopeQualityEvidence(process.cwd(), "P9.7", "", "x"),
    /full base and head commit SHAs/,
  );
  assert.equal(P97_QUALITY_RUBRIC.startsWith("P9.7 approved criteria:"), true);
});
