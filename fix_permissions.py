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

req = urllib.request.Request(
    f'https://api.github.com/repos/{OWNER}/{REPO}/actions/permissions/workflow',
    headers=headers,
    method='PUT',
    data=json.dumps({
        'default_workflow_permissions': 'write',
        'can_approve_pull_request_reviews': False
    }).encode('utf-8')
)

try:
    with urllib.request.urlopen(req) as resp:
        print(f"Update workflow permissions status: {resp.status}")
except urllib.error.HTTPError as e:
    print(f"Error {e.code}: {e.read().decode('utf-8', errors='ignore')}")

# Also check logs of the failed run to be 100% sure what happened
req = urllib.request.Request(f'https://api.github.com/repos/{OWNER}/{REPO}/actions/runs?per_page=1', headers=headers)
runs = json.loads(urllib.request.urlopen(req).read())
run_id = runs['workflow_runs'][0]['id']

# Download logs zip if possible or print details
print(f"Latest run ID: {run_id}")
