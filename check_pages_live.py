import sys, json, urllib.request, time, subprocess
sys.stdout.reconfigure(encoding='utf-8')

OWNER = "Treystu"
REPO = "BigEnergyCo"

def get_token():
    try:
        r = subprocess.run(['git', 'credential', 'fill'],
            input='protocol=https\nhost=github.com\n\n',
            capture_output=True, text=True, timeout=5)
        for line in r.stdout.splitlines():
            if line.startswith('password='):
                return line.split('=', 1)[1].strip()
    except Exception:
        pass
    return ''

token = get_token()
headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'BigEnergyCo/1.0'
}

print("Checking Pages build status...")
for i in range(10):
    time.sleep(3)
    req = urllib.request.Request(f'https://api.github.com/repos/{OWNER}/{REPO}/pages/builds/latest', headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
            st = data.get('status')
            print(f"[{i+1}] Pages Build Status: {st}")
            if st == 'built':
                print(f"✅ SUCCESS! Built in {data.get('duration')}ms")
                break
            elif st == 'errored':
                print(f"❌ Errored: {data.get('error')}")
                break
    except urllib.error.HTTPError as e:
        print(f"[{i+1}] HTTP {e.code}")

# Test fetching the actual live URL
print("\nTesting live site...")
url = "https://treystu.github.io/BigEnergyCo/"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode('utf-8', errors='replace')
        print(f"Status: {resp.status} | Length: {len(html)} bytes")
        print("First 200 chars:")
        print(html[:200])
        if "BigEnergyCo" in html:
            print("✅ BigEnergyCo is LIVE on GitHub Pages!")
except urllib.error.HTTPError as e:
    print(f"Live site HTTP {e.code}: {e.reason}")
