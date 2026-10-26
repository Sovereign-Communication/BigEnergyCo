import sys, json, urllib.request, ssl
sys.stdout.reconfigure(encoding='utf-8')

ctx = ssl.create_default_context()

url = "https://bigenergyco-api.bigenergyco.workers.dev"

print("1. Testing /api/health...")
req = urllib.request.Request(f"{url}/api/health", headers={"User-Agent": "BigEnergyCo-Tester/1.0"})
with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
    data = json.loads(resp.read().decode('utf-8'))
    print(f"✅ Health Status 200: {data}")

print("\n2. Testing /api/chat with Groq AI model rotation (openai/gpt-oss-120b)...")
req = urllib.request.Request(
    f"{url}/api/chat",
    headers={"Content-Type": "application/json", "User-Agent": "BigEnergyCo-Tester/1.0"},
    data=json.dumps({
        "message": "Aloha! What are the specs and cycle life of EVE MB31 314Ah cells in 2026?",
        "history": []
    }).encode('utf-8'),
    method="POST"
)

with urllib.request.urlopen(req, context=ctx, timeout=25) as resp:
    data = json.loads(resp.read().decode('utf-8'))
    print(f"✅ Chat Reply (Model: {data.get('model')}):")
    print(data.get('reply'))

print("\n3. Testing /api/lead submission...")
req = urllib.request.Request(
    f"{url}/api/lead",
    headers={"Content-Type": "application/json", "User-Agent": "BigEnergyCo-Tester/1.0"},
    data=json.dumps({
        "name": "Lucas Test",
        "email": "lucas@example.com",
        "phone": "+1-808-555-0199",
        "capacity": "100kWh",
        "location": "Hawaii",
        "notes": "Testing live cloudflare worker lead submission"
    }).encode('utf-8'),
    method="POST"
)

with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
    data = json.loads(resp.read().decode('utf-8'))
    print(f"✅ Lead Response: {data}")
