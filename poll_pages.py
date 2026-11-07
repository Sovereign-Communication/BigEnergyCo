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

print("Monitoring GitHub Pages builds...")
for i in range(15):
    req = urllib.request.Request(f'https://api.github.com/repos/{OWNER}/{REPO}/pages/builds', headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            builds = json.loads(resp.read())
            if builds:
                latest = builds[0]
                print(f"[{i+1}] Latest build: {latest.get('status')} | Created: {latest.get('created_at')}")
                if latest.get('status') == 'built':
                    print("✅ Build completed successfully!")
                    break
                elif latest.get('status') == 'errored':
                    print(f"❌ Error: {latest.get('error')}")
            else:
                print(f"[{i+1}] No builds listed yet...")
    except Exception as e:
        print(f"[{i+1}] Error: {e}")
    time.sleep(4)

# Test live URL
print("\nTesting https://treystu.github.io/BigEnergyCo/ ...")
req = urllib.request.Request("https://treystu.github.io/BigEnergyCo/", headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        html = resp.read().decode('utf-8', errors='replace')
        print(f"HTTP Status: {resp.status} | Bytes: {len(html)}")
        if "BigEnergyCo" in html:
            print("🎉 BigEnergyCo is LIVE at https://treystu.github.io/BigEnergyCo/ !")
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.reason}")
