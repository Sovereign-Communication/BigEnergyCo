// ============================================================
// BigEnergyCo API — Cloudflare Worker
// Handles: POST /api/chat  (Groq AI advisor)
//          GET  /api/health
//
// Security posture:
//  - CORS locked to an explicit origin allowlist (no wildcards).
//  - In-isolate fixed-window rate limiting (best-effort first layer;
//    pair with a Cloudflare WAF rate-limiting rule for enforcement
//    that survives isolate eviction).
//  - Strict payload caps before any paid API call.
// ============================================================

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_PRIMARY_MODEL = "openai/gpt-oss-120b";
const GROQ_FALLBACK_MODEL = "openai/gpt-oss-20b";

const MAX_MESSAGE_CHARS = 4000; // reject absurd prompts outright
const MAX_BODY_BYTES = 20000; // whole JSON body ceiling (~20 KB)
const MAX_HISTORY_TURNS = 6; // never trust the client's history length
const MAX_HISTORY_MSG_CHARS = 4000;

// Mirrors proxy_server.py so local and public limits tell the same story.
const RATE_PER_IP_PER_MIN = 8;
const RATE_PER_IP_PER_DAY = 150;
const RATE_GLOBAL_PER_DAY = 3000;
const RATE_MAP_CLEAR_SIZE = 10000;

// ── Jev sanity-check (/api/jev) ─────────────────────────────────────────────
// TypeSafe's System One model returns typed probabilities, never prose. The
// CLIENT sends only engine-output numbers (no user text, no free-form fields
// — nothing to inject into); the question set is built HERE so its wording
// has exactly one owner and can never be influenced by a request body.
// Every answer ships with the model's own confidence; interpretation and
// presentation thresholds live client-side in sizing/validate.js.
const JEV_API_URL = "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = "jev-latest";
const JEV_TIMEOUT_MS = 8000; // quoted 70-500ms; generous ceiling

// Strict numeric bounds: a result outside these is not a judgment call, it is
// a malformed/hostile body (400) before any paid call happens.
const JEV_STATE_FIELDS = {
  mode: null, // handled separately: enum, not a number
  dailyKwh: [0.1, 5000],
  pvKw: [0, 10000],
  battKwh: [0, 50000], // 0 is legitimate in grid-tie mode
  costLo: [0, 100000000],
  costHi: [0, 100000000],
  cutPct: [0, 100],
  paybackYears: [0, 200],
  // Specific yield: average daily kWh produced per kWp of array AFTER
  // real-world losses (derates, soiling, thermal). Typical installed range
  // is roughly 2.5-7; the engine computes it from NASA POWER per site.
  specificYieldKwhPerKwDay: [0.1, 9],
  // Worst-month average insolation at the same site (kWh/m²/day). Seasonality
  // is the signal that judges a battery: a bank generous at a 5.8 annual
  // average can be undersized for a German January. Optional (omitted when
  // climate data is unavailable); bounds: Atacama 12.1 down to polar winter 0.
  worstMonthGhi: [0, 12.1],
  // Site mean temperature (°C) — drives battery thermal derating. Optional.
  meanTempC: [-60, 50],
};
const JEV_OPTIONAL_FIELDS = new Set(["worstMonthGhi", "meanTempC"]);

