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

const MAX_MESSAGE_CHARS = 4000;   // reject absurd prompts outright
const MAX_BODY_BYTES = 20000;     // whole JSON body ceiling (~20 KB)
const MAX_HISTORY_TURNS = 6;      // never trust the client's history length
const MAX_HISTORY_MSG_CHARS = 4000;

// Mirrors proxy_server.py so local and public limits tell the same story.
const RATE_PER_IP_PER_MIN = 8;
const RATE_PER_IP_PER_DAY = 150;
const RATE_GLOBAL_PER_DAY = 3000;
const RATE_MAP_CLEAR_SIZE = 10000;

// Only these origins may call this API. Anything else gets no CORS headers,
// which makes browsers refuse to read the response.
const ALLOWED_ORIGINS = new Set([
  "https://treystu.github.io",
  "https://bigenergyco.pages.dev",
  "http://127.0.0.1:7510",
  "http://localhost:7510",
]);

function getAllowedOrigin(origin) {
  return origin && ALLOWED_ORIGINS.has(origin) ? origin : null;
}

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
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
      ...extraHeaders,
    },
  });
}

// ── Rate limiting (in-isolate, fixed window) ────────────────────────────────
// Counters live in Worker memory and reset on isolate eviction. That makes
// them a strong brake on burst abuse and a soft daily cap — not a hard
// guarantee. For hard guarantees add a Cloudflare WAF rate-limiting rule.
const _rateLockState = { minute: new Map(), dayIp: new Map(), globalDay: [0, 0] };

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

function sanitizeAndCloseReply(text) {
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
    if (lastLine.startsWith("|") && (!lastLine.endsWith("|") || lastLine === "| ~")) {
      lines.pop();
    } else {
      break;
    }
  }
  cleaned = lines.join("\n").trimEnd();

  // 3. Ensure sentence closes cleanly if it was cut off mid-thought
  const terminalChars = [".", "!", "?", ":", "🌞", "⚡", "🌺", "✅", "👉", ")", "`", '"', "'", "*", "_"];
  const lastChar = cleaned.slice(-1);
  if (lastChar && !terminalChars.includes(lastChar)) {
    const lastPunctMatch = cleaned.match(/([\.\!\?])\s+[^\.\!\?]*$/);
    if (lastPunctMatch && lastPunctMatch.index !== undefined) {
      cleaned = cleaned.slice(0, lastPunctMatch.index + 1).trimEnd();
      cleaned += "\n\n*(Feel free to ask for Part 2 or let me know if you'd like to dive deeper into any of these specs! ⚡)*";
    }
  }

  return cleaned;
}

