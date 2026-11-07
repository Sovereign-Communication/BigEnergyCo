import urllib.request, json

data = json.dumps({'message': 'what is today date?', 'history': []}).encode()
req = urllib.request.Request(
    'http://127.0.0.1:7510/api/chat',
    data=data,
    headers={'Content-Type': 'application/json'}
)
r = urllib.request.urlopen(req, timeout=20)
result = r.read().decode()
print("API RESPONSE:", result)
parsed = json.loads(result)
print("REPLY:", parsed.get('reply', 'NO REPLY'))
print("ENGINE:", parsed.get('engine', 'unknown'))