function jevQuestions(mode, worstMonthGhi) {
  const batteryRule =
    mode === "offgrid"
      ? "This is an OFF-GRID system, so a battery (battKwh) is required: battKwh of 0 or a battery too small to carry the load overnight is a red flag."
      : "This is a GRID-TIE system, so a battery is optional: battKwh of 0 can be legitimate.";
  const seasonRule =
    worstMonthGhi == null
      ? "No worst-month insolation was provided, so judge seasonality only from the annual average."
      : `Seasonality matters: the WORST month at this site averages ${worstMonthGhi.toFixed(1)} kWh/m2/day of insolation. The battery must carry the load through that darkest month, not just the annual average.`;
  return {
    physically_plausible: {
      type: "noul",
      instructions:
        "Physics check for an off-grid/grid-tie solar system: pvKw is peak solar array kW. specificYieldKwhPerKwDay is the measured average daily energy per kWp AFTER real-world losses (typical installed range 2.5-7 kWh/day). The array plus battery (battKwh, usable roughly 80-90%) must serve dailyKwh per day, with autonomy for sunless periods. " +
        batteryRule +
        " " +
        seasonRule +
        " Judge whether these numbers can physically work together.",
    },
    verdict: {
      type: "choice",
      instructions:
        "Overall engineering judgment of this solar sizing result. " +
        batteryRule +
        " " +
        seasonRule,
      criteria: {
        impossible:
          "Physically impossible or self-contradictory for these inputs",
        suspicious: "Possible but one or more values look wrong for the inputs",
        reasonable:
          "Consistent with the inputs and typical off-grid engineering practice",
        textbook: "Very close to standard rule-of-thumb sizing",
      },
    },
    red_flag: {
      type: "score",
      instructions: "How many values are physically implausible?",
      criteria: [
        "No red flags - all values consistent with the inputs",
        "One value looks off for the given inputs",
        "Multiple values physically implausible",
      ],
    },
  };
}

/**
 * Strict state validation. Returns { ok, state } or { ok: false, reason }.
 * Numbers must be finite, within bounds, and the body may contain nothing
 * beyond the known fields — extra keys are rejected, not ignored.
 */
export function validateJevState(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, reason: "body must be an object" };
  }
  const state = body.state;
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return { ok: false, reason: "state must be an object" };
  }
  const allowed = new Set(Object.keys(JEV_STATE_FIELDS));
  for (const key of Object.keys(state)) {
    if (!allowed.has(key))
      return { ok: false, reason: `unknown field: ${key}` };
  }
  if (state.mode !== "gridtie" && state.mode !== "offgrid") {
    return { ok: false, reason: "mode must be gridtie or offgrid" };
  }
  for (const [key, bounds] of Object.entries(JEV_STATE_FIELDS)) {
    if (key === "mode" || bounds === null) continue;
    const [min, max] = bounds;
    const v = state[key];
    if (v === undefined && JEV_OPTIONAL_FIELDS.has(key)) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) {
      return {
        ok: false,
        reason: `${key} must be a finite number in [${min}, ${max}]`,
      };
    }
  }
  return { ok: true, state };
}

export async function handleJevSanity(request, env, origin) {
  // Same first layers as /api/chat: origin is already resolved, payload caps
  // before any paid call, same fixed-window limiter (shared buckets).
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    return jsonResponse(
      { available: false, reason: "rate_limited" },
      429,
      origin,
      { "Retry-After": String(rl.retryAfter) },
    );
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return jsonResponse(
      { available: false, reason: "payload_too_large" },
      413,
      origin,
    );
  }
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonResponse(
      { available: false, reason: "invalid_json" },
      400,
      origin,
    );
  }
  const checked = validateJevState(body);
  if (!checked.ok) {
    return jsonResponse(
      { available: false, reason: checked.reason },
      400,
      origin,
    );
  }

  const key = env && env.TYPESAFE_API_KEY;
  if (!key) {
    // Activation is a deployment concern, not a user-facing error: the
    // client treats any non-available reply as "hide the badge, silently".
    return jsonResponse(
      { available: false, reason: "key_missing" },
      503,
      origin,
    );
  }

  // env.fetch is a test seam: undefined in production, so the global Worker
  // fetch is used there; tests inject a stub to cover the upstream mapping
  // without network access.
  const doFetch = (env && env.fetch) || fetch;
  let upstream;
  try {
    upstream = await doFetch(JEV_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(JEV_TIMEOUT_MS),
      body: JSON.stringify({
        model: JEV_MODEL,
        state: checked.state,
        questions: jevQuestions(
          checked.state.mode,
          checked.state.worstMonthGhi,
        ),
      }),
    });
  } catch {
    return jsonResponse(
      { available: false, reason: "upstream_unreachable" },
      502,
      origin,
    );
  }
  if (!upstream.ok) {
    return jsonResponse(
      { available: false, reason: "upstream_error" },
      502,
      origin,
    );
  }
  let answers;
  try {
    const payload = await upstream.json();
    answers = payload.answers;
  } catch {
    return jsonResponse(
      { available: false, reason: "upstream_invalid" },
      502,
      origin,
    );
  }
  if (
    !answers ||
    !answers.physically_plausible ||
    !answers.verdict ||
    !answers.red_flag
  ) {
    return jsonResponse(
      { available: false, reason: "upstream_shape" },
      502,
      origin,
    );
  }

  return jsonResponse(
    {
      available: true,
      model: upstream.headers.get("x-model") || JEV_MODEL,
      plausible: answers.physically_plausible.noul,
      verdict: answers.verdict.choice,
      verdictProbabilities: answers.verdict.probabilities || null,
      verdictConfidence: answers.verdict.confidence,
      redFlag: answers.red_flag.score,
      redFlagConfidence: answers.red_flag.confidence,
    },
    200,
    origin,
  );
}

