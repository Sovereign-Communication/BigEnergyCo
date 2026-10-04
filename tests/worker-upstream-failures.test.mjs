// Upstream-transport failures in the Worker, and the evidence write path.
//
// Every test here fails against the code as it stood when an external review
// read it. The common shape of the defects: a gate or a guard that LOOKED
// present and did not cover the case that actually occurs. The first call to
// Groq was wrapped in `.catch(() => null)`; the two calls that run during an
// upstream incident were not, so the moment the network was the broken thing
// was the moment the endpoint returned an exception instead of the labelled
// deterministic reply it promises.
import { test, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import worker, {
  resetRateLimitsForTest,
  buildDegradedReply,
  DEGRADED_LABEL,
} from "../worker/index.js";
import { putEvidence } from "../worker/evidence.mjs";

const ORIGIN = "https://freeoffgridcalculator.com";
const chatReq = (body) =>
  new Request("https://api.test/api/chat", {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => resetRateLimitsForTest());

// ── Groq: a throw is not a status ─────────────────────────────────────────

test("a throw on the 429 retry degrades instead of escaping the handler", async () => {
  // First call 429s (so the backoff branch is taken), then the retry THROWS —
  // a DNS failure or a reset, which is what an upstream incident actually
  // looks like from here. Before the fix this escaped `handleChat` as a Worker
  // exception: a 500 with no CORS headers, which the browser reports as an
  // opaque network failure with the chat box stuck on "Thinking…".
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    if (++calls === 1)
      return {
        ok: false,
        status: 429,
        json: async () => ({ error: { message: "try again in 0.2s" } }),
      };
    throw new TypeError("fetch failed");
  };
  try {
    const res = await worker.fetch(chatReq({ message: "size me" }), {
      GROQ_API_KEY: "test-key",
    });
    assert.equal(res.status, 200, "an upstream throw must not become a 500");
    assert.ok(
      res.headers.get("Access-Control-Allow-Origin"),
      "a degraded reply still has to reach the browser",
    );
    const body = await res.json();
    assert.equal(body.degraded, true);
    assert.match(body.reply, new RegExp(DEGRADED_LABEL));
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("a throw on the fallback-model call degrades instead of escaping", async () => {
  // The other unguarded call. It runs precisely when the primary model is
  // failing, which is the moment the network is least likely to be healthy.
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    if (++calls === 1)
      return { ok: false, status: 500, json: async () => ({}) };
    throw new TypeError("fetch failed");
  };
  try {
    const res = await worker.fetch(chatReq({ message: "size me" }), {
      GROQ_API_KEY: "test-key",
    });
    assert.equal(res.status, 200);
    assert.ok(res.headers.get("Access-Control-Allow-Origin"));
    assert.equal((await res.json()).degraded, true);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("every Groq call in the handler is guarded, not just the first", () => {
  // Structural, so the fourth call cannot quietly become unguarded later.
  const src = readFileSync(
    new URL("../worker/index.js", import.meta.url),
    "utf8",
  );
  const unguarded = [...src.matchAll(/await callGroq\(/g)]
    .map((m) => src.slice(m.index, m.index + 240))
    .filter((s) => !/\.catch\(/s.test(s));
  assert.deepEqual(
    unguarded,
    [],
    `these callGroq calls have no .catch and would escape the handler:\n${unguarded.join("\n")}`,
  );
});

test("buildDegradedReply never leaks key state", () => {
  const r = buildDegradedReply("groq_unavailable", {}, (s) => s);
  const text = JSON.stringify(r);
  assert.doesNotMatch(text, /gsk_|GROQ_API_KEY|TURNSTILE|SECRET/);
  assert.equal(r.degraded, true);
});

// ── /api/evidence ────────────────────────────────────────────────────────

const evidenceReq = (body, headers = {}) =>
  new Request("https://api.test/api/evidence", {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const bucket = () => {
  const puts = [];
  return { puts, put: async (k, v, o) => void puts.push([k, v, o]) };
};

test("evidence upload requires a provisioned bearer secret", async () => {
  const b = bucket();
  // No secret: closed, and closed BY NAME. CORS does nothing for curl and the
  // in-isolate limiter does not survive eviction, so an open writer could
  // overwrite the deterministic Lighthouse/axe/Jev records this endpoint exists
  // to make durable.
  const res = await worker.fetch(
    evidenceReq({
      kind: "lighthouse",
      name: "run-1",
      data: "{}",
      contentType: "application/json",
    }),
    { EVIDENCE_BUCKET: b },
  );
  assert.equal(res.status, 503, "an unprovisioned secret must not mean open");
  assert.match(
    JSON.stringify(await res.json()),
    /EVIDENCE_UPLOAD_TOKEN/,
    "the failure must name the provisioning step",
  );
  assert.deepEqual(b.puts, [], "nothing may be written while unprovisioned");
});

test("evidence upload refuses a wrong or missing bearer token", async () => {
  const b = bucket();
  const env = { EVIDENCE_BUCKET: b, EVIDENCE_UPLOAD_TOKEN: "s3cret" };
  for (const headers of [
    {},
    { Authorization: "Bearer wrong" },
    { Authorization: "s3cret" },
    { Authorization: "Bearer s3cret-extra" },
    { Authorization: "Bearer s3cr" },
    { Authorization: "Basic czNjcmV0" },
  ]) {
    const res = await worker.fetch(
      evidenceReq(
        {
          kind: "axe",
          name: "run-2",
          data: "{}",
          contentType: "application/json",
        },
        headers,
      ),
      env,
    );
    assert.equal(res.status, 403, `must refuse ${JSON.stringify(headers)}`);
    assert.equal(b.puts.length, 0);
  }
});

test("evidence upload accepts the provisioned token and stores the key", async () => {
  const b = bucket();
  const res = await worker.fetch(
    evidenceReq(
      {
        kind: "axe",
        name: "run-3",
        data: '{"violations":[]}',
        contentType: "application/json",
      },
      { Authorization: "Bearer s3cret" },
    ),
    { EVIDENCE_BUCKET: b, EVIDENCE_UPLOAD_TOKEN: "s3cret" },
  );
  assert.equal(res.status, 200);
  assert.deepEqual(b.puts[0][0], "evidence/axe/run-3.json");
});

test("a non-string evidence body is a named 400, not an uncaught 500", async () => {
  // `body.data` is whatever JSON carried. A number or an object has no
  // `.byteLength`, `undefined > LIMIT` is false, so the size check passed a
  // value it could not measure and `bucket.put` threw a TypeError out of the
  // handler — with no CORS headers.
  const b = bucket();
  for (const data of [5, { a: 1 }, [1, 2, 3], true, null]) {
    const res = await worker.fetch(
      evidenceReq(
        { kind: "jev", name: "run-4", data, contentType: "application/json" },
        { Authorization: "Bearer s3cret" },
      ),
      { EVIDENCE_BUCKET: b, EVIDENCE_UPLOAD_TOKEN: "s3cret" },
    );
    assert.ok(
      res.status === 400 || res.status === 413,
      `data=${JSON.stringify(data)} produced ${res.status}`,
    );
    assert.ok(
      res.headers.get("Access-Control-Allow-Origin"),
      "even a rejection has to be readable by the caller",
    );
  }
});

test("putEvidence refuses a value it cannot measure", async () => {
  const b = bucket();
  for (const body of [5, { a: 1 }, [1], true]) {
    const r = await putEvidence(b, "axe", "x", body, "application/json");
    assert.equal(r.ok, false, `body=${JSON.stringify(body)}`);
    assert.equal(r.reason, "invalid_body");
  }
  // And a real string still works, at the size boundary.
  const ok = await putEvidence(b, "axe", "ok", "{}", "application/json");
  assert.equal(ok.ok, true);
  const big = await putEvidence(
    b,
    "axe",
    "big",
    "x".repeat(5 * 1024 * 1024 + 1),
    "application/json",
  );
  assert.equal(big.reason, "too_large");
});
