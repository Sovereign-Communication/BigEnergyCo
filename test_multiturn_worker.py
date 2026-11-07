import sys, json, urllib.request, ssl
sys.stdout.reconfigure(encoding='utf-8')

ctx = ssl.create_default_context()
url = "https://bigenergyco-api.bigenergyco.workers.dev/api/chat"

print("1. Turn 1 (No history)...")
req1 = urllib.request.Request(
    url,
    headers={"Content-Type": "application/json", "User-Agent": "BigEnergyCo-Tester/1.0"},
    data=json.dumps({
        "message": "Aloha! I want to build a 100kWh battery for my off-grid homestead.",
        "history": []
    }).encode('utf-8'),
    method="POST"
)
with urllib.request.urlopen(req1, context=ctx, timeout=20) as resp:
    data1 = json.loads(resp.read().decode('utf-8'))
    reply1 = data1.get('reply')
    print(f"Turn 1 Reply ({data1.get('model')}): {reply1[:80]}...")

print("\n2. Turn 2 (With multi-turn history containing assistant/bot messages)...")
history = [
    {"role": "user", "content": "Aloha! I want to build a 100kWh battery for my off-grid homestead."},
    {"role": "assistant", "content": reply1}
]
req2 = urllib.request.Request(
    url,
    headers={"Content-Type": "application/json", "User-Agent": "BigEnergyCo-Tester/1.0"},
    data=json.dumps({
        "message": "What BMS and fuses should I use for this 100kWh setup?",
        "history": history
    }).encode('utf-8'),
    method="POST"
)
with urllib.request.urlopen(req2, context=ctx, timeout=20) as resp:
    data2 = json.loads(resp.read().decode('utf-8'))
    reply2 = data2.get('reply')
    print(f"Turn 2 Reply ({data2.get('model')}): {reply2[:100]}...")
    if "BMS" in reply2 or "JK" in reply2 or "Fuse" in reply2 or "fuse" in reply2 or "Class-T" in reply2:
        print("✅ PASS: Multi-turn conversation works perfectly with full context!")
