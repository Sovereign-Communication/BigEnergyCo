// The formatting gate itself, tested as a gate.
//
// This file exists because a local preflight reported GREEN on a tree CI
// rejected. `npx prettier --check` was fed a batch of tracked files; prettier
// ERRORS on the tracked files it has no parser for (.gitattributes, LICENSE,
// _headers, _redirects), and that error suppressed the warnings for every other
// file in the same batch. The count of "[warn]" lines was then read as a pass,
// and PR #166 shipped an unformatted scripts/lib/gate-registry.mjs that only the
// runner caught.
//
// So: the committed tree is checked here, over the runner's file set and the
// runner's bytes, and the helpers that build that view are mutation-proven -
// including the proof that the check is not vacuously green.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRETTIER_SPEC,
  eolOf,
  exportTrackedTree,
  fromGitEol,
  listTrackedFiles,
  parseTrackedPaths,
  runPrettier,
  toGitEol,
  writeBack,
} from "../scripts/check-format.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const NL = "\n";
const CRNL = "\r\n";
const NUL = "\0";

/** `git ls-files --others --exclude-standard`, for the disjointness assertion. */
function listUntrackedFiles() {
  const r = spawnSync(
    "git",
    ["ls-files", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8" },
  );
  return parseTrackedPaths(r.stdout);
}

test("GATE: every tracked file is formatted the way the runner reads it", () => {
  // The whole point of the file. `npm test` must not be able to pass on a tree
  // that CI rejects, so this runs the real thing rather than a proxy for it.
  const files = listTrackedFiles();
  assert.ok(files.length > 100, `expected the tracked tree, got ${files.length}`);
  const dir = mkdtempSync(join(tmpdir(), "beco-format-test-"));
  try {
    const { written } = exportTrackedTree({ files, outDir: dir });
    const status = runPrettier(dir, "--check", {
      spawn: { stdio: "pipe", encoding: "utf8" },
    });
    assert.equal(
      status,
      0,
      `prettier ${PRETTIER_SPEC} rejected the tracked tree as the runner reads it. ` +
        "Run `npm run format`, then re-run `npm run format:check`.",
    );
    assert.ok(written.length > 0, "the export must actually contain the tree");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runPrettier is not vacuously green: a bad file fails and a good one passes", () => {
  // Without this, "the gate passed" could mean "the gate never ran". Both cases
  // are real prettier invocations on tiny trees, which is the only way to know
  // the exit status reflects the files rather than the plumbing.
  const dir = mkdtempSync(join(tmpdir(), "beco-format-probe-"));
  try {
    writeFileSync(join(dir, ".prettierrc"), '{ "endOfLine": "auto" }' + NL);
    writeFileSync(join(dir, "bad.mjs"), "const x   =    1;" + NL + "export default x;" + NL);
    assert.equal(
      runPrettier(dir, "--check", { spawn: { stdio: "pipe" } }),
      1,
      "an unformatted file must make the check fail",
    );
    writeFileSync(join(dir, "bad.mjs"), "const x = 1;" + NL + "export default x;" + NL);
    assert.equal(
      runPrettier(dir, "--check", { spawn: { stdio: "pipe" } }),
      0,
      "a formatted file must make the check pass",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the export reproduces git's line endings, and a binary byte survives", () => {
  // `.gitattributes` says `* text=auto`, so a Windows checkout's CRLF is stored
  // as LF. Checking raw working-tree bytes would make the local verdict depend
  // on core.autocrlf, which is the trap tests/perf-budget.test.mjs already
  // documents for its own byte measurement.
  const out = mkdtempSync(join(tmpdir(), "beco-export-"));
  const source = {
    "a/crlf.mjs": Buffer.from("const a = 1;" + CRNL + "const b = 2;" + CRNL),
    "a/lf.mjs": Buffer.from("const a = 1;" + NL + "const b = 2;" + NL),
    "a/logo.png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d, 0x0a, 0x1a]),
  };
  // The lookup keys on the path suffix, normalised, because the export builds
  // absolute paths with this platform's separator.
  const readSource = (p) => {
    const flat = p.replace(/\\/g, "/");
    const rel = Object.keys(source).find((f) => flat.endsWith(f));
    return source[rel];
  };
  try {
    const { crlf } = exportTrackedTree({
      files: Object.keys(source),
      outDir: out,
      read: readSource,
      exists: () => true,
      mkdir: () => {},
      write: (p, b) => {
        mkdirSync(dirname(p), { recursive: true });
        writeFileSync(p, b);
      },
    });
    const exported = readFileSync(join(out, "a", "crlf.mjs"), "utf8");
    assert.ok(!exported.includes("\r"), "a CRLF working copy must be checked as LF");
    assert.equal(exported, "const a = 1;" + NL + "const b = 2;" + NL);
    assert.deepEqual(
      [...crlf],
      ["a/crlf.mjs"],
      "only the CRLF file is remembered as needing CRLF back",
    );
    // A NUL byte means "no parser", so prettier skips it; decoding one as UTF-8
    // would corrupt the copy for nothing.
    assert.deepEqual(
      [...readFileSync(join(out, "a", "logo.png"))],
      [...source["a/logo.png"]],
    );
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("a tracked path deleted in the working tree is skipped, never fatal", () => {
  // Deleting a tracked file is ordinary work. The runner would not have it once
  // the deletion is committed, so a missing file must not read as a failure -
  // and must not be silently "checked" either.
  const out = mkdtempSync(join(tmpdir(), "beco-export-missing-"));
  try {
    const { written, skipped } = exportTrackedTree({
      files: ["gone.mjs", "here.mjs"],
      outDir: out,
      exists: (p) => p.endsWith("here.mjs"),
      read: () => Buffer.from("const a = 1;" + NL),
      mkdir: () => {},
      write: () => {},
    });
    assert.deepEqual(skipped, ["gone.mjs"]);
    assert.deepEqual(written, ["here.mjs"]);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("tracked paths survive spaces, quotes and non-ASCII (git -z, not whitespace)", () => {
  // The reason for `-z`: `git ls-files` quotes and escapes unusual names unless
  // it is told not to, and a whitespace split would mangle them and merge two
  // paths into one filename that does not exist.
  const paths = parseTrackedPaths(
    'a b/c.mjs' + NUL + '"quo\\"te".md' + NUL + "docs/café.md" + NUL +
      "weird\ttab.js" + NUL + NUL,
  );
  assert.deepEqual(paths, [
    "a b/c.mjs",
    '"quo\\"te".md',
    "docs/café.md",
    "weird\ttab.js",
  ]);
  assert.equal(paths.length, 4, "a whitespace split would have produced other names");
});

test("writeBack restores line endings and writes back only what prettier fixed", () => {
  // Two properties, and the second one is the defect this script actually had.
  //
  // 1. A fix must not flip a CRLF checkout's whole file to LF: that is a 40 KB
  //    diff to fix a two-space indent, and it hides the real change in review.
  // 2. A file prettier has NO PARSER for must not be written at all. The first
  //    version of this rewrote docs/plan/LEDGER.jsonl - a .jsonl prettier
  //    never formats - because it had mixed endings (36 CRLF, one LF), eolOf()
  //    called that "crlf", and the restore normalised all 38 lines. A pure-CRLF
  //    file cannot show that bug, which is why the fixture here is mixed.
  const fixed = mkdtempSync(join(tmpdir(), "beco-fixed-"));
  const work = mkdtempSync(join(tmpdir(), "beco-work-"));
  mkdirSync(join(fixed, "sub"));
  mkdirSync(join(work, "sub"));
  const CRLF_FIXED = "const a = 1;" + NL;
  // What prettier would have written: always LF, because that is what it read.
  writeFileSync(join(fixed, "sub", "crlf.mjs"), CRLF_FIXED);
  writeFileSync(join(fixed, "sub", "lf.mjs"), CRLF_FIXED);
  writeFileSync(join(fixed, "sub", "same.mjs"), CRLF_FIXED);
  const DATA_LF = '{"a":1}' + NL + '{"b":2}' + NL;
  writeFileSync(join(fixed, "sub", "data.jsonl"), DATA_LF);
  // The working tree as git handed it over.
  writeFileSync(join(work, "sub", "crlf.mjs"), "const a   = 1;" + CRNL);
  writeFileSync(join(work, "sub", "lf.mjs"), "const a   = 1;" + NL);
  writeFileSync(join(work, "sub", "same.mjs"), CRLF_FIXED);
  const DATA_MIXED = '{"a":1}' + CRNL + '{"b":2}' + NL;
  writeFileSync(join(work, "sub", "data.jsonl"), DATA_MIXED);
  try {
    const rels = ["sub/crlf.mjs", "sub/lf.mjs", "sub/same.mjs", "sub/data.jsonl"];
    // What the export held BEFORE prettier ran: only the two misformatted .mjs
    // files differ afterwards. The .jsonl comes back byte-identical.
    const before = new Map([
      ["sub/crlf.mjs", Buffer.from("const a   = 1;" + NL)],
      ["sub/lf.mjs", Buffer.from("const a   = 1;" + NL)],
      ["sub/same.mjs", Buffer.from(CRLF_FIXED)],
      ["sub/data.jsonl", Buffer.from(DATA_LF)],
    ]);
    const changed = writeBack(fixed, rels, new Set(["sub/crlf.mjs", "sub/data.jsonl"]), {
      dest: work,
      before,
    });
    assert.deepEqual(
      changed,
      ["sub/crlf.mjs", "sub/lf.mjs"],
      "only files prettier actually fixed may be written back",
    );
    assert.equal(
      readFileSync(join(work, "sub", "crlf.mjs"), "utf8"),
      "const a = 1;" + CRNL,
      "a CRLF checkout must not have its whole file flipped to LF",
    );
    assert.equal(
      readFileSync(join(work, "sub", "lf.mjs"), "utf8"),
      CRLF_FIXED,
      "an LF file is fixed in place",
    );
    assert.equal(
      readFileSync(join(work, "sub", "data.jsonl"), "utf8"),
      DATA_MIXED,
      "a file prettier never formats must be left exactly as git handed it " +
        "over, mixed line endings included",
    );
  } finally {
    rmSync(fixed, { recursive: true, force: true });
    rmSync(work, { recursive: true, force: true });
  }
});

test("the line-ending helpers are inverse and total", () => {
  assert.equal(toGitEol("a" + CRNL + "b" + CRNL), "a" + NL + "b" + NL);
  assert.equal(toGitEol("a" + NL + "b" + NL), "a" + NL + "b" + NL, "an LF file is unchanged");
  assert.equal(toGitEol("a\rb"), "a\rb", "a lone CR is not a line ending git rewrites");
  assert.equal(fromGitEol("a" + NL + "b" + NL, true), "a" + CRNL + "b" + CRNL);
  assert.equal(fromGitEol("a" + NL + "b" + NL, false), "a" + NL + "b" + NL);
  assert.equal(
    fromGitEol(toGitEol("x" + CRNL + "y" + CRNL), true),
    "x" + CRNL + "y" + CRNL,
    "round trip",
  );
  assert.equal(eolOf("a" + CRNL + "b"), "crlf");
  assert.equal(eolOf("a" + NL + "b"), "lf");
});

test("the checked file set is git's, so untracked files can never be in it", () => {
  // A false green also comes from checking the wrong files. The runner sees a
  // checkout, so this must be `git ls-files` and nothing else - in particular
  // not whatever happens to be lying around in the working directory.
  const files = listTrackedFiles();
  assert.ok(files.includes("package.json"), "the manifest is tracked");
  assert.ok(files.includes("assets/js/sizing/engine.js"), "a shipped module is tracked");
  const untracked = listUntrackedFiles();
  assert.deepEqual(
    files.filter((f) => untracked.includes(f)),
    [],
    "a tracked list and an untracked list sharing an entry means the set is not git's",
  );
  assert.ok(root.length > 0);
});
