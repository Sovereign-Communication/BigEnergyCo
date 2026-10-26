import sys, json, urllib.request

config_path = r"C:\Users\SCM\AppData\Roaming\xdg.config\.wrangler\config\default.toml"
token = None
with open(config_path, 'r', encoding='utf-8') as f:
    for line in f:
        if line.strip().startswith('oauth_token ='):
            token = line.split('=', 1)[1].strip().strip('"').strip("'")
            break

account_id = "0e758b340d7cb5e4f75d90871c42fda7"

req = urllib.request.Request(
    f"https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/subdomain",
    headers={"Authorization": f"Bearer {token}"}
)

with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode('utf-8'))
    print("Cloudflare Subdomain API:")
    print(json.dumps(data, indent=2))
