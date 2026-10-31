// End-to-end tests for the asset-stamp staleness gate, run as the real CLI in a
// throwaway repository.
//
// Why a real process and not a unit test. The gate's entire value is that it
// REFUSES. Every failure mode found by the external review of this work was a
// gate that printed its normal green line while verifying nothing:
//
//   - a shallow clone, where `git log -S` returns HEAD, so the setter becomes
//     HEAD and the comparison is HEAD against HEAD;
//   - a reference that resolves to no blob, skipped and still counted in the
//     "N referenced assets verified" tally;
//   - a reference that escapes the repository, same outcome;
//   - a `git add`ed asset, whose bytes are compared at HEAD, so an uncommitted
//     index sails through and the stale commit lands.
//
// None of those is visible from the function signature. Each one is only
// reachable by running the gate and reading its exit code, so that is what
// these do. A green exit code is the product; everything else is the means.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STAMP = "20260101a";

// No `shell: true`: it re-splits arguments on Windows, so a commit message of
// two words arrives as two pathspecs.
const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8" });

const commit = (cwd, msg) => {
  const r = git(cwd, "-c", "user.name=t", "-c", "user.email=t@e", "add", "-A");
  assert.equal(r.status, 0, `git add failed: ${r.stderr}`);
  const c = git(
    cwd,
    "-c",
    "user.name=t",
    "-c",
    "user.email=t@e",
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    msg,
  );
  assert.equal(c.status, 0, `git commit failed: ${c.stderr}`);
};

/**
 * A minimal repository that passes checks (a), (b) and (c): one token, present
 * everywhere it is referenced, and a sw.js whose SHELL entries exist.
 */
function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "bec-gate-"));
  mkdirSync(join(dir, "assets", "js"), { recursive: true });
  mkdirSync(join(dir, "solar-heatmap"), { recursive: true });
  mkdirSync(join(dir, "scripts", "lib"), { recursive: true });

  // The gate under test, verbatim from the working tree.
  cpSync(
    join(ROOT, "scripts", "bump-asset-tokens.mjs"),
    join(dir, "scripts", "bump-asset-tokens.mjs"),
  );
  cpSync(
    join(ROOT, "scripts", "lib", "asset-tokens.mjs"),
    join(dir, "scripts", "lib", "asset-tokens.mjs"),
  );

  writeFileSync(
    join(dir, "index.html"),
    `<!doctype html><script type="module" src="./assets/js/a.js?v=${STAMP}"></script>\n`,
  );
  writeFileSync(join(dir, "assets", "js", "a.js"), "// v1\n");
  // The graph is a fixed list, and solar-heatmap/index.html is on it
  // unconditionally, so the fixture has to have it or the gate ENOENTs before it
  // ever reaches the check under test.
  writeFileSync(
    join(dir, "solar-heatmap", "index.html"),
    `<!doctype html><script type="module" src="../assets/js/a.js?v=${STAMP}"></script>\n`,
  );
  writeFileSync(
    join(dir, "sw.js"),
    `const CACHE_VERSION = "beco-v1";\nconst SHELL = ["./index.html"];\n`,
  );

  git(dir, "init", "-q", ".");
  commit(dir, "set the stamp");
  return dir;
}

const runCheck = (dir) =>
  spawnSync(
    "node",
    [join(dir, "scripts", "bump-asset-tokens.mjs"), "--check"],
    {
      cwd: dir,
      encoding: "utf8",
    },
  );

