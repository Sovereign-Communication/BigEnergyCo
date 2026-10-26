import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  mutationLockPath,
  withMutationLock,
} from "../scripts/lib/mutation-lock.mjs";

test("mutation lock timeout never overwrites its owner or runs the operation", async () => {
  const root = mkdtempSync(join(tmpdir(), "beco-mutation-lock-test-"));
  const lock = mutationLockPath(root);
  writeFileSync(lock, "held-by-another-process");
  let ran = false;

  try {
    await assert.rejects(
      withMutationLock(
        async () => {
          ran = true;
        },
        root,
        { timeoutMs: 10, stepMs: 1 },
      ),
      /Timed out waiting for the shared mutation lock/,
    );
    assert.equal(ran, false);
    assert.equal(readFileSync(lock, "utf8"), "held-by-another-process");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a child process borrows its parent's lock without releasing it", async () => {
  const root = mkdtempSync(join(tmpdir(), "beco-mutation-lock-child-"));
  const lock = mutationLockPath(root);
  const lockModule = new URL(
    "../scripts/lib/mutation-lock.mjs",
    import.meta.url,
  ).href;

  try {
    await withMutationLock(async () => {
      const before = readFileSync(lock, "utf8");
      const code = `import { withMutationLock } from ${JSON.stringify(lockModule)}; await withMutationLock(() => console.log("borrowed"), ${JSON.stringify(root)});`;
      const output = execFileSync(
        process.execPath,
        ["--input-type=module", "-e", code],
        { encoding: "utf8" },
      );

      assert.equal(output.trim(), "borrowed");
      assert.equal(readFileSync(lock, "utf8"), before);
    }, root);
    assert.equal(existsSync(lock), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("unrelated calls in one process stay mutually exclusive", async () => {
  const root = mkdtempSync(join(tmpdir(), "beco-mutation-lock-concurrent-"));
  let signalFirstEntered;
  const firstEntered = new Promise((resolve) => {
    signalFirstEntered = resolve;
  });
  let releaseFirst;
  const firstMayExit = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  let secondEntered = false;
  let first;
  let second;

  try {
    first = withMutationLock(async () => {
      signalFirstEntered();
      await firstMayExit;
    }, root);
    await firstEntered;

    second = withMutationLock(
      async () => {
        secondEntered = true;
      },
      root,
      { timeoutMs: 1000, stepMs: 1 },
    );

    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(secondEntered, false, "second call must wait for the lock");

    releaseFirst();
    await Promise.all([first, second]);
    assert.equal(secondEntered, true, "second call runs after release");
  } finally {
    releaseFirst();
    await Promise.allSettled([first, second].filter(Boolean));
    rmSync(root, { recursive: true, force: true });
  }
});
