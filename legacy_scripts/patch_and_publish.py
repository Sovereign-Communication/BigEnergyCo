"""
patch_and_publish.py — Reads the Cloudflare tunnel URL from tunnel_url.txt,
patches index.html to use absolute API URLs, syncs to freenet_web_dist,
and republishes the Freenet contract.

Run this AFTER start_tunnel.py has written tunnel_url.txt.
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
import os, shutil, subprocess

REPO = r"c:\Users\SCM\Documents\GitHub\BigEnergyCo"
INDEX_SRC = os.path.join(REPO, "index.html")
DIST = os.path.join(REPO, "freenet_web_dist")
TUNNEL_URL_FILE = os.path.join(REPO, "tunnel_url.txt")
FDEV = r"C:\Users\SCM\AppData\Local\Freenet\bin\fdev.exe"
CONTRACT_KEY = "bigenergyco"

# Read tunnel URL
if not os.path.exists(TUNNEL_URL_FILE):
    print("ERROR: tunnel_url.txt not found. Run start_tunnel.py first.")
    sys.exit(1)

with open(TUNNEL_URL_FILE, 'r') as f:
    tunnel_url = f.read().strip()

print(f"[PATCH] Cloudflare tunnel URL: {tunnel_url}")

# Read index.html
with open(INDEX_SRC, 'r', encoding='utf-8') as f:
    html = f.read()

# Replace the CF_API_URL variable in index.html (single clean target line)
old_var = "var CF_API_URL = '"
# Find the line and replace the URL value
lines = html.split('\n')
patched = False
for i, line in enumerate(lines):
    if old_var in line:
        lines[i] = f"    var CF_API_URL = '{tunnel_url}';"
        print(f"[PATCH] ✅ Updated CF_API_URL = '{tunnel_url}'")
        patched = True
        break

if not patched:
    # Fallback: try direct string replacement for fetch URLs
    original_chat = "fetch('/api/chat',"
    patched_chat  = f"fetch('{tunnel_url}/api/chat',"
    original_lead = "fetch('/api/lead',"
    patched_lead  = f"fetch('{tunnel_url}/api/lead',"
    if original_chat in html:
        html = html.replace(original_chat, patched_chat)
        print(f"[PATCH] ✅ Fallback: patched /api/chat URL")
    if original_lead in html:
        html = html.replace(original_lead, patched_lead)
        print(f"[PATCH] ✅ Fallback: patched /api/lead URL")
else:
    html = '\n'.join(lines)

# Write patched index.html back
with open(INDEX_SRC, 'w', encoding='utf-8') as f:
    f.write(html)
print(f"[PATCH] Saved patched index.html")

# Sync to freenet_web_dist
os.makedirs(DIST, exist_ok=True)
for fname in ['index.html', 'styles.css']:
    src = os.path.join(REPO, fname)
    dst = os.path.join(DIST, fname)
    if os.path.exists(src):
        shutil.copy2(src, dst)
        print(f"[SYNC] Copied {fname} → freenet_web_dist/")

# Publish to Freenet
print(f"\n[PUBLISH] Publishing to Freenet...")
result = subprocess.run(
    [FDEV, "website", "publish", "--key", CONTRACT_KEY, DIST],
    capture_output=True, text=True
)
print(result.stdout)
if result.returncode != 0:
    print("ERROR:", result.stderr)
    sys.exit(1)

print(f"\n{'='*65}")
print(f"✅ PUBLISHED SUCCESSFULLY!")
print(f"")
print(f"  Cloudflare URL (full AI + leads for anyone):")
print(f"  {tunnel_url}/v1/contract/web/AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov/")
print(f"")
print(f"  Freenet URL (same content, AI works via CF tunnel):")
print(f"  http://127.0.0.1:7509/v1/contract/web/AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov/")
print(f"{'='*65}")
