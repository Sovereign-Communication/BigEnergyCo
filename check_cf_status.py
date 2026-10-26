import sys, json, urllib.request, os
sys.stdout.reconfigure(encoding='utf-8')

config_path = r"C:\Users\SCM\AppData\Roaming\xdg.config\.wrangler\config\default.toml"
token = None
with open(config_path, 'r', encoding='utf-8') as f:
    for line in f:
        if line.strip().startswith('oauth_token ='):
            token = line.split('=', 1)[1].strip().strip('"').strip("'")
            break

account_id = "0e758b340d7cb5e4f75d90871c42fda7"
script_name = "bigenergyco-api"

url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/scripts/{script_name}"
req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        print("Worker script details:")
        print(json.dumps(data, indent=2))
except Exception as e:
    print(f"Error: {e}")

# Check subdomain status
url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/subdomain"
req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        print("\nSubdomain details:")
        print(json.dumps(data, indent=2))
except Exception as e:
    print(f"Error checking subdomain: {e}")
