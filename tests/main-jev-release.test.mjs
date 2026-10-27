import { test } from "node:test";
import assert from "node:assert/strict";

import {
  githubRepositorySlug,
  latestMainPushRun,
  mainJevReleaseVerdict,
} from "../scripts/lib/main-jev-release.mjs";

const sha = "1234567890abcdef";
const passingRun = {
  id: 42,
  head_sha: sha,
  head_branch: "main",
  event: "push",
  status: "completed",
  conclusion: "success",
  created_at: "2026-10-20T12:00:00Z",
};
const passingJobs = [
  {
    name: "jev-complete",
    status: "completed",
    conclusion: "success",
    steps: [
      {
        name: "Jev complete gate (live, model-pinned)",
        conclusion: "success",
      },
    ],
  },
];

test("promotion selects only the latest exact-SHA main push", () => {
  const previous = {
    ...passingRun,
    id: 41,
    created_at: "2026-10-20T11:00:00Z",
  };
  const pr = { ...passingRun, id: 40, event: "pull_request" };
  const otherSha = { ...passingRun, id: 39, head_sha: "other" };
  assert.equal(
    latestMainPushRun([pr, otherSha, previous, passingRun], sha).id,
    42,
  );
  assert.equal(latestMainPushRun([previous], "missing"), null);
});

test("a newer failed main run cannot be bypassed by an older successful run", () => {
  const failed = {
    ...passingRun,
    id: 43,
    status: "completed",
    conclusion: "failure",
    created_at: "2026-10-20T13:00:00Z",
  };
  const selected = latestMainPushRun([passingRun, failed], sha);
  assert.equal(selected.id, 43);
  assert.deepEqual(
    mainJevReleaseVerdict({ sha, run: selected, jobs: passingJobs }),
    {
      ok: false,
      reason: "main push run concluded failure",
    },
  );
  const pending = {
    ...passingRun,
    id: 44,
    status: "in_progress",
    conclusion: null,
    created_at: "2026-10-20T14:00:00Z",
  };
  const latest = latestMainPushRun([passingRun, pending], sha);
  assert.equal(latest.id, 44);
  assert.equal(
    mainJevReleaseVerdict({ sha, run: latest, jobs: passingJobs }).ok,
    false,
  );
});

test("production gate requires the completed full live Jev job and step", () => {
  assert.deepEqual(
    mainJevReleaseVerdict({ sha, run: passingRun, jobs: passingJobs }),
    { ok: true, runId: 42, sha },
  );
  assert.equal(
    mainJevReleaseVerdict({
      sha,
      run: { ...passingRun, status: "in_progress" },
      jobs: passingJobs,
    }).ok,
    false,
  );
  assert.equal(
    mainJevReleaseVerdict({ sha, run: passingRun, jobs: [] }).ok,
    false,
  );
  assert.equal(
    mainJevReleaseVerdict({
      sha,
      run: passingRun,
      jobs: [
        {
          ...passingJobs[0],
          steps: [
            {
              name: "Jev complete gate (live, model-pinned)",
              conclusion: "failure",
            },
          ],
        },
      ],
    }).ok,
    false,
  );
});

test("GitHub remote URLs resolve to the repository slug", () => {
  assert.equal(
    githubRepositorySlug(
      "https://github.com/Sovereign-Communication/BigEnergyCo.git",
    ),
    "Sovereign-Communication/BigEnergyCo",
  );
  assert.equal(
    githubRepositorySlug(
      "git@github.com:Sovereign-Communication/BigEnergyCo.git",
    ),
    "Sovereign-Communication/BigEnergyCo",
  );
  assert.throws(() => githubRepositorySlug("https://example.com/project.git"));
});
