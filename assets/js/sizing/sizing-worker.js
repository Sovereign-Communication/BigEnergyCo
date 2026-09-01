// Sizing web worker: thin shell around runSizing() so the multi-second

// searches never block the page. All logic lives in run.js (and is tested

// directly under Node — this file must stay trivial).

// Message in:  { type: "run", ...runSizing msg }

// Message out: { type: "ok", payload } | { type: "error", message }

import { runSizing } from "./run.js?v=20260831a";



self.onmessage = async (ev) => {

  const msg = ev.data;

  if (msg?.type !== "run") return;

  try {

    const payload = await runSizing(msg);

    self.postMessage({ type: "ok", seq: msg.seq, payload });

  } catch (e) {

    self.postMessage({ type: "error", seq: msg.seq, message: String(e && e.message || e) });

  }

};



