#!/usr/bin/env node
// The formatting gate, as the RUNNER sees it.
//
// Why this file exists. The CI step is `npx --yes prettier@3.9.6 --check .`.
// Running that locally over a batch of tracked files reported ZERO warnings on a
// tree that CI rejected: prettier ERRORS on the tracked files it has no parser
// for (.gitattributes, LICENSE, _headers, _redirects), and that error
// suppressed the warnings for every other file in the same batch. The count of
// "[warn]" lines was then read as a pass. That is a false green in the tool we
// use to decide whether work is verified, and it shipped an unformatted file to
// CI on PR #166.
//
// So the check is run the way the runner runs it, over the file set the runner
// has, with the bytes the runner gets:
//
//   1. The FILE SET is `git ls-files` - tracked files only. The runner sees a
//      checkout, never a developer's scratch directories, so neither do we.
//   2. The BYTES are LF-normalised. `.gitattributes` says `* text=auto`, and
//      the committed tree is 0 CRLF / 573 LF, so a Windows checkout hands us
//      CRLF that git will store as LF. Normalising reproduces what gets
//      committed without depending on this machine's core.autocrlf. This is the
//      same reasoning tests/perf-budget.test.mjs already records for its own
//      byte measurement.
//   3. The RUN is prettier, from the repo's pinned version, with a non-zero exit
//      treated as failure WHATEVER it says. No parsing of prettier's output, so
//      no error can be mistaken for a pass.
//
// Usage:
//   node scripts/check-format.mjs            check; exit 1 if anything is unformatted
//   node scripts/check-format.mjs --write    fix, writing back in the working tree's
//                                            own line endings so a CRLF checkout
//                                            does not get its whole file flipped
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { npxPlan } from "./lib/npx.mjs";
import { exitWhenDrained } from "./lib/graceful-exit.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

/** The version the workflow pins. Changing it here and in test.yml together is the only way to move it. */
export const PRETTIER_SPEC = "prettier@3.9.6";

/** What git stores: `* text=auto` in .gitattributes means CRLF in, LF out. */
export function toGitEol(text) {
  return String(text).replace(/\r\n/g, "\n");
}

/** The inverse, for writing a formatted file back into a CRLF checkout. */
export function fromGitEol(text, wasCrlf) {
  return wasCrlf ? String(text).replace(/\n/g, "\r\n") : String(text);
}

/** Which line ending a working-tree file uses, so a fix does not churn the whole file. */
export function eolOf(text) {
  return /\r\n/.test(String(text)) ? "crlf" : "lf";
}

/**
 * Tracked paths, NUL-separated so a name with a space, a quote or non-ASCII
 * survives intact. `-z` is the only form git quotes correctly.
 */
