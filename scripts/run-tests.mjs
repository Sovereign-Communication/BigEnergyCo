#!/usr/bin/env node
// The test suite, run so that WHAT IT MEASURED is written down.
//
//   node scripts/run-tests.mjs            (this is what `npm test` runs)
//
// WHY THIS EXISTS. `npm test` used to be `node --test "tests/*.test.mjs"` and
// nothing more, so the number of tests existed only in the terminal scrollback
// of whoever ran it. The evidence record therefore carried a hand-typed
// "835/835 npm test green ... measured on this tree" that stayed true for
// exactly as long as nobody added a test — and it read 835 on a tree carrying
// 1397. That sentence is not decoration: it is the substrate the judge reads
// before it reads any facet, so a false one costs every facet at once.
//
// It cannot be fixed by being careful. It is fixed by the runner that already
// knows the number writing it, which is the same move the Lighthouse proof line
// makes (composed from the run, never typed) applied to the run record itself.
//
// TWO THINGS THIS HAD TO LEARN THE HARD WAY, both from CI runs where it
// silently recorded nothing:
//
//   1. Node's test runner writes its summary to STDERR, and whether the same
//      block also lands on stdout varies by environment. Locally it did; on the
//      runner it did not. Both streams are captured.
//   2. The DEFAULT REPORTER IS VERSION-DEPENDENT. Node 22 defaults to TAP
//      ("# tests 1397"); Node 24 defaults to spec ("ℹ tests 1397"). This repo's
//      CI pins Node 22 and a developer machine runs Node 24, so the same command
//      printed two different summaries and the parser read zero on one of them.
//      The reporter is now pinned, so the format cannot drift with the runtime,
//      and BOTH forms are parsed anyway — because the next version bump should
//      cost a line of parser, not a silently empty measurement.
//
// WHAT IT DOES NOT DO. It does not change which tests run, how they are
// selected, or what they assert: the same `node --test` invocation with the same
// glob, and the child's exit code is this process's exit code, so a red suite is
// still a red `npm test`. The only additions are the pinned reporter, the
// measurement file, and one summary line.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACT = join(ROOT, "jev-artifacts", "test-measurement.json");

/**
 * The summary line for each count, per reporter.
 *
 * `spec` prints the ℹ-prefixed block; `tap` prints the #-prefixed one. The
 * reporter is pinned below so the first is what actually appears, but a parser
 * that only knows one of them is a parser that reads zero the moment somebody
 * runs this on a Node whose default differs.
 */
const FIELD = {
  tests: [/^ℹ tests (\d+)/m, /^# tests (\d+)/m],
  pass: [/^ℹ pass (\d+)/m, /^# pass (\d+)/m],
  fail: [/^ℹ fail (\d+)/m, /^# fail (\d+)/m],
  skipped: [/^ℹ skipped (\d+)/m, /^# skipped (\d+)/m],
  cancelled: [/^ℹ cancelled (\d+)/m, /^# cancelled (\d+)/m],
};

export function parseCounts(output) {
  const counts = {};
  for (const [key, patterns] of Object.entries(FIELD)) {
    let value = null;
    for (const re of patterns) {
      const m = output.match(re);
      if (m) {
        value = Number(m[1]);
        break;
      }
    }
    counts[key] = value;
  }
  return counts;
}

export function measurementFrom(counts) {
  return {
    measured_by: "scripts/run-tests.mjs (node --test summary block)",
    ...counts,
    // What `npm test` runs, so a reader can see the measurement and the thing
    // measured are the same command rather than two that look alike.
    command: 'node --test --test-reporter=spec "tests/*.test.mjs"',
    node: process.version,
  };
}

function write(counts) {
  try {
    mkdirSync(dirname(ARTIFACT), { recursive: true });
    writeFileSync(
      ARTIFACT,
      JSON.stringify(measurementFrom(counts), null, 2) + "\n",
      "utf8",
    );
  } catch {
    // Same reasoning as the smoke runner: a run that already reported its
    // verdict must not be turned red by an unwritable scratch file.
  }
}

function main() {
  const child = spawn(
    process.execPath,
    ["--test", "--test-reporter=spec", "tests/*.test.mjs"],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
  );
  // Streamed rather than buffered, so a long suite does not hold its output
  // hostage until the end. Every byte reaches the terminal on its own stream.
  let captured = "";
  const tee = (stream, sink) => {
    stream.on("data", (d) => {
      captured += d.toString();
      sink.write(d);
    });
  };
  tee(child.stdout, process.stdout);
  tee(child.stderr, process.stderr);

  child.on("close", (code) => {
    const counts = parseCounts(captured);
    write(counts);
    const measured =
      counts.tests === null
        ? "no summary block seen on either stream, so no count was recorded"
        : `${counts.pass}/${counts.tests} recorded in jev-artifacts/test-measurement.json`;
    console.error(`run-tests: ${measured}`);
    // The child's verdict is the verdict. A missing summary block is reported
    // above rather than invented into a zero.
    process.exit(code ?? 1);
  });
}

// Resolved through pathToFileURL rather than by hand: process.argv[1] is
// whatever the caller typed (npm passes a relative path), so comparing it to
// import.meta.url as a string is a comparison that silently fails — and a
// runner that exits 0 having run nothing is the worst possible way for that to
// happen, which is why the tests assert this guard fires.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
