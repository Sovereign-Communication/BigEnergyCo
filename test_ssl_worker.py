import sys, ssl, urllib.request, json

ctx = ssl.create_default_context()

url = "https://bigenergyco-api.bigenergyco.workers.dev/api/health"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})

try:
    with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
        print(f"Status: {resp.status}")
        print("Response:", resp.read().decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")