// Only these origins may call this API. Anything else gets no CORS headers,
// which makes browsers refuse to read the response.
const ALLOWED_ORIGINS = new Set([
  "https://treystu.github.io",
  "https://bigenergyco.pages.dev",
  "https://freeoffgridcalculator.com",
  "https://www.freeoffgridcalculator.com",
  "https://sovereign-communication.github.io",
  "http://127.0.0.1:7510",
  "http://localhost:7510",
  "http://127.0.0.1:3000",
  "http://localhost:3000",
]);

export function getAllowedOrigin(origin) {
  return origin && ALLOWED_ORIGINS.has(origin) ? origin : null;
}

export function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function jsonResponse(data, status = 200, origin = null, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

// ── Rate limiting (in-isolate, fixed window) ────────────────────────────────
// Counters live in Worker memory and reset on isolate eviction. That makes
// them a strong brake on burst abuse and a soft daily cap — not a hard
// guarantee. For hard guarantees add a Cloudflare WAF rate-limiting rule.
const _rateLockState = {
  minute: new Map(),
  dayIp: new Map(),
  globalDay: [0, 0],
};

function _bump(bucket, limit, windowSecs, now) {
  if (now - bucket[0] >= windowSecs) {
    bucket[0] = now;
    bucket[1] = 0;
  }
  if (bucket[1] >= limit) return false;
  bucket[1] += 1;
  return true;
}

export function checkRateLimit(ip, now = Date.now() / 1000) {
  const state = _rateLockState;
  if (state.minute.size > RATE_MAP_CLEAR_SIZE) state.minute.clear();
  if (state.dayIp.size > RATE_MAP_CLEAR_SIZE) state.dayIp.clear();

  if (!_bump(state.globalDay, RATE_GLOBAL_PER_DAY, 86400, now)) {
    return { allowed: false, retryAfter: 3600 };
  }
  const minute = state.minute.get(ip) || [now, 0];
  state.minute.set(ip, minute);
  if (!_bump(minute, RATE_PER_IP_PER_MIN, 60, now)) {
    return { allowed: false, retryAfter: 60 };
  }
  const day = state.dayIp.get(ip) || [now, 0];
  state.dayIp.set(ip, day);
  if (!_bump(day, RATE_PER_IP_PER_DAY, 86400, now)) {
    return { allowed: false, retryAfter: 3600 };
  }
  return { allowed: true, retryAfter: 0 };
}

export function resetRateLimitsForTest() {
  _rateLockState.minute.clear();
  _rateLockState.dayIp.clear();
  _rateLockState.globalDay[0] = 0;
  _rateLockState.globalDay[1] = 0;
}

export function getClientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    (request.headers.get("X-Forwarded-For") || "").split(",")[0].trim() ||
    "unknown"
  );
}

