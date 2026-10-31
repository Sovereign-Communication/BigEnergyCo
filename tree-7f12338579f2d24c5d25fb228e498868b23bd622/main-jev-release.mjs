/** Select and verify the latest full Jev run for the exact main staging SHA. */
export function latestMainPushRun(runs, sha) {
  return (
    (Array.isArray(runs) ? runs : [])
      .filter(
        (run) =>
          run.head_sha === sha &&
          run.head_branch === "main" &&
          run.event === "push",
      )
      .sort(
        (a, b) =>
          (Date.parse(b.created_at || "") || 0) -
            (Date.parse(a.created_at || "") || 0) ||
          Number(b.run_number || 0) - Number(a.run_number || 0) ||
          Number(b.run_attempt || 0) - Number(a.run_attempt || 0),
      )[0] || null
  );
}

export function mainJevReleaseVerdict({ sha, run, jobs }) {
  if (!run) return { ok: false, reason: `no main push run for ${sha}` };
  if (
    run.head_sha !== sha ||
    run.head_branch !== "main" ||
    run.event !== "push"
  ) {
    return { ok: false, reason: "latest run does not match the main push SHA" };
  }
  if (run.status !== "completed") {
    return { ok: false, reason: `main push run is ${run.status || "unknown"}` };
  }
  if (run.conclusion !== "success") {
    return {
      ok: false,
      reason: `main push run concluded ${run.conclusion || "unknown"}`,
    };
  }
  const job = (Array.isArray(jobs) ? jobs : []).find(
    (candidate) => candidate.name === "jev-complete",
  );
  if (!job || job.status !== "completed" || job.conclusion !== "success") {
    return {
      ok: false,
      reason: "main push run has no successful completed jev-complete job",
    };
  }
  const gateStep = (Array.isArray(job.steps) ? job.steps : []).find((step) =>
    String(step.name || "").startsWith(
      "Jev complete gate (live, model-pinned)",
    ),
  );
  if (!gateStep || gateStep.conclusion !== "success") {
    return {
      ok: false,
      reason: "main push jev-complete job has no successful live gate step",
    };
  }
  return { ok: true, runId: run.id, sha };
}

export function githubRepositorySlug(remote) {
  const match = String(remote || "").match(
    /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/i,
  );
  if (!match || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(match[1])) {
    throw new Error("origin is not a GitHub repository URL");
  }
  return match[1];
}