async function callGroq(apiKey, model, messages) {
  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "BigEnergyCo-Worker/2.1"
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: 2048,
      temperature: 0.7
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
    try { return JSON.parse(rawBody); } catch { return {}; }
  })();

  const userMsg = (typeof body.message === "string" ? body.message : "").trim();
  const rawHistory = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY_TURNS) : [];

  if (!userMsg) return jsonResponse({ error: "No message provided" }, 400, origin);
  if (userMsg.length > MAX_MESSAGE_CHARS) {
    return jsonResponse({ error: `Message too long (max ${MAX_MESSAGE_CHARS} characters)` }, 413, origin);
  }

  // Rate limit BEFORE any paid call, including for requests that would fail later.
  // Layer 1 (hard): Cloudflare Rate Limiting binding — consistent across isolates
  // within a location. Layer 2 (soft): in-isolate daily/global counters.
  if (env.RL_CHAT_PER_MIN) {
    try {
      const rl = await env.RL_CHAT_PER_MIN.limit({ key: "chat:" + getClientIp(request) });
      if (!rl.success) {
        return jsonResponse(
          { error: "Rate limit exceeded. Please wait a minute before trying again." },
          429,
          origin,
          { "Retry-After": "60" }
        );
      }
    } catch { /* binding unavailable -> fall through to soft limits */ }
  }
  const { allowed, retryAfter } = checkRateLimit(getClientIp(request));
  if (!allowed) {
    return jsonResponse(
      { error: "Rate limit exceeded. Please wait before trying again." },
      429,
      origin,
      { "Retry-After": String(retryAfter) }
    );
  }

  const apiKey = env.GROQ_API_KEY;
  if (!apiKey) return jsonResponse({ error: "GROQ_API_KEY secret not configured in Cloudflare Worker" }, 500, origin);

  const history = rawHistory.map(m => ({
    role: (m.role === 'bot' || m.role === 'assistant') ? 'assistant' : 'user',
    content: typeof m.content === 'string' ? m.content.slice(0, MAX_HISTORY_MSG_CHARS) : ''
  })).filter(m => m.content.trim().length > 0);

  let currentMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: userMsg },
  ];

  let usedModel = GROQ_PRIMARY_MODEL;
  let fullReply = "";
  let turns = 0;
  const maxContinuations = 2;

  while (turns <= maxContinuations) {
    let groqRes = await callGroq(apiKey, usedModel, currentMessages);

    // Upstream rate limit (shared org TPM pool): do NOT hammer the fallback model —
    // it draws from the same pool. Return a sanitized, retryable response.
    if (groqRes.status === 429) {
      let retryAfter = 30;
      try {
        const errBody = await groqRes.json();
        const m = /try again in ([\d.]+)s/i.exec(errBody?.error?.message || "");
        if (m) retryAfter = Math.max(5, Math.ceil(parseFloat(m[1]) + 1));
      } catch { /* keep default */ }
      return jsonResponse(
        { error: "The AI provider is busy right now. Please try again shortly." },
        503,
        origin,
        { "Retry-After": String(retryAfter) }
      );
    }

    // Fallback to the smaller model only for other upstream failures (outage, 5xx),
    // and only before any partial output exists.
    if (!groqRes.ok && turns === 0 && usedModel === GROQ_PRIMARY_MODEL) {
      console.warn(`Primary model ${GROQ_PRIMARY_MODEL} failed (${groqRes.status}). Trying fallback ${GROQ_FALLBACK_MODEL}...`);
      usedModel = GROQ_FALLBACK_MODEL;
      groqRes = await callGroq(apiKey, usedModel, currentMessages);
    }

    if (!groqRes.ok) {
      if (fullReply.length > 0) {
        break; // Return whatever complete text was accumulated
      }
      return jsonResponse({ error: `AI provider error (${groqRes.status}). Please try again later.` }, 502, origin);
    }

    const data = await groqRes.json();
    const choice = data.choices?.[0];
    const chunk = choice?.message?.content || "";
    const finishReason = choice?.finish_reason;

    fullReply += chunk;
    turns++;

    // If completed naturally, stop
    if (finishReason !== "length" || !chunk.trim() || turns > maxContinuations) {
      break;
    }

    // Auto-continue to complete communication without truncation
    currentMessages.push({ role: "assistant", content: chunk });
    currentMessages.push({
      role: "user",
      content: "Continue immediately from where you stopped without repeating prior text."
    });
  }

  const rawReply = fullReply || "No response received.";
  const reply = sanitizeAndCloseReply(rawReply);
  return jsonResponse({ reply, model: usedModel, continuations: turns - 1 }, 200, origin);
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
      return jsonResponse({
        status: "ok",
        service: "BigEnergyCo Cloudflare Worker API",
        version: "2.1",
        model: GROQ_PRIMARY_MODEL
      }, 200, origin);
    }

    if (path === "/api/chat" && request.method === "POST") {
      return handleChat(request, env, origin);
    }

    return jsonResponse({ error: "Not found" }, 404, origin);
  },
};

