// Run a child process and resolve its exit code — including when the child
// never starts at all.
//
// Both gates that stage the site before a browser run used to listen only for
// "exit". `spawn` does not emit "exit" when the executable is missing or the
// working directory does not exist: it emits "error", and an EventEmitter
// "error" with no listener is a thrown exception. So a gate that could not
// start its own child crashed with a raw spawn trace BEFORE its `finally` closed
// the static server and removed the staging directory, and the operator got a
// Node stack instead of "SMOKE FAIL ...".
//
// Resolving a non-zero code keeps the caller's own message and its cleanup in
// play: a gate must report, not explode.
import { spawn } from "node:child_process";

export function runChild(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (code) => {
      if (settled) return;
      settled = true;
      resolve(code);
    };
    let child;
    try {
      child = spawn(cmd, args, opts);
    } catch (err) {
      // A synchronous spawn throw (invalid options) is the same failure class.
      console.error(`CHILD FAIL  ${cmd}: ${err && err.message}`);
      done(1);
      return;
    }
    child.on("error", (err) => {
      console.error(
        `CHILD FAIL  ${cmd}: ${err && err.message ? err.message : err}`,
      );
      done(1);
    });
    child.on("exit", (code) => done(code ?? 1));
  });
}
