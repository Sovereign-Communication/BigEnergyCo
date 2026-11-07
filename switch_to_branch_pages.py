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

# Update GitHub Pages to build from branch 'main' directly
req = urllib.request.Request(
    f'https://api.github.com/repos/{OWNER}/{REPO}/pages',
    headers=headers,
    method='PUT',
    data=json.dumps({
        'build_type': 'legacy',
        'source': {
            'branch': 'main',
            'path': '/'
        }
    }).encode('utf-8')
)

try:
    with urllib.request.urlopen(req) as resp:
        print(f"Update Pages source to branch 'main': Status {resp.status}")
except urllib.error.HTTPError as e:
    print(f"Error {e.code}: {e.read().decode('utf-8', errors='ignore')}")

# Check current Pages status
req = urllib.request.Request(f'https://api.github.com/repos/{OWNER}/{REPO}/pages', headers=headers)
try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
        print(f"Pages URL: {data.get('html_url')}")
        print(f"Pages status: {data.get('status')}")
        print(f"Pages build_type: {data.get('build_type')}")
        print(f"Pages source: {data.get('source')}")
except Exception as e:
    print(f"Error reading pages: {e}")
