"""Probe which configured models are reachable on the token-plan endpoint.
Tiny 'reply OK' prompt per model so the check stays cheap.

Usage: python check_token_plan_models.py
"""
import sys, json, os, urllib.request, urllib.error
sys.stdout.reconfigure(encoding='utf-8')

ENDPOINT = 'https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions'
CANDIDATES = [
    # Qwen (text gen)
    'qwen3.8-max', 'qwen3.7-max', 'qwen3.7-plus', 'qwen3.6-flash',
    # DeepSeek
    'deepseek-v4-pro-0813', 'deepseek-v4-pro', 'deepseek-v4-flash-0731',
    # Zhipu
    'glm-5.2',
]

def get_key():
    k = os.environ.get('DASHSCOPE_API_KEY') or os.environ.get('BAILIAN_CODING_PLAN_API_KEY')
    if k:
        return k
    p = os.path.expanduser(r'C:\Users\SCM\.qwen\settings.json')
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8') as f:
            s = json.load(f)
        return (s.get('env') or {}).get('DASHSCOPE_API_KEY')
    return None

key = get_key()
if not key:
    print('No API key found!')
    sys.exit(1)
print(f'Key found: {key[:8]}...{key[-4:]}')

for m in CANDIDATES:
    payload = {'model': m, 'messages': [{'role': 'user', 'content': 'Reply with exactly: OK'}],
               'max_tokens': 8}
    req = urllib.request.Request(
        ENDPOINT, data=json.dumps(payload).encode('utf-8'),
        headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        reply = data['choices'][0]['message']['content'].strip()
        print(f'  OK    {m:28s} -> {reply[:40]!r}')
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', 'replace')[:160]
        print(f'  FAIL  {m:28s} -> HTTP {e.code}: {body}')
    except Exception as e:
        print(f'  FAIL  {m:28s} -> {e}')
