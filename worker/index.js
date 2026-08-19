// ============================================================
// BigEnergyCo API — Cloudflare Worker
// Handles: POST /api/chat  (Groq AI)
//          POST /api/lead  (Google Sheets + Email)
//          GET  /api/health
// ============================================================

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL   = "llama-3.3-70b-versatile";
const CONTRACT_HASH = "AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov";

const SYSTEM_PROMPT = `You are a free, friendly AI advisor for off-grid solar and battery storage, serving people worldwide. Today's date is August 2026.

=== WHAT THIS SERVICE IS ===
This is a free educational tool given away by one individual, Lucas Ballek.
Lucas is a Hawaii-based off-grid energy advocate. He offers free AI-powered guidance and procurement consulting to help individuals achieve energy sovereignty.

=== YOUR PERSONA ===
- Warm, knowledgeable, Aloha-spirit Hawaiian off-grid expert
- You speak like a trusted friend, not a corporate salesperson
- You give real, specific, actionable answers
- You are transparent about costs, limitations, and risks

=== CORE EXPERTISE ===
- EVE MB31 LFP prismatic cells (280Ah, 3.2V nominal, 6000+ cycles to 80% DoD)
- Sodium-Ion cells (HiNa, CATL, Faradion — excellent cold weather -40°C performance)
- 16S battery string configurations (51.2V nominal), 4P/7P parallel arrangements
- JK BMS (JK-PB2A16S20P) smart active balance BMS integration
- DDP sea freight from China to Hawaii, West Coast, and global destinations
- Off-grid system sizing (solar, inverter, battery bank design)
- Cost comparisons vs Tesla Powerwall 3 (~$13,700 per 13.5kWh)

=== PRICING KNOWLEDGE (2026) ===
- EVE MB31 280Ah cells: ~$62-70 USD each direct factory DDP
- 16S4P pack (100kWh nominal, ~87kWh usable): ~$3,968 BOM
- 16S7P pack (112kWh usable): ~$6,981 BOM
- Landed cost including freight + BMS + fusing: ~$112/kWh
- Tesla Powerwall 3 equivalent savings: 85-90%

=== RESPONSE STYLE ===
- Keep responses conversational and under 200 words unless technical depth is requested
- Use bullet points for specs/numbers
- Always end with an invitation to ask follow-up questions or get a custom sizing quote
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

async function handleChat(request, env) {
  const body = await request.json().catch(() => ({}));
  const userMsg = (body.message || "").trim();
  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];

  if (!userMsg) return jsonResponse({ error: "No message provided" }, 400);
  if (!env.GROQ_API_KEY) return jsonResponse({ error: "API key not configured" }, 500);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: userMsg },
  ];

  const groqRes = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: GROQ_MODEL, messages, max_tokens: 512, temperature: 0.7 }),
  });

  if (!groqRes.ok) {
    const err = await groqRes.text();
    return jsonResponse({ error: `Groq error: ${groqRes.status}`, detail: err }, 502);
  }

  const data = await groqRes.json();
  const reply = data.choices?.[0]?.message?.content || "No response received.";
  return jsonResponse({ reply, model: GROQ_MODEL });
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
    source:   "BigEnergyCo GitHub Pages",
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

  // ── Send email notification via Mailgun ───────────────────
  if (env.MAILGUN_API_KEY && env.MAILGUN_DOMAIN && env.NOTIFY_EMAIL) {
    try {
      const emailBody = Object.entries(lead)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");

      const form = new URLSearchParams({
        from:    `BigEnergyCo Leads <leads@${env.MAILGUN_DOMAIN}>`,
        to:      env.NOTIFY_EMAIL,
        subject: `⚡ New Lead: ${lead.name} — ${lead.location}`,
        text:    `New lead from BigEnergyCo:\n\n${emailBody}`,
      });

      await fetch(`https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa("api:" + env.MAILGUN_API_KEY)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });
    } catch (e) {
      errors.push(`Email: ${e.message}`);
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
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/health" || path === "/") {
      return jsonResponse({ status: "ok", service: "BigEnergyCo API", version: "2.0" });
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
