"""Diagnose the worker /api/chat 403 and verify the advisor identity fix."""
import sys, json, urllib.request, urllib.error
sys.stdout.reconfigure(encoding='utf-8')

URL = 'https://bigenergyco-api.bigenergyco.workers.dev/api/chat'
UAS = ['Python-urllib/3.14',
       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Safari/537.36']

for ua in UAS:
    req = urllib.request.Request(
        URL, data=json.dumps({'message': 'Are you GPT-OSS or ChatGPT?'}).encode(),
        headers={'Content-Type': 'application/json', 'User-Agent': ua,
                 'Origin': 'https://treystu.github.io'})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            reply = json.loads(r.read())['reply']
            print(f'[{ua[:16]}] -> {r.status}')
            print(reply[:500])
    except urllib.error.HTTPError as e:
        print(f'[{ua[:16]}] -> HTTP {e.code}: {e.read().decode()[:300]}')
    except Exception as e:
        print(f'[{ua[:16]}] -> {e}')
    print('---')
