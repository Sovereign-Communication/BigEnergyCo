import sys, json, urllib.request, os, subprocess
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
    return os.environ.get('GITHUB_TOKEN', '')

token = get_token()
headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'BigEnergyCo/1.0'
}

def api_req(url, method='GET', data=None):
    req = urllib.request.Request(url, headers=headers, method=method)
    if data:
        req.data = json.dumps(data).encode('utf-8')
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='ignore')
        return e.code, body

# Check workflow permissions
st, res = api_req(f'https://api.github.com/repos/{OWNER}/{REPO}/actions/permissions/workflow')
print(f"Actions Workflow Permissions ({st}): {res}")

# Check github-pages environment
st, res = api_req(f'https://api.github.com/repos/{OWNER}/{REPO}/environments/github-pages')
print(f"github-pages Environment ({st}): {res}")

# Check repo settings
st, res = api_req(f'https://api.github.com/repos/{OWNER}/{REPO}/actions/permissions')
print(f"Actions Permissions ({st}): {res}")
