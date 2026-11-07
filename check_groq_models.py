import sys, json, urllib.request, os
sys.stdout.reconfigure(encoding='utf-8')

def get_groq_key():
    k = os.environ.get('GROQ_API_KEY')
    if k:
        return k
    p = os.path.expanduser(r'C:\Users\SCM\.config\scmorc\groq.env')
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip().startswith('GROQ_API_KEY='):
                    return line.strip().split('=', 1)[1].strip().strip('"').strip("'")
    return None

key = get_groq_key()
if not key:
    print("GROQ_API_KEY not found!")
    sys.exit(1)

print(f"Groq Key found: {key[:8]}...{key[-4:]}")

req = urllib.request.Request(
    'https://api.groq.com/openai/v1/models',
    headers={'Authorization': f'Bearer {key}'}
)

try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        models = [m['id'] for m in data.get('data', []) if m.get('active', True)]
        print(f"Found {len(models)} active Groq models:")
        for m in sorted(models):
            print(f"  - {m}")
except Exception as e:
    print(f"Error querying Groq models: {e}")
