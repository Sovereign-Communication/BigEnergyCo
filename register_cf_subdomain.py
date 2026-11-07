import sys, json, urllib.request, os
sys.stdout.reconfigure(encoding='utf-8')

config_path = r"C:\Users\SCM\AppData\Roaming\xdg.config\.wrangler\config\default.toml"
if not os.path.exists(config_path):
    print("Wrangler config not found")
    sys.exit(1)

token = None
with open(config_path, 'r', encoding='utf-8') as f:
    for line in f:
        if line.strip().startswith('oauth_token ='):
            token = line.split('=', 1)[1].strip().strip('"').strip("'")
            break

if not token:
    print("OAuth token not found in config")
    sys.exit(1)

print("Found OAuth token! Testing Cloudflare API...")
account_id = "0e758b340d7cb5e4f75d90871c42fda7"

# Check available subdomain options
subdomains_to_try = ["bigenergyco", "treystu", "lucasballek"]

for sub in subdomains_to_try:
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/subdomain"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        data=json.dumps({"subdomain": sub}).encode('utf-8'),
        method="PUT"
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print(f"✅ Registered workers.dev subdomain: {sub}.workers.dev")
            print(f"API Response: {data}")
            break
    except urllib.error.HTTPError as e:
        err = e.read().decode('utf-8', errors='ignore')
        print(f"❌ Subdomain '{sub}' ({e.code}): {err}")
    except Exception as e:
        print(f"⚠️ Error with '{sub}': {e}")
