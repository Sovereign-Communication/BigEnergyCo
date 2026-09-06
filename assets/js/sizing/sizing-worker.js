// Sizing web worker: thin shell around runSizing() so the multi-second
// searches never block the page. All logic lives in run.js (and is tested
// directly under Node - this file must stay trivial).
//
// Message in:
//   { type: "run",     ...runSizing msg }                     -> full payload
//   { type: "reSlice", ...runSizing msg }                     -> cut-only patch
// Message out:
//   { type: "ok", seq, epoch, payload } | { type: "reSlice", seq, epoch, result } | error
//
// Dispatch is on msg.type (never on payload flags): a "run" that accidentally
// carried incrementalCut must still return a full payload, and vice versa.
// Every reply echoes seq AND epoch so the UI can drop stale responses; errors
// carry a stream tag ("run"/"slice"/"unknown") for the same stale check.
// Unknown types answer with an error instead of hanging the spinner.
//
import { runSizing } from "./run.js?v=20260906e";

self.onmessage = async (ev) => {
  const msg = ev.data;

  if (msg?.type === "reSlice") {
    try {
      const result = await runSizing({ ...msg, incrementalCut: true });
      self.postMessage({
        type: "reSlice",
        seq: msg.seq,
        epoch: msg.epoch,
        result,
      });
    } catch (e) {
      self.postMessage({
        type: "error",
        seq: msg.seq,
        epoch: msg.epoch,
        stream: "slice",
        message: String((e && e.message) || e),
      });
    }
    return;
  }

  if (msg?.type === "run") {
    try {
      const { type: _t, ...rest } = msg;
      const payload = await runSizing({ ...rest, incrementalCut: false });
      self.postMessage({ type: "ok", seq: msg.seq, epoch: msg.epoch, payload });
    } catch (e) {
      self.postMessage({
        type: "error",
        seq: msg.seq,
        epoch: msg.epoch,
        stream: "run",
        message: String((e && e.message) || e),
      });
    }
    return;
  }

  self.postMessage({
    type: "error",
    seq: msg?.seq,
    stream: "unknown",
    message: `unknown worker message type: ${msg?.type}`,
  });
};
