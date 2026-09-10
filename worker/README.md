# BigEnergyCo API Worker

Cloudflare Worker handling `/api/chat` (Groq AI advisor) and `/api/health`.

## Local Development

### Prerequisites
- Node.js 22+
- `wrangler` CLI (`npm install -g wrangler` or `npx wrangler`)
- Groq API key

### Setup

1. Create `.dev.vars` in `worker/`:
   ```bash
   echo "GROQ_API_KEY=your_groq_key_here" > worker/.dev.vars
   ```

2. Start the Worker (Terminal 1):
   ```bash
   cd worker && npx wrangler dev --port 8787
   ```
   Worker runs at `http://localhost:8787`

3. Start static frontend (Terminal 2):
   ```bash
   npx serve . -p 3000
   ```
   Frontend at `http://localhost:3000`

4. Test chat at `http://localhost:3000` — calls Worker at `http://localhost:8787/api/chat`

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | Groq API key for AI chat |
| `RL_CHAT_PER_MIN` | No | Cloudflare Rate Limiting binding (auto-configured in production) |

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check + version + rate limit config |
| POST | `/api/chat` | AI chat — body: `{message, history?}` |
| OPTIONS | `/api/*` | CORS preflight |

### Rate Limits (Production)

| Scope | Limit | Window |
|-------|-------|--------|
| Per IP | 8 requests | 1 minute |
| Per IP | 150 requests | 24 hours |
| Global | 3000 requests | 24 hours |
| Message | 4000 chars | — |
| Body | 20 KB | — |

Enforced via:
- **Hard**: Cloudflare Rate Limiting binding (`RL_CHAT_PER_MIN`) — consistent across isolates
- **Soft**: In-isolate fixed-window counters (burst protection, resets on eviction)

### CORS Allowlist

Only these origins receive CORS headers:
- `https://treystu.github.io`
- `https://bigenergyco.pages.dev`
- `https://sovereign-communication.github.io`
- `http://127.0.0.1:7510` / `http://localhost:7510` (legacy Python server port)
- `http://127.0.0.1:3000` / `http://localhost:3000` (local static server)

Add new origins to `ALLOWED_ORIGINS` in `index.js`.

### Deploy

```bash
cd worker && npx wrangler deploy
```

Sets `GROQ_API_KEY` secret:
```bash
cd worker && npx wrangler secret put GROQ_API_KEY
```

### Testing

```bash
# Health check
curl http://localhost:8787/api/health

# Chat
curl -X POST -H "Content-Type: application/json" \
  -d '{"message":"Hello"}' \
  http://localhost:8787/api/chat

# CORS verify
curl -H "Origin: http://localhost:3000" \
  -v http://localhost:8787/api/health 2>&1 | grep -i access-control
```

### Architecture Notes

- **No persistent state** — rate limits in memory, reset on isolate eviction
- **Streaming responses** — auto-continues on `finish_reason: "length"` (max 2 continuations)
- **Fallback model** — tries `openai/gpt-oss-20b` if primary fails on first turn
- **Upstream retry** — one automatic backoff on Groq 429 (rate limit)
- **Disclaimer injection** — every reply gets `*Educational estimates only — verify with a licensed professional before buying or building anything.*` appended if missing