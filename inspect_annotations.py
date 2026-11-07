import sys, json, urllib.request, subprocess
sys.stdout.reconfigure(encoding='utf-8')

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

req = urllib.request.Request('https://api.github.com/repos/Treystu/BigEnergyCo/check-runs/96038748473/annotations', headers=headers)
annotations = json.loads(urllib.request.urlopen(req).read())
print("=== ANNOTATIONS ===")
print(json.dumps(annotations, indent=2))
