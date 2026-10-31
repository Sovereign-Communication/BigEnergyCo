import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import worker, { resetRateLimitsForTest } from "../worker/index.js";
import { verifyTurnstile } from "../worker/turnstile.mjs";
import {
  storeSharePayload,
  getSharePayload,
  makeShareId,
  isValidShareId,
  SHARE_TTL_SECONDS,
} from "../worker/share-cache.mjs";
import {
  putEvidence,
  evidenceKey,
  EVIDENCE_MAX_BYTES,
} from "../worker/evidence.mjs";
import {
  recordUsageEvent,
  validateUsageEvent,
  USAGE_EVENTS,
} from "../worker/usage-ledger.mjs";
import {
  resolveBeaconToken,
  injectBeacon,
  BEACON_SRC,
  PLACEHOLDER_TOKEN,
} from "../assets/js/cf-beacon.js";
import { b64urlEncode, SHARE_PREFIX } from "../assets/js/sizing/share-codec.js";
import { checkProvisioning } from "../scripts/cf-provision-check.mjs";

const ORIGIN = "https://freeoffgridcalculator.com";

// ── stubs ──────────────────────────────────────────────────────────────

function memoryKv() {
  const store = new Map();
  return {
    store,
    async put(k, v, opts) {
      store.set(k, { v, opts });
    },
    async get(k) {
      return store.has(k) ? store.get(k).v : null;
    },
  };
}

function memoryR2() {
  const store = new Map();
  return {
    store,
    async put(k, bytes, opts) {
      store.set(k, { bytes, opts });
    },
  };
}

function memoryD1() {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              calls.push({ sql, args });
            },
          };
        },
      };
    },
  };
}

const siteverifyOk = async () => ({ json: async () => ({ success: true }) });
const siteverifyNo = async () => ({
  json: async () => ({
    success: false,
    "error-codes": ["invalid-input-response"],
  }),
});

