"""
BigEnergyCo Proxy Server v2
============================
Runs on port 7510 — proxies Freenet (7509) with /api/* handled locally.

KEY TECHNIQUE: Rewrites Freenet's hardcoded CSP header which locks
connect-src to port 7509. Without this rewrite, all fetch() calls
from inside the Freenet iframe fail with CORS/CSP errors.

Usage: python proxy_server.py
URL:   http://127.0.0.1:7510/v1/contract/web/AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov/
"""

import http.server
import socketserver
import json
import os
import re
import urllib.parse
import urllib.request
import urllib.error
import datetime
import threading
import sys
import socket
import time

sys.stdout.reconfigure(encoding='utf-8')

PROXY_PORT = 7510
FREENET_PORT = 7509
FREENET_HOST = "127.0.0.1"
DIRECTORY = r"c:\Users\SCM\Documents\GitHub\BigEnergyCo"

# ── Abuse limits ──────────────────────────────────────────────────────────────
# /api/chat is a public, unauthenticated path to a paid-quota LLM key. Without
# these it is an open proxy that anyone can drain. Tuned to be invisible to a
# real person and painful to a script.
MAX_MESSAGE_CHARS = 4000       # reject absurd prompts outright
MAX_HISTORY_TURNS = 6          # never trust the client's history length
RATE_PER_IP_PER_MIN = 8        # burst allowance for one human
RATE_PER_IP_PER_DAY = 150      # daily ceiling per address
RATE_GLOBAL_PER_DAY = 3000     # total daily ceiling across everyone

_rate_lock = threading.Lock()
_ip_minute = {}                # ip -> [window_start_epoch, count]
_ip_day = {}                   # ip -> [window_start_epoch, count]
_global_day = [0.0, 0]         # [window_start_epoch, count]


def _bump(bucket, limit, window_secs, now):
    """Fixed-window counter. Returns True if the request is allowed."""
    if now - bucket[0] >= window_secs:
        bucket[0], bucket[1] = now, 0
    if bucket[1] >= limit:
        return False
    bucket[1] += 1
    return True


def check_rate_limit(ip):
    """Returns (allowed: bool, retry_after_secs: int)."""
    now = time.time()
    with _rate_lock:
        # Keep the per-IP maps from growing without bound.
        if len(_ip_minute) > 10000:
            _ip_minute.clear()
        if len(_ip_day) > 10000:
            _ip_day.clear()

        if not _bump(_global_day, RATE_GLOBAL_PER_DAY, 86400, now):
            return False, 3600

        minute = _ip_minute.setdefault(ip, [now, 0])
        if not _bump(minute, RATE_PER_IP_PER_MIN, 60, now):
            return False, 60

        day = _ip_day.setdefault(ip, [now, 0])
        if not _bump(day, RATE_PER_IP_PER_DAY, 86400, now):
            return False, 3600

    return True, 0


def validate_groq_response(reply_text):
    """Light validation of Groq response. Logs warnings, doesn't block."""
    warnings = []

    # Check 1: Lead-Acid without cost-of-ownership analysis
    if 'lead' in reply_text.lower() and 'acid' in reply_text.lower():
        has_tco = any(x in reply_text.lower() for x in ['replacement', 'years', 'lifespan', 'cost', 'expensive'])
        if not has_tco:
            warnings.append("[VALIDATION] Lead-Acid mentioned but no lifespan/cost-of-ownership analysis")

    # Check 2: Pricing with false precision (e.g., $1234.56 without context)
    prices = re.findall(r'\$[0-9,]+\.[0-9]{2,}(?!\s*-|\s*/|\s*\()', reply_text)
    if prices:
        warnings.append(f"[VALIDATION] High-precision prices found: {prices} (should be ranges or rounded)")

    # Check 3: Impossible cycle life numbers (sanity check)
    cycles = re.findall(r'([0-9]{2,}),?([0-9]{3})(?:\s|-)?cycles', reply_text, re.IGNORECASE)
    if cycles:
        for cycle_match in cycles:
            cycle_count = int(cycle_match[0] + cycle_match[1])
            if cycle_count > 50000:
                warnings.append(f"[VALIDATION] Suspiciously high cycle count ({cycle_count:,}) - verify Groq understands verified 2026 specs")

    for w in warnings:
        print(w)

    return reply_text  # Always return, validation is advisory only

