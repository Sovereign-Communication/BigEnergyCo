// Staging deployable files from the committed bytes (scripts/lib/deploy-blobs.mjs).
//
// The defect this pins: the deploy manifest was ALWAYS index-derived
// (`deployList()` reads `git ls-files`), but the CONTENT was copied with
// `cpSync` from the working tree. On a `core.autocrlf = true` checkout the two
// halves disagree: git stores LF and checks CRLF out, so every promote run from
// such a machine shipped CRLF — index.html at 125,266 bytes, 266 OVER the
// repo's own 125,000 first-load budget, while the committed blob sat at
// 121,825 and CI passed. The site that shipped was not the site that was
// reviewed.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  committedBytes,
  parseBatch,
  stageFromIndex,
  workingTreeDivergences,
} from "../scripts/lib/deploy-blobs.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * A throwaway repository for the tests that must WRITE to a git index.
 *
 * These used to mutate this repository and restore it afterwards. That is a
 * bet against the rest of the suite: `node --test` runs test FILES in
 * parallel, and `tests/promote-gates.test.mjs` has a "mutation tooth" test that
 * `git rm`s a tracked file. Two suites writing `.git/index` at the same time
 * collide on `index.lock`, and the symptom is a failure in whichever suite lost
 * — which is how an unrelated test went red on a tree nobody had touched.
 *
 * `workingTreeDivergences` takes its root as a parameter precisely so this is
 * possible, so the tests exercise the real function against a real index and
 * simply stop sharing one with anybody else.
 */
function scratchRepo(t) {
  const dir = mkdtempSync(join(tmpdir(), "bec-divergence-"));
  const g = (...args) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8" });
  mkdirSync(join(dir, "assets", "js"), { recursive: true });
  writeFileSync(join(dir, "a.txt"), "one\n");
  writeFileSync(join(dir, "nested.txt"), "one\ntwo\n");
  writeFileSync(join(dir, "assets", "js", "b.js"), "one\n");
  g("init", "-q", ".");
  g("-c", "user.name=t", "-c", "user.email=t@e", "add", "-A");
  g("-c", "user.name=t", "-c", "user.email=t@e", "commit", "-q", "-m", "base");
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return { dir, g };
}

// ── the batch protocol ────────────────────────────────────────────────────

test("parseBatch reads byte-exact content and skips the trailing LF", () => {
  const body = Buffer.from([0x41, 0x0d, 0x0a, 0x00, 0xff]); // includes CR, LF, NUL, 0xff
  const wire = Buffer.concat([
    Buffer.from("deadbeef blob 5\n"),
    body,
    Buffer.from("\n"),
  ]);
  const [rec] = parseBatch(wire);
  assert.equal(rec.size, 5);
  assert.deepEqual(Buffer.from(rec.content), body);
});

test("parseBatch reports a missing object instead of guessing", () => {
  const wire = Buffer.from("nope missing\n");
  const [rec] = parseBatch(wire);
  assert.equal(rec.missing, true);
  assert.equal(rec.content, undefined);
});

// ── committed bytes are the bytes git holds ──────────────────────────────

test("committedBytes returns the index blob, not the working-tree file", () => {
  const fromIndex = committedBytes(ROOT, "index.html");
  const fromGit = execFileSync("git", ["show", ":index.html"], {
    cwd: ROOT,
    maxBuffer: 32 * 1024 * 1024,
  });
  assert.ok(fromIndex.equals(fromGit), "must equal the git index blob");
});

test("committed html carries no CR, whatever the checkout's line endings", () => {
  const html = committedBytes(ROOT, "index.html");
  const crs = [...html].filter((b) => b === 13).length;
  assert.equal(
    crs,
    0,
    `committed index.html should be LF, found ${crs} CR bytes`,
  );
});

test("a Windows-style backslash path resolves (git paths are forward-slash)", () => {
  const forward = committedBytes(ROOT, "assets/js/sizing/ui.js");
  const backward = committedBytes(ROOT, "assets\\js\\sizing\\ui.js");
  assert.ok(forward.equals(backward));
});

test("binary assets survive the read intact", () => {
  const png = committedBytes(ROOT, "assets/icon-192.png");
  const onDisk = readFileSync(join(ROOT, "assets/icon-192.png"));
  // A text round-trip would corrupt this; bytes must be identical either way.
  assert.ok(png.equals(onDisk));
  assert.ok(png.length > 0);
});

