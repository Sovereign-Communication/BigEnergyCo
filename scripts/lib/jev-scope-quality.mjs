// The scoped quality evidence a P9.7 judgment needs: the approved content
// rubric, plus a compact excerpt measured from this PR's actual diff.
import { spawnSync } from "node:child_process";

export const P97_QUALITY_RUBRIC =
  "P9.7 approved criteria: canonical formatting (byte-identical shared style blocks, uniform headers/footers/CTA, metadata/JSON-LD parity, H1/title alignment); SEO (real demand, unique URL intent, valid sitemap/structured data, no cannibalization); sourcing (verifiable cited claims, official sources for news hooks); voice (plain, second person, grade 8 or below, no hype/fear/sales language).";

const FULL_SHA = /^[0-9a-f]{40}$/i;
const MAX_CONTEXT_CHARS = 1250;

function git(repoRoot, args) {
  const result = spawnSync("git", ["-C", repoRoot, ...args], {
    encoding: "utf8",
    timeout: 15000,
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error)
    throw new Error(`git ${args[0]} failed: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`git ${args[0]} failed: ${(result.stderr || "").trim()}`);
  }
  return result.stdout || "";
}

function redact(line) {
  return line.replace(
    /(?:sk-[A-Za-z0-9_-]{20,}|apik[-_][A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9]{20,})/g,
    "[REDACTED]",
  );
}

function changedLineExcerpts(patch) {
  const chunks = patch.split(/(?=^diff --git )/m).filter(Boolean);
  const excerpts = [];
  for (const chunk of chunks) {
    const file = /^diff --git a\/(.+) b\//m.exec(chunk)?.[1];
    if (!file) continue;
    const changes = chunk
      .split(/\r?\n/)
      .filter(
        (line) =>
          /^[+-]/.test(line) &&
          !line.startsWith("+++") &&
          !line.startsWith("---"),
      );
    if (!changes.length) continue;
    // Prefer new text; blog content gets two added lines so the judge sees a
    // copy sample rather than the deleted version or only its heading.
    const count = /^blog\//i.test(file) ? 2 : 1;
    const selected = changes.filter((line) => line.startsWith("+"));
    for (const line of (selected.length ? selected : changes).slice(0, count)) {
      excerpts.push(`${file}: ${redact(line).slice(0, 88)}`);
    }
  }
  return excerpts;
}

export function buildScopeQualityEvidence(scope, change) {
  if (scope !== "P9.7") return null;
  if (!change || !Array.isArray(change.files)) {
    throw new Error("P9.7 quality evidence requires the actual PR diff");
  }

  const files = change.files.filter((file) => typeof file === "string");
  const additions = Number.isFinite(change.additions) ? change.additions : 0;
  const deletions = Number.isFinite(change.deletions) ? change.deletions : 0;
  const fileSummary = files.length ? files.join(", ") : "no changed files";
  const excerpt = changedLineExcerpts(String(change.patch || ""))
    .join(" | ")
    .slice(0, 420);
  const context = [
    P97_QUALITY_RUBRIC,
    `Actual PR diff: ${files.length} files, +${additions}/-${deletions}; ${fileSummary}.`,
    excerpt
      ? `Changed-line evidence: ${excerpt}`
      : "Changed-line evidence: none.",
  ]
    .join(" ")
    .slice(0, MAX_CONTEXT_CHARS);

  return {
    facet_line:
      "For P9.7, judge this change against the approved content rubric and actual-diff evidence below.",
    context,
    changed_files: files,
    additions,
    deletions,
  };
}

export function collectScopeQualityEvidence(repoRoot, scope, baseSha, headSha) {
  if (scope !== "P9.7") return null;
  if (!FULL_SHA.test(baseSha || "") || !FULL_SHA.test(headSha || "")) {
    throw new Error(
      "P9.7 quality evidence requires full base and head commit SHAs",
    );
  }

  const range = `${baseSha}...${headSha}`;
  const files = git(repoRoot, ["diff", "--name-only", "--no-renames", range])
    .split(/\r?\n/)
    .filter(Boolean);
  const numstat = git(repoRoot, ["diff", "--numstat", "--no-renames", range]);
  let additions = 0;
  let deletions = 0;
  for (const line of numstat.split(/\r?\n/).filter(Boolean)) {
    const [added, removed] = line.split("\t");
    if (/^\d+$/.test(added)) additions += Number(added);
    if (/^\d+$/.test(removed)) deletions += Number(removed);
  }
  const patch = git(repoRoot, [
    "diff",
    "--no-ext-diff",
    "--no-color",
    "--no-renames",
    "--unified=0",
    range,
  ]);
  return buildScopeQualityEvidence(scope, {
    files,
    additions,
    deletions,
    patch,
  });
}
