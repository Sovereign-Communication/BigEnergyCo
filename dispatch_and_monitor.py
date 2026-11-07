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
    return os.environ.get('GITHUB_TOKEN', '')

token = get_token()
headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'BigEnergyCo/1.0'
}

# Trigger dispatch
req = urllib.request.Request(
    f'https://api.github.com/repos/{OWNER}/{REPO}/actions/workflows/deploy.yml/dispatches',
    headers=headers,
    method='POST',
    data=json.dumps({'ref': 'main'}).encode('utf-8')
)

try:
    with urllib.request.urlopen(req) as resp:
        print(f"Dispatch status: {resp.status}")
except Exception as e:
    print(f"Dispatch error: {e}")

print("Waiting for workflow to run...")
time.sleep(10)

for attempt in range(12):
    req = urllib.request.Request(f'https://api.github.com/repos/{OWNER}/{REPO}/actions/runs?per_page=1', headers=headers)
    runs = json.loads(urllib.request.urlopen(req).read())
    run = runs['workflow_runs'][0]
    status = run['status']
    conclusion = run['conclusion']
    print(f"[{attempt+1}] Run ID: {run['id']} | Status: {status} | Conclusion: {conclusion}")
    if status == 'completed':
        # Get jobs and steps
        req_jobs = urllib.request.Request(f"https://api.github.com/repos/{OWNER}/{REPO}/actions/runs/{run['id']}/jobs", headers=headers)
        jobs_data = json.loads(urllib.request.urlopen(req_jobs).read())
        for j in jobs_data['jobs']:
            print(f"  Job {j['name']}: {j['status']} / {j['conclusion']}")
            for s in j.get('steps', []):
                print(f"    Step {s['name']}: {s['conclusion']}")
        break
    time.sleep(5)