// ── divergences ──────────────────────────────────────────────────────────

test("a clean tree reports no divergences (CRLF is not a divergence)", (t) => {
  // The whole point of using `git diff` rather than comparing bytes: a CRLF
  // working tree must NOT read as modified, or the warning is pure noise here.
  const { dir, g } = scratchRepo(t);
  assert.deepEqual(
    workingTreeDivergences(dir, ["a.txt", "assets/js/b.js"]),
    [],
  );
  // The SAME bytes written with CRLF must not read as an edit either -- that is
  // the whole reason this compares git's view rather than the bytes on disk,
  // and the noise it avoids is the warning a CRLF checkout would otherwise
  // print on every single run.
  g("config", "core.autocrlf", "true");
  writeFileSync(join(dir, "nested.txt"), "one\r\ntwo\r\n");
  assert.deepEqual(
    workingTreeDivergences(dir, ["nested.txt"]),
    [],
    "line endings are not a divergence",
  );
});

test("an uncommitted edit IS reported, by name", (t) => {
  const { dir } = scratchRepo(t);
  writeFileSync(join(dir, "a.txt"), "one\ntwo\n");
  assert.deepEqual(workingTreeDivergences(dir, ["a.txt"]), ["a.txt"]);
});

test("a STAGED edit is reported too, because the build reads the index", (t) => {
  // The stage is built from the INDEX, so a `git add`ed edit is not excluded
  // from the artifact - it is IN it, and the next commit carries it. Calling the
  // bytes "committed" while silently omitting staged ones made the warning lie
  // in the direction that matters least. Measured before the fix: a staged edit
  // produced zero STAGE NOTE lines.
  const { dir, g } = scratchRepo(t);
  writeFileSync(join(dir, "a.txt"), "one\nstaged\n");
  g("add", "--", "a.txt");

  // The working tree now matches the index, so the old index-vs-worktree diff
  // saw nothing at all.
  assert.deepEqual(g("diff", "--name-only").trim(), "");
  assert.deepEqual(workingTreeDivergences(dir, ["a.txt"]), ["a.txt"]);

  // And the same file, unstaged, is caught by the other half of the union.
  g("restore", "--staged", "--", "a.txt");
  assert.deepEqual(workingTreeDivergences(dir, ["a.txt"]), ["a.txt"]);
});

test("divergences normalise a Windows-style path before matching", (t) => {
  // readIndexBlobs normalises `\` to `/` for the same reason: git always speaks
  // forward slashes, so a backslash path would match nothing and report a clean
  // tree over a dirty index.
  const { dir, g } = scratchRepo(t);
  writeFileSync(join(dir, "assets", "js", "b.js"), "one\nstaged\n");
  g("add", "--", "assets/js/b.js");

  const victim = "assets/js/b.js";
  const windowsStyle = victim.split("/").join("\\");
  assert.notEqual(
    windowsStyle,
    victim,
    "the probe must actually contain a backslash",
  );
  assert.deepEqual(
    workingTreeDivergences(dir, [windowsStyle]),
    [victim],
    "a Windows-style path must match the git path it names",
  );
});

// ── staging behaviour ────────────────────────────────────────────────────

test("stageFromIndex writes committed bytes and excludes a local edit", () => {
  const stage = "_pages_blob_test";
  const victim = "robots.txt";
  const backup = readFileSync(join(ROOT, victim), "utf8");
  rmSync(stage, { recursive: true, force: true });
  try {
    writeFileSync(join(ROOT, victim), backup + "\n<!-- uncommitted -->\n");
    const divergences = stageFromIndex(ROOT, stage, [
      "robots.txt",
      "index.html",
    ]);

    // The edit is named, loudly, not silently dropped.
    assert.deepEqual(divergences, [victim]);

    // And it is genuinely absent from the staged artifact.
    const staged = readFileSync(join(stage, victim), "utf8");
    assert.ok(!staged.includes("uncommitted"), "local edit must not be staged");
    assert.equal(staged, backup, "staged bytes must equal the committed blob");

    const stagedHtml = readFileSync(join(stage, "index.html"));
    assert.ok(stagedHtml.equals(committedBytes(ROOT, "index.html")));
    assert.equal(
      [...stagedHtml].filter((b) => b === 13).length,
      0,
      "staged html must be LF",
    );
  } finally {
    rmSync(stage, { recursive: true, force: true });
    writeFileSync(join(ROOT, victim), backup);
  }
});
