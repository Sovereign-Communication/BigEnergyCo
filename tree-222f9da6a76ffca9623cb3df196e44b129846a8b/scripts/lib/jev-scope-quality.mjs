// P9.7 evidence policy. Git collection lives in jev-scope-quality-git.mjs.
const MAX_CONTEXT_CHARS = 90000;
export const PLAN_PATH = "docs/plan/MASTER_PLAN.md";
const INTERNAL_PAGE_ROOTS = new Set([
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
const CONTENT_SOURCES = new Set([
  "liability.md",
  "robots.txt",
  "sitemap.xml",
  "assets/data/provenance.json",
  "assets/js/shared/jargon-dict.js",
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

function requirementLine(planText, id) {
  const line = String(planText)
    .split(/\r?\n/)
    .find((text) => text.includes(`| ${id} |`) || text.includes(`**${id}:`));
  if (!line)
    throw new Error(
      `authoritative P9.7 evidence is missing ${id} in ${PLAN_PATH}`,
    );
  return line.trim();
}

export function extractP97QualityRubric(planText) {
  return [
    `P9.7 requirements from the candidate's ${PLAN_PATH}:`,
    ...REQUIRED_PLAN_IDS.map((id) => requirementLine(planText, id)),
    "Apply the requirements to every changed governed page or content source. For infrastructure-only changes, judge the gate against its actual diff and tests; do not grade code as published copy.",
  ].join("\n");
}

function normalizePath(file) {
  return String(file).replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
}

export function isGovernedContentFile(file) {
  const path = normalizePath(file);
  if (CONTENT_SOURCES.has(path)) return true;
  if (!/\.html?$/.test(path) || path === "404.html") return false;
  const root = path.split("/")[0];
  return (
    !root.startsWith(".") &&
    !root.startsWith("_") &&
    !INTERNAL_PAGE_ROOTS.has(root)
  );
}

function redact(text) {
  return String(text)
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
      /(?:AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|xox[bap]-[0-9A-Za-z-]+|sk-[A-Za-z0-9_-]{20,}|apik[-_][A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})/g,
      "[REDACTED]",
    );
}

export function buildScopeQualityEvidence(scope, change, planText = "") {
  if (scope !== "P9.7") return null;
  if (
    !change ||
    !Array.isArray(change.files) ||
    typeof change.patch !== "string"
  ) {
    throw new Error("P9.7 quality evidence requires the actual PR diff");
  }

  const files = change.files.filter((file) => typeof file === "string");
  const contentFiles = files.filter(isGovernedContentFile);
  const snapshots = new Map(
    (change.contentSnapshots || []).map((snapshot) => [
      snapshot.path,
      snapshot,
    ]),
  );
  let evidenceComplete = true;
  const parts = [
    extractP97QualityRubric(planText),
    `Changed files: ${files.join(", ") || "none"}.`,
  ];

  for (const file of contentFiles) {
    const snapshot = snapshots.get(file);
    if (!snapshot || typeof snapshot.content !== "string") {
      evidenceComplete = false;
      parts.push(
        `Full snapshot unavailable for changed governed content: ${file}.`,
      );
      continue;
    }
    const revision = snapshot.revision === "base" ? "base (deleted)" : "head";
    parts.push(
      `Full ${revision} snapshot of ${file}:\n${redact(snapshot.content)}`,
    );
  }

  parts.push(
    `Actual unified diff (credential-shaped values redacted):\n${redact(change.patch) || "(no changed lines)"}`,
  );
  let context = parts.join("\n\n");
  const contextTruncated = context.length > MAX_CONTEXT_CHARS;
  if (contextTruncated) {
    context = `${context.slice(0, MAX_CONTEXT_CHARS - 100)}\n\n[Evidence truncated at ${MAX_CONTEXT_CHARS} characters; judgment is incomplete.]`;
    evidenceComplete = false;
  }

  const contentApplicable = contentFiles.length > 0;
  const facetLine = contentApplicable
    ? "For P9.7, judge changed governed pages and content sources against the candidate plan requirements, full snapshots, and actual diff below."
    : "For this P9.7 infrastructure-only change, judge the gate against its tests and actual diff, including whether content checks apply only to published pages and named content sources. Do not grade code as published copy.";
  return {
    facet_line: evidenceComplete
      ? facetLine
      : `${facetLine} Evidence is incomplete or truncated; do not grant a passing P9.7 judgment.`,
    context,
    changed_files: files,
    content_files: contentFiles,
    content_criteria_applicable: contentApplicable,
    content_evidence_complete: evidenceComplete,
    context_truncated: contextTruncated,
  };
}
