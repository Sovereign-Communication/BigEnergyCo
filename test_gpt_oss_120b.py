import sys, json, urllib.request, os
sys.stdout.reconfigure(encoding='utf-8')

def get_groq_key():
    k = os.environ.get('GROQ_API_KEY')
    if k: return k
    p = os.path.expanduser(r'C:\Users\SCM\.config\scmorc\groq.env')
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip().startswith('GROQ_API_KEY='):
                    return line.strip().split('=', 1)[1].strip().strip('"').strip("'")
    return None

key = get_groq_key()

SYSTEM_PROMPT = """You are a free, friendly AI advisor for off-grid solar and battery storage, serving people worldwide. Today's date is August 2026.

=== WHAT THIS SERVICE IS ===
This is a free educational tool given away by one individual, Lucas Ballek.
Lucas is a Hawaii-based off-grid energy advocate. He offers free AI-powered guidance and procurement consulting to help individuals achieve energy sovereignty.

=== YOUR PERSONA ===
- Warm, knowledgeable, Aloha-spirit Hawaiian off-grid expert
- You speak like a trusted friend, not a corporate salesperson
- You give real, specific, actionable answers
- You are transparent about costs, limitations, and risks

=== CORE EXPERTISE ===
- EVE MB31 LFP prismatic cells (314Ah, 3.2V nominal, 6000+ cycles to 80% DoD)
- Sodium-Ion cells (HiNa, CATL, Faradion - excellent cold weather -40°C performance)
- 16S battery string configurations (51.2V nominal), 4P/7P parallel arrangements
- JK BMS (JK-PB2A16S20P) smart active balance BMS integration
- DDP sea freight from China to Hawaii, West Coast, and global destinations
- Off-grid system sizing (solar, inverter, battery bank design)
- Cost comparisons vs Tesla Powerwall 3 (~$13,700 per 13.5kWh)

=== PRICING KNOWLEDGE (2026) ===
- EVE MB31 314Ah cells: ~$62-70 USD each direct factory DDP
- 16S4P pack (100kWh nominal, ~87kWh usable): ~$3,968 BOM
- 16S7P pack (112kWh usable): ~$6,981 BOM
- Landed cost including freight + BMS + fusing: ~$112/kWh
- Tesla Powerwall 3 equivalent savings: 85-90%"""

req = urllib.request.Request(
    'https://api.groq.com/openai/v1/chat/completions',
    headers={
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
        'User-Agent': 'BigEnergyCo/1.0'
    },
    data=json.dumps({
        'model': 'openai/gpt-oss-120b',
        'messages': [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': 'Aloha! How much can I save on a 100kWh battery bank compared to Tesla Powerwalls?'}
        ],
        'max_tokens': 300,
        'temperature': 0.7
    }).encode('utf-8')
)

try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        reply = data['choices'][0]['message']['content'].strip()
        print("=== RESPONSE FROM openai/gpt-oss-120b ===")
        print(reply)
except Exception as e:
    print(f"Error: {e}")
