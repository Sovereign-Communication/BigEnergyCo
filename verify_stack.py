import sys, urllib.request, json, re
sys.stdout.reconfigure(encoding='utf-8')

REPO = r'c:\Users\SCM\Documents\GitHub\BigEnergyCo'
TUNNEL_FILE = REPO + r'\tunnel_url.txt'
INDEX_FILE  = REPO + r'\index.html'

# Read tunnel URL
with open(TUNNEL_FILE) as f:
    cf_url = f.read().strip()
print(f"Tunnel URL:      {cf_url}")

# Check index.html CF_API_URL
with open(INDEX_FILE, encoding='utf-8') as f:
    html = f.read()
m = re.search(r"var CF_API_URL = '([^']+)'", html)
if m:
    in_html = m.group(1)
    print(f"index.html var:  {in_html}")
    print(f"Match:           {'YES' if in_html == cf_url else 'NO - MISMATCH!'}")
else:
    print("CF_API_URL NOT FOUND in index.html")

# Proxy health
try:
    r = urllib.request.urlopen('http://127.0.0.1:7510/api/health', timeout=5)
    print(f"Proxy health:    {r.read().decode()}")
except Exception as e:
    print(f"Proxy DOWN:      {e}")

# Groq via proxy
try:
    data = json.dumps({'message': 'hi', 'history': []}).encode()
    req = urllib.request.Request(
        'http://127.0.0.1:7510/api/chat', data=data,
        headers={'Content-Type': 'application/json'}
    )
    r = urllib.request.urlopen(req, timeout=20)
    resp = json.loads(r.read().decode())
    print(f"Groq reply:      {resp.get('reply','')[:80]}")
except Exception as e:
    print(f"Groq FAILED:     {e}")

# CF URL response check
try:
    req = urllib.request.Request(cf_url + '/', headers={'User-Agent': 'Mozilla/5.0'})
    r = urllib.request.urlopen(req, timeout=15)
    body = r.read().decode('utf-8', errors='replace')
    has_styles = 'BigEnergyCo Design System' in body
    has_new_url = cf_url in body
    print(f"CF URL bytes:    {len(body)}")
    print(f"Has inlined CSS: {has_styles}")
    print(f"Has new CF URL:  {has_new_url}")
except Exception as e:
    print(f"CF URL FAILED:   {e}")
