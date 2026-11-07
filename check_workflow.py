import sys, json, urllib.request, os, subprocess
sys.stdout.reconfigure(encoding='utf-8')

def get_token():
    try:
        r = subprocess.run(
            ['git', 'credential', 'fill'],
            input='protocol=https\nhost=github.com\n\n',
            capture_output=True, text=True, timeout=5
        )
        for line in r.stdout.splitlines():
            if line.startswith('password='):
                return line.split('=', 1)[1].strip()
    except Exception:
        pass
    return os.environ.get('GITHUB_TOKEN', '')

token = get_token()

req = urllib.request.Request(
    'https://api.github.com/repos/Treystu/BigEnergyCo/actions/runs?per_page=5',
    headers={
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'setup/1.0'
    }
)
data = json.loads(urllib.request.urlopen(req, timeout=10).read())

print("Recent workflow runs:")
for run in data['workflow_runs']:
    conclusion = run['conclusion'] or 'in_progress'
    title = run['display_title'][:50]
    print(f"  {run['created_at']} | {run['status']:12} | {conclusion:15} | {title}")
