// The scoped quality evidence a P9.7 judgment needs: the approved content
// rubric, plus the bounded, credential-redacted actual PR diff.
import { spawnSync } from "node:child_process";

export const P97_QUALITY_RUBRIC =
  "P9.7 approved criteria: canonical formatting (byte-identical shared style blocks, uniform headers/footers/CTA, metadata/JSON-LD parity, H1/title alignment); SEO (real demand, unique URL intent, valid sitemap/structured data, no cannibalization); sourcing (verifiable cited claims, official sources for news hooks); voice (plain, second person, grade 8 or below, no hype/fear/sales language).";

const FULL_SHA = /^[0-9a-f]{40}$/i;
const MAX_CONTEXT_CHARS = 40000;

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

function redactDiff(diff) {
  return String(diff)
    .replace(
      /\b([A-Z0-9_]*(?:API_KEY|SECRET|TOKEN)[A-Z0-9_]*)\b\s*([=:])\s*([^\s,;]+)/gi,
      "$1$2[REDACTED]",
    )
    .replace(
      /(?:sk-[A-Za-z0-9_-]{20,}|apik[-_][A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9]{20,})/g,
      "[REDACTED]",
    );
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
  const safePatch = redactDiff(change.patch || "");
  const contextPrefix = [
    P97_QUALITY_RUBRIC,
    `Actual PR diff: ${files.length} files, +${additions}/-${deletions}; ${fileSummary}.`,
    "Actual unified diff (credential-shaped values redacted):",
  ].join("\n");
  const remainingChars = Math.max(
    0,
    MAX_CONTEXT_CHARS - contextPrefix.length - 40,
  );
  const diffText = safePatch.slice(0, remainingChars);
  const truncationNote =
    safePatch.length > diffText.length
      ? `\n[diff truncated at ${MAX_CONTEXT_CHARS} characters]`
      : "";
  const context = [
    contextPrefix,
    diffText || "(no changed lines)",
    truncationNote,
  ].join("\n");

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
