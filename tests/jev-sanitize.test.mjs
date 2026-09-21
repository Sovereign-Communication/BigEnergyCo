// Tests for the Jev sanity-check feature (PR A of the Jev plan).
//
// What each section pins:
//   1. Worker /api/jev contract — strict state validation (bounds, unknown
//      fields, mode enum), key-missing degradation, upstream error mapping,
//      shared rate-limit buckets. The upstream is injected, never fetched.
//   2. Client gating — the interpretation thresholds are pinned to the
//      LIVE-measured jev-1.13.0 calibration probes (textbook vs German-winter
//      vs broken-PV), so a future model version that shifts calibration
//      cannot silently change what a visitor sees.
//   3. Weather-cache regression — asserted in the REAL browser surface
//      (scripts/browser-smoke.mjs counts NASA requests across same-location
//      re-runs), because the node-injectable weather path bypasses the cache
//      BY DESIGN ("injected test weather bypasses the memo") — a node test
//      here would measure the fixture layer, not production.
//   4. Locale parity — every locale carries the same sanity-* keys.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import worker, {
  checkRateLimit,
  resetRateLimitsForTest,
  validateJevState,
} from "../worker/index.js";
import {
  interpretSanity,
  jevEnabled,
  requestSanity,
  renderSanityBadge,
  sanityState,
  SANITY_THRESHOLDS,
} from "../assets/js/sizing/validate.js";
import { LOCALES } from "../assets/js/shared/locales.js";

const ORIGIN = "https://freeoffgridcalculator.com";

