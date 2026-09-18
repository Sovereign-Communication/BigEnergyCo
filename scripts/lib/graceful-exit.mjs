// Shared exit plumbing for the release tools.
//
// `process.exit()` tears the loop down immediately. If an undici keep-alive
// socket is still closing (any script that has just fetched), libuv can abort
// the process on Windows with
//   "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94"
// which loses the exit code entirely — a human running `npm run promote` on
// their own machine sees a crash instead of a verdict, and CI would see a
// non-zero code that means nothing.
//
// Setting `process.exitCode` and letting the loop drain avoids the race
// completely. The unref'd backstop timer guarantees we still exit if some
// handle refuses to close (it cannot hold the loop open itself).

/**
 * Exit with `code`, draining pending sockets first instead of ripping the loop
 * down mid-close.
 * @param {number} code process exit status
 * @param {number} [graceMs] how long to wait for the loop to drain naturally
 */
export function exitWhenDrained(code, graceMs = 1000) {
  process.exitCode = code;
  const backstop = setTimeout(() => process.exit(code), graceMs);
  backstop.unref();
}
