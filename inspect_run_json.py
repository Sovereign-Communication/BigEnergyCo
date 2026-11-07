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

req = urllib.request.Request(f'https://api.github.com/repos/{OWNER}/{REPO}/actions/runs?per_page=1', headers=headers)
runs = json.loads(urllib.request.urlopen(req).read())
run = runs['workflow_runs'][0]
print("=== RUN DETAILS ===")
print(json.dumps(run, indent=2))

req = urllib.request.Request(f"https://api.github.com/repos/{OWNER}/{REPO}/actions/runs/{run['id']}/jobs", headers=headers)
jobs = json.loads(urllib.request.urlopen(req).read())
print("=== JOBS DETAILS ===")
print(json.dumps(jobs, indent=2))
