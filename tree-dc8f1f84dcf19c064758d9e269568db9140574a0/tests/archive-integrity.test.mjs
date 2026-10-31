// Master plan P0.2 (closing finding F-40): twelve legacy plan and audit
// documents gave conflicting guidance because nothing checked whether a link
// still resolved. These gates make a broken pointer a test failure instead of
// something a contributor discovers by following it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// The twelve documents master plan §15 and P0.2 move to docs/archive/.
const ARCHIVED = [
  "GOOGLE_QUALITY_PLAN",
  "PLAN",
  "PHASE2_PLAN",
  "PHASE3_PLAN",
  "ROADMAP_10_PHASES",
  "SEO_MASTER_PLAN",
  "LAUNCH_AUDIT",
  "IMPLEMENTATION_COMPLETE",
  "GROQ_AUDIT_AND_OPTIMIZATION",
  "GROQ_IMPLEMENTATION_GUIDE",
  "GROQ_ROADMAP_VISUAL",
  "CYCLE_LIFE_CORRECTION_SUMMARY",
];

// Reference data and legal posture, explicitly NOT plans. Master plan P0.2
// keeps these live at the root; archiving them would lose what the site needs.
const KEPT_AT_ROOT = ["LIABILITY", "BATTERY_CYCLE_LIFE_REFERENCE_2026"];

test("GATE: all twelve legacy plans live in docs/archive/, not at the root", () => {
  for (const name of ARCHIVED) {
    assert.ok(
      existsSync(join(ROOT, "docs", "archive", `${name}.md`)),
      `docs/archive/${name}.md must exist (P0.2)`,
    );
    assert.ok(
      !existsSync(join(ROOT, `${name}.md`)),
      `${name}.md must not remain at the repo root`,
    );
  }
  assert.equal(ARCHIVED.length, 12, "F-40 names twelve documents");
});

test("GATE: every archived document carries a supersession banner", () => {
  for (const name of ARCHIVED) {
    const head = readFileSync(
      join(ROOT, "docs", "archive", `${name}.md`),
      "utf8",
    )
      .slice(0, 1200)
      .toLowerCase();
    assert.ok(
      head.includes("superseded"),
      `docs/archive/${name}.md needs a "SUPERSEDED" banner at the top`,
    );
    // A banner that does not say what replaced it is not a banner.
    assert.ok(
      head.includes("master_plan.md"),
      `docs/archive/${name}.md must link the governing plan`,
    );
  }
});

test("GATE: each archived document states its own reason, not a blanket notice", () => {
  for (const name of ARCHIVED) {
    const head = readFileSync(
      join(ROOT, "docs", "archive", `${name}.md`),
      "utf8",
    )
      .slice(0, 2000)
      .toLowerCase();
    assert.ok(
      head.includes("reason for archiving"),
      `docs/archive/${name}.md must name why THIS file was archived`,
    );
    assert.ok(
      head.includes("where its content went"),
      `docs/archive/${name}.md must say where its content went`,
    );
  }
});

test("GATE: the reference and legal docs are NOT archived", () => {
  for (const name of KEPT_AT_ROOT) {
    assert.ok(
      existsSync(join(ROOT, `${name}.md`)),
      `${name}.md stays live at the root (P0.2 keeps non-plan references)`,
    );
  }
});

test("GATE: no plan documents are left loose at the repo root", () => {
  const loose = readdirSync(ROOT).filter((f) => f.endsWith(".md"));
  const allowed = new Set([
    "AGENTS.md",
    "README.md",
    ...KEPT_AT_ROOT.map((n) => `${n}.md`),
  ]);
  const unexpected = loose.filter((f) => !allowed.has(f));
  assert.deepEqual(
    unexpected,
    [],
    `only AGENTS, README and the kept references may sit at the root: ${unexpected.join(", ")}`,
  );
});

// The failure mode F-40 describes: a doc names another doc, the file moves,
// and the link quietly rots. Walk every live markdown file's relative links.
test("GATE: every relative markdown link in a live doc resolves", () => {
  const live = [
    "README.md",
    "AGENTS.md",
    "LIABILITY.md",
    "docs/INDEX.md",
    "docs/DEPLOY_RUNBOOK.md",
    "docs/ARCHITECTURE.md",
    "docs/DOMAIN_MIGRATION_PLAN.md",
    "docs/archive/README.md",
  ];
  const broken = [];
  for (const rel of live) {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) {
      broken.push(`${rel} (file itself missing)`);
      continue;
    }
    const body = readFileSync(abs, "utf8");
    for (const m of body.matchAll(/\[[^\]]*\]\(([^)#\s]+)\)/g)) {
      const target = m[1];
      if (/^(https?:|mailto:|#)/i.test(target)) continue;
      if (!existsSync(resolve(dirname(abs), target))) {
        broken.push(`${rel} -> ${target}`);
      }
    }
  }
  assert.deepEqual(broken, [], `broken relative links: ${broken.join("; ")}`);
});

test("GATE: the master plan is the only plan any doc points to as current", () => {
  const index = readFileSync(join(ROOT, "docs", "INDEX.md"), "utf8");
  assert.ok(
    index.includes("docs/plan/MASTER_PLAN.md"),
    "the doc index must lead with the governing plan",
  );
  for (const name of ARCHIVED) {
    // A bare backticked root path would resurrect a dead pointer.
    assert.ok(
      !new RegExp("`" + name + "\\.md`").test(index),
      `docs/INDEX.md must not reference ${name}.md as if it were at the root`,
    );
  }
});
