import sys, json, urllib.request, urllib.error, os, subprocess
sys.stdout.reconfigure(encoding='utf-8')

OWNER = "Treystu"
REPO  = "BigEnergyCo"

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

def api(method, path, body=None, token=None):
    url = f"https://api.github.com{path}"
    data = json.dumps(body).encode() if body else None
    headers = {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'BigEnergyCo/1.0',
    }
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            body_bytes = r.read()
            if body_bytes:
                return r.status, json.loads(body_bytes)
            return r.status, {}
    except urllib.error.HTTPError as e:
        body_bytes = e.read()
        try:
            d = json.loads(body_bytes) if body_bytes else {}
        except Exception:
            d = {'raw': body_bytes.decode('utf-8', errors='replace')}
        return e.code, d

token = get_token()

# Create github-pages environment
print("Creating github-pages environment...")
s, d = api('PUT', f'/repos/{OWNER}/{REPO}/environments/github-pages',
    body={'wait_timer': 0, 'reviewers': [], 'deployment_branch_policy': None},
    token=token)
print(f"  Status {s}: {d.get('name', d.get('message', str(d)))}")

# Trigger workflow
print("\nTriggering workflow dispatch...")
s, d = api('POST', f'/repos/{OWNER}/{REPO}/actions/workflows/deploy.yml/dispatches',
    body={'ref': 'main'}, token=token)
print(f"  Status {s}: {'queued OK' if s == 204 else d}")

import time
print("\nWaiting 15s for workflow to start...")
time.sleep(15)

# Check runs
s, d = api('GET', f'/repos/{OWNER}/{REPO}/actions/runs?per_page=3', token=token)
print("\nLatest runs:")
for run in d.get('workflow_runs', []):
    conclusion = run['conclusion'] or 'in_progress'
    print(f"  {run['created_at'][:19]} | {run['status']:12} | {conclusion:15} | {run['display_title'][:45]}")
