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

import {
  buildScopeQualityEvidence,
  extractP97QualityRubric,
  isGovernedContentFile,
} from "../scripts/lib/jev-scope-quality.mjs";
import { buildStateText } from "../scripts/lib/jev-complete.mjs";
import { collectScopeQualityEvidence } from "../scripts/lib/jev-scope-quality-git.mjs";

const plan = readFileSync("docs/plan/MASTER_PLAN.md", "utf8");
const page = `<!doctype html>
<html lang="en"><head>
<title>System size and home use</title>
<meta name="description" content="Plain-language guidance on sizing home energy storage.">
<link rel="canonical" href="https://example.invalid/blog/system/">
<script type="application/ld+json">{"@type":"BlogPosting","headline":"System size and home use"}</script>
</head><body><main><article>
<h1>System size and home use</h1>
<p>A kilowatt-hour (kWh) measures energy. A 5 kWh battery at 80% usable capacity provides 4 kWh before conversion losses.</p>
<p>Use the cited figure as an estimate and check the source date before relying on it.</p>
<p>Use fall protection. A licensed electrician must do every electrical termination; check local requirements before work.</p>
<p>This is educational information, not legal or installation advice. You can compare the estimate with your own bills.</p>
<p>Source: <cite>National Renewable Energy Laboratory, residential storage guidance</cite>.</p>
<p>Last reviewed: October 10, 2026</p>
</article></main></body></html>
`;

