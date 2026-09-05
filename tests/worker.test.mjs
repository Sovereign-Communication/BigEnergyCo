import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import worker, {
  getAllowedOrigin, corsHeaders, getClientIp,
  checkRateLimit, resetRateLimitsForTest,
  sanitizeAndCloseReply, SYSTEM_PROMPT_VERSION,
} from "../worker/index.js";

const ORIGIN = "https://bigenergyco.pages.dev";
const chatReq = (body, headers = {}) => new Request("https://api.test/api/chat", {
  method: "POST",
  headers: { Origin: ORIGIN, "Content-Type": "application/json", ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

beforeEach(() => resetRateLimitsForTest());

test("getAllowedOrigin locks to the explicit allowlist", () => {
  assert.equal(getAllowedOrigin(ORIGIN), ORIGIN);
  assert.equal(getAllowedOrigin("https://sovereign-communication.github.io"), "https://sovereign-communication.github.io");
  assert.equal(getAllowedOrigin("http://localhost:7510"), "http://localhost:7510");
  assert.equal(getAllowedOrigin("https://evil.com"), null);
  assert.equal(getAllowedOrigin(`${ORIGIN}/`), null);
  assert.equal(getAllowedOrigin("https://BIGENERGYCO.pages.dev"), null);
  assert.equal(getAllowedOrigin(null), null);
  assert.equal(getAllowedOrigin(undefined), null);
});

test("corsHeaders echoes only allowed origins and always varies", () => {
  const h = corsHeaders(ORIGIN);
  assert.equal(h["Access-Control-Allow-Origin"], ORIGIN);
  assert.equal(h.Vary, "Origin");
  assert.match(h["Access-Control-Allow-Methods"], /POST/);
  assert.ok(!("Access-Control-Allow-Origin" in corsHeaders(null)));
});

test("getClientIp prefers CF-Connecting-IP, then first XFF, then unknown", () => {
  const r1 = new Request("https://x/", { headers: { "CF-Connecting-IP": "9.9.9.9", "X-Forwarded-For": "1.1.1.1" } });
  assert.equal(getClientIp(r1), "9.9.9.9");
  const r2 = new Request("https://x/", { headers: { "X-Forwarded-For": "1.2.3.4, 5.6.7.8" } });
  assert.equal(getClientIp(r2), "1.2.3.4");
  assert.equal(getClientIp(new Request("https://x/")), "unknown");
});

test("checkRateLimit enforces 8/min per IP with Retry-After", () => {
  for (let i = 0; i < 8; i++) assert.equal(checkRateLimit("10.0.0.1", 1000 + i).allowed, true);
  const blocked = checkRateLimit("10.0.0.1", 1008);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfter, 60);
  assert.equal(checkRateLimit("10.0.0.2", 1008).allowed, true);
});

test("checkRateLimit enforces 150/day per IP", () => {
  // One call per minute: stays under the 8/min bucket, fills the day bucket.
  for (let i = 0; i < 150; i++) assert.equal(checkRateLimit("10.0.0.9", 2000 + i * 60).allowed, true);
  const blocked = checkRateLimit("10.0.0.9", 2000 + 150 * 60);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfter, 3600);
});

test("checkRateLimit enforces the 3000/day global cap", () => {
  for (let i = 0; i < 3000; i++) {
    assert.equal(checkRateLimit(`192.168.1.${i % 250}`, 3000 + i).allowed, true);
  }
  assert.equal(checkRateLimit("192.168.9.9", 6001).allowed, false);
});

test("sanitizeAndCloseReply closes fences, drops dangling rows, finishes sentences", () => {
  assert.equal(sanitizeAndCloseReply("```\ncode"), "```\ncode\n```");
  assert.equal(sanitizeAndCloseReply("a | b |\n| dangling"), "a | b |");
  assert.equal(sanitizeAndCloseReply("First done. Second cut"), "First done.\n\n*(Feel free to ask for Part 2 or let me know if you'd like to dive deeper into any of these specs! ⚡)*");
  assert.equal(sanitizeAndCloseReply("Clean sentence."), "Clean sentence.");
  assert.equal(sanitizeAndCloseReply(""), "");
  assert.equal(sanitizeAndCloseReply(null), null);
});

test("OPTIONS without an allowed origin gets no CORS headers", async () => {
  const res = await worker.fetch(new Request("https://api.test/api/chat", {
    method: "OPTIONS", headers: { Origin: "https://evil.com" },
  }), {});
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
});

test("OPTIONS with an allowed origin returns CORS headers", async () => {
  const res = await worker.fetch(new Request("https://api.test/api/chat", {
    method: "OPTIONS", headers: { Origin: ORIGIN },
  }), {});
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
});

test("/api/health exposes version, prompt version and limits with no-store", async () => {
  const res = await worker.fetch(new Request("https://api.test/api/health"), {});
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  const body = await res.json();
  assert.equal(body.status, "ok");
  assert.equal(body.promptVersion, SYSTEM_PROMPT_VERSION);
  assert.equal(body.rateLimits.perIpPerMinute, 8);
  assert.equal(body.rateLimits.perIpPerDay, 150);
  assert.equal(body.rateLimits.globalPerDay, 3000);
});

test("unknown paths 404", async () => {
  const res = await worker.fetch(new Request("https://api.test/nope"), {});
  assert.equal(res.status, 404);
});

test("/api/chat validates input before any paid call", async () => {
  assert.equal((await worker.fetch(chatReq({}), {})).status, 400);
  assert.equal((await worker.fetch(chatReq({ message: "x".repeat(4001) }), {})).status, 413);
  assert.equal((await worker.fetch(chatReq({ message: "x".repeat(20001) }), {})).status, 413);
});

test("/api/chat 500s without a configured key (never leaks key state)", async () => {
  const res = await worker.fetch(chatReq({ message: "hello" }), {});
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.ok(!JSON.stringify(body).includes("GROQ_API_KEY="));
});

test("/api/chat returns 429 with Retry-After after 8/min", async () => {
  const env = {};
  for (let i = 0; i < 8; i++) {
    assert.equal((await worker.fetch(chatReq({ message: "hi" }), env)).status, 500);
  }
  const limited = await worker.fetch(chatReq({ message: "hi" }), env);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "60");
});

test("/api/chat happy path returns the sanitized reply", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true, status: 200,
    json: async () => ({ choices: [{ message: { content: "Sized for you." }, finish_reason: "stop" }] }),
  });
  try {
    const res = await worker.fetch(chatReq({ message: "size me" }), { GROQ_API_KEY: "test-key" });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.reply, "Sized for you.");
    assert.equal(body.model, "openai/gpt-oss-120b");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("/api/chat falls back to the small model on 5xx before partial output", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => (++calls === 1
    ? { ok: false, status: 500, json: async () => ({}) }
    : { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "fallback ok." }, finish_reason: "stop" }] }) });
  try {
    const res = await worker.fetch(chatReq({ message: "size me" }), { GROQ_API_KEY: "test-key" });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.model, "openai/gpt-oss-20b");
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("/api/chat backs off once on upstream 429 then serves the retry", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => (++calls === 1
    ? { ok: false, status: 429, json: async () => ({ error: { message: "try again in 0.2s" } }) }
    : { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "recovered." }, finish_reason: "stop" }] }) });
  try {
    const res = await worker.fetch(chatReq({ message: "size me" }), { GROQ_API_KEY: "test-key" });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).reply, "recovered.");
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = realFetch;
  }
});
