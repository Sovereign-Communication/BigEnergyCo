import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildScopeQualityEvidence,
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

test("the rubric carries the approved plan requirements and content criteria", () => {
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
  ])
    assert.ok(rubric.includes(id), `missing plan requirement ${id}`);
  for (const criterion of [
    "metadata/JSON-LD parity",
    "no cannibalization",
    "official sources only for news hooks",
    "reading grade of",
    "all locales",
    "significant figures",
    "2\u20133 significant figures",
    "percentages are whole numbers",
    "Full precision appears only in tables and CSV",
    "no decimals at or above 100 units",
    "fall protection",
    "Stale figures are fixed or removed",
    "last reviewed",
    "No hype, no fear, no sales language",
    "two or three quotes",
    "where DIY is not permitted",
    "No lead forms and no company names",
  ])
    assert.ok(rubric.includes(criterion), `missing ${criterion}`);
});

test("the public fixture represents copy, numeric, glossary, legal, safety, source, and review criteria", () => {
  for (const evidence of [
    'rel="canonical"',
    "application/ld+json",
    "<title>A 2.4 kW solar system",
    "<h1>A 2.4 kW solar system",
    "2.4 kW",
    "35%",
    "$8,200",
    "146.28 kWh",
    "kilowatt-hour (kWh)",
    "A licensed electrician must do every electrical termination",
    "fall protection",
    "permit and grid-connection steps",
    "not a quote or a guarantee",
    "dataset updated in 2026",
    "Last reviewed: October 10, 2026",
  ])
    assert.ok(contentFixture.includes(evidence), `fixture missing ${evidence}`);
});

test("scope detection includes public pages and content sources, excluding internal files", () => {
  for (const [file, expected] of [
    ["index.html", true],
    ["about/index.html", true],
    ["blog/example/index.html", true],
    ["solar-calculator/example/index.html", true],
    ["assets/js/shared/jargon-dict.js", true],
    ["assets/js/shared/locales.js", true],
    ["assets/js/sizing/money.js", true],
    ["assets/js/sizing/city-data/US.json", true],
    ["assets/data/provenance.json", true],
    ["LIABILITY.md", true],
    ["sitemap.xml", true],
    ["llms.txt", true],
    ["404.html", false],
    ["docs/guide.html", false],
    ["scripts/generated.html", false],
    ["tests/fixtures/jev-p97/content-page.html", false],
    ["assets/template.html", false],
    ["blog/SEO-DOCTRINE.md", false],
    ["scripts/lib/jev-scope-quality.mjs", false],
    ["worker/wrangler.json", false],
  ])
    assert.equal(isGovernedContentFile(file), expected, file);

  assert.equal(isBlogPostFile("blog/example/index.html"), true);
  assert.equal(isBlogPostFile("blog/index.html"), false);
  assert.equal(isBlogPostFile("about/index.html"), false);
  const glossary = buildScopeQualityEvidence(
    "P9.7",
    { files: ["assets/js/shared/jargon-dict.js"] },
    plan,
  );
  assert.equal(glossary.content_criteria_applicable, true);
  assert.ok(glossary.context.includes("every technical term"));
});

test("changed pages receive the full plan rubric, snapshot, and actual diff", () => {
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
  assert.deepEqual(evidence.blog_post_files, ["blog/example/index.html"]);
  for (const item of [
    "R-CONT-01",
    "R-CONT-05",
    "licensed electrician must do every electrical termination",
    "Last reviewed: October 10, 2026",
    "A new, reviewed sentence",
  ])
    assert.ok(evidence.context.includes(item), `context missing ${item}`);
  assert.ok(evidence.facet_line.includes("full changed-page snapshots"));
});

test("missing or over-budget page evidence cannot pass the P9.7 content judgment", () => {
  const missing = buildScopeQualityEvidence(
    "P9.7",
    { files: ["index.html"], patch: "+<p>Updated content</p>" },
    plan,
  );
  assert.equal(missing.content_evidence_complete, false);
  assert.ok(missing.context.includes("full page snapshot unavailable"));
  assert.ok(missing.facet_line.includes("Evidence is incomplete"));

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
  assert.equal(truncated.context_truncated, true);
  assert.equal(truncated.content_evidence_complete, false);
  assert.ok(
    truncated.facet_line.includes("do not grant a passing P9.7 judgment"),
  );
});

test("infrastructure-only changes use their fixture and retain complete evidence within budget", () => {
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
  assert.ok(
    evidence.facet_line.includes(
      "Do not grade infrastructure files as published copy",
    ),
  );
  assert.ok(evidence.context.includes("isPublicContentPath"));
  assert.ok(
    evidence.changed_files.includes(
      "tests/fixtures/jev-p97/infrastructure-only.patch",
    ),
  );

  const largePatch = "+" + "x".repeat(80000);
  const complete = buildScopeQualityEvidence(
    "P9.7",
    { files: ["scripts/quality-gate.mjs"], patch: largePatch },
    plan,
  );
  assert.equal(complete.context_truncated, false);
  assert.equal(complete.content_evidence_complete, true);
  assert.ok(complete.context.includes(largePatch));
});

test("actual-diff and page evidence redact credentials before transport", () => {
  const evidence = buildScopeQualityEvidence(
    "P9.7",
    {
      files: ["index.html"],
      patch: [
        '+TYPESAFE_API_KEY="example-secret-value"',
        "+Authorization: Bearer bearer-example-value",
        "+token eyJabcdefghijk.abcdefghijk.abcdefghijk",
        "+-----BEGIN " +
          "PRIVATE KEY-----fake-key-material" +
          "-----END PRIVATE KEY-----",
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
  ])
    assert.ok(!evidence.context.includes(secret), `leaked ${secret}`);
  for (const redaction of [
    "TYPESAFE_API_KEY=[REDACTED]",
    "Authorization: Bearer [REDACTED]",
    "[REDACTED JWT]",
    "[REDACTED PRIVATE KEY]",
  ])
    assert.ok(evidence.context.includes(redaction), `missing ${redaction}`);
});

test("only P9.7 builds and transports its scope evidence alongside the quality facet", () => {
  assert.equal(
    buildScopeQualityEvidence("P9.1", { files: ["index.html"] }),
    null,
  );
  const evidence = buildScopeQualityEvidence(
    "P9.7",
    { files: ["scripts/gate.mjs"], patch: "+export const contentOnly = true;" },
    plan,
  );
  const state = buildStateText(
    { facet_evidence: { quality: evidence.facet_line } },
    { target: "pr @ head", sha: "head", treeClean: true, secretsClean: true },
    ["quality"],
    evidence.context,
  );
  assert.ok(
    state.includes(
      "quality: P9.7 content criteria are not applicable as a copy judgment",
    ),
  );
  assert.ok(state.includes("content criteria are not applicable"));
  assert.ok(state.includes("Actual PR diff: 1 files, +0/-0"));

  const oversizedContext = "actual P9.7 diff ".padEnd(8000, "x");
  const scoped = buildStateText(
    { facet_evidence: { quality: "P9.7 diff below" } },
    { target: "pr @ head", sha: "head", treeClean: true, secretsClean: true },
    ["quality"],
    oversizedContext,
  );
  const ordinary = buildStateText(
    { facet_evidence: { quality: "ordinary evidence" } },
    {},
    ["quality"],
  );
  assert.ok(scoped.includes(oversizedContext));
  assert.ok(scoped.length > ordinary.length);
});
