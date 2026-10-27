// P9.7 evidence is derived from the immutable plan and applies only to
// changed public pages or user-facing content sources. Infrastructure changes
// are judged against their implementation and representative fixtures instead.
import { spawnSync } from "node:child_process";

const FULL_SHA = /^[0-9a-f]{40}$/i;
const MAX_CONTEXT_CHARS = 90000;
const PLAN_PATH = "docs/plan/MASTER_PLAN.md";
const INTERNAL_ROOTS = new Set([
  ".github",
  ".quality-evidence",
  ".wrangler",
  "_pages_staging",
  "assets",
  "docs",
  "evidence",
  "jev-artifacts",
  "node_modules",
  "scripts",
  "src",
  "tests",
  "worker",
]);
const CONTENT_ROOT_FILES = new Set([
  "liability.md",
  "llms.txt",
  "robots.txt",
  "sitemap.xml",
]);
const REQUIRED_PLAN_IDS = [
  "P9.7",
  "D-05",
  "R-CONT-01",
  "R-CONT-02",
  "R-CONT-03",
  "R-CONT-04",
  "R-CONT-05",
  "R-RES-07",
  "R-SEO-05",
];

function git(repoRoot, args) {
  const result = spawnSync("git", ["-C", repoRoot, ...args], {
    encoding: "utf8",
    timeout: 15000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error)
    throw new Error(`git ${args[0]} failed: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`git ${args[0]} failed: ${(result.stderr || "").trim()}`);
  }
  return result.stdout || "";
}

function requirementLine(planText, id) {
  const lines = String(planText).split(/\r?\n/);
  const line = lines.find((candidate) => {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(
      `^\\s*(?:\\|\\s*${escaped}\\s*\\||-\\s*\\*\\*${escaped}:|\\d+\\.\\s*\\*\\*${escaped}:)`,
    ).test(candidate);
  });
  if (!line)
    throw new Error(
      `authoritative P9.7 evidence is missing ${id} in ${PLAN_PATH}`,
    );
  return line.trim();
}

export function extractP97QualityRubric(planText) {
  const requirements = REQUIRED_PLAN_IDS.map((id) =>
    requirementLine(planText, id),
  );
  return [
    `Authoritative requirements from ${PLAN_PATH} (read from the candidate; plan hash remains governed by plan:check):`,
    ...requirements,
    "Apply R-CONT-01..05 to changed governed content. For blog posts, also verify the P9.7 formatting, SEO, sourcing, and voice criteria; check dated claims against current sources and require a visible review date.",
  ].join("\n");
}

export function isGovernedContentPage(file) {
  const normalized = String(file).replace(/\\/g, "/").replace(/^\.\//, "");
  if (!/\.html?$/i.test(normalized) || normalized.toLowerCase() === "404.html")
    return false;
  const first = normalized.split("/")[0].toLowerCase();
  return !INTERNAL_ROOTS.has(first) && !first.startsWith(".");
}

function isGovernedContentSource(file) {
  const normalized = String(file)
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .toLowerCase();
  return (
    CONTENT_ROOT_FILES.has(normalized) ||
    /^assets\/js\/.+\.(?:js|json)$/.test(normalized) ||
    /^assets\/data\/.+\.(?:json|csv|xml)$/.test(normalized)
  );
}

export function isGovernedContentFile(file) {
  const normalized = String(file).replace(/\\/g, "/").replace(/^\.\//, "");
  return (
    isGovernedContentPage(normalized) || isGovernedContentSource(normalized)
  );
}

export function isBlogPostFile(file) {
  const normalized = String(file).replace(/\\/g, "/").toLowerCase();
  return (
    normalized !== "blog/index.html" &&
    /^blog\//.test(normalized) &&
    /\.html?$/.test(normalized)
  );
}

function redactDiff(diff) {
  return String(diff)
    .replace(
      /\b([A-Z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE[_-]?KEY)[A-Z0-9_]*)\b\s*([=:])\s*("[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/gi,
      "$1$2[REDACTED]",
    )
    .replace(
      /\b((?:Proxy-)?Authorization)\s*:\s*(Bearer|Basic)\s+[^\s]+/gi,
      "$1: $2 [REDACTED]",
    )
    .replace(
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi,
      "[REDACTED PRIVATE KEY]",
    )
    .replace(
      /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
      "[REDACTED JWT]",
    )
    .replace(
      /(?:sk-[A-Za-z0-9_-]{20,}|apik[-_][A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9]{20,})/g,
      "[REDACTED]",
    );
}

function fitContext(parts, complete) {
  const context = parts.join("\n\n");
  if (context.length <= MAX_CONTEXT_CHARS)
    return { context, truncated: false, complete };
  const clipped = context.slice(0, MAX_CONTEXT_CHARS - 100);
  return {
    context: `${clipped}\n\n[Evidence truncated at ${MAX_CONTEXT_CHARS} characters; full content evidence is incomplete.]`,
    truncated: true,
    complete: false,
  };
}

export function buildScopeQualityEvidence(scope, change, planText = "") {
  if (scope !== "P9.7") return null;
  if (!change || !Array.isArray(change.files)) {
    throw new Error("P9.7 quality evidence requires the actual PR diff");
  }

  const files = change.files.filter((file) => typeof file === "string");
  const additions = Number.isFinite(change.additions) ? change.additions : 0;
  const deletions = Number.isFinite(change.deletions) ? change.deletions : 0;
  const contentFiles = files.filter(isGovernedContentFile);
  const contentPages = contentFiles.filter(isGovernedContentPage);
  const contentApplicable = contentFiles.length > 0;
  const blogPostFiles = files.filter(isBlogPostFile);
  const safePatch = redactDiff(change.patch || "");
  const fileSummary = files.length ? files.join(", ") : "no changed files";
  const parts = [
    `${
      contentApplicable
        ? extractP97QualityRubric(planText)
        : [
            "P9.7 content criteria are not applicable as a copy judgment: this change modifies no governed page or content source.",
            extractP97QualityRubric(planText),
            "For this infrastructure-only change, judge the gate, tests, fixtures, and content-only scope detection; do not grade infrastructure files as published copy.",
          ].join("\n")
    }`,
    `Actual PR diff: ${files.length} files, +${additions}/-${deletions}; ${fileSummary}.`,
    `Changed blog posts: ${blogPostFiles.length ? blogPostFiles.join(", ") : "none"}.`,
  ];
  let contentEvidenceComplete = true;
  if (contentApplicable) {
    const snapshots = Array.isArray(change.contentSnapshots)
      ? change.contentSnapshots
      : [];
    for (const file of contentPages) {
      const snapshot = snapshots.find((entry) => entry.path === file);
      if (!snapshot || typeof snapshot.content !== "string") {
        contentEvidenceComplete = false;
        parts.push(
          `Changed governed page ${file}: full page snapshot unavailable; content judgment is incomplete.`,
        );
      } else {
        const safeContent = redactDiff(snapshot.content);
        parts.push(
          `Full ${snapshot.revision === "base" ? "base (deleted)" : "head"} snapshot of governed page ${file}:\n${safeContent}`,
        );
      }
    }
  }
  parts.push(
    `Actual unified diff (credential-shaped values redacted):\n${safePatch || "(no changed lines)"}`,
  );
  const fitted = fitContext(parts, contentEvidenceComplete);
  const facetLine = [
    contentApplicable
      ? "For P9.7, judge changed governed pages and content sources against the complete authoritative requirements, full changed-page snapshots, and actual PR diff below."
      : "For this P9.7 infrastructure-only change: judge gate correctness, tests, representative fixtures, and whether content criteria activate only for governed pages or sources. Do not grade infrastructure files as published copy.",
    !fitted.complete
      ? "Evidence is incomplete or truncated; do not grant a passing P9.7 judgment."
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  return {
    facet_line: facetLine,
    context: fitted.context,
    changed_files: files,
    content_files: contentFiles,
    blog_post_files: blogPostFiles,
    content_criteria_applicable: contentApplicable,
    content_evidence_complete: contentApplicable ? fitted.complete : true,
    context_truncated: fitted.truncated,
    additions,
    deletions,
  };
}

function parseNameStatus(raw) {
  const fields = raw.split("\0").filter(Boolean);
  const changes = [];
  for (let i = 0; i < fields.length;) {
    const status = fields[i++];
    const count = status.startsWith("R") || status.startsWith("C") ? 2 : 1;
    const paths = fields.slice(i, i + count);
    i += count;
    if (paths.length !== count)
      throw new Error("git returned incomplete changed-file metadata");
    changes.push({ status: status[0], path: paths.at(-1) });
  }
  return changes;
}

export function collectScopeQualityEvidence(repoRoot, scope, baseSha, headSha) {
  if (scope !== "P9.7") return null;
  if (!FULL_SHA.test(baseSha || "") || !FULL_SHA.test(headSha || "")) {
    throw new Error(
      "P9.7 quality evidence requires full base and head commit SHAs",
    );
  }
  const range = `${baseSha}...${headSha}`;
  const changes = parseNameStatus(
    git(repoRoot, ["diff", "--name-status", "-z", "--no-renames", range]),
  );
  const files = changes.map((change) => change.path);
  const numstat = git(repoRoot, ["diff", "--numstat", "--no-renames", range]);
  let additions = 0;
  let deletions = 0;
  for (const line of numstat.split(/\r?\n/).filter(Boolean)) {
    const [added, removed] = line.split("\t");
    if (/^\d+$/.test(added)) additions += Number(added);
    if (/^\d+$/.test(removed)) deletions += Number(removed);
  }
  const contentPages = files.filter(isGovernedContentPage);
  const contentSnapshots = contentPages.map((file) => {
    const status = changes.find((entry) => entry.path === file)?.status;
    const revision = status === "D" ? "base" : "head";
    const sha = revision === "base" ? baseSha : headSha;
    try {
      return {
        path: file,
        revision,
        content: git(repoRoot, ["show", `${sha}:${file}`]),
      };
    } catch {
      return { path: file, revision, content: null };
    }
  });
  const patch = git(repoRoot, [
    "diff",
    "--no-ext-diff",
    "--no-color",
    "--no-renames",
    "--unified=5",
    range,
  ]);
  let planText;
  try {
    planText = git(repoRoot, ["show", `${headSha}:${PLAN_PATH}`]);
  } catch (error) {
    throw new Error(
      `cannot read authoritative plan at candidate head: ${error.message}`,
    );
  }
  return buildScopeQualityEvidence(
    scope,
    {
      files,
      additions,
      deletions,
      patch,
      contentSnapshots,
    },
    planText,
  );
}