test("GATE: a freshly stamped repository passes, and says what it verified", (t) => {
  const dir = makeRepo();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const r = runCheck(dir);
  assert.equal(r.status, 0, `expected green:\n${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /asset-token check OK/);
  // The tally is the thing a reader trusts, so it must count a real asset.
  assert.match(r.stdout, /1 referenced assets verified/);
});

test("GATE: a committed asset edit under an unchanged stamp is refused", (t) => {
  const dir = makeRepo();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "assets", "js", "a.js"), "// v2\n");
  commit(dir, "change the asset, keep the token");

  const r = runCheck(dir);
  assert.equal(r.status, 1, "a stale token must fail the build");
  assert.match(r.stderr, /assets\/js\/a\.js/);
  assert.match(r.stderr, /changed but the stamp stayed/);
});

test("GATE: a STAGED asset edit under an unchanged stamp is refused", (t) => {
  // The hole the review found. Blobs are compared at HEAD, so an index the
  // author has `git add`ed but not committed is invisible — and it is precisely
  // the bytes the next commit will carry. Before the fix this exited 0.
  const dir = makeRepo();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "assets", "js", "a.js"), "// v2\n");
  assert.equal(git(dir, "add", "assets/js/a.js").status, 0);

  const r = runCheck(dir);
  assert.equal(
    r.status,
    1,
    "a staged-but-uncommitted asset must fail the build",
  );
  assert.match(r.stderr, /STAGED but the stamp is unchanged/);
  assert.match(r.stderr, /assets\/js\/a\.js/);
});

test("GATE: an unstaged asset edit is not by itself a failure", (t) => {
  // The mirror of the test above, so the fix cannot be a blanket "any dirty
  // asset file fails": an uncommitted local edit ships in nobody's commit, and
  // failing on it would make the gate unpassable on a contributor's machine.
  const dir = makeRepo();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "assets", "js", "a.js"), "// v2\n");

  const r = runCheck(dir);
  assert.equal(r.status, 0, `expected green:\n${r.stdout}${r.stderr}`);
});

test("GATE: a reference that resolves outside the repository is refused", (t) => {
  // Previously this path was inserted into the asset map anyway. `git show` then
  // failed on it, it was classified "new since the setter" and therefore exempt,
  // and it was still counted in the "N verified" tally — a broken resolution
  // reported identically to a clean run.
  const dir = makeRepo();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(
    join(dir, "index.html"),
    `<!doctype html>\n` +
      `<script type="module" src="./assets/js/a.js?v=${STAMP}"></script>\n` +
      `<script type="module" src="../../outside.js?v=${STAMP}"></script>\n`,
  );
  commit(dir, "reference outside the repo");

  const r = runCheck(dir);
  assert.equal(r.status, 1, "an escaping reference must fail the build");
  assert.match(r.stderr, /resolve OUTSIDE the repository/);
});

test("GATE: a reference whose target no longer exists is refused, not skipped", (t) => {
  // The other half of the same hole. index.html still points at assets/js/gone.js
  // — a first-party reference that now resolves to nothing. Every path handed
  // to the comparison came from the reference scan, so "absent at HEAD" is never
  // a benign deletion; it is a broken reference, and a page that ships a 404.
  //
  // The previous version skipped it as "deleted, nothing references it any
  // more", which is exactly backwards: something does reference it, that is how
  // we found it.
  const dir = makeRepo();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  // A NEW stamp, so the setter commit is the one that introduces gone.js. Under
  // the original stamp the setter predates the file, which is legitimately "new
  // since the setter" and legitimately exempt — a different rule, tested above.
  const NEXT = "20260102a";
  for (const [f, dir_] of [
    ["index.html", ""],
    [join("solar-heatmap", "index.html"), "../"],
  ]) {
    writeFileSync(
      join(dir, f),
      `<!doctype html><script type="module" src="${dir_}assets/js/a.js?v=${NEXT}"></script>\n` +
        `<script type="module" src="${dir_}assets/js/gone.js?v=${NEXT}"></script>\n`,
    );
  }
  writeFileSync(join(dir, "assets", "js", "gone.js"), "// transient\n");
  commit(dir, "reference a file under a fresh stamp");

  rmSync(join(dir, "assets", "js", "gone.js"));
  commit(dir, "delete the file but keep the reference");

  const r = runCheck(dir);
  assert.equal(r.status, 1, "an unresolvable reference must fail the build");
  assert.match(r.stderr, /no blob in the repository/);
  assert.match(r.stderr, /gone\.js/);
});

test("GATE: a shallow clone refuses rather than verifying nothing", (t) => {
  // Measured before the fix: exit 0, with the normal green line and a full
  // tally. `git log -S` does not fail on a grafted root — it reports exactly
  // one commit, HEAD, so the setter became HEAD and the gate compared HEAD to
  // itself. This is the single most dangerous finding of the review, because
  // nothing about the output changed: it looked like a working gate.
  const origin = makeRepo();
  const shallow = join(
    tmpdir(),
    `bec-gate-shallow-${process.pid}-${Date.now()}`,
  );
  t.after(() => {
    rmSync(shallow, { recursive: true, force: true });
    rmSync(origin, { recursive: true, force: true });
  });

  // `--depth` is ignored for a plain local path; file:// is what honours it.
  const clone = git(
    tmpdir(),
    "clone",
    "-q",
    "--depth",
    "1",
    `file://${origin}`,
    shallow,
  );
  assert.equal(clone.status, 0, `clone failed: ${clone.stderr}`);

  const r = runCheck(shallow);
  assert.equal(r.status, 1, "a shallow clone must refuse to report green");
  assert.match(r.stderr, /shallow/);
  assert.doesNotMatch(r.stdout, /asset-token check OK/);
});

test("GATE: the same history fetched in full passes again", (t) => {
  // Proves the shallow guard is a statement about REACHABILITY, not a blanket
  // refusal: unshallowing the identical history restores the green.
  const origin = makeRepo();
  const full = join(tmpdir(), `bec-gate-full-${process.pid}-${Date.now()}`);
  t.after(() => {
    rmSync(full, { recursive: true, force: true });
    rmSync(origin, { recursive: true, force: true });
  });
  const clone = git(
    tmpdir(),
    "clone",
    "-q",
    "--depth",
    "1",
    `file://${origin}`,
    full,
  );
  assert.equal(clone.status, 0, `clone failed: ${clone.stderr}`);
  assert.equal(
    runCheck(full).status,
    1,
    "the shallow clone must be refused before the fetch",
  );

  assert.equal(git(full, "fetch", "-q", "--unshallow").status, 0);
  const r = runCheck(full);
  assert.equal(
    r.status,
    0,
    `expected green after unshallowing:\n${r.stdout}${r.stderr}`,
  );
  assert.match(r.stdout, /asset-token check OK/);
});

test("GATE: the gate under test is the one in the working tree", (t) => {
  // Guards the fixtures themselves: if the copy drifted, every other test in
  // this file would be exercising a historical version of the gate.
  const dir = makeRepo();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  assert.equal(
    readFileSync(join(dir, "scripts", "bump-asset-tokens.mjs"), "utf8"),
    readFileSync(join(ROOT, "scripts", "bump-asset-tokens.mjs"), "utf8"),
  );
  assert.equal(
    readFileSync(join(dir, "scripts", "lib", "asset-tokens.mjs"), "utf8"),
    readFileSync(join(ROOT, "scripts", "lib", "asset-tokens.mjs"), "utf8"),
  );
});
