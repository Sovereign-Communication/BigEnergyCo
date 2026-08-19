import sys, json, urllib.request, subprocess
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

req = urllib.request.Request(f'https://api.github.com/repos/{OWNER}/{REPO}/pages/builds/latest', headers=headers)
try:
    with urllib.request.urlopen(req) as resp:
        print(json.dumps(json.loads(resp.read()), indent=2))
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.read().decode('utf-8', errors='ignore')}")
