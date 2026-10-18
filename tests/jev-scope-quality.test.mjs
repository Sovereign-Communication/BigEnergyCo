import { test } from "node:test";
import assert from "node:assert/strict";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  buildScopeQualityEvidence,
  collectScopeQualityEvidence,
  extractP97QualityRubric,
  isBlogPostFile,
  isGovernedContentFile,
} from "../scripts/lib/jev-scope-quality.mjs";
import { buildStateText } from "../scripts/lib/jev-complete.mjs";

const plan = readFileSync("docs/plan/MASTER_PLAN.md", "utf8");
const contentFixture = readFileSync(
  "tests/fixtures/jev-p97/content-page.html",
  "utf8",
);
const infrastructureFixture = readFileSync(
  "tests/fixtures/jev-p97/infrastructure-only.patch",
  "utf8",
);

function git(cwd, ...args) {
  const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test("the P9.7 rubric is extracted from the authoritative plan with all five content rules", () => {
  const rubric = extractP97QualityRubric(plan);
  for (const requirement of [
    "| P9.7 |",
    "| D-05 |",
    "R-CONT-01",
    "R-CONT-02",
    "R-CONT-03",
    "R-CONT-04",
    "R-CONT-05",
    "R-RES-07",
    "R-SEO-05",
  ]) {
    assert.ok(rubric.includes(requirement), `missing ${requirement}`);
  }
  assert.match(rubric, /canonical formatting/);
  assert.match(rubric, /metadata\/JSON-LD parity/);
  assert.match(rubric, /real search demand/);
  assert.match(rubric, /no cannibalization/);
  assert.match(rubric, /verifiable claims with cited sources/);
  assert.match(rubric, /official sources only for news hooks/);
  assert.match(rubric, /reading grade of/);
  assert.match(rubric, /every technical term/);
  assert.match(rubric, /all locales/);
  assert.match(rubric, /2–3 significant figures/);
  assert.match(rubric, /percentages are whole numbers/);
  assert.match(rubric, /Full precision appears only in tables and CSV/);
  assert.match(rubric, /no decimals at or above 100 units/);
  assert.match(rubric, /never suggests unlicensed electrical work/);
  assert.match(rubric, /fall protection/);
  assert.match(rubric, /Stale figures are fixed or removed/);
  assert.match(rubric, /last reviewed/);
  assert.match(rubric, /No hype, no fear, no sales language/);
  assert.match(rubric, /country-specific checklist/);
  assert.match(rubric, /two or three quotes/);
  assert.match(rubric, /where DIY is not permitted/);
  assert.match(rubric, /No lead forms and no company names/);
});

test("the representative public page fixture covers copy, number, source, legal, safety, and review evidence", () => {
  assert.match(contentFixture, /rel="canonical"/);
  assert.match(contentFixture, /application\/ld\+json/);
  assert.ok(contentFixture.includes("<title>A 2.4 kW solar system"));
  assert.ok(contentFixture.includes("<h1>A 2.4 kW solar system"));
  assert.match(contentFixture, /2\.4 kW/);
  assert.match(contentFixture, /35%/);
  assert.match(contentFixture, /\$8,200/);
  assert.match(contentFixture, /146\.28 kWh/);
  assert.match(contentFixture, /kilowatt-hour \(kWh\)/);
  assert.match(
    contentFixture,
    /A licensed electrician must do every electrical termination/,
  );
  assert.match(contentFixture, /fall protection/);
  assert.match(contentFixture, /permit and grid-connection steps/);
  assert.match(contentFixture, /not a quote or a guarantee/);
  assert.match(contentFixture, /dataset updated in 2026/);
  assert.match(contentFixture, /Last reviewed: October 10, 2026/);
});

test("public HTML is governed content while internal, non-content, and 404 files are excluded", () => {
  for (const file of [
    "index.html",
    "about/index.html",
    "blog/example/index.html",
    "solar-calculator/example/index.html",
    "solar-heatmap/index.html",
  ]) {
    assert.equal(isGovernedContentFile(file), true, file);
  }
  for (const file of [
    "404.html",
    "docs/guide.html",
    "scripts/generated.html",
    "tests/fixtures/jev-p97/content-page.html",
    "assets/template.html",
    "blog/SEO-DOCTRINE.md",
  ]) {
    assert.equal(isGovernedContentFile(file), false, file);
  }
  assert.equal(isBlogPostFile("blog/example/index.html"), true);
  assert.equal(isBlogPostFile("blog/index.html"), false);
  assert.equal(isBlogPostFile("about/index.html"), false);
});

test("glossary, localized copy, numeric display sources, legal terms, and SEO files are governed content", () => {
  for (const file of [
    "assets/js/shared/jargon-dict.js",
    "assets/js/shared/locales.js",
    "assets/js/shared/content.js",
    "assets/js/sizing/money.js",
    "assets/js/sizing/city-data/US.json",
    "assets/data/provenance.json",
    "LIABILITY.md",
    "sitemap.xml",
    "llms.txt",
  ]) {
    assert.equal(isGovernedContentFile(file), true, file);
  }
  assert.equal(
    isGovernedContentFile("scripts/lib/jev-scope-quality.mjs"),
    false,
  );
  assert.equal(isGovernedContentFile("worker/wrangler.json"), false);

  const evidence = buildScopeQualityEvidence(
    "P9.7",
    {
      files: ["assets/js/shared/jargon-dict.js"],
      additions: 1,
      deletions: 0,
      patch: "+  term: a plain-language definition",
    },
    plan,
  );
  assert.equal(evidence.content_criteria_applicable, true);
  assert.match(evidence.context, /every technical term/);
});
test("changed governed content receives the complete rubric and its full page snapshot", () => {
  const evidence = buildScopeQualityEvidence(
    "P9.7",
    {
      files: ["blog/example/index.html"],
      additions: 4,
      deletions: 2,
      patch: "+A new, reviewed sentence.",
      contentSnapshots: [
        {
          path: "blog/example/index.html",
          revision: "head",
          content: contentFixture,
        },
      ],
    },
    plan,
  );

  assert.equal(evidence.content_criteria_applicable, true);
  assert.equal(evidence.content_evidence_complete, true);
  assert.deepEqual(evidence.content_files, ["blog/example/index.html"]);
  assert.match(evidence.context, /R-CONT-01/);
  assert.match(evidence.context, /R-CONT-05/);
  assert.match(
    evidence.context,
    /licensed electrician must do every electrical termination/,
  );
  assert.match(evidence.context, /Last reviewed: October 10, 2026/);
  assert.match(evidence.context, /A new, reviewed sentence/);
  assert.match(evidence.facet_line, /full changed-page snapshots/);
  assert.deepEqual(evidence.blog_post_files, ["blog/example/index.html"]);
});

test("missing or truncated page evidence is marked incomplete", () => {
  const evidence = buildScopeQualityEvidence(
    "P9.7",
    {
      files: ["index.html"],
      additions: 1,
      deletions: 0,
      patch: "+<p>Updated content</p>",
    },
    plan,
  );

  assert.equal(evidence.content_criteria_applicable, true);
  assert.equal(evidence.content_evidence_complete, false);
  assert.match(evidence.context, /full page snapshot unavailable/);
  assert.match(evidence.facet_line, /Evidence is incomplete/);

  const truncated = buildScopeQualityEvidence(
    "P9.7",
    {
      files: ["index.html"],
      contentSnapshots: [
        { path: "index.html", revision: "head", content: "x".repeat(100000) },
      ],
    },
    plan,
  );
  assert.equal(truncated.content_evidence_complete, false);
  assert.equal(truncated.context_truncated, true);
  assert.ok(
    truncated.facet_line.includes("do not grant a passing P9.7 judgment"),
  );
});
test("a complete infrastructure diff up to the scoped context budget is retained", () => {
  const patch = "+" + "x".repeat(80000);
  const evidence = buildScopeQualityEvidence(
    "P9.7",
    {
      files: ["scripts/quality-gate.mjs"],
      additions: 1,
      deletions: 0,
      patch,
    },
    plan,
  );

  assert.equal(evidence.context_truncated, false);
  assert.equal(evidence.content_evidence_complete, true);
  assert.ok(evidence.context.includes(patch));
});
test("an infrastructure-only candidate uses its fixture and does not trigger content grading", () => {
  const evidence = buildScopeQualityEvidence(
    "P9.7",
    {
      files: [
        "scripts/lib/jev-scope-quality.mjs",
        "tests/jev-scope-quality.test.mjs",
        "tests/fixtures/jev-p97/infrastructure-only.patch",
      ],
      additions: 12,
      deletions: 3,
      patch: infrastructureFixture,
    },
    plan,
  );

  assert.equal(evidence.content_criteria_applicable, false);
  assert.deepEqual(evidence.content_files, []);
  assert.match(
    evidence.facet_line,
    /Do not grade infrastructure files as published copy/,
  );
  assert.match(evidence.context, /content criteria are not applicable/);
  assert.match(evidence.context, /isPublicContentPath/);
  assert.match(evidence.changed_files.join(" "), /infrastructure-only\.patch/);
});

test("actual-diff evidence redacts patch and page credentials before transport", () => {
  const evidence = buildScopeQualityEvidence(
    "P9.7",
    {
      files: ["index.html"],
      additions: 4,
      deletions: 0,
      patch: [
        '+TYPESAFE_API_KEY="example-secret-value"',
        "+Authorization: Bearer bearer-example-value",
        "+token eyJabcdefghijk.abcdefghijk.abcdefghijk",
        "+-----BEGIN PRIVATE KEY-----fake-key-material-----END PRIVATE KEY-----",
      ].join("\n"),
      contentSnapshots: [
        {
          path: "index.html",
          revision: "head",
          content: "<p>TYPESAFE_API_KEY=fixture-secret-content</p>",
        },
      ],
    },
    plan,
  );

  for (const secret of [
    "example-secret-value",
    "bearer-example-value",
    "eyJabcdefghijk.abcdefghijk.abcdefghijk",
    "fake-key-material",
    "fixture-secret-content",
  ]) {
    assert.doesNotMatch(evidence.context, new RegExp(secret));
  }
  assert.ok(evidence.context.includes("TYPESAFE_API_KEY=[REDACTED]"));
  assert.ok(evidence.context.includes("Authorization: Bearer [REDACTED]"));
  assert.ok(evidence.context.includes("[REDACTED JWT]"));
  assert.ok(evidence.context.includes("[REDACTED PRIVATE KEY]"));
});
test("other scopes do not replace the repository's quality evidence", () => {
  assert.equal(
    buildScopeQualityEvidence("P9.1", { files: ["index.html"] }),
    null,
  );
});

test("scope-specific quality evidence reaches Jev alongside its quality facet", () => {
  const evidence = buildScopeQualityEvidence(
    "P9.7",
    {
      files: ["scripts/gate.mjs"],
      additions: 1,
      deletions: 0,
      patch: "+export const contentOnly = true;",
    },
    plan,
  );
  const state = buildStateText(
    { facet_evidence: { quality: evidence.facet_line } },
    { target: "pr @ head", sha: "head", treeClean: true, secretsClean: true },
    ["quality"],
    evidence.context,
  );

  assert.match(
    state,
    /quality: P9\.7 content criteria are not applicable as a copy judgment/,
  );
  assert.match(state, /content criteria are not applicable/);
  assert.match(
    evidence.facet_line,
    /For this P9\.7 infrastructure-only change/,
  );
  assert.match(state, /Actual PR diff: 1 files, \+1\/-0/);
});

test("scope-specific diff evidence expands only its own transport budget", () => {
  const context = "actual P9.7 diff ".padEnd(8000, "x");
  const state = buildStateText(
    { facet_evidence: { quality: "P9.7 diff below" } },
    { target: "pr @ head", sha: "head", treeClean: true, secretsClean: true },
    ["quality"],
    context,
  );

  assert.ok(state.includes(context));
  assert.ok(state.length > 6000);
  const ordinary = buildStateText(
    { facet_evidence: { quality: "ordinary evidence" } },
    {},
    ["quality"],
  );
  assert.ok(ordinary.length < 6000);
});

test("the collector loads the candidate plan and full snapshots for page changes, but scopes infra separately", () => {
  const repo = mkdtempSync(join(tmpdir(), "jev-p97-diff-"));
  try {
    git(repo, "init", "-q");
    git(repo, "config", "user.name", "Jev scope test");
    git(repo, "config", "user.email", "jev-scope-test@example.invalid");
    mkdirSync(join(repo, "docs", "plan"), { recursive: true });
    mkdirSync(join(repo, "blog", "example"), { recursive: true });
    writeFileSync(join(repo, "docs", "plan", "MASTER_PLAN.md"), plan);
    writeFileSync(join(repo, "blog", "example", "index.html"), contentFixture);
    git(repo, "add", ".");
    git(repo, "commit", "-qm", "base");
    const base = git(repo, "rev-parse", "HEAD");

    const changedPage = contentFixture.replace(
      "Last reviewed: October 10, 2026",
      "Last reviewed: October 12, 2026",
    );
    writeFileSync(join(repo, "blog", "example", "index.html"), changedPage);
    git(repo, "add", ".");
    git(repo, "commit", "-qm", "content change");
    const contentHead = git(repo, "rev-parse", "HEAD");
    const contentEvidence = collectScopeQualityEvidence(
      repo,
      "P9.7",
      base,
      contentHead,
    );

    assert.deepEqual(contentEvidence.changed_files, [
      "blog/example/index.html",
    ]);
    assert.equal(contentEvidence.content_criteria_applicable, true);
    assert.equal(contentEvidence.content_evidence_complete, true);
    assert.match(
      contentEvidence.context,
      /Authoritative requirements from docs\/plan\/MASTER_PLAN\.md/,
    );
    assert.match(contentEvidence.context, /Last reviewed: October 12, 2026/);
    assert.match(contentEvidence.context, /2–3 significant figures/);

    mkdirSync(join(repo, "scripts"), { recursive: true });
    writeFileSync(
      join(repo, "scripts", "quality-gate.mjs"),
      "export const gate = true;\n",
    );
    git(repo, "add", ".");
    git(repo, "commit", "-qm", "infrastructure change");
    const infraHead = git(repo, "rev-parse", "HEAD");
    const infraEvidence = collectScopeQualityEvidence(
      repo,
      "P9.7",
      contentHead,
      infraHead,
    );

    assert.deepEqual(infraEvidence.changed_files, ["scripts/quality-gate.mjs"]);
    assert.equal(infraEvidence.content_criteria_applicable, false);
    assert.match(
      infraEvidence.facet_line,
      /Do not grade infrastructure files as published copy/,
    );
    assert.match(infraEvidence.context, /export const gate = true/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("a P9.7 item introduced by this PR is loaded from the candidate plan", () => {
  const repo = mkdtempSync(join(tmpdir(), "jev-p97-plan-intro-"));
  try {
    git(repo, "init", "-q");
    git(repo, "config", "user.name", "Jev scope test");
    git(repo, "config", "user.email", "jev-scope-test@example.invalid");
    mkdirSync(join(repo, "docs", "plan"), { recursive: true });
    const priorPlan = plan.replace(/^\| P9\.7 \|.*(?:\r?\n)?/m, "");
    assert.doesNotMatch(priorPlan, /^\| P9\.7 \|/m);
    writeFileSync(join(repo, "docs", "plan", "MASTER_PLAN.md"), priorPlan);
    git(repo, "add", ".");
    git(repo, "commit", "-qm", "base without P9.7");
    const base = git(repo, "rev-parse", "HEAD");

    writeFileSync(join(repo, "docs", "plan", "MASTER_PLAN.md"), plan);
    mkdirSync(join(repo, "scripts"), { recursive: true });
    writeFileSync(
      join(repo, "scripts", "quality-gate.mjs"),
      "export const gate = true;\n",
    );
    git(repo, "add", ".");
    git(repo, "commit", "-qm", "introduce P9.7 and its gate");
    const head = git(repo, "rev-parse", "HEAD");

    const evidence = collectScopeQualityEvidence(repo, "P9.7", base, head);
    assert.equal(evidence.content_criteria_applicable, false);
    assert.match(evidence.context, /\| P9\.7 \| Content quality gate/);
    assert.match(evidence.context, /R-CONT-05/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
test("P9.7 diff evidence refuses missing or malformed commit identities", () => {
  assert.throws(
    () => collectScopeQualityEvidence(process.cwd(), "P9.7", "", "x"),
    /full base and head commit SHAs/,
  );
});