export function sanitizeAndCloseReply(text) {
  if (!text || typeof text !== "string") return text;
  let cleaned = text.trimEnd();

  // 1. Close unclosed markdown code blocks
  const codeBlockCount = (cleaned.match(/```/g) || []).length;
  if (codeBlockCount % 2 !== 0) {
    cleaned += "\n```";
  }

  // 2. Remove unfinished markdown table row
  let lines = cleaned.split("\n");
  while (lines.length > 0) {
    const lastLine = lines[lines.length - 1].trim();
    if (
      lastLine.startsWith("|") &&
      (!lastLine.endsWith("|") || lastLine === "| ~")
    ) {
      lines.pop();
    } else {
      break;
    }
  }
  cleaned = lines.join("\n").trimEnd();

  // 3. Ensure sentence closes cleanly if it was cut off mid-thought
  const terminalChars = [
    ".",
    "!",
    "?",
    ":",
    "🌞",
    "⚡",
    "🌺",
    "✅",
    "👉",
    ")",
    "`",
    '"',
    "'",
    "*",
    "_",
  ];
  const lastChar = cleaned.slice(-1);
  if (lastChar && !terminalChars.includes(lastChar)) {
    const lastPunctMatch = cleaned.match(/([\.\!\?])\s+[^\.\!\?]*$/);
    if (lastPunctMatch && lastPunctMatch.index !== undefined) {
      cleaned = cleaned.slice(0, lastPunctMatch.index + 1).trimEnd();
      cleaned +=
        "\n\n*(Feel free to ask for Part 2 or let me know if you'd like to dive deeper into any of these specs! ⚡)*";
    }
  }

  return cleaned;
}

// Ground-rule backstop (README/LIABILITY): every AI reply carries a
// disclaimer at the point of output. The prompt instructs the model to
// include one, but model compliance is not enforcement — if the reply lacks
// any disclaimer marker, append the canonical footer verbatim.
export const DISCLAIMER_FOOTER =
  "*Educational estimates only — verify with a licensed professional before buying or building anything.*";

export function ensureDisclaimer(reply) {
  if (!reply || typeof reply !== "string") return reply;
  if (/educational estimates? only|licensed professional/i.test(reply))
    return reply;
  return `${reply.trimEnd()}\n\n${DISCLAIMER_FOOTER}`;
}

async function callGroq(apiKey, model, messages) {
  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "BigEnergyCo-Worker/2.1",
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: 2048,
      temperature: 0.3,
    }),
  });
  return res;
}

