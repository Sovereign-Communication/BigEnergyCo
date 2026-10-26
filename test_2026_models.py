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

models_to_test = [
    "meta-llama/llama-4-maverick-17b-128e-instruct",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "llama-4-scout-17b-16e-instruct",
    "llama-4-maverick-17b-128e-instruct",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "gpt-oss-120b",
    "gpt-oss-20b",
    "qwen/qwen3-32b",
    "qwen/qwen3.6-27b",
    "qwen-2.5-coder-32b",
    "qwen-2.5-72b-instruct",
    "deepseek-r1-distill-qwen-32b",
    "llama-3.2-90b-vision-preview",
    "llama-3.2-11b-vision-preview",
    "llama-3.2-3b-preview",
    "llama-3.2-1b-preview",
    "moonshotai/kimi-k2-instruct-0905",
    "minimaxai/minimax-m2.5"
]

print(f"Testing {len(models_to_test)} modern models on Groq...")
working_models = []

for model in models_to_test:
    req = urllib.request.Request(
        'https://api.groq.com/openai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
            'User-Agent': 'BigEnergyCo/1.0'
        },
        data=json.dumps({
            'model': model,
            'messages': [{'role': 'user', 'content': 'Hello, are you online?'}],
            'max_tokens': 30
        }).encode('utf-8')
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            reply = data['choices'][0]['message']['content'].strip()
            print(f"✅ {model:45} -> SUCCESS: {reply[:60]}...")
            working_models.append(model)
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8', errors='ignore')
        try:
            err_json = json.loads(err_msg)
            print(f"❌ {model:45} -> {e.code}: {err_json.get('error', {}).get('message', err_msg)}")
        except Exception:
            print(f"❌ {model:45} -> {e.code}: {err_msg[:80]}")
    except Exception as e:
        print(f"⚠️ {model:45} -> {e}")

print(f"\nWorking Models: {working_models}")
