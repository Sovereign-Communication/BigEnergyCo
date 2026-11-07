import sys, urllib.request, time, json

print("Waiting for Cloudflare SSL certificate provisioning on bigenergyco.workers.dev...")
for i in range(12):
    try:
        resp = urllib.request.urlopen("https://bigenergyco-api.bigenergyco.workers.dev/api/health", timeout=5)
        print(f"[{i+1}] ✅ SUCCESS! Status: {resp.status}")
        print("Response:", resp.read().decode('utf-8'))
        break
    except Exception as e:
        print(f"[{i+1}] Still provisioning SSL... ({e})")
        time.sleep(8)