async function handleChat(request, env, origin) {
  const rawBody = await request.text().catch(() => "");
  if (rawBody.length > MAX_BODY_BYTES) {
    return jsonResponse({ error: "Request too large" }, 413, origin);
  }
  const body = (() => {
    try {
      return JSON.parse(rawBody);
    } catch {
      return {};
    }
  })();

  const userMsg = (typeof body.message === "string" ? body.message : "").trim();
  const rawHistory = Array.isArray(body.history)
    ? body.history.slice(-MAX_HISTORY_TURNS)
    : [];

  if (!userMsg)
    return jsonResponse({ error: "No message provided" }, 400, origin);
  if (userMsg.length > MAX_MESSAGE_CHARS) {
    return jsonResponse(
      { error: `Message too long (max ${MAX_MESSAGE_CHARS} characters)` },
      413,
      origin,
    );
  }

  // Rate limit BEFORE any paid call, including for requests that would fail later.
  // Layer 1 (hard): Cloudflare Rate Limiting binding — consistent across isolates
  // within a location. Layer 2 (soft): in-isolate daily/global counters.
  if (env.RL_CHAT_PER_MIN) {
    try {
      const rl = await env.RL_CHAT_PER_MIN.limit({
        key: "chat:" + getClientIp(request),
      });
      if (!rl.success) {
        return jsonResponse(
          {
            error:
              "Rate limit exceeded. Please wait a minute before trying again.",
          },
          429,
          origin,
          { "Retry-After": "60" },
        );
      }
    } catch {
      /* binding unavailable -> fall through to soft limits */
    }
  }
  const { allowed, retryAfter } = checkRateLimit(getClientIp(request));
  if (!allowed) {
    return jsonResponse(
      { error: "Rate limit exceeded. Please wait before trying again." },
      429,
      origin,
      { "Retry-After": String(retryAfter) },
    );
  }

  const apiKey = env.GROQ_API_KEY;
  if (!apiKey)
    return jsonResponse(
      { error: "GROQ_API_KEY secret not configured in Cloudflare Worker" },
      500,
      origin,
    );

  const history = rawHistory
    .map((m) => ({
      role: m.role === "bot" || m.role === "assistant" ? "assistant" : "user",
      content:
        typeof m.content === "string"
          ? m.content.slice(0, MAX_HISTORY_MSG_CHARS)
          : "",
    }))
    .filter((m) => m.content.trim().length > 0);

  let currentMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: userMsg },
  ];

  let usedModel = GROQ_PRIMARY_MODEL;
  let fullReply = "";
  let turns = 0;
  let retriedUpstreamBusy = false;
  const maxContinuations = 2;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  while (turns <= maxContinuations) {
    let groqRes = await callGroq(apiKey, usedModel, currentMessages);

    // Upstream rate limit (shared org TPM pool). Wait out the provider's own
    // window once, invisibly, before giving up — the free tier's 8k TPM makes
    // short busy spells routine, and one backoff turns most of them around.
    if (groqRes.status === 429 && !retriedUpstreamBusy) {
      let retryAfter = 15;
      try {
        const errBody = await groqRes.json();
        const m = /try again in ([\d.]+)s/i.exec(errBody?.error?.message || "");
        if (m) retryAfter = Math.max(3, Math.ceil(parseFloat(m[1]) + 1));
      } catch {
        /* keep default */
      }
      retriedUpstreamBusy = true;
      await sleep(Math.min(retryAfter * 1000, 25000));
      groqRes = await callGroq(apiKey, usedModel, currentMessages);

      if (groqRes.status === 429) {
        return jsonResponse(
          {
            error:
              "The AI provider is busy right now. Please try again shortly.",
          },
          503,
          origin,
          { "Retry-After": "60" },
        );
      }
    } else if (groqRes.status === 429) {
      // Already burned our one backoff: if we hold a complete-enough reply,
      // ship it rather than discarding the user's time.
      if (fullReply.length > 0) break;
      return jsonResponse(
        {
          error: "The AI provider is busy right now. Please try again shortly.",
        },
        503,
        origin,
        { "Retry-After": "30" },
      );
    }

    // Fallback to the smaller model only for other upstream failures (outage, 5xx),
    // and only before any partial output exists.
    if (!groqRes.ok && turns === 0 && usedModel === GROQ_PRIMARY_MODEL) {
      console.warn(
        `Primary model ${GROQ_PRIMARY_MODEL} failed (${groqRes.status}). Trying fallback ${GROQ_FALLBACK_MODEL}...`,
      );
      usedModel = GROQ_FALLBACK_MODEL;
      groqRes = await callGroq(apiKey, usedModel, currentMessages);
    }

    if (!groqRes.ok) {
      if (fullReply.length > 0) {
        break; // Return whatever complete text was accumulated
      }
      return jsonResponse(
        {
          error: `AI provider error (${groqRes.status}). Please try again later.`,
        },
        502,
        origin,
      );
    }

    const data = await groqRes.json();
    const choice = data.choices?.[0];
    const chunk = choice?.message?.content || "";
    const finishReason = choice?.finish_reason;

    fullReply += chunk;
    turns++;

    // If completed naturally, stop
    if (
      finishReason !== "length" ||
      !chunk.trim() ||
      turns > maxContinuations
    ) {
      break;
    }

    // Auto-continue to complete communication without truncation
    currentMessages.push({ role: "assistant", content: chunk });
    currentMessages.push({
      role: "user",
      content:
        "Continue immediately from where you stopped without repeating prior text.",
    });
  }

  const rawReply = fullReply || "No response received.";
  const reply = ensureDisclaimer(sanitizeAndCloseReply(rawReply));
  return jsonResponse(
    { reply, model: usedModel, continuations: turns - 1 },
    200,
    origin,
  );
}

