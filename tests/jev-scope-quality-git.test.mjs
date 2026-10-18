import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { collectScopeQualityEvidence } from "../scripts/lib/jev-scope-quality-git.mjs";

const plan = readFileSync("docs/plan/MASTER_PLAN.md", "utf8");
const contentFixture = readFileSync(
  "tests/fixtures/jev-p97/content-page.html",
  "utf8",
);

function git(cwd, ...args) {
  const { status, stderr, stdout } = spawnSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
  });
  assert.equal(status, 0, stderr);
  return stdout.trim();
}

test("candidate-plan and changed-page evidence stays distinct from infra-only changes", () => {
  const repo = mkdtempSync(join(tmpdir(), "jev-p97-diff-"));
  try {
    git(repo, "init", "-q");
    git(repo, "config", "user.name", "Jev scope test");
    git(repo, "config", "user.email", "jev-scope-test@example.invalid");
    mkdirSync(join(repo, "docs", "plan"), { recursive: true });
    mkdirSync(join(repo, "blog", "example"), { recursive: true });
    const priorPlan = plan.replace(/^\| P9\.7 \|.*(?:\r?\n)?/m, "");
    assert.doesNotMatch(priorPlan, /^\| P9\.7 \|/m);
    writeFileSync(join(repo, "docs", "plan", "MASTER_PLAN.md"), priorPlan);
    writeFileSync(join(repo, "blog", "example", "index.html"), contentFixture);
    git(repo, "add", ".");
    git(repo, "commit", "-qm", "base without P9.7");
    const base = git(repo, "rev-parse", "HEAD");

    const reviewedPage = contentFixture.replace(
      "Last reviewed: October 10, 2026",
      "Last reviewed: October 12, 2026",
    );
    writeFileSync(join(repo, "docs", "plan", "MASTER_PLAN.md"), plan);
    writeFileSync(join(repo, "blog", "example", "index.html"), reviewedPage);
    git(repo, "add", ".");
    git(repo, "commit", "-qm", "introduce P9.7 and update content");
    const contentHead = git(repo, "rev-parse", "HEAD");
    const content = collectScopeQualityEvidence(
      repo,
      "P9.7",
      base,
      contentHead,
    );

    assert.deepEqual(content.changed_files.sort(), [
      "blog/example/index.html",
      "docs/plan/MASTER_PLAN.md",
    ]);
    assert.equal(content.content_criteria_applicable, true);
    assert.equal(content.content_evidence_complete, true);
    for (const evidence of [
      "| P9.7 | Content quality gate",
      "R-CONT-05",
      "Last reviewed: October 12, 2026",
      "significant figures",
    ])
      assert.ok(content.context.includes(evidence), `missing ${evidence}`);

    mkdirSync(join(repo, "scripts"), { recursive: true });
    writeFileSync(
      join(repo, "scripts", "quality-gate.mjs"),
      "export const gate = true;\n",
    );
    git(repo, "add", ".");
    git(repo, "commit", "-qm", "infrastructure change");
    const infraHead = git(repo, "rev-parse", "HEAD");
    const infrastructure = collectScopeQualityEvidence(
      repo,
      "P9.7",
      contentHead,
      infraHead,
    );

    assert.deepEqual(infrastructure.changed_files, [
      "scripts/quality-gate.mjs",
    ]);
    assert.equal(infrastructure.content_criteria_applicable, false);
    assert.ok(
      infrastructure.facet_line.includes(
        "Do not grade infrastructure files as published copy",
      ),
    );
    assert.ok(infrastructure.context.includes("export const gate = true"));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("P9.7 evidence requires full base and head commit identities", () => {
  assert.throws(
    () => collectScopeQualityEvidence(process.cwd(), "P9.7", "", "x"),
    /full base and head commit SHAs/,
  );
});
