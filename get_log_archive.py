import sys, json, urllib.request, zipfile, io, os, subprocess
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

req = urllib.request.Request(f'https://api.github.com/repos/{OWNER}/{REPO}/actions/runs?per_page=1', headers=headers)
runs = json.loads(urllib.request.urlopen(req).read())
run_id = runs['workflow_runs'][0]['id']

req_logs = urllib.request.Request(f'https://api.github.com/repos/{OWNER}/{REPO}/actions/runs/{run_id}/logs', headers=headers)
try:
    with urllib.request.urlopen(req_logs) as resp:
        content = resp.read()
        print(f"Downloaded log zip: {len(content)} bytes")
        z = zipfile.ZipFile(io.BytesIO(content))
        for name in z.namelist():
            print(f"\n--- File: {name} ---")
            txt = z.read(name).decode('utf-8', errors='replace')
            print(txt[:2000])
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.read().decode('utf-8', errors='ignore')}")
except Exception as e:
    print(f"Error: {e}")
