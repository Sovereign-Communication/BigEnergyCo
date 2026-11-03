"""
start_tunnel.py — Starts a Cloudflare Quick Tunnel on port 7510,
captures the public HTTPS URL from stdout, writes it to tunnel_url.txt,
then patches index.html with that URL and republishes to Freenet.
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

import subprocess, re, time, os, shutil

PROXY_PORT = 7510
REPO = r"c:\Users\SCM\Documents\GitHub\BigEnergyCo"
DIST = os.path.join(REPO, "freenet_web_dist")
TUNNEL_URL_FILE = os.path.join(REPO, "tunnel_url.txt")

# Try both cloudflared locations
CF_PATHS = [
    os.path.join(REPO, "cloudflared.exe"),
    r"C:\Program Files\cloudflared\cloudflared.exe",
    "cloudflared",
]

cf_bin = None
for p in CF_PATHS:
    if os.path.exists(p) if os.sep in p else True:
        cf_bin = p
        break

print(f"[TUNNEL] Using cloudflared: {cf_bin}")
print(f"[TUNNEL] Starting tunnel on http://127.0.0.1:{PROXY_PORT} ...")

proc = subprocess.Popen(
    [cf_bin, "tunnel", "--url", f"http://127.0.0.1:{PROXY_PORT}"],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    encoding='utf-8',
    errors='replace'
)

# Capture the tunnel URL from output (it appears in stdout/stderr)
tunnel_url = None
deadline = time.time() + 60  # 60 second timeout to find URL

print("[TUNNEL] Waiting for URL...")
while time.time() < deadline:
    line = proc.stdout.readline()
    if not line:
        time.sleep(0.1)
        continue
    print(f"  CF> {line.rstrip()}")
    # Cloudflare prints: https://xxxx.trycloudflare.com
    match = re.search(r'https://[a-zA-Z0-9\-]+\.trycloudflare\.com', line)
    if match:
        tunnel_url = match.group(0)
        print(f"\n[TUNNEL] ✅ Got public URL: {tunnel_url}")
        break

if not tunnel_url:
    print("[TUNNEL] ❌ Failed to get tunnel URL within 60s")
    proc.terminate()
    sys.exit(1)

# Write URL to file so other scripts can read it
with open(TUNNEL_URL_FILE, 'w', encoding='utf-8') as f:
    f.write(tunnel_url)
print(f"[TUNNEL] URL saved to {TUNNEL_URL_FILE}")

# Keep process alive and keep printing output
print(f"\n[TUNNEL] 🌐 Tunnel active. Keep this running.")
print(f"[TUNNEL] External users: {tunnel_url}/v1/contract/web/AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov/")
print(f"[TUNNEL] Press Ctrl+C to stop\n")

try:
    while True:
        line = proc.stdout.readline()
        if not line:
            if proc.poll() is not None:
                print("[TUNNEL] Process ended")
                break
            time.sleep(0.5)
            continue
        # Only print important lines
        if any(k in line for k in ('ERR', 'error', 'warn', 'WARN', 'connection', 'Registered')):
            print(f"  CF> {line.rstrip()}")
except KeyboardInterrupt:
    print("\n[TUNNEL] Shutting down...")
    proc.terminate()
