import sys, json, urllib.request
sys.stdout.reconfigure(encoding='utf-8')

worker_url = "https://bigenergyco-api.bigenergyco.workers.dev"

# 1. Test Health
print("Testing /api/health...")
try:
    req = urllib.request.Request(f"{worker_url}/api/health", headers={"User-Agent": "BigEnergyCo-Test/2.0"})
    resp = urllib.request.urlopen(req, timeout=10)
    data = json.loads(resp.read().decode('utf-8'))
    print(f"✅ Health OK: {data}")
except Exception as e:
    print(f"❌ Health Failed: {e}")

# 2. Test Groq AI Chat
print("\nTesting /api/chat with query...")
try:
    req = urllib.request.Request(
        f"{worker_url}/api/chat",
        headers={"Content-Type": "application/json", "User-Agent": "BigEnergyCo-Test/2.0"},
        data=json.dumps({
            "message": "Aloha! What are the specs and 2026 cycle life of EVE MB31 cells?",
            "history": []
        }).encode('utf-8'),
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        print(f"✅ Chat Response (Model: {data.get('model')}):")
        print(data.get('reply'))
except Exception as e:
    print(f"❌ Chat Failed: {e}")

# 3. Test Lead Capture
print("\nTesting /api/lead...")
try:
    req = urllib.request.Request(
        f"{worker_url}/api/lead",
        headers={"Content-Type": "application/json", "User-Agent": "BigEnergyCo-Test/2.0"},
        data=json.dumps({
            "name": "Live Test Lead",
            "email": "test@bigenergyco.com",
            "phone": "808-555-0199",
            "capacity": "100kWh",
            "location": "Hawaii",
            "notes": "Testing worker endpoint"
        }).encode('utf-8'),
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        print(f"✅ Lead Response: {data}")
except Exception as e:
    print(f"❌ Lead Failed: {e}")