export function parseTrackedPaths(stdout) {
  return String(stdout)
    .split("\0")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function listTrackedFiles(run = git) {
  return parseTrackedPaths(run("ls-files", "-z"));
}

function git(...args) {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${r.stderr || r.stdout}`);
  }
  return r.stdout;
}

/**
 * Write the tracked working tree into `outDir` with git's line endings, so the
 * directory a check runs in is byte-identical to a fresh checkout on CI.
 *
 * Binary files are copied verbatim: a NUL byte means prettier has no parser for
 * it anyway, and decoding one as UTF-8 would corrupt the copy for nothing.
 *
 * @returns {{written: string[], skipped: string[], crlf: Set<string>}}
 */
export function exportTrackedTree({
  files,
  outDir,
  read = (p) => readFileSync(p),
  write = (p, b) => writeFileSync(p, b),
  mkdir = (p) => mkdirSync(p, { recursive: true }),
  exists = (p) => existsSync(p),
} = {}) {
  const written = [];
  const skipped = [];
  const crlf = new Set();
  for (const rel of files) {
    const src = join(root, rel);
    if (!exists(src)) {
      // Tracked but deleted in the working tree: there is nothing to format, and
      // the runner would not have it either once the deletion is committed.
      skipped.push(rel);
      continue;
    }
    const buf = read(src);
    if (buf.includes(0)) {
      mkdir(dirname(join(outDir, rel)));
      write(join(outDir, rel), buf);
    } else {
      const text = buf.toString("utf8");
      if (eolOf(text) === "crlf") crlf.add(rel);
      mkdir(dirname(join(outDir, rel)));
      write(join(outDir, rel), Buffer.from(toGitEol(text), "utf8"));
    }
    written.push(rel);
  }
  return { written, skipped, crlf };
}

/**
 * Run prettier over `dir`. Returns the exit status and never throws on a
 * non-zero one: the caller decides, and a non-zero is a failure whatever the
 * reason for it is.
 */
export function runPrettier(dir, mode = "--check", { run = null } = {}) {
  const plan = npxPlan(["--yes", PRETTIER_SPEC, mode, "."]);
  const r = run
    ? run(plan, dir)
    : spawnSync(plan.command, plan.args, {
        cwd: dir,
        stdio: "inherit",
        shell: plan.options.shell,
      });
  return r.status === null ? 1 : r.status;
}

/**
 * Copy prettier's fixed output back, restoring each file's own line endings.
 *
 * ONLY files prettier actually rewrote. A file it has no parser for comes back
 * byte-identical, and a file it left alone comes back identical to the export -
 * so comparing against the PRE-write export is what separates "prettier fixed
 * this" from "this file merely happened to be in the tree". Without that
 * distinction a --write run normalises the line endings of every CRLF working
 * copy it walks, including data files it never formats (.jsonl), which is a
 * large invisible diff and not a fix.
 */
export function writeBack(
  dir,
  files,
  crlf,
  {
    dest = root,
    before = new Map(),
    read = (p) => readFileSync(p),
    write = (p, b) => writeFileSync(p, b),
  } = {},
) {
  const changed = [];
  for (const rel of files) {
    const fixed = read(join(dir, rel));
    const prior = before.get(rel);
    if (prior && prior.equals(fixed)) continue; // prettier did not touch it
    const target = join(dest, rel);
    const current = read(target);
    const out = fromGitEol(fixed.toString("utf8"), crlf.has(rel));
    if (out === current.toString("utf8")) continue;
    mkdirSync(dirname(target), { recursive: true });
    write(target, Buffer.from(out, "utf8"));
    changed.push(rel);
  }
  return changed;
}

async function main(argv) {
  const write = argv.includes("--write");
  const files = listTrackedFiles();
  const dir = mkdtempSync(join(tmpdir(), "beco-format-"));
  let code = 0;
  try {
    const { written, skipped, crlf } = exportTrackedTree({
      files,
      outDir: dir,
    });
    if (skipped.length) {
      console.log(
        `format: ${skipped.length} tracked path(s) are deleted in this working tree and were not checked`,
      );
    }
    // Snapshot the exported bytes BEFORE prettier runs, so write-back can tell
    // a file it fixed from a file it merely passed over.
    const before = new Map(
      written.map((rel) => [rel, readFileSync(join(dir, rel))]),
    );
    code = runPrettier(dir, write ? "--write" : "--check");
    if (write) {
      const changed = writeBack(dir, written, crlf, { dest: root, before });
      console.log(
        changed.length
          ? `format: rewrote ${changed.length} file(s) in the working tree`
          : "format: nothing to rewrite",
      );
      // A --write pass is a fix, not a verification: say so, and say what to run.
      console.log("format: re-run `npm run format:check` to verify");
      return 0;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  if (code !== 0) {
    console.error(
      `format: FAILED (prettier exited ${code}) on the tracked tree as the runner sees it.\n` +
        `        Fix with \`npm run format\`, then re-run \`npm run format:check\`.`,
    );
  } else {
    console.log(
      `format: OK - ${files.length} tracked file(s) formatted as the runner will read them`,
    );
  }
  return code;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv.slice(2)).then(
    (code) => exitWhenDrained(code),
    (err) => {
      console.error("format:", err && err.message ? err.message : err);
      exitWhenDrained(2);
    },
  );
}
