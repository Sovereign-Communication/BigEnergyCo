// Git adapter for P9.7 evidence. It pins the change, page snapshots, and
// authoritative plan to explicit commits, then delegates prompt construction
// to the pure jev-scope-quality module.
import { spawnSync } from "node:child_process";
import {
  buildScopeQualityEvidence,
  isGovernedContentPage,
  PLAN_PATH,
} from "./jev-scope-quality.mjs";

const FULL_SHA = /^[0-9a-f]{40}$/i;
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

function parseNameStatus(raw) {
  const fields = raw.split("\0").filter(Boolean);
  if (fields.length % 2)
    throw new Error("git returned incomplete changed-file metadata");
  return Array.from({ length: fields.length / 2 }, (_, index) => ({
    status: fields[index * 2][0],
    path: fields[index * 2 + 1],
  }));
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