const jevReq = (body, env = {}) =>
  new Request("https://api.test/api/jev", {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const UPSTREAM_OK = {
  model: "jev-1.13.0",
  answers: {
    physically_plausible: { type: "noul", noul: 0.67 },
    verdict: {
      type: "choice",
      choice: "reasonable",
      confidence: 0.8,
      probabilities: {},
    },
    red_flag: { type: "score", score: 0.5, confidence: 0.7, legend: {} },
  },
  usage: { input_tokens: 580, output_tokens: 89 },
};

const GOOD_STATE = {
  mode: "offgrid",
  dailyKwh: 10,
  pvKw: 6.6,
  battKwh: 13.4,
  costLo: 4200,
  costHi: 8100,
  cutPct: 90,
  paybackYears: 5.1,
  specificYieldKwhPerKwDay: 4.8,
  worstMonthGhi: 4.5,
  meanTempC: 27,
};

beforeEach(() => resetRateLimitsForTest());

// ── 1. Worker contract ───────────────────────────────────────────────────────

test("validateJevState: rejects unknown fields, bad mode, out-of-bounds numbers", () => {
  assert.equal(validateJevState({ state: GOOD_STATE }).ok, true);
  assert.equal(
    validateJevState({ state: { ...GOOD_STATE, evil: "<script>" } }).ok,
    false,
    "unknown fields are rejected, not ignored",
  );
  assert.equal(
    validateJevState({ state: { ...GOOD_STATE, mode: "auto" } }).ok,
    false,
  );
  assert.equal(
    validateJevState({ state: { ...GOOD_STATE, dailyKwh: 999999 } }).ok,
    false,
    "out-of-bounds numbers rejected",
  );
  assert.equal(
    validateJevState({ state: { ...GOOD_STATE, pvKw: "6.6" } }).ok,
    false,
    "strings are not numbers",
  );
  assert.equal(validateJevState({ state: null }).ok, false);
  assert.equal(validateJevState(null).ok, false);
  assert.equal(
    validateJevState({ state: { ...GOOD_STATE, worstMonthGhi: undefined } }).ok,
    true,
    "climate fields are optional",
  );
  assert.equal(
    validateJevState({ state: { ...GOOD_STATE, paybackYears: undefined } }).ok,
    true,
    "payback is optional when tariff data is unavailable",
  );
});

test("sanityState omits unavailable payback instead of serializing NaN", () => {
  const state = sanityState(
    { mode: "gridtie", dailyKwh: 10, annualYieldPerKw: 1800 },
    { pvKw: 4, battKwh: 10, costLo: 1000, costHi: 2000, cutPct: 80 },
  );
  assert.equal("paybackYears" in state, false);
  assert.equal(validateJevState({ state }).ok, true);
});

test("/api/jev: key-missing degrades to available:false, never a 5xx crash", async () => {
  const res = await worker.fetch(jevReq({ state: GOOD_STATE }), {});
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.available, false);
  assert.equal(body.reason, "key_missing");
});

test("/api/health exposes the jevSanity gate flag from the key's presence", async () => {
  const off = await (
    await worker.fetch(new Request("https://api.test/api/health"), {})
  ).json();
  assert.equal(off.jevSanity, false, "no key -> route reported off");
  const on = await (
    await worker.fetch(new Request("https://api.test/api/health"), {
      OPENROUTER_API_KEY: "k",
    })
  ).json();
  assert.equal(on.jevSanity, true, "backup key present -> route reported on");
});

test("requestSanity: never asks when health says the route is off (silent, zero noise)", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (u) => {
    calls += 1;
    return new Response(JSON.stringify({ status: "ok", jevSanity: false }), {
      status: 200,
    });
  };
  try {
    const out = await requestSanity({ mode: "offgrid" });
    assert.equal(out, null);
    assert.equal(calls, 1, "health asked; no /api/jev POST at all");
    await requestSanity({ mode: "offgrid" });
    assert.equal(
      calls,
      2,
      "each render re-asks: activation is server-side only",
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("requestSanity: health-on path POSTs and maps the response; failures stay silent", async () => {
  const realFetch = globalThis.fetch;
  let posts = 0;
  globalThis.fetch = async (u, o) => {
    if (String(u).indexOf("/api/health") !== -1) {
      return new Response(JSON.stringify({ status: "ok", jevSanity: true }), {
        status: 200,
      });
    }
    posts += 1;
    if (posts === 1) {
      return new Response(
        JSON.stringify({
          available: true,
          model: "jev-1.13.0",
          plausible: 0.9,
          verdict: "reasonable",
          verdictConfidence: 0.9,
          redFlag: 0.2,
          redFlagConfidence: 0.8,
        }),
        { status: 200 },
      );
    }
    return new Response("{}", { status: 404 });
  };
  try {
    const data = await requestSanity({ mode: "offgrid" });
    assert.equal(data.available, true);
    const interp = interpretSanity(data);
    assert.equal(interp.level, "pass");
    assert.equal(
      await requestSanity({ mode: "offgrid" }),
      null,
      "non-2xx -> null",
    );
    assert.equal(posts, 2);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("/api/jev: full happy path maps the upstream answers into the client contract", async () => {
  const calls = [];
  const env = {
    TYPESAFE_API_KEY: "k_test",
    fetch: async (url, opts) => {
      calls.push({ url: String(url), body: JSON.parse(opts.body) });
      return new Response(JSON.stringify(UPSTREAM_OK), { status: 200 });
    },
  };
  const res = await worker.fetch(jevReq({ state: GOOD_STATE }), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.available, true);
  assert.equal(body.plausible, 0.67);
  assert.equal(body.verdict, "reasonable");
  assert.equal(body.redFlag, 0.5);
  assert.ok(
    calls[0].body.questions.physically_plausible,
    "questions built server-side",
  );
  assert.ok(
    !JSON.stringify(calls[0].body).includes("<script"),
    "no client-controlled text reaches the upstream body",
  );
});

test("/api/jev: OpenRouter backs up a failed TypeSafe provider", async () => {
  const calls = [];
  const res = await worker.fetch(jevReq({ state: GOOD_STATE }), {
    TYPESAFE_API_KEY: "typesafe",
    OPENROUTER_API_KEY: "openrouter",
    fetch: async (url, options) => {
      calls.push({ url: String(url), body: JSON.parse(options.body) });
      if (String(url).includes("typesafe"))
        return new Response("provider down", { status: 503 });
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({ answers: UPSTREAM_OK.answers }),
              },
            },
          ],
        }),
        { status: 200 },
      );
    },
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.available, true);
  assert.equal(body.model, "~typesafe/jev-latest");
  assert.deepEqual(
    calls.map((call) => call.url),
    [
      "https://api.typesafe.ai/v1/systemone",
      "https://openrouter.ai/api/v1/chat/completions",
    ],
  );
  assert.equal(calls[1].body.model, "~typesafe/jev-latest");
});

test("/api/jev: provider failures remain a silent unavailable result", async () => {
  const res = await worker.fetch(jevReq({ state: GOOD_STATE }), {
    TYPESAFE_API_KEY: "typesafe",
    OPENROUTER_API_KEY: "openrouter",
    fetch: async () => new Response("provider down", { status: 503 }),
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    available: false,
    reason: "upstream_unavailable",
  });
});

test("/api/jev: invalid bodies are 400 before any paid call", async () => {
  const fetchCalls = [];
  const env = {
    TYPESAFE_API_KEY: "k",
    fetch: async (u, o) => {
      fetchCalls.push(1);
      return new Response("{}", { status: 200 });
    },
  };
  const res = await worker.fetch(jevReq({ state: { mode: "offgrid" } }), env);
  assert.equal(res.status, 400);
  assert.equal(fetchCalls.length, 0, "no upstream call on a malformed body");
});

test("/api/jev: shares the chat rate-limit buckets", async () => {
  const env = {
    TYPESAFE_API_KEY: "k",
    fetch: async () =>
      new Response(JSON.stringify(UPSTREAM_OK), { status: 200 }),
  };
  for (let i = 0; i < 8; i++) {
    const res = await worker.fetch(jevReq({ state: GOOD_STATE }), env);
    assert.equal(res.status, 200);
  }
  const res = await worker.fetch(jevReq({ state: GOOD_STATE }), env);
  assert.equal(res.status, 429, "9th call inside a minute is rate-limited");
  assert.equal((await res.json()).reason, "rate_limited");
});

// ── 2. Client gating, pinned to live-measured calibration ───────────────────

test("interpretSanity: the measured calibration cases classify as designed", () => {
  // Live probes against jev-1.13.0 (recorded in the PR):
  //   German winter, undersized battery: plausible=0.19 -> FLAG
  const german = interpretSanity({
    available: true,
    plausible: 0.19,
    verdict: "suspicious",
    verdictConfidence: 0.63,
    redFlag: 1.25,
    redFlagConfidence: 0.13,
  });
  assert.equal(german.level, "flag");
  //   Yemen flat-sun textbook sizing: plausible=0.63 -> PASS
  const yemen = interpretSanity({
    available: true,
    plausible: 0.63,
    verdict: "suspicious",
    verdictConfidence: 0.43,
    redFlag: 0.87,
    redFlagConfidence: 0.14,
  });
  assert.equal(yemen.level, "pass");
  //   A confident "impossible" flags even with a high plausible noul.
  const imp = interpretSanity({
    available: true,
    plausible: 0.7,
    verdict: "impossible",
    verdictConfidence: 0.9,
    redFlag: 0.5,
    redFlagConfidence: 0.8,
  });
  assert.equal(imp.level, "flag");
  //   Mid-band is uncertain — never a pass, never a visitor alarm.
  // Observed staging response: available, suspicious, but not confident
  // enough to claim either a pass or a warning.
  const mid = interpretSanity({
    available: true,
    model: "jev-latest",
    plausible: 0.42,
    verdict: "suspicious",
    verdictProbabilities: {
      reasonable: 0.08,
      textbook: 0.03,
      impossible: 0.22,
      suspicious: 0.67,
    },
    verdictConfidence: 0.57,
    redFlag: 1.12,
    redFlagConfidence: 0.16,
  });
  assert.equal(mid.level, "uncertain");
});

test("renderSanityBadge: pass, flag, and inconclusive stay distinct", () => {
  const realDocument = globalThis.document;
  const makeElement = () => ({
    children: [],
    className: "",
    textContent: "",
    title: "",
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    setAttribute() {},
    addEventListener() {},
  });
  globalThis.document = { createElement: makeElement };
  const t = (key) =>
    ({
      sanityOk: "PASS",
      sanityFlag: "FLAG",
      sanityUncertain: "INCONCLUSIVE",
      sanityTooltip: "tooltip",
      sanityAskAdvisor: "ASK",
    })[key];
  try {
    const cases = [
      ["pass", "PASS"],
      ["flag", "FLAG"],
      ["uncertain", "INCONCLUSIVE"],
    ];
    for (const [level, text] of cases) {
      const container = makeElement();
      const badge = renderSanityBadge(container, { level }, t);
      assert.equal(badge.className, `sanity-badge sanity-${level}`);
      assert.equal(badge.textContent, text);
      assert.equal(container.children.length, 1);
    }
  } finally {
    globalThis.document = realDocument;
  }
});

test("interpretSanity: unavailable/shapeless upstreams render nothing", () => {
  assert.equal(
    interpretSanity({ available: false, reason: "key_missing" }),
    null,
  );
  assert.equal(interpretSanity({ available: true }), null);
  assert.equal(interpretSanity(null), null);
});

test("sanityState: numbers only, payback midpoint, yield from annualYieldPerKw", () => {
  const p = {
    mode: "offgrid",
    dailyKwh: 10.4,
    annualYieldPerKw: 1740,
    assumptions: { worstMonth: { averageDailyGhi: 4.51 }, meanTempC: 27 },
  };
  const entry = {
    pvKw: 6.6,
    battKwh: 13.4,
    costLo: 4200,
    costHi: 8100,
    cutPct: 90,
    paybackYearsLo: 4.2,
    paybackYearsHi: 6.1,
  };
  const st = sanityState(p, entry);
  assert.equal(st.specificYieldKwhPerKwDay, 4.767);
  assert.equal(st.worstMonthGhi, 4.51);
  assert.equal(st.paybackYears, 5.15);
  assert.ok(
    !("worstMonth" in st) && !("assumptions" in st),
    "no raw objects leak",
  );
});

test("thresholds stay within sane engineering bounds (mutation guard)", () => {
  assert.ok(
    SANITY_THRESHOLDS.flagPlausibleMax < SANITY_THRESHOLDS.passPlausibleMin,
  );
  assert.ok(
    SANITY_THRESHOLDS.passRedFlagMax < SANITY_THRESHOLDS.flagRedFlagMin,
  );
});

// ── 3. (Weather-cache regression lives in scripts/browser-smoke.mjs — see
//       header note. The fixtures above stay hermetic by design.)

// ── 4. Locale parity ─────────────────────────────────────────────────────────

test("every locale carries the sanity-* keys with non-empty strings", () => {
  const KEYS = [
    "sanityOk",
    "sanityFlag",
    "sanityAskAdvisor",
    "sanityUncertain",
    "sanityTooltip",
  ];
  for (const [loc, strings] of Object.entries(LOCALES)) {
    for (const key of KEYS) {
      assert.ok(
        typeof strings[key] === "string" && strings[key].length > 5,
        `${loc}.${key} missing or empty`,
      );
    }
  }
});
