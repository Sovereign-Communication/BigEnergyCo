// Read P9.7's exact base/head diff, then let the pure policy build its evidence.
import { spawnSync } from "node:child_process";
import {
  buildScopeQualityEvidence,
  isGovernedContentFile,
  PLAN_PATH,
} from "./jev-scope-quality.mjs";

function git(root, ...args) {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    timeout: 15000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `git ${args[0]} failed: ${(result.stderr || result.error?.message || "").trim()}`,
    );
  return result.stdout || "";
}

export function collectScopeQualityEvidence(root, scope, base, head) {
  if (scope !== "P9.7") return null;
  if (![base, head].every((sha) => /^[0-9a-f]{40}$/i.test(sha || "")))
    throw new Error(
      "P9.7 quality evidence requires full base and head commit SHAs",
    );

  const range = `${base}...${head}`;
  const fields = git(root, "diff", "--name-status", "-z", "--no-renames", range)
    .split("\0")
    .filter(Boolean);
  if (fields.length % 2)
    throw new Error("git returned incomplete changed-file metadata");
  const changes = Array.from({ length: fields.length / 2 }, (_, index) => ({
    status: fields[index * 2][0],
    path: fields[index * 2 + 1],
  }));
  const files = changes.map(({ path }) => path);
  const contentSnapshots = changes
    .filter(({ path }) => isGovernedContentFile(path))
    .map(({ path, status }) => {
      const revision = status === "D" ? "base" : "head";
      try {
        return {
          path,
          revision,
          content: git(
            root,
            "show",
            `${revision === "base" ? base : head}:${path}`,
          ),
        };
      } catch {
        return { path, revision, content: null };
      }
    });
  const patch = git(
    root,
    "diff",
    "--no-ext-diff",
    "--no-color",
    "--no-renames",
    "--unified=5",
    range,
  );
  const plan = git(root, "show", `${head}:${PLAN_PATH}`);
  return buildScopeQualityEvidence(
    scope,
    { files, patch, contentSnapshots },
    plan,
  );
}
