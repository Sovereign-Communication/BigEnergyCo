// The wire: where the Jev key comes from, and the one request that spends it.
//
// This is the only impure part of the gate's live path. It knows the
// transport and nothing about the report — what came back is handed to
// lib/jev-run.mjs, which decides what it means, and to lib/jev-complete.mjs,
// which reads the answers. Nothing here knows the report has a field called
// `provider`, which is why a change to the transport cannot silently change
// what the report says about the run.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { JEV_MODEL_ALIAS } from "./jev-run.mjs";

const JEV_TIMEOUT_MS = 15000;
const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";

// Key resolution mirrors the harness config chain for the LOCAL copy's needs:
// env first, then this repo's .env, then the harness jev.env (read-only —
// config is the one sanctioned way to reuse the local harness setup).
export function resolveKeys(repoRoot) {
  const fromEnv = (names) => {
    for (const n of names) {
      const v = process.env[n];
      if (v && v.trim()) return v.trim();
    }
    return null;
  };
  const fromFile = (path, names) => {
    if (!path || !existsSync(path)) return null;
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
      if (m && names.includes(m[1]) && m[2].trim()) return m[2].trim();
    }
    return null;
  };

  const typesafeKey =
    fromEnv(["TYPESAFE_API_KEY", "HARNESS_JEV_KEY", "JEV_API_KEY"]) ||
    fromFile(join(repoRoot, ".env"), ["TYPESAFE_API_KEY", "HARNESS_JEV_KEY"]) ||
    fromFile(join(homedir(), ".config", "harness", "jev.env"), [
      "HARNESS_JEV_KEY",
      "JEV_API_KEY",
      "TYPESAFE_API_KEY",
    ]);
  // P0.3(b) / D-13: OpenRouter is no longer a Jev path, so it is no longer
  // read from the environment or from .env. Nothing resolves an OpenRouter
  // key here, and nothing downstream can ask for one.
  return { typesafeKey };
}

async function attemptFetch(url, options) {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  }
}

// ONE direct attempt — a single request with a hard timeout, never a retry
// loop. P0.3(b) / D-13: TypeSafe direct is the only path, and the request asks
// for the loose alias; what the gate will ACCEPT is a response naming a
// concrete version (acceptLiveJudgment), so every score is attributable.
export async function liveJevCall(stateText, questions, keys) {
  const notes = [];
  // The official request shape is {model, state, questions} — the same
  // envelope worker/index.js and the harness evaluator send; `state` carries
  // the evidence text the facets are judged against.
  const payload = {
    state: { gate: "jev-complete", evidence: stateText },
    questions,
  };

  if (keys.typesafeKey) {
    const r = await attemptFetch(TYPESAFE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${keys.typesafeKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(JEV_TIMEOUT_MS),
      body: JSON.stringify({ model: JEV_MODEL_ALIAS, ...payload }),
    });
    if (r.ok && r.body) {
      return {
        answers: r.body.answers || r.body,
        usage: r.body.usage || null,
        provider: "typesafe",
        model: r.body.model,
        notes,
      };
    }
    notes.push(
      `direct: ${r.error ? `network error: ${r.error}` : `HTTP ${r.status}`}`,
    );
  } else {
    notes.push("direct: no key (TYPESAFE_API_KEY / HARNESS_JEV_KEY)");
  }

  // P0.3(b) / D-13: TypeSafe direct is the ONLY Jev path. The bounded
  // OpenRouter backup that used to follow it is removed, so a provider outage
  // is now an honest "no answers" in the report rather than a silent reroute to
  // a second provider. Do not reintroduce a fallback here without an amendment.

  return { answers: null, usage: null, provider: null, model: null, notes };
}
