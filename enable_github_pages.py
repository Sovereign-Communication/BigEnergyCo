import sys, os, json, urllib.request, urllib.error
sys.stdout.reconfigure(encoding='utf-8')

OWNER = "Treystu"
REPO  = "BigEnergyCo"
API   = "https://api.github.com"

def get_token():
    t = os.environ.get("GITHUB_TOKEN", "").strip()
    if t:
        return t
    try:
        import subprocess
        r = subprocess.run(
            ["git", "credential", "fill"],
            input="protocol=https\nhost=github.com\n\n",
            capture_output=True, text=True, timeout=5
        )
        for line in r.stdout.splitlines():
            if line.startswith("password="):
                return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return None

def api_call(method, path, body=None, token=None):
    url = API + path
    data = json.dumps(body).encode() if body else None
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "BigEnergyCo-Setup/1.0",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            body_data = json.loads(e.read())
        except Exception:
            body_data = {}
        return e.code, body_data

def main():
    token = get_token()

    # Check repo visibility
    status, data = api_call("GET", f"/repos/{OWNER}/{REPO}", token=token)
    print(f"Repo: {data.get('full_name')} | Private: {data.get('private')} | Visibility: {data.get('visibility')}")

    if data.get('private'):
        print("\nRepo is PRIVATE. Making it public for GitHub Pages...")
        status, data = api_call(
            "PATCH", f"/repos/{OWNER}/{REPO}",
            body={"private": False, "visibility": "public"},
            token=token
        )
        print(f"PATCH visibility -> {status}")
        if status == 200:
            print("Repo is now PUBLIC")
        else:
            print(f"Error: {data}")
            return

    # Now enable Pages
    print("\nEnabling GitHub Pages...")
    status, data = api_call(
        "POST", f"/repos/{OWNER}/{REPO}/pages",
        body={"build_type": "workflow"},
        token=token
    )
    print(f"POST /pages -> {status}: {json.dumps(data)[:200]}")

    if status in (200, 201):
        print(f"\nPAGES LIVE at: https://treystu.github.io/{REPO}/")
    elif status == 409:
        # Already exists, just update source
        status2, data2 = api_call(
            "PUT", f"/repos/{OWNER}/{REPO}/pages",
            body={"build_type": "workflow"},
            token=token
        )
        print(f"PUT /pages -> {status2}: {json.dumps(data2)[:200]}")
        print(f"Pages URL: https://treystu.github.io/{REPO}/")
    else:
        print(f"\nManual step needed:")
        print(f"  1. Go to https://github.com/{OWNER}/{REPO}/settings/pages")
        print(f"  2. Under Build and deployment, select: Source = GitHub Actions")
        print(f"  3. Click Save")

if __name__ == "__main__":
    main()
