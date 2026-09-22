// Browser + CDP runtime for the smoke suite. Owns process launch, the CDP
// wire (send/evaluate), the error collectors the gates assert on, and the
// gate reporter. Flows import { start, gate, gateSummary } — nothing here
// knows what a "gate" means for the product.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];
const EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/microsoft-edge",
];

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const isCsp = (e) =>
  /Content Security Policy|Refused to (connect|load)|violates .* directive/i.test(
    e,
  );

let failures = 0;

export function gate(name, ok, extra = "") {
  console.log(
    `${ok ? "SMOKE OK    " : "SMOKE FAIL  "}${name}${extra ? " — " + extra : ""}`,
  );
  if (!ok) failures++;
}

export function gateSummary() {
  console.log(
    failures
      ? `\n${failures} SMOKE GATE(S) FAILED`
      : "\nALL SMOKE GATES PASSED",
  );
  return failures ? 1 : 0;
}

export async function start() {
  const exe = [...CHROME_PATHS, ...EDGE_PATHS].find((p) => existsSync(p));
  if (!exe) throw new Error("no Chrome/Edge binary found");
  console.log(`SMOKE      browser: ${exe}`);
  const profile = mkdtempSync(join(tmpdir(), "beco-smoke-"));
  const DEBUG_PORT = 19222;
  const browser = spawn(
    exe,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--no-first-run",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  const errors = [];
  let ws = null;
  let send, evaluate;
  const poll = async (fn, timeoutMs, stepMs = 2000) => {
    const start = Date.now();
    for (;;) {
      if (await fn()) return true;
      if (Date.now() - start > timeoutMs) return false;
      await sleep(stepMs);
    }
  };

  try {
    let targets = null;
    for (let i = 0; i < 100; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
        if (r.ok) {
          targets = await r.json();
          break;
        }
      } catch {
        /* not up yet */
      }
      await sleep(300);
    }
    if (!targets) throw new Error("DevTools endpoint never came up");
    const page = targets.find((t) => t.type === "page");
    if (!page?.webSocketDebuggerUrl) throw new Error("no page target");

    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });
    let nextId = 1;
    const pending = new Map();
    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error)));
        else res(msg.result);
      } else if (msg.method === "Runtime.exceptionThrown") {
        errors.push(
          `page exception: ${msg.params?.exceptionDetails?.text || JSON.stringify(msg.params).slice(0, 300)}`,
        );
      } else if (
        msg.method === "Runtime.consoleAPICalled" &&
        msg.params?.type === "error"
      ) {
        errors.push(
          `console.error: ${(msg.params.args || [])
            .map((a) => a.value ?? a.description ?? "")
            .join(" ")
            .slice(0, 300)}`,
        );
      } else if (
        msg.method === "Log.entryAdded" &&
        msg.params?.entry?.level === "error"
      ) {
        const url = msg.params.entry.url
          ? ` [${msg.params.entry.url.slice(0, 120)}]`
          : "";
        errors.push(
          `log.error: ${(msg.params.entry.text || "").slice(0, 300)}${url}`,
        );
      }
    };
    send = (method, params = {}, sessionId = null) =>
      new Promise((res, rej) => {
        const id = nextId++;
        pending.set(id, { res, rej });
        // flatten-mode sessions (worker targets) carry a sessionId on every
        // frame; null keeps plain page-session behavior.
        const frame = { id, method, params };
        if (sessionId) frame.sessionId = sessionId;
        ws.send(JSON.stringify(frame));
        setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id);
            rej(new Error(`CDP timeout: ${method}`));
          }
        }, 30000);
      });
    evaluate = async (expression) => {
      const r = await send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (r?.exceptionDetails)
        throw new Error(
          `page eval threw: ${JSON.stringify(r.exceptionDetails).slice(0, 300)}`,
        );
      return r?.result?.value;
    };
  } catch (e) {
    try {
      ws?.close();
    } catch {
      /* noop */
    }
    try {
      browser.kill();
    } catch {
      /* noop */
    }
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      /* noop */
    }
    throw e;
  }

  const close = async () => {
    try {
      ws?.close();
    } catch {
      /* noop */
    }
    try {
      browser.kill();
    } catch {
      /* noop */
    }
    await sleep(1000);
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      /* noop */
    }
  };

  return { ws, send, evaluate, errors, poll, close };
}