const post = (path, body, env = {}, headers = {}) =>
  worker.fetch(
    new Request(`https://api.test${path}`, {
      method: "POST",
      headers: {
        Origin: ORIGIN,
        "Content-Type": "application/json",
        ...headers,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    env,
  );

const get = (path, env = {}) =>
  worker.fetch(
    new Request(`https://api.test${path}`, {
      headers: { Origin: ORIGIN },
    }),
    env,
  );

beforeEach(() => resetRateLimitsForTest());

// ── Turnstile ──────────────────────────────────────────────────────────

test("verifyTurnstile rejects missing token and missing secret", async () => {
  assert.deepEqual(await verifyTurnstile("", "s", siteverifyOk), {
    ok: false,
    reason: "missing_token",
  });
  assert.deepEqual(await verifyTurnstile("t", "", siteverifyOk), {
    ok: false,
    reason: "missing_secret",
  });
});

test("verifyTurnstile maps siteverify outcomes", async () => {
  assert.deepEqual(await verifyTurnstile("t", "s", siteverifyOk), { ok: true });
  assert.deepEqual(await verifyTurnstile("t", "s", siteverifyNo), {
    ok: false,
    reason: "invalid_token",
  });
  assert.deepEqual(
    await verifyTurnstile("t", "s", async () => {
      throw new Error("boom");
    }),
    { ok: false, reason: "network_error" },
  );
  assert.deepEqual(
    await verifyTurnstile("t", "s", async () => ({
      json: async () => {
        throw new Error("bad json");
      },
    })),
    { ok: false, reason: "bad_response" },
  );
});

test("chat is fail-closed once the Turnstile secret exists", async () => {
  const env = { TURNSTILE_SECRET_KEY: "s3cr3t", fetch: siteverifyNo };
  const res = await post(
    "/api/chat",
    { message: "hello", turnstileToken: "bogus-token" },
    env,
  );
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.reason, "invalid_token");
});

test("chat rejects a missing token once the secret exists", async () => {
  const env = { TURNSTILE_SECRET_KEY: "s3cr3t", fetch: siteverifyOk };
  const res = await post("/api/chat", { message: "hello" }, env);
  assert.equal(res.status, 403);
  assert.equal((await res.json()).reason, "missing_token");
});

test("chat keeps its ungated behavior while Turnstile is unprovisioned", async () => {
  // PORTED (B2 / R-CF-10), not weakened. No TURNSTILE_SECRET_KEY: the request
  // must sail past the Turnstile gate exactly as before — that is still the
  // assertion. The terminal status moved from 500 to the labelled degraded
  // reply, because a 500 IS a dead chat box to a visitor and was the defect.
  //
  // What this test guards is the presence-gating, so it now also pins that
  // Turnstile's absence is the ONLY thing that let the call through: with the
  // secret set, the same request is a 403 (the tests above).
  const res = await post("/api/chat", { message: "hello" }, {});
  assert.equal(
    res.status,
    200,
    "unprovisioned Turnstile must not gate the advisor",
  );
  const body = await res.json();
  assert.equal(body.degraded, true);
  assert.equal(body.reason, "key_missing");
  assert.equal(
    body.turnstile,
    undefined,
    "no Turnstile verdict on an ungated path",
  );
});

// ── KV share cache ─────────────────────────────────────────────────────

const validHash = () =>
  SHARE_PREFIX + b64urlEncode({ v: 1, la: 19.7, lo: -155.8, kw: 8 });

test("share ids are 12 lowercase-alphanumeric chars", () => {
  for (let i = 0; i < 25; i++) {
    const id = makeShareId();
    assert.ok(isValidShareId(id), id);
  }
  assert.ok(!isValidShareId("short"));
  assert.ok(!isValidShareId("UPPERCASE12ab"));
  assert.ok(!isValidShareId("has space 12"));
  assert.ok(!isValidShareId(null));
});

test("share ids are uniform, and rejected bytes are retaken rather than folded", () => {
  // The bug this pins: mapping a raw byte with `b % 36` is biased, because
  // 256 % 36 leaves residues 0-3 reachable by 8 byte values and the other 32
  // by only 7. Measured, that made '0'-'3' ~14% more likely than every other
  // symbol — and those are the first four an attacker enumerating a share id
  // would reach for. Rejection sampling removes it.
  //
  // Asserted EXACTLY, not statistically: a seam that walks the byte range
  // covers all 252 usable values once per cycle, and 252 / 36 == 7, so a
  // correct implementation puts every symbol in the alphabet exactly 7 times.
  // A folded implementation would put '0'-'3' in 8 times. No randomness, no
  // flake, and the assertion states the property rather than a proxy for it.
  const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
  let next = 0;
  const walkUsable = (b) => {
    b[0] = next % 252; // every usable byte value, once per 252 draws
    next++;
  };
  // 252 usable bytes / 36 symbols = exactly 7 each, and 252 / 12 chars per id
  // = exactly 21 ids. Feed one complete cycle and the output must contain
  // every symbol exactly seven times. Nothing random, nothing statistical.
  const counts = new Map();
  for (let i = 0; i < 21; i++) {
    for (const ch of makeShareId(walkUsable)) {
      counts.set(ch, (counts.get(ch) || 0) + 1);
    }
  }
  assert.equal(next, 252, "the seam must have been drawn exactly 252 times");
  assert.equal(counts.size, 36, "every symbol must be reachable");
  for (const ch of ALPHABET) {
    assert.equal(
      counts.get(ch),
      7,
      `symbol '${ch}' must appear exactly 7 times per 252-byte cycle`,
    );
  }

  // And the rejection path itself: a source that hands back only unusable
  // bytes first must still produce a valid id, by drawing again — which is
  // what makes the uniformity above true rather than incidental.
  let draws = 0;
  const lateStart = (b) => {
    draws++;
    b[0] = draws <= 3 ? 255 : (draws * 7) % 252;
  };
  assert.ok(isValidShareId(makeShareId(lateStart)));
  assert.equal(
    draws,
    15,
    "3 unusable bytes must be retaken before 12 usable ones are accepted",
  );
});

test("share payload round-trips through KV with a 7-day TTL", async () => {
  const kv = memoryKv();
  const stored = await storeSharePayload(kv, validHash(), (b) => {
    b[0] = 7; // deterministic id for this round trip
  });
  assert.equal(stored.ok, true);
  assert.ok(isValidShareId(stored.id));
  const [[key, entry]] = [...kv.store.entries()];
  assert.equal(key, `share:${stored.id}`);
  assert.equal(entry.opts.expirationTtl, SHARE_TTL_SECONDS);
  assert.equal(SHARE_TTL_SECONDS, 7 * 24 * 3600);

  const found = await getSharePayload(kv, stored.id);
  assert.equal(found.ok, true);
  assert.equal(found.payload.kw, 8);
  assert.equal(found.payload.la, 19.7);
});

test("share store rejects payloads the codec rejects", async () => {
  const kv = memoryKv();
  const bad = await storeSharePayload(kv, "#s=not-valid-json!!!");
  assert.deepEqual(bad, { ok: false, reason: "invalid_payload" });
  const wrongVersion = await storeSharePayload(
    kv,
    SHARE_PREFIX + b64urlEncode({ v: 2, la: 1, lo: 1, kw: 8 }),
  );
  assert.deepEqual(wrongVersion, { ok: false, reason: "invalid_payload" });
  assert.equal(kv.store.size, 0, "nothing invalid may reach KV");
});

test("share endpoints degrade to 503 without the KV binding", async () => {
  const res = await post("/api/share", { hash: validHash() }, {});
  assert.equal(res.status, 503);
  assert.match((await res.json()).hint, /cloudflare-showcase/);
  const res2 = await get("/api/share?id=abcdefgh1234", {});
  assert.equal(res2.status, 503);
});

test("share GET validates ids and reports misses", async () => {
  const kv = memoryKv();
  const env = { SHARE_KV: kv };
  const badId = await get("/api/share?id=nope", env);
  assert.equal(badId.status, 400);
  const miss = await get("/api/share?id=abcdefgh1234", env);
  assert.equal(miss.status, 404);
});

test("share POST end-to-end over the worker router", async () => {
  const kv = memoryKv();
  const env = { SHARE_KV: kv };
  const res = await post("/api/share", { hash: validHash() }, env);
  assert.equal(res.status, 200);
  const { id, ttlSeconds } = await res.json();
  assert.ok(isValidShareId(id));
  assert.equal(ttlSeconds, SHARE_TTL_SECONDS);
  const back = await get(`/api/share?id=${id}`, env);
  assert.equal(back.status, 200);
  assert.equal((await back.json()).payload.kw, 8);
});

// ── R2 evidence ────────────────────────────────────────────────────────

test("evidenceKey namespaces by kind and sanitizes names", () => {
  assert.equal(
    evidenceKey("lighthouse", "2026-09-28T120000Z"),
    "evidence/lighthouse/2026-09-28T120000Z.json",
  );
  assert.equal(evidenceKey("nope", "x"), null);
  assert.equal(evidenceKey("axe", "../escape"), null);
  assert.equal(evidenceKey("axe", ""), null);
});

test("putEvidence enforces kind, type, and size", async () => {
  const r2 = memoryR2();
  const ok = await putEvidence(
    r2,
    "axe",
    "run-1",
    '{"violations":[]}',
    "application/json",
  );
  assert.deepEqual(ok, { ok: true, key: "evidence/axe/run-1.json" });
  assert.equal(
    r2.store.get("evidence/axe/run-1.json").opts.httpMetadata.contentType,
    "application/json",
  );

  assert.deepEqual(
    (await putEvidence(r2, "malware", "x", "{}", "application/json")).reason,
    "invalid_kind",
  );
  assert.deepEqual(
    (await putEvidence(r2, "axe", "x", "{}", "application/x-sh")).reason,
    "invalid_content_type",
  );
  const big = "x".repeat(EVIDENCE_MAX_BYTES + 1);
  assert.deepEqual(
    (await putEvidence(r2, "axe", "x", big, "application/json")).reason,
    "too_large",
  );
  assert.deepEqual(
    (await putEvidence(null, "axe", "x", "{}", "application/json")).reason,
    "r2_unavailable",
  );
});

test("evidence endpoint degrades to 503 without the R2 binding", async () => {
  const res = await post(
    "/api/evidence",
    { kind: "axe", name: "r1", contentType: "application/json", data: "{}" },
    {},
  );
  assert.equal(res.status, 503);
});

// ── D1 usage ledger ────────────────────────────────────────────────────

test("usage event validation is a closed enum with no PII fields", () => {
  for (const event of USAGE_EVENTS) {
    const clean = validateUsageEvent({
      event,
      page: "/solar-calculator/",
      country: "US",
    });
    assert.deepEqual(clean, {
      event,
      page: "/solar-calculator/",
      country: "US",
    });
  }
  assert.equal(validateUsageEvent({ event: "hacked", page: "/" }), null);
  assert.equal(
    validateUsageEvent({ event: "page_view", page: "https://evil.com" }).page,
    "/",
  );
  assert.equal(
    validateUsageEvent({ event: "page_view", page: "/", country: "USA" })
      .country,
    null,
  );
  // No field exists for IPs, emails, or coordinates — extra keys are dropped.
  const clean = validateUsageEvent({
    event: "page_view",
    page: "/",
    ip: "1.2.3.4",
    email: "a@b.c",
  });
  assert.deepEqual(Object.keys(clean).sort(), ["country", "event", "page"]);
});

test("recordUsageEvent inserts exactly the allowlisted columns", async () => {
  const db = memoryD1();
  const res = await recordUsageEvent(
    db,
    { event: "calc_run", page: "/solar-calculator/", country: "DE" },
    1759000000,
  );
  assert.deepEqual(res, { ok: true });
  assert.equal(db.calls.length, 1);
  const [{ sql, args }] = db.calls;
  assert.match(sql, /INSERT INTO usage_events/);
  assert.deepEqual(args, [
    1759000000,
    "calc_run",
    "/solar-calculator/",
    "DE",
    "2025-09-27",
  ]);
  assert.deepEqual(
    await recordUsageEvent(null, { event: "page_view", page: "/" }),
    {
      ok: false,
      reason: "d1_unavailable",
    },
  );
  assert.deepEqual(await recordUsageEvent(db, { event: "nope", page: "/" }), {
    ok: false,
    reason: "invalid_event",
  });
});

test("events endpoint degrades to 503 without the D1 binding", async () => {
  const res = await post("/api/events", { event: "page_view", page: "/" }, {});
  assert.equal(res.status, 503);
});

test("events endpoint takes country from cf-ipcountry, never the client", async () => {
  const db = memoryD1();
  const res = await post(
    "/api/events",
    { event: "page_view", page: "/", country: "XX" },
    { USAGE_DB: db },
    { "cf-ipcountry": "JP" },
  );
  assert.equal(res.status, 200);
  assert.equal(db.calls[0].args[3], "JP");
});

// ── Web Analytics beacon ───────────────────────────────────────────────

const fakeDoc = (token) => ({
  querySelector: (sel) =>
    sel === 'meta[name="cf-beacon-token"]' && token
      ? { getAttribute: () => token }
      : null,
  head: { appendChild: (el) => el },
  createElement: (tag) => ({
    tag,
    attrs: {},
    setAttribute(k, v) {
      this.attrs[k] = v;
    },
  }),
});

test("beacon never fires on the placeholder or malformed tokens", () => {
  assert.equal(resolveBeaconToken(fakeDoc(null)), null);
  assert.equal(resolveBeaconToken(fakeDoc(PLACEHOLDER_TOKEN)), null);
  assert.equal(resolveBeaconToken(fakeDoc("not-a-token")), null);
  assert.equal(resolveBeaconToken(null), null);
});

test("beacon accepts a real 32-char hex token from meta or window", () => {
  const token = "a".repeat(32);
  assert.equal(resolveBeaconToken(fakeDoc(token)), token);
  const realDoc = fakeDoc(null);
  globalThis.window = { BEC_CF_BEACON_TOKEN: token };
  try {
    assert.equal(resolveBeaconToken(realDoc), token);
  } finally {
    delete globalThis.window;
  }
});

test("injectBeacon points at the Cloudflare beacon with the token", () => {
  const doc = fakeDoc(null);
  const el = injectBeacon(doc, "b".repeat(32));
  assert.equal(el.src, BEACON_SRC);
  assert.ok(el.attrs["data-cf-beacon"].includes("b".repeat(32)));
});

// ── health + provisioning gate ─────────────────────────────────────────

test("health reports showcase binding presence, never secrets", async () => {
  const res = await get("/api/health", {
    SHARE_KV: memoryKv(),
    TURNSTILE_SECRET_KEY: "s3cr3t",
  });
  const body = await res.json();
  assert.deepEqual(body.showcase, {
    turnstile: true,
    kv: true,
    r2: false,
    d1: false,
  });
  assert.ok(!JSON.stringify(body).includes("s3cr3t"));
});

test("provision check fails on placeholders, passes when clean", () => {
  const dirty = checkProvisioning('{"id":"REPLACE_WITH_KV_NAMESPACE_ID"}');
  assert.ok(dirty.some((m) => m.key === "REPLACE_WITH_KV_NAMESPACE_ID"));
  assert.deepEqual(checkProvisioning('{"id":"real-id-123"}'), []);
});