export default {
  async fetch(request, env) {
    const origin = getAllowedOrigin(request.headers.get("Origin"));

    if (request.method === "OPTIONS") {
      if (!origin) return new Response(null, { status: 204 }); // no CORS headers -> browser blocks
      return new Response(null, { headers: corsHeaders(origin) });
    }

    const path = new URL(request.url).pathname;

    if (path === "/api/health" || path === "/") {
      return jsonResponse(
        {
          status: "ok",
          service: "BigEnergyCo Cloudflare Worker API",
          version: "2.1",
          model: GROQ_PRIMARY_MODEL,
          promptVersion: SYSTEM_PROMPT_VERSION,
          jevSanity: !!(env && env.TYPESAFE_API_KEY),
          rateLimits: {
            perIpPerMinute: RATE_PER_IP_PER_MIN,
            perIpPerDay: RATE_PER_IP_PER_DAY,
            globalPerDay: RATE_GLOBAL_PER_DAY,
            maxMessageChars: MAX_MESSAGE_CHARS,
            maxBodyBytes: MAX_BODY_BYTES,
          },
        },
        200,
        origin,
      );
    }

    if (path === "/api/chat" && request.method === "POST") {
      return handleChat(request, env, origin);
    }

    if (path === "/api/jev" && request.method === "POST") {
      return handleJevSanity(request, env, origin);
    }

    return jsonResponse({ error: "Not found" }, 404, origin);
  },
};

export const SYSTEM_PROMPT_VERSION = "2026-09a";
const SYSTEM_PROMPT = `You are the BigEnergyCo AI Advisor — a free educational advisor for off-grid solar and battery storage, worldwide. Today is August 2026.

SERVICE: BigEnergyCo is a free educational tool by Lucas Ballek (Hawaii). It sells nothing and offers no procurement. Cell models/brands mentioned by users are illustrative only. Educational estimates only; always recommend verification by a licensed professional before buying or building anything.

IDENTITY: You are not a person, salesperson, sourcing agent, or licensed engineer/electrician. You run on GPT-OSS via Groq; say so honestly if asked ("I'm not ChatGPT"). Never claim another brand.

TONE: Warm, Aloha-spirit, plain-spoken expert friend. Transparent about costs, limitations, risks. Specific and actionable. Occasional ⚡ emoji.

EXPERTISE: LFP prismatic cells (314Ah-class, 3.2V, ~6,000 cycles @ 80% DoD); sodium-ion (charges to about -20°C, discharges to -40°C; most packs lack UL 9540/CE listing as of Aug 2026); 16S strings (51.2V) and parallel banks; JK-class smart BMS; sea-freight logistics; full off-grid sizing (PV array, inverter, battery bank).

PRICING (Aug 2026 reference — ALWAYS give ranges AND label the scope):
- Ex-works China cells: $40-46 per 314Ah cell; cells + BMS ≈ $45-55/kWh nominal.
- Landed DDP cells (freight+duty): $60-70 each ($60-70/kWh).
- All-in landed DIY bank (cells+BMS+fusing+rack+enclosure+freight+duty): ~$95-125/kWh; destination drives most of the spread.
- Turnkey reference: Tesla Powerwall 3 ≈ $13,700 list for 13.5 kWh usable.
- Savings vs turnkey vary hugely by destination and what is counted; use ranges ("landed component costs often 60-85% lower"), never one promised number. If you don't know current local prices, say so plainly and explain how to check locally.

CHEMISTRY RULES:
- Cold sites (frequently below -10°C): LFP cannot charge below 0°C without heating → recommend sodium-ion IF genuinely purchasable in the user's country, or LFP WITH a heated/insulated enclosure; say which you'd pick and why.
- Temperate/tropical sites: LFP is the mature default (lowest cost per kWh-cycle, widest availability); sodium-ion only where locally available and certification isn't required.
- Tight space: prefer LFP (denser than sodium-ion).
- Always state certification, availability, and warranty caveats for anything you highlight.

RESPONSE LENGTH — MATCH THE QUESTION. This is the rule that overrides everything below:
- Simple factual question ("what does a BMS do?", "is sodium-ion safe?"): answer in 1-4 sentences. Done. No headers, no bullet lists, no follow-up offers.
- Practical how-to or comparison: short intro line + up to 5-7 tight bullets. Under ~120 words unless the user asked for depth.
- Genuinely big ask (full system design, multi-part): deliver the core in under ~350 words, then offer specific follow-ups instead of writing everything at once.
Never pad: no restating the question, no "great question", no summary-of-what-you-just-said, no closing paragraphs of encouragement beyond one short line. Default to the SHORTEST complete answer. Use bullet points and tables for specs.

DISCLAIMER (non-negotiable, every reply): end with this exact line on its own:
*Educational estimates only — verify with a licensed professional before buying or building anything.*`;
