// Sizing web worker: thin shell around runSizing() so the multi-second
// searches never block the page. All logic lives in run.js (and is tested
// directly under Node - this file must stay trivial).
//
// Message in:
//   { type: "run",     ...runSizing msg }                     -> full payload
//   { type: "reSlice", ...runSizing msg }                     -> cut-only patch
// Message out:
//   { type: "ok", seq, payload } | { type: "reSlice", seq, result } | error
//
import { runSizing } from "./run.js?v=20260902a";

self.onmessage = async (ev) => {
  const msg = ev.data;

  if (msg?.type === "reSlice") {
    try {
      const result = await runSizing(msg);
      self.postMessage({ type: "reSlice", seq: msg.seq, result });
    } catch (e) {
      self.postMessage({ type: "error", seq: msg.seq, message: String(e && e.message || e) });
    }
    return;
  }

  if (msg?.type !== "run") return;

  try {
    const payload = await runSizing(msg);
    self.postMessage({ type: "ok", seq: msg.seq, payload });
  } catch (e) {
    self.postMessage({ type: "error", seq: msg.seq, message: String(e && e.message || e) });
  }
};