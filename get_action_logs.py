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

# Get latest run
req = urllib.request.Request(f'https://api.github.com/repos/{OWNER}/{REPO}/actions/runs?per_page=1', headers=headers)
runs = json.loads(urllib.request.urlopen(req).read())
latest_run = runs['workflow_runs'][0]
run_id = latest_run['id']
print(f"Latest Run ID: {run_id} | Status: {latest_run['status']} | Conclusion: {latest_run['conclusion']}")

# Get jobs for this run
req = urllib.request.Request(f'https://api.github.com/repos/{OWNER}/{REPO}/actions/runs/{run_id}/jobs', headers=headers)
jobs = json.loads(urllib.request.urlopen(req).read())
for job in jobs['jobs']:
    print(f"Job: {job['name']} (ID: {job['id']}) | Status: {job['status']} | Conclusion: {job['conclusion']}")
    for step in job.get('steps', []):
        print(f"  Step: {step['name']} | Conclusion: {step['conclusion']} | Status: {step['status']}")

# Check logs URL
print(f"Logs URL: {latest_run['logs_url']}")