# Freenet long-polling / streaming URL prefixes we should NOT attempt to buffer
STREAMING_PREFIXES = (
    '/v1/contract/subscribe',
    '/v1/node',
    '/v1/network',
    '/v1/peer',
    '/v1/topology',
)

def get_system_groq_key():
    env_key = os.environ.get('GROQ_API_KEY')
    if env_key:
        return env_key
    groq_env_file = os.path.expanduser(r"C:\Users\SCM\.config\scmorc\groq.env")
    if os.path.exists(groq_env_file):
        try:
            with open(groq_env_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip().startswith('GROQ_API_KEY='):
                        return line.strip().split('=', 1)[1].strip().strip('"').strip("'")
        except Exception:
            pass
    return None

def process_bot_query(user_msg, history=[]):
    groq_key = get_system_groq_key()

    system_instruction = (
        "You are a free, friendly AI advisor for off-grid solar and battery storage, "
        "serving people worldwide. Today's date is August 1, 2026.\n\n"

        "=== WHAT THIS SERVICE IS ===\n"
        "This is a free educational tool given away by one individual, Lucas Ballek.\n"
        "- NOTHING IS FOR SALE. No procurement, sourcing, consulting fees, or procurement pipeline.\n"
        "- If the user wants to buy, point them to ordinary local suppliers. You take no cut.\n"
        "- Optional donations exist but NEVER solicit them. Donating does not improve answers.\n\n"

        "=== HOW TO ANSWER ===\n"
        "1. BE WARM AND DIRECT: Answer greetings and small talk naturally. Don't dump boilerplate.\n"
        "2. SERVE THE WORLD:\n"
        "   - Ask for or respect the user's country/region.\n"
        "   - Remember: most of the world runs 230V/50Hz, not 120V/60Hz.\n"
        "   - Use metric by default unless the user clearly uses imperial.\n"
        "   - Lead-Acid may still be what many people can actually buy—don't dismiss it.\n"
        "3. REPLY IN THE USER'S LANGUAGE.\n\n"

        "=== BATTERY CHEMISTRY GUIDANCE (THIS MATTERS) ===\n"
        "When the user asks 'which battery should I choose?' or you're sizing a system:\n\n"
        "PRIMARY: SODIUM-ION (NaIon)\n"
        "- Cost: ~$38-42/kWh (now price-competitive with LFP; verified August 2026).\n"
        "- Cycle life: 10,000-15,000 cycles @ 80% capacity (CATL 15,000; BYD 10,000; verified data).\n"
        "- Lifespan: ~30-50 years at typical 300 cycles/year (realistic: 27-33 years).\n"
        "- Environment: ~40% lower carbon footprint than Lithium mining; sodium abundant.\n"
        "- Temperature: EXCELLENT cold performance (-40 to -50°C)—better than LFP.\n"
        "- Space: Bulkier for same capacity, but home storage penalty <2-3 sq ft—negligible.\n"
        "- Limitation: Not UL 9540-certified yet (as of August 2026); certification expected 2026-2027.\n"
        "- When to recommend: User is in ANY climate (especially cold), or cares about environment/cost.\n"
        "- RULE: This is the DEFAULT choice. Recommend Sodium-Ion unless user MUST have UL 9540 cert TODAY.\n\n"

        "SECONDARY: LITHIUM (LFP preferred)\n"
        "- Cost: ~20-30% more than Sodium-Ion (parity projected 2027).\n"
        "- Cycle life: 6,000-10,000 cycles @ 80% capacity (premium: up to 14,000; verified August 2026).\n"
        "- Lifespan: ~16-33 years at typical 300 cycles/year (assumes 50-80% depth-of-discharge).\n"
        "- Temperature: Stable to -20°C; degradation below 0°C; LESS cold-hardy than Sodium-Ion.\n"
        "- Space: Compact—good for RVs, boats, apartments.\n"
        "- Regulation: UL 9540-certified; required for US residential (Tesla Powerwall 3 now LFP).\n"
        "- When to recommend: User MUST have UL 9540 cert TODAY, OR user in cold climate, OR space-constrained.\n"
        "- RULE: If you recommend Lithium, ALWAYS explain why: 'Lithium is UL 9540-certified for residential "
        "use and works better in cold climates. It costs 20-30% more and lasts 20-25 years vs. 30+ for "
        "Sodium-Ion. Sodium-Ion will be the better choice once certified, but Lithium is the safer pick "
        "today for US homes.'\n\n"

        "TERTIARY: LEAD-ACID (rare use only)\n"
        "- Cost: $10-15/kWh upfront (cheapest initial price—but deceptive).\n"
        "- Cycle life: 1,000-1,500 cycles @ 50% DoD (flooded); 300-1,000 AGM (verified August 2026).\n"
        "- Real lifespan: 3-5 years at typical 300 cycles/year, 50% DoD (half what users expect).\n"
        "- True cost of ownership: $30-40/kWh amortized over 10 years (accounting for replacements).\n"
        "- Maintenance: High (water top-up every 1-3 months, equalization, battery acid safety).\n"
        "- Depth of Discharge critical: At 80%+ DoD, cycle life drops to 500-700 cycles (almost worthless).\n"
        "- Recycling: 99% recyclable; excellent infrastructure in most countries.\n"
        "- When to recommend: VERY RARELY. Only if user has ZERO budget AND can do monthly maintenance.\n"
        "- RULE: When a user asks about Lead-Acid, say: 'Lead-Acid costs less upfront ($10-15/kWh) but dies "
        "in 3-5 years. You'll replace it 2-3 times in 10 years, totaling $30-40/kWh—the SAME as Sodium-Ion. "
        "But Sodium-Ion lasts 30+ years AND requires zero maintenance. Strongly recommend Sodium-Ion instead. "
        "If budget is truly the issue, let's talk about system design (smaller size, lower autonomy) to reduce "
        "upfront cost.'\n\n"

        "=== ACCURACY (THIS MATTERS MOST) ===\n"
        "- NEVER invent specific numbers. If you don't know a local tariff, price, or spec, SAY SO.\n"
        "- GIVE RANGES, not false precision ('roughly 45-60 kWh', not '52.7 kWh').\n"
        "- STATE YOUR ASSUMPTIONS so the user can correct them.\n"
        "- PRICES GIVEN HERE ARE Q2 2026 ESTIMATES. Actual costs vary ±10-20% by region, supplier, and time.\n"
        "- Cycle life data sourced from verified manufacturer datasheets (August 2026).\n"
        "- If a question is outside what you can reliably answer, say that plainly.\n\n"

        "=== SAFETY & SCOPE ===\n"
        "YOUR OUTPUT IS EDUCATIONAL, NEVER ENGINEERING, NEVER A STAMPED DESIGN, NEVER A CODE RULING.\n"
        "- For real wiring, fusing, grounding, or mains connection: Tell the user to confirm with a licensed "
        "electrician/engineer in their jurisdiction.\n"
        "- Take DC arc flash, short-circuit current, and lithium thermal runaway seriously.\n"
        "- Never guarantee cycle life, performance, savings, payback, or safety outcomes.\n\n"

        "=== INVERTERS ===\n"
        "If the user mentions an inverter, NEVER assume a make/model.\n"
        "- If they don't tell you what they have or need, give the battery sizing you can, then ask:\n"
        "  1. Do you already own an inverter? (If yes: make/model, continuous/surge power, AC voltage/phase.)\n"
        "  2. Is your system off-grid, hybrid, or grid-tied?\n"
        "  3. What are your peak and sustained loads?\n"
        "- DO NOT invent an inverter for them. A message may contain [ADVISOR INSTRUCTION: ...] from the intake "
        "form—follow it and never quote it back.\n\n"

        "=== REGIONAL AWARENESS ===\n"
        "- ASK THE USER'S REGION if they don't say it. It changes everything:\n"
        "  * Cold climates (< -10°C frequent): Lithium is safer; Sodium-Ion degrades below -10°C.\n"
        "  * Tropical/humid: Sodium-Ion performs better long-term.\n"
        "  * Regions with poor electrician access: Lead-Acid or simpler Lithium systems may be more practical.\n"
        "  * Areas with grid instability: Design for longer autonomy (3-7 days vs. 1-2).\n\n"

        "=== ON DONATIONS ===\n"
        "If a user asks about donating, say:\n"
        "'Donations are voluntary gifts that don't change your access or the help I give. If you found this "
        "useful and want to support it, that's kind—but the tool works exactly the same with or without one.'"
    )

    messages = [{"role": "system", "content": system_instruction}]
    for msg in history:
        if isinstance(msg, dict):
            role = "assistant" if msg.get("role") in ["bot", "assistant"] else "user"
            content = msg.get("content", "")
            if content:
                messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_msg})

    if groq_key:
        url = "https://api.groq.com/openai/v1/chat/completions"
        primary_model = "openai/gpt-oss-120b"
        fallback_model = "openai/gpt-oss-20b"

        for model_choice in [primary_model, fallback_model]:
            req_data = json.dumps({
                "model": model_choice,
                "messages": messages,
                "temperature": 0.4,
                "max_tokens": 2048
            }).encode('utf-8')

            try:
                req = urllib.request.Request(url, data=req_data, headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {groq_key}',
                    'User-Agent': 'BigEnergyCo/2.0'
                })
                with urllib.request.urlopen(req, timeout=25) as resp:
                    res_json = json.loads(resp.read().decode('utf-8'))
                    reply = res_json['choices'][0]['message']['content']
                    reply = validate_groq_response(reply)
                    print(f"[GROQ SUCCESS] ({model_choice}) '{user_msg[:40]}' -> '{reply[:60]}...'")
                    return {"status": "success", "reply": reply, "engine": f"Groq {model_choice}"}
            except Exception as e:
                print(f"[GROQ API ERROR ({model_choice})] {e}")

    return {
        "status": "success",
        "reply": "Aloha! I am the BigEnergyCo Senior Sourcing Advisor. How can I help you today?",
        "engine": "Fallback"
    }


