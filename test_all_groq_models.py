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
print(f"Testing Groq Key: {key[:8]}...{key[-4:]}")

candidate_models = [
    "llama-3.3-70b-versatile",
    "llama-3.3-70b-specdec",
    "llama-3.1-70b-versatile",
    "llama-3.1-8b-instant",
    "llama3-70b-8192",
    "llama3-8b-8192",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
    "qwen-2.5-32b",
    "deepseek-r1-distill-llama-70b"
]

for model in candidate_models:
    req = urllib.request.Request(
        'https://api.groq.com/openai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
            'User-Agent': 'BigEnergyCo/1.0'
        },
        data=json.dumps({
            'model': model,
            'messages': [{'role': 'user', 'content': 'Say hello in 5 words'}],
            'max_tokens': 20
        }).encode('utf-8')
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            reply = data['choices'][0]['message']['content'].strip()
            print(f"✅ {model:30} -> SUCCESS: {reply}")
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8', errors='ignore')
        try:
            err_json = json.loads(err_msg)
            print(f"❌ {model:30} -> {e.code}: {err_json.get('error', {}).get('message', err_msg)}")
        except Exception:
            print(f"❌ {model:30} -> {e.code}: {err_msg[:100]}")
    except Exception as e:
        print(f"⚠️ {model:30} -> {e}")
