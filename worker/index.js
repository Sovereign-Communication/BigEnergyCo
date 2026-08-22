// ============================================================
// BigEnergyCo API — Cloudflare Worker
// Handles: POST /api/chat  (Groq AI with rotated 2026 models)
//          POST /api/lead  (Google Sheets + Email Webhook)
//          GET  /api/health
// ============================================================

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_PRIMARY_MODEL = "openai/gpt-oss-120b";
const GROQ_FALLBACK_MODEL = "openai/gpt-oss-20b";

const SYSTEM_PROMPT = `You are the BigEnergyCo AI Advisor — a free, friendly educational advisor for off-grid solar and battery storage, serving people worldwide. Today's date is August 2026.

=== WHAT THIS SERVICE IS ===
BigEnergyCo is a free educational tool given away by one individual, Lucas Ballek, a Hawaii-based off-grid energy advocate.
It is educational only: it sells nothing, offers no products, and provides no procurement services. It informs people about ALL options, prices, and possibilities. Specific cell models or brands are illustrative examples only, never offerings.
All guidance is educational estimates only — recommend verification with a licensed professional before buying or building.

=== YOUR IDENTITY ===
- You are the BigEnergyCo AI Advisor. You are not a person, not a salesperson, and not a licensed engineer or electrician.
- You run on GPT-OSS, OpenAI's open-weights model family, served via Groq. If asked what model you are, answer honestly: "Yes — I run on GPT-OSS, OpenAI's open-weights model, served via Groq. I'm not the ChatGPT product or service."
- Never claim to be ChatGPT or any other branded assistant.

=== YOUR PERSONA ===
- Warm, knowledgeable, Aloha-spirit Hawaiian off-grid expert
- You speak like a trusted friend, not a corporate salesperson
- You give real, specific, actionable answers
- You are transparent about costs, limitations, and risks

=== CORE EXPERTISE ===
- LFP prismatic cells (e.g., 314Ah-class, 3.2V nominal, 4,000-6,000+ cycles to 80% DoD)
- Sodium-Ion cells (e.g., HiNa, CATL, Faradion — excellent cold weather performance to about -40°C)
- 16S battery string configurations (51.2V nominal), 4P/7P parallel arrangements
- Smart active-balance BMS integration (e.g., JK BMS class)
- Freight considerations (DDP sea freight from China to Hawaii, West Coast, and global destinations)
- Off-grid system sizing (solar, inverter, battery bank design)
- Cost comparisons vs turnkey systems like Tesla Powerwall 3 (~$13,700 per 13.5kWh)

=== PRICING KNOWLEDGE (2026, educational reference — prices vary by market) ===
- 314Ah-class LFP cells: ~$62-70 USD each direct factory DDP
- 16S4P pack (100kWh nominal, ~87kWh usable): ~$3,968 BOM
- 16S7P pack (112kWh usable): ~$6,981 BOM
- Landed cost including freight + BMS + fusing: ~$112/kWh
- Typical savings vs turnkey equivalents: 85-90%

=== RESPONSE STYLE ===
- Keep responses conversational and under 200 words unless technical depth is requested
- Use bullet points for specs/numbers
- Always end with an invitation to ask follow-up questions, and point to the free estimator at https://treystu.github.io/BigEnergyCo/ for sizing
- Use ⚡ emoji occasionally for energy topics`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function callGroq(apiKey, model, messages) {
  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "BigEnergyCo-Worker/2.0"
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

async function handleChat(request, env) {
  const body = await request.json().catch(() => ({}));
  const userMsg = (body.message || "").trim();
  const rawHistory = Array.isArray(body.history) ? body.history.slice(-6) : [];

  if (!userMsg) return jsonResponse({ error: "No message provided" }, 400);
  
  const apiKey = env.GROQ_API_KEY;
  if (!apiKey) return jsonResponse({ error: "GROQ_API_KEY secret not configured in Cloudflare Worker" }, 500);

  const history = rawHistory.map(m => ({
    role: (m.role === 'bot' || m.role === 'assistant') ? 'assistant' : 'user',
    content: typeof m.content === 'string' ? m.content : ''
  })).filter(m => m.content.trim().length > 0);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: userMsg },
  ];

  // Try primary model
  let groqRes = await callGroq(apiKey, GROQ_PRIMARY_MODEL, messages);
  let usedModel = GROQ_PRIMARY_MODEL;

  // Fallback if primary fails
  if (!groqRes.ok) {
    console.warn(`Primary model ${GROQ_PRIMARY_MODEL} failed (${groqRes.status}). Trying fallback ${GROQ_FALLBACK_MODEL}...`);
    groqRes = await callGroq(apiKey, GROQ_FALLBACK_MODEL, messages);
    usedModel = GROQ_FALLBACK_MODEL;
  }

  if (!groqRes.ok) {
    const errText = await groqRes.text();
    return jsonResponse({ error: `Groq API error (${groqRes.status})`, detail: errText }, 502);
  }

  const data = await groqRes.json();
  const reply = data.choices?.[0]?.message?.content || "No response received.";
  return jsonResponse({ reply, model: usedModel });
}

async function handleLead(request, env) {
  const body = await request.json().catch(() => ({}));
  const lead = {
    timestamp: new Date().toISOString(),
    name:     (body.name     || "Anonymous").trim(),
    email:    (body.email    || "").trim(),
    phone:    (body.phone    || "").trim(),
    capacity: (body.capacity || "Not specified").trim(),
    location: (body.location || "Global").trim(),
    notes:    (body.notes    || "").trim(),
    source:   "BigEnergyCo Global Platform",
  };

  const errors = [];

  // ── Forward to Google Sheets Apps Script webhook ──────────
  if (env.SHEETS_WEBHOOK_URL) {
    try {
      await fetch(env.SHEETS_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
    } catch (e) {
      errors.push(`Sheets: ${e.message}`);
    }
  }

  return jsonResponse({
    status: "success",
    message: "✅ Thank you! Your follow-up request has been recorded. Our Senior Energy Engineer will reach out directly.",
    errors: errors.length ? errors : undefined,
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/health" || path === "/") {
      return jsonResponse({
        status: "ok",
        service: "BigEnergyCo Cloudflare Worker API",
        version: "2.0",
        model: GROQ_PRIMARY_MODEL
      });
    }

    if (path === "/api/chat" && request.method === "POST") {
      return handleChat(request, env);
    }

    if (path === "/api/lead" && request.method === "POST") {
      return handleLead(request, env);
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
};
