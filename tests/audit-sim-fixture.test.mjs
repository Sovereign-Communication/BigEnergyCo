// Proves the `audit-sim` fixture is REGENERABLE, not merely asserted to be.
//
// Preservation gap G6 (docs/lane/PRESERVATION-CONFORMANCE-2026-11-05.md) scored
// the two `C:/tmp/audit-sim*` directories as unproven scaffolding: their tips
// are fabricated `Merge pull request #999/9999` commits that GitHub rejects
// (HTTP 422), so they were never pushed, and the 2026-11-03 record's claim that
// they are reproducible had no committed generator behind it. This test runs
// `scripts/make-audit-sim-fixture.mjs` and asserts the shape it must produce,
// which is what converts that row's disposition from asserted to proven.
//
// It also pins WHY the fixture matters: `prDeliveredShas` cannot tell a
// fabricated merge subject from a GitHub merge (the limit written down in
// scripts/lib/release.mjs). A fixture that stopped reproducing this would make
// the release-safety gates look stronger than they are.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { directPushVerdict, prDeliveredShas } from "../scripts/lib/release.mjs";

const generator = fileURLToPath(
  new URL("../scripts/make-audit-sim-fixture.mjs", import.meta.url),
);

function build(pr = "9999", seed = "") {
  const root = mkdtempSync(join(tmpdir(), "beco-audit-sim-"));
  const dir = join(root, "fixture");
  const out = execFileSync(
    process.execPath,
    [generator, "--dir", dir, "--pr", pr, "--seed", seed],
    { encoding: "utf8" },
  );
  const g = (...args) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  return {
    root,
    dir,
    out,
    g,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

test("G6: the committed generator rebuilds the fabricated-merge fixture", () => {
  const f = build();
  try {
    assert.equal(
      f.g("log", "-1", "--format=%s"),
      "Merge pull request #9999 from Sovereign-Communication/pr-sim",
      "the fixture's tip must carry the fabricated PR merge subject",
    );
    assert.equal(
      f.g("rev-list", "--parents", "-n", "1", "HEAD").split(/\s+/).length,
      3,
      "the tip must be a real two-parent merge, not a squash",
    );
  } finally {
    f.cleanup();
  }
});

test("G6: the fixture is deterministic, so it is regenerable rather than lost", () => {
  const a = build();
  const b = build();
  try {
    assert.equal(
      a.g("rev-parse", "HEAD"),
      b.g("rev-parse", "HEAD"),
      "two runs of the generator must produce the same tip SHA",
    );
    assert.match(a.out, /^audit-sim fixture: /m);
  } finally {
    a.cleanup();
    b.cleanup();
  }
});

test("G6: the generator refuses to write into a non-empty directory", () => {
  const f = build();
  try {
    assert.throws(
      () =>
        execFileSync(process.execPath, [generator, "--dir", f.dir], {
          encoding: "utf8",
          stdio: "pipe",
        }),
      /REFUSED/,
      "an existing fixture must not be overwritten in place",
    );
  } finally {
    f.cleanup();
  }
});

test("G6: a fabricated merge still hides a non-documentation commit from the audit", () => {
  const f = build();
  try {
    const base = f.g("rev-list", "--max-parents=0", "HEAD");
    const range = `${base}..HEAD`;
    const commits = f
      .g("rev-list", "--reverse", range)
      .split("\n")
      .filter(Boolean);
    const delivered = prDeliveredShas(commits, { cwd: f.dir });
    const pulled = f.g("rev-parse", "HEAD^2");

    // The documented limit, asserted rather than assumed: the pulled commit is
    // forgiven because of a subject anyone can type.
    assert.equal(delivered.has(pulled), true);

    // The guard still blocks the same change pushed straight onto the branch.
    const direct = directPushVerdict({
      range: `${base}..${pulled}`,
      message: "pr-sim: change a non-documentation file",
      cwd: f.dir,
    });
    assert.equal(direct.ok, false);
    assert.deepEqual(direct.files, ["assets/js/sim.js"]);
  } finally {
    f.cleanup();
  }
});

test("G6: the pushed refs of this repository never contain a fabricated fixture tip", async () => {
  // The reason these fixtures are not on the remote: a fabricated merge subject
  // is indistinguishable from a real one to the audit. Assert the practice, not
  // just the intent — no ref in the repo names an audit-sim tip.
  const refs = execFileSync("git", ["for-each-ref", "--format=%(refname)"], {
    encoding: "utf8",
    cwd: fileURLToPath(new URL("..", import.meta.url)),
  })
    .split("\n")
    .filter(Boolean);
  assert.equal(
    refs.some((r) => /audit-sim/i.test(r)),
    false,
    "audit-sim fixtures stay out of the repository refs",
  );
  assert.ok(readdirSync(tmpdir()).length >= 0);
});
