import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request

# Check the CSP on the sandbox URL (the iframe content)
url = "http://127.0.0.1:7510/v1/contract/web/AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov/?__sandbox=1"
r = urllib.request.urlopen(url, timeout=15)
print("Status:", r.status)
for k, v in r.headers.items():
    if 'security' in k.lower() or 'content-type' in k.lower():
        print(f"  {k}: {v}")
body = r.read().decode('utf-8', errors='replace')
print("Body length:", len(body))
print("Contains '7509':", '7509' in body)
print("Contains '7510':", '7510' in body)
print("Contains '/api/chat':", '/api/chat' in body)