def _rewrite_csp(csp_value):
    """Rewrite Freenet's locked CSP to allow fetch from port 7510."""
    # Replace all hard-coded 7509 references with 7510
    new_csp = csp_value.replace(f'127.0.0.1:{FREENET_PORT}', f'127.0.0.1:{PROXY_PORT}')
    # Add 'self' to connect-src so same-origin fetch works
    if 'connect-src' in new_csp:
        new_csp = new_csp.replace("connect-src ", "connect-src 'self' ")
    else:
        new_csp += "; connect-src 'self'"
    print(f"[CSP REWRITE] {new_csp[:140]}...")
    return new_csp


def _rewrite_html_body(html_text):
    """Rewrite the HTML response body."""
    # Replace all 7509 port references
    html_text = html_text.replace(f'127.0.0.1:{FREENET_PORT}', f'127.0.0.1:{PROXY_PORT}')
    # Inject allow-same-origin into iframe sandbox
    html_text = re.sub(
        r'(sandbox=")(allow-scripts[^"]*?)(")',
        lambda m: m.group(1) + m.group(2) + ' allow-same-origin' + m.group(3),
        html_text
    )
    return html_text


class ProxyHandler(http.server.BaseHTTPRequestHandler):
    timeout = 30

    def log_message(self, format, *args):
        # Suppress Freenet's high-frequency polling noise
        path = self.path.split('?')[0]
        if any(path.startswith(p) for p in STREAMING_PREFIXES):
            return
        print(f"[PROXY] {format % args}")

    def _client_ip(self):
        # Behind cloudflared, the real client is in CF-Connecting-IP.
        for header in ('CF-Connecting-IP', 'X-Forwarded-For'):
            val = self.headers.get(header)
            if val:
                return val.split(',')[0].strip()
        return self.client_address[0]

    def _send_cors_headers(self):
        # The page is served same-origin, so it needs no cross-origin grant.
        # Freenet-hosted copies fetch cross-origin, so allow that one origin back in.
        origin = self.headers.get('Origin', '')
        if origin and (origin.startswith('http://127.0.0.1:') or origin.startswith('http://localhost:')):
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _send_json(self, data, status=200):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # Health check
        if path == '/api/health':
            self._send_json({"status": "ok", "proxy": True, "port": PROXY_PORT})
            return

        # NOTE: the old /api/jsonp bridge was removed — it reached the LLM without
        # passing through the rate limiter, which made the limits on /api/chat moot.

        # GET /api/chat (plain JSON)
        if path == '/api/chat':
            self._handle_chat({'message': query.get('message', [''])[0]})
            return

        if path.startswith('/api/'):
            self._send_json({"status": "error", "message": "Not found"}, status=404)
            return

        # Serve clean standalone index.html directly for Web viewers accessing root or contract main URL
        if path == '/' or (path.startswith('/v1/contract/web/') and '__sandbox=1' not in parsed.query and not path.endswith('.css') and not path.endswith('.js')):
            index_path = os.path.join(DIRECTORY, 'index.html')
            if os.path.exists(index_path):
                with open(index_path, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(content)))
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(content)
                return

        # All other requests → proxy to Freenet
        self._proxy_to_freenet('GET')

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body_bytes = self.rfile.read(content_length) if content_length > 0 else b''
            payload = json.loads(body_bytes.decode('utf-8')) if body_bytes else {}
        except Exception:
            payload = {}

        if path == '/api/chat':
            self._handle_chat(payload)
            return

        # Retired endpoints (e.g. the old /api/lead) must 404 rather than fall
        # through to Freenet, which would just hang until the proxy times out.
        if path.startswith('/api/'):
            self._send_json({"status": "error", "message": "Not found"}, status=404)
            return

        self._proxy_to_freenet('POST')

    def _handle_chat(self, payload):
        """Rate-limited, size-capped entry point to the LLM."""
        ip = self._client_ip()
        allowed, retry_after = check_rate_limit(ip)
        if not allowed:
            print(f"[RATE LIMIT] {ip}")
            self.send_response(429)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Retry-After', str(retry_after))
            body = json.dumps({
                "status": "rate_limited",
                "reply": "You've hit the usage limit for this free tool — it runs on one "
                         "person's own AI budget. Please try again a bit later."
            }).encode('utf-8')
            self.send_header('Content-Length', str(len(body)))
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(body)
            return

        message = str(payload.get('message', ''))[:MAX_MESSAGE_CHARS]
        if not message.strip():
            self._send_json({"status": "error", "reply": "Please type a question first."})
            return

        # Never trust the client's history — cap count and per-entry size here.
        raw_history = payload.get('history', [])
        history = raw_history[-MAX_HISTORY_TURNS:] if isinstance(raw_history, list) else []
        history = [
            {"role": h.get("role", "user"), "content": str(h.get("content", ""))[:MAX_MESSAGE_CHARS]}
            for h in history if isinstance(h, dict)
        ]

        self._send_json(process_bot_query(message, history))

    def _proxy_to_freenet(self, method='GET'):
        """Forward request to Freenet on port 7509, rewriting CSP headers and HTML body.

        The critical rewrites:
        1. CSP header: Freenet hardcodes 'connect-src http://127.0.0.1:7509' which blocks
           fetch() from our iframe to port 7510. We rewrite it to 7510 + 'self'.
        2. HTML body: Replace 7509 -> 7510 + inject allow-same-origin into iframe sandbox.
        """
        target_url = f"http://{FREENET_HOST}:{FREENET_PORT}{self.path}"
        is_streaming = any(self.path.split('?')[0].startswith(p) for p in STREAMING_PREFIXES)

        try:
            # Build request to Freenet
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length) if content_length > 0 else None

            fwd_headers = {}
            for key, val in self.headers.items():
                if key.lower() in ('host', 'connection', 'keep-alive', 'proxy-connection',
                                   'transfer-encoding', 'content-length'):
                    continue
                fwd_headers[key] = val
            fwd_headers['Host'] = f"{FREENET_HOST}:{FREENET_PORT}"
            fwd_headers['Connection'] = 'close'

            req = urllib.request.Request(target_url, data=body, headers=fwd_headers, method=method)

            # Longer timeout for streaming Freenet internal paths
            timeout_val = 5 if is_streaming else 20

            with urllib.request.urlopen(req, timeout=timeout_val) as resp:
                status = resp.status
                resp_headers = list(resp.headers.items())
                content_type = resp.headers.get('Content-Type', '')
                raw_body = resp.read()

            # --- Rewrite HTML/JS/JSON body ---
            is_text = any(t in content_type for t in ('text/', 'javascript', 'json'))
            if is_text:
                try:
                    text = raw_body.decode('utf-8', errors='replace')
                    text = _rewrite_html_body(text)
                    raw_body = text.encode('utf-8')
                except Exception as e:
                    print(f"[PROXY BODY REWRITE ERR] {e}")

            # --- Rewrite response headers ---
            self.send_response(status)
            for key, val in resp_headers:
                low = key.lower()
                if low in ('transfer-encoding', 'connection', 'keep-alive', 'content-length'):
                    continue
                if low == 'content-security-policy':
                    val = _rewrite_csp(val)
                self.send_header(key, val)
            self.send_header('Content-Length', str(len(raw_body)))
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(raw_body)

        except (TimeoutError, socket.timeout, urllib.error.URLError) as e:
            # Freenet has some long-polling endpoints that timeout — treat gracefully
            if not is_streaming:
                print(f"[PROXY TIMEOUT] {target_url}: {e}")
            try:
                self.send_response(504)
                self.send_header('Content-Type', 'text/plain')
                self.send_header('Content-Length', '12')
                self.end_headers()
                self.wfile.write(b'Gateway Timeout')
            except Exception:
                pass
        except Exception as e:
            print(f"[PROXY ERROR] {target_url}: {e}")
            try:
                msg = f"Proxy error: {e}".encode('utf-8')
                self.send_response(502)
                self.send_header('Content-Type', 'text/plain')
                self.send_header('Content-Length', str(len(msg)))
                self.end_headers()
                self.wfile.write(msg)
            except Exception:
                pass


class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True

    def handle_error(self, request, client_address):
        # Suppress socket reset / client disconnect error traces
        pass


if __name__ == "__main__":
    with ThreadedTCPServer(("", PROXY_PORT), ProxyHandler) as httpd:
        print(f"[BigEnergyCo Proxy v2] Running on http://127.0.0.1:{PROXY_PORT}/")
        print(f"[BigEnergyCo Proxy v2] Freenet: http://{FREENET_HOST}:{FREENET_PORT}/")
        print(f"[BigEnergyCo Proxy v2] Groq AI: /api/chat (rate limited: "
              f"{RATE_PER_IP_PER_MIN}/min, {RATE_PER_IP_PER_DAY}/day per IP, "
              f"{RATE_GLOBAL_PER_DAY}/day total)")
        print(f"[BigEnergyCo Proxy v2] Lead capture REMOVED — no personal data is collected")
        print(f"[BigEnergyCo Proxy v2] KEY FIX: CSP header rewrite 7509->7510 + allow-same-origin sandbox")
        print(f"[BigEnergyCo Proxy v2] App URL: http://127.0.0.1:{PROXY_PORT}/v1/contract/web/AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov/")
        try:
            httpd.serve_forever()
        except Exception:
            pass
