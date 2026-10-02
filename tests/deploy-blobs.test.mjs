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
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  committedBytes,
  parseBatch,
  stageFromIndex,
  workingTreeDivergences,
} from "../scripts/lib/deploy-blobs.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

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

test("a clean tree reports no divergences (CRLF is not a divergence)", () => {
  // The whole point of using `git diff` rather than comparing bytes: a CRLF
  // working tree must NOT read as modified, or the warning is pure noise here.
  assert.deepEqual(
    workingTreeDivergences(ROOT, ["index.html", "robots.txt"]),
    [],
  );
});

test("an uncommitted edit IS reported, by name", () => {
  const victim = "robots.txt";
  const backup = readFileSync(join(ROOT, victim), "utf8");
  try {
    writeFileSync(join(ROOT, victim), backup + "\n<!-- uncommitted -->\n");
    assert.deepEqual(workingTreeDivergences(ROOT, [victim]), [victim]);
  } finally {
    writeFileSync(join(ROOT, victim), backup);
  }
  assert.deepEqual(workingTreeDivergences(ROOT, [victim]), []);
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
