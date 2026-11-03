"""Poll until the og-card.png from the latest commit is served by GitHub Pages."""
import sys, time, urllib.request
sys.stdout.reconfigure(encoding='utf-8')
url = 'https://treystu.github.io/BigEnergyCo/assets/og-card.png'
for i in range(15):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=20) as r:
            print(f'og-card live: {r.status} {r.headers.get("Content-Type")} {r.headers.get("Content-Length")} bytes')
            sys.exit(0)
    except Exception as e:
        print(f'[{i+1}] waiting... {e}')
        time.sleep(10)
print('NOT LIVE after polling')
sys.exit(1)
