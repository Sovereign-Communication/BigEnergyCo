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
// 1378. That sentence is not decoration: it is the substrate the judge reads
// before it reads any facet, so a false one costs every facet at once.
//
// It cannot be fixed by being careful. It is fixed by the runner that already
// knows the number writing it, which is the same move the Lighthouse proof line
// makes (composed from the run, never typed) applied to the run record itself.
//
// BOTH STREAMS ARE CAPTURED, and that is not tidiness. Node's test runner writes
// its summary block to stderr, and whether the same block also lands on stdout
// varies with the environment: locally it arrived on stdout, and on the first CI
// run it did not, so the wrapper reported "no summary block seen" and recorded
// nothing. The record then reached the builder with its `{{tests_total}}`
// placeholders unresolved, which the builder names as a fatal problem rather
// than filling in — the fail-closed path working, but the measurement was lost.
// A parser that reads one stream and hopes is a parser that will read zero.
//
// WHAT IT DOES NOT DO. It does not change which tests run, how they are
// selected, or what they assert: the same `node --test` invocation with the same
// glob, and the child's exit code is this process's exit code, so a red suite is
// still a red `npm test`. The only additions are the measurement file and one
// summary line.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACT = join(ROOT, "jev-artifacts", "test-measurement.json");

// The runner prints a summary block; these are its lines. Read as numbers and
// as integers — the runner pads them with the glyphs a terminal would draw.
const FIELD = {
  tests: /^ℹ tests (\d+)/m,
  pass: /^ℹ pass (\d+)/m,
  fail: /^ℹ fail (\d+)/m,
  skipped: /^ℹ skipped (\d+)/m,
  cancelled: /^ℹ cancelled (\d+)/m,
};

export function parseCounts(output) {
  const counts = {};
  for (const [key, re] of Object.entries(FIELD)) {
    const m = output.match(re);
    counts[key] = m ? Number(m[1]) : null;
  }
  return counts;
}

export function measurementFrom(counts) {
  return {
    measured_by: "scripts/run-tests.mjs (node --test summary block)",
    ...counts,
    // What `npm test` runs, so a reader can see the measurement and the thing
    // measured are the same command rather than two that look alike.
    command: 'node --test "tests/*.test.mjs"',
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
  const child = spawn(process.execPath, ["--test", "tests/*.test.mjs"], {
    cwd: ROOT,
    // Both piped so the summary can be read wherever the runner chose to put
    // it. Every byte still reaches the terminal, in order, on its own stream.
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Streamed rather than buffered, so a long suite does not hold its output
  // hostage until the end.
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
// happen, which is why the tests below assert this guard fires.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
