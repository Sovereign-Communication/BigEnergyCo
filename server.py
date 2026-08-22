import http.server
import socketserver
import json
import os
import urllib.parse
import math
import sys
import re
import datetime
import hashlib
import base64
import struct
import threading

# Ensure UTF-8 output encoding for Windows terminal
sys.stdout.reconfigure(encoding='utf-8')

PORT = 3000
DIRECTORY = r"c:\Users\SCM\Documents\GitHub\BigEnergyCo"
LEADS_FILE = os.path.join(DIRECTORY, "leads.jsonl")

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
        "You are the BigEnergyCo Senior Sourcing Advisor, a 100% autonomous off-grid energy, battery electrochemistry engineer, and direct-factory procurement AI assistant powered by Groq (Llama-3.3-70b).\n"
        "Today's date is August 1, 2026.\n\n"
        "YOUR ROLE & PERSONALITY:\n"
        "- Friendly, highly knowledgeable, professional off-grid energy consultant based in Hawaii.\n"
        "- Answer ANY question naturally, conversationally, and accurately (e.g. greetings like 'hi', general questions like 'what\'s today\'s date?', technical battery questions about EVE MB31 314Ah LFP cells, Sodium-Ion vs LFP performance, JK BMS 200A active balance, Eaton Class-T fuses, 16S4P/16S7P string configurations, UN3480 DDP ocean freight, or system sizing).\n"
        "- If the user asks for a battery quote, capacity sizing, or mentions an electric bill / kWh storage target, provide real landed engineering estimates based on ~$100/kWh landed for LFP ($43.50/cell) or ~$130/kWh landed for Sodium-Ion ($32/cell) vs $850/kWh Tesla Powerwall 3 retail baseline.\n"
        "- NEVER output rigid repetitive boilerplate templates for simple greetings or non-sizing questions! Respond fluidly and directly like an expert human engineer."
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
        import urllib.request
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
                    print(f"[GROQ SUCCESS] Prompt: '{user_msg[:40]}' -> Reply: '{reply[:60]}...'")
                    return {"status": "success", "reply": reply, "engine": f"Groq {model_choice}"}
            except Exception as e:
                print(f"[GROQ API ERROR ({model_choice})] {e}")

    reply = "Aloha! I am the BigEnergyCo Senior Sourcing Advisor. How can I help you size or source your off-grid battery array today?"
    return {"status": "success", "reply": reply, "engine": "Fallback Advisor"}

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True

class RealBigEnergyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)

        # JSONP Web-Bridge Endpoint for Freenet CSP Passthrough
        if parsed.path in ['/api/jsonp', '/api/chat_jsonp']:
            callback = query.get('callback', ['handleGroqResponse'])[0]
            prompt = query.get('prompt', [''])[0]
            history_raw = query.get('history', ['[]'])[0]
            try:
                history = json.loads(history_raw)
            except Exception:
                history = []

            print(f"[JSONP BRIDGE PROMPT] '{prompt}'")
            res = process_bot_query(prompt, history)
            json_payload = json.dumps(res)
            js_code = f"{callback}({json_payload});"

            self.send_response(200)
            self.send_header('Content-Type', 'application/javascript; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Private-Network', 'true')
            self.end_headers()
            self.wfile.write(js_code.encode('utf-8'))
            return

        if self.headers.get('Upgrade', '').lower() == 'websocket':
            self.handle_websocket()
            return

        super().do_GET()

    def handle_websocket(self):
        ws_key = self.headers.get('Sec-WebSocket-Key')
        if not ws_key:
            return
        
        guid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
        accept_key = base64.b64encode(hashlib.sha1((ws_key + guid).encode('utf-8')).digest()).decode('utf-8')
        
        response = (
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Accept: {accept_key}\r\n\r\n"
        )
        self.wfile.write(response.encode('utf-8'))
        self.wfile.flush()

        try:
            while True:
                data = self.rfile.read(2)
                if not data or len(data) < 2:
                    break
                byte1, byte2 = struct.unpack('BB', data)
                opcode = byte1 & 0x0f
                if opcode == 0x8:
                    break
                
                masked = bool(byte2 & 0x80)
                payload_len = byte2 & 0x7f
                if payload_len == 126:
                    payload_len = struct.unpack('>H', self.rfile.read(2))[0]
                elif payload_len == 127:
                    payload_len = struct.unpack('>Q', self.rfile.read(8))[0]
                
                masks = self.rfile.read(4) if masked else None
                raw_payload = self.rfile.read(payload_len)
                
                if masked:
                    payload_bytes = bytearray(raw_payload)
                    for i in range(len(payload_bytes)):
                        payload_bytes[i] ^= masks[i % 4]
                    payload_str = payload_bytes.decode('utf-8', errors='ignore')
                else:
                    payload_str = raw_payload.decode('utf-8', errors='ignore')

                try:
                    msg_obj = json.loads(payload_str)
                    action = msg_obj.get('action', 'chat')
                    if action == 'chat':
                        user_msg = msg_obj.get('message', '')
                        history = msg_obj.get('history', [])
                        res = process_bot_query(user_msg, history)
                    elif action == 'lead':
                        name = msg_obj.get('name', 'Anonymous').strip()
                        email = msg_obj.get('email', '').strip()
                        phone = msg_obj.get('phone', '').strip()
                        capacity = msg_obj.get('capacity', 'Not Specified').strip()
                        location = msg_obj.get('location', 'Global').strip()
                        notes = msg_obj.get('notes', '').strip()
                        lead_entry = {
                            "timestamp": datetime.datetime.now().isoformat(),
                            "name": name, "email": email, "phone": phone,
                            "capacity": capacity, "location": location, "notes": notes
                        }
                        with open(LEADS_FILE, "a", encoding="utf-8") as f:
                            f.write(json.dumps(lead_entry) + "\n")
                        res = {"status": "success", "action": "lead", "message": "Thank you! Your follow-up request has been recorded."}
                    else:
                        res = {"status": "error", "message": "Unknown action"}
                except Exception as ex:
                    res = {"status": "error", "message": str(ex)}

                resp_bytes = json.dumps(res).encode('utf-8')
                resp_len = len(resp_bytes)
                header = bytearray()
                header.append(0x81)
                if resp_len <= 125:
                    header.append(resp_len)
                elif resp_len <= 65535:
                    header.append(126)
                    header.extend(struct.pack('>H', resp_len))
                else:
                    header.append(127)
                    header.extend(struct.pack('>Q', resp_len))
                
                self.wfile.write(bytes(header) + resp_bytes)
                self.wfile.flush()
        except Exception as e:
            pass

    def do_OPTIONS(self):
        self.send_response(200, "OK")
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Access-Control-Request-Private-Network')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.end_headers()

    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            payload = json.loads(post_data.decode('utf-8')) if post_data else {}
        except Exception:
            payload = {}

        try:
            if self.path == '/api/chat':
                res = process_bot_query(payload.get('message', ''), payload.get('history', []))
                self.send_json(res)
            elif self.path == '/api/lead':
                self.handle_lead_api(payload)
            else:
                self.send_json({"status": "error", "message": "API Endpoint Not Found"})
        except Exception as e:
            self.send_json({
                "status": "success",
                "reply": "Aloha! How can I assist with your battery array or energy setup today?",
                "engine": "Fallback Handler"
            })

    def handle_lead_api(self, payload):
        name = payload.get('name', 'Anonymous').strip()
        email = payload.get('email', '').strip()
        phone = payload.get('phone', '').strip()
        capacity = payload.get('capacity', 'Not Specified').strip()
        location = payload.get('location', 'Global').strip()
        notes = payload.get('notes', '').strip()

        lead_entry = {
            "timestamp": datetime.datetime.now().isoformat(),
            "name": name, "email": email, "phone": phone,
            "capacity": capacity, "location": location, "notes": notes
        }

        try:
            with open(LEADS_FILE, "a", encoding="utf-8") as f:
                f.write(json.dumps(lead_entry) + "\n")
            print(f"[LEAD CAPTURED] Saved lead for {name} ({email} / {phone}) to {LEADS_FILE}")
            self.send_json({
                "status": "success",
                "message": "Thank you! Your follow-up request has been recorded. Our Senior Energy Engineer will reach out directly."
            })
        except Exception as e:
            self.send_json({"status": "error", "message": f"Failed to save lead: {str(e)}"})

    def send_json(self, data):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Access-Control-Request-Private-Network')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

if __name__ == "__main__":
    with ThreadedTCPServer(("", PORT), RealBigEnergyHandler) as httpd:
        print(f"Real BigEnergyCo Groq AI Multithreaded Backend + JSONP Web Bridge Running on port {PORT}")
        httpd.serve_forever()
