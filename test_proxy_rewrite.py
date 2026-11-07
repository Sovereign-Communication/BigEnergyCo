import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request

# Fetch the proxy page and check if it contains 7509 (should be rewritten to 7510)
url = "http://127.0.0.1:7510/v1/contract/web/AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov/"
r = urllib.request.urlopen(url, timeout=15)
html = r.read().decode('utf-8', errors='replace')
print(f"Status: {r.status}")
print(f"Content-Type: {r.headers.get('Content-Type', 'unknown')}")
print(f"Response length: {len(html)} bytes")
print(f"Contains '7509': {'YES - BAD!' if '7509' in html else 'NO - GOOD'}")
print(f"Contains '7510': {'YES - GOOD' if '7510' in html else 'NO - BAD!'}")
# Show first 2000 chars to inspect iframe
print("\n--- Response Preview (first 2000 chars) ---")
print(html[:2000])