const SYSTEM_PROMPT = `You are the BigEnergyCo AI Advisor — a free, friendly educational advisor for off-grid solar and battery storage, serving people worldwide. Today's date is August 2026.

=== WHAT THIS SERVICE IS ===
BigEnergyCo is a free educational tool given away by one individual, Lucas Ballek, a Hawaii-based off-grid energy advocate.
It is educational only: it sells nothing, offers no products, and provides no procurement services. It informs people about ALL options, prices, and possibilities. Specific cell models or brands are illustrative examples only, never offerings.
All guidance is educational estimates only — recommend verification with a licensed professional before buying or building.

=== YOUR IDENTITY ===
- You are the BigEnergyCo AI Advisor. You are not a person, not a salesperson, not a sourcing agent, and not a licensed engineer or electrician.
- You run on GPT-OSS, OpenAI's open-weights model family, served via Groq. If asked what model you are, answer honestly: "Yes — I run on GPT-OSS, OpenAI's open-weights model, served via Groq. I'm not the ChatGPT product or service."
- Never claim to be ChatGPT or any other branded assistant.

=== YOUR PERSONA ===
- Warm, knowledgeable, Aloha-spirit Hawaiian off-grid expert
- You speak like a trusted friend, not a corporate salesperson
- You give real, specific, actionable answers
- You are transparent about costs, limitations, and risks

=== CORE EXPERTISE ===
- LFP prismatic cells (e.g., 314Ah-class, 3.2V nominal, 4,000-6,000+ cycles to 80% DoD)
- Sodium-Ion cells (e.g., HiNa, CATL, Faradion — excellent cold weather performance; most packs still lack UL 9540 / CE certification as of Aug 2026, so flag that for code-regulated jurisdictions)
- Lead-acid (AGM/gel/flooded): still what much of the world buys — cheapest upfront, ~50% usable DoD, far shorter cycle life, maintenance for flooded types. Cover it honestly when budget is the binding constraint.
- 16S battery string configurations (51.2V nominal), 4P/7P parallel arrangements
- Smart active-balance BMS integration (e.g., JK BMS class)
- Freight considerations (sea freight from China to Hawaii, US West Coast, and global destinations)
- Off-grid system sizing (solar array, inverter, battery bank design)

=== PRICING KNOWLEDGE (Aug 2026, educational reference — ALWAYS quote ranges and ALWAYS state the scope) ===
These scopes differ enormously — label every figure you give:
- Ex-works China (bare component market indications): 314Ah-class LFP cells roughly $40-46 each; cells + BMS roughly $45-55/kWh nominal.
- Landed DDP cells (incl. sea freight + duty): roughly $60-70 each, i.e. $60-70/kWh.
- All-in landed DIY bank (cells + BMS + fusing + rack + enclosure + freight + duty): roughly $95-125/kWh nominal. Destination drives most of the spread.
- Turnkey retail reference point: Tesla Powerwall 3, roughly $13,700 list for 13.5 kWh usable (~$1,000/kWh-class).
- Savings vs turnkey depend entirely on destination and on what the buyer counts (freight, duty, labor, permits, warranty risk). Give honest ranges (e.g. "landed component costs are often 60-85% lower"), never a single promised percentage.
If you don't know current prices for a market, say so plainly and explain how the user can check locally instead of inventing figures.

=== CHEMISTRY GUIDANCE PRINCIPLES ===
- Cold sites (frequently below -10°C): LFP must not be charged below 0°C without heating. Recommend sodium-ion IF genuinely purchasable in the user's country, or LFP WITH a heated/insulated enclosure — say which you'd pick and why.
- Temperate/tropical sites: LFP is the mature default (lowest cost per kWh-cycle, widest availability). Sodium-ion only where locally available and certification is not required.
- Space-constrained sites: prefer LFP over sodium-ion (higher energy density).
- Tightest budgets: cover lead-acid honestly as the low-upfront-cost option with its real drawbacks.
- Always state certification, availability, and warranty caveats for anything you highlight.

=== DYNAMIC PACING, LENGTH BUDGET & MULTI-PART PROTOCOL ===
- Operational Length Budget: Aim for concise, high-density responses (typically 350–700 words, maximum ~1,000 words per response).
- Self-Balancing & Relevance: Dynamically assess how complex the question is against your length budget. Be crisp, direct, and high-signal; avoid repetitive prose or bloated preambles.
- Multi-Part Protocol for Massive Requests: If the user asks for a very broad or multi-layered build (e.g. asking for sizing + full wiring diagrams + BMS programming + inverter configuration + code permits all in one prompt), do NOT try to write an unreadable encyclopedia at once. Instead:
  * Open cleanly: "Off-grid setups have several key layers, so I've structured this into a clear, actionable overview (Part 1). Whenever you're ready, just ask for Part 2 to cover [wiring / schematics / permits]!"
  * Deliver the primary core calculation, sizing breakdown, chemistry recommendation, and BOM table fully.
  * Clearly offer specific next-step questions the user can ask to trigger Part 2.
- Never Cut Off Mid-Thought: Every response MUST conclude cleanly with a complete sentence, proper markdown table closing, and sign-off. Never leave a hanging sentence, dangling bullet point, or unclosed table.
- Use bullet points and tables for specs/numbers.
- Always end with an invitation to ask follow-up questions, and point to the free estimator at https://treystu.github.io/BigEnergyCo/ for sizing.
- Use ⚡ emoji occasionally for energy topics.`;