function git(root, ...args) {
  const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test("P9.7 judgment carries each authoritative requirement from the candidate plan", () => {
  const rubric = extractP97QualityRubric(plan);
  for (const id of [
    "P9.7",
    "D-05",
    "R-CONT-01",
    "R-CONT-02",
    "R-CONT-03",
    "R-CONT-04",
    "R-CONT-05",
    "R-RES-07",
    "R-SEO-05",
  ]) {
    const requirement = plan
      .split(/\r?\n/)
      .find((line) => line.includes(`| ${id} |`) || line.includes(`**${id}:`));
    assert.ok(requirement, `plan requirement ${id} exists`);
    assert.ok(rubric.includes(requirement.trim()), `rubric includes ${id}`);
  }
});

test("content scope is public pages plus plan-named sources, not implementation assets", () => {
  for (const [path, expected] of [
    ["index.html", true],
    ["blog/system/index.html", true],
    ["about/index.htm", true],
    ["LIABILITY.md", true],
    ["robots.txt", true],
    ["sitemap.xml", true],
    ["assets/js/shared/jargon-dict.js", true],
    ["assets/data/provenance.json", true],
    ["assets/js/sizing/money.js", false],
    ["assets/data/city-grid.json", false],
    ["llms.txt", false],
    ["404.html", false],
    ["docs/guide.html", false],
    ["assets/template.html", false],
    ["tests/fixtures/page.html", false],
  ])
    assert.equal(isGovernedContentFile(path), expected, path);
});

test("changed content requires its full snapshot and diff; incomplete or oversized evidence fails closed", () => {
  const content = buildScopeQualityEvidence(
    "P9.7",
    {
      files: ["blog/system/index.html"],
      patch: "+<p>Last reviewed: October 12, 2026</p>",
      contentSnapshots: [
        { path: "blog/system/index.html", revision: "head", content: page },
      ],
    },
    plan,
  );
  assert.equal(content.content_evidence_complete, true);
  assert.ok(content.context.includes("metadata/JSON-LD parity"));
  assert.ok(
    content.context.includes("Full head snapshot of blog/system/index.html"),
  );
  for (const evidence of [
    '<link rel="canonical" href="https://example.invalid/blog/system/">',
    "<title>System size and home use</title>",
    '"headline":"System size and home use"',
    "<h1>System size and home use</h1>",
    '<meta name="description"',
  ])
    assert.ok(content.context.includes(evidence), `snapshot missing ${evidence}`);
  assert.ok(
    content.context.includes(
      "licensed electrician must do every electrical termination",
    ),
  );
  assert.ok(content.context.includes("5 kWh battery at 80% usable capacity"));
  assert.ok(content.context.includes("educational information, not legal"));
  assert.ok(content.context.includes("National Renewable Energy Laboratory"));
  assert.ok(content.context.includes("Last reviewed: October 10, 2026"));
  assert.ok(content.context.includes("October 12, 2026"));

  const missing = buildScopeQualityEvidence(
    "P9.7",
    { files: ["index.html"], patch: "+<p>Changed</p>" },
    plan,
  );
  assert.equal(missing.content_evidence_complete, false);
  assert.match(missing.facet_line, /do not grant a passing P9\.7 judgment/);

  const oversized = buildScopeQualityEvidence(
    "P9.7",
    { files: [], patch: "+".repeat(90001) },
    plan,
  );
  assert.equal(oversized.context_truncated, true);
  assert.equal(oversized.content_evidence_complete, false);
});

test("credentials in page snapshots and diffs are redacted before Jev transport", () => {
  const token = "gh" + "p_" + "0123456789abcdefghijklmnopqrstuvwxyzABCDE";
  const awsKey = "AKIA" + "0123456789ABCDEF";
  const googleKey = "AIza" + "A".repeat(24);
  const slackToken = "xox" + "b-" + "a".repeat(24);
  const evidence = buildScopeQualityEvidence(
    "P9.7",
    {
      files: ["index.html"],
      patch: [
        '+TYPESAFE_API_KEY="example-secret-value"',
        "+Authorization: Bearer bearer-example-value",
        "+token eyJabcdefghijk.abcdefghijk.abcdefghijk",
        `+${token}`,
        `+${awsKey}`,
        `+${googleKey}`,
        `+${slackToken}`,
        "+-----" +
          "BEGIN " +
          "PRIVATE KEY-----fake-key-material-----END PRIVATE KEY-----",
      ].join("\n"),
      contentSnapshots: [
        {
          path: "index.html",
          revision: "head",
          content: `<p>TYPESAFE_API_KEY=fixture-secret-content ${token}</p>`,
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
    token,
    awsKey,
    googleKey,
    slackToken,
  ])
    assert.ok(!evidence.context.includes(secret));
  assert.ok(evidence.context.includes("Authorization: Bearer [REDACTED]"));
  assert.ok(evidence.context.includes("[REDACTED PRIVATE KEY]"));
});

test("state transport includes P9.7 context without shortening ordinary facet evidence", () => {
  const evidence = buildScopeQualityEvidence(
    "P9.7",
    { files: ["scripts/gate.mjs"], patch: "+export const gate = true;" },
    plan,
  );
  assert.equal(evidence.content_criteria_applicable, false);
  const state = buildStateText(
    { facet_evidence: { quality: evidence.facet_line } },
    {},
    ["quality"],
    evidence.context,
  );
  assert.ok(state.includes("quality: P9.7 requirements from the candidate"));
  assert.ok(state.includes("export const gate = true"));

  const ordinary = buildStateText(
    { facet_evidence: { quality: "ordinary proof" } },
    {},
    ["quality"],
  );
  assert.ok(ordinary.includes("quality: ordinary proof"));
});

test("the Git adapter snapshots the exact candidate page and reads the plan at head", () => {
  const root = mkdtempSync(join(tmpdir(), "jev-p97-"));
  try {
    git(root, "init", "-q");
    git(root, "config", "user.name", "P9.7 test");
    git(root, "config", "user.email", "jev@example.invalid");
    mkdirSync(join(root, "docs", "plan"), { recursive: true });
    mkdirSync(join(root, "blog", "system"), { recursive: true });
    const priorPlan = plan.replace(/^\| P9\.7 \|.*(?:\r?\n)?/m, "");
    writeFileSync(join(root, "docs", "plan", "MASTER_PLAN.md"), priorPlan);
    writeFileSync(join(root, "blog", "system", "index.html"), page);
    git(root, "add", ".");
    git(root, "commit", "-qm", "base");
    const base = git(root, "rev-parse", "HEAD");

    writeFileSync(join(root, "docs", "plan", "MASTER_PLAN.md"), plan);
    writeFileSync(
      join(root, "blog", "system", "index.html"),
      page.replace("October 10", "October 12"),
    );
    git(root, "add", ".");
    git(root, "commit", "-qm", "candidate");
    const head = git(root, "rev-parse", "HEAD");
    const evidence = collectScopeQualityEvidence(root, "P9.7", base, head);
    assert.deepEqual(evidence.changed_files.sort(), [
      "blog/system/index.html",
      "docs/plan/MASTER_PLAN.md",
    ]);
    assert.ok(evidence.context.includes("| P9.7 | Content quality gate"));
    assert.ok(evidence.context.includes("October 12, 2026"));
    assert.equal(evidence.content_evidence_complete, true);

    mkdirSync(join(root, "scripts"), { recursive: true });
    writeFileSync(
      join(root, "scripts", "gate.mjs"),
      "export const gate = true;\n",
    );
    git(root, "add", ".");
    git(root, "commit", "-qm", "infrastructure");
    const infraHead = git(root, "rev-parse", "HEAD");
    const infrastructure = collectScopeQualityEvidence(
      root,
      "P9.7",
      head,
      infraHead,
    );
    assert.equal(infrastructure.content_criteria_applicable, false);
    assert.ok(infrastructure.context.includes("export const gate = true"));
    assert.throws(
      () => collectScopeQualityEvidence(root, "P9.7", "", infraHead),
      /full base and head commit SHAs/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
