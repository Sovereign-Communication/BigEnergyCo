"""Verify the SEO URL fix is live on GitHub Pages after deploy.
Polls sitemap.xml until retargeted, then checks article canonical/CTAs and robots.txt."""
import sys, time, urllib.request
sys.stdout.reconfigure(encoding='utf-8')

BASE = 'https://treystu.github.io/BigEnergyCo'
ARTICLE = BASE + '/blog/diy-vs-prebuilt-sodium-ion-lifepo4-battery-storage/'
UA = {'User-Agent': 'Mozilla/5.0'}

def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, r.read().decode('utf-8', 'replace')

print('Waiting for Pages deploy (polling sitemap.xml)...')
sitemap_ok = False
for i in range(15):
    try:
        st, body = fetch(BASE + '/sitemap.xml')
        if 'treystu.github.io/BigEnergyCo' in body and 'bigenergyco.github.io' not in body:
            sitemap_ok = True
            break
    except Exception as e:
        print(f'  [{i+1}] {e}')
    time.sleep(10)
print(f'  sitemap.xml retargeted: {"PASS" if sitemap_ok else "FAIL (still old or unreachable)"}')

results = []
try:
    st, art = fetch(ARTICLE)
    results.append(('article returns 200', st == 200, str(st)))
    results.append(('canonical retargeted',
                    'rel="canonical" href="https://treystu.github.io/BigEnergyCo/blog/diy-vs-prebuilt-sodium-ion-lifepo4-battery-storage/"' in art, ''))
    results.append(('no bigenergyco.github.io left in article', 'bigenergyco.github.io' not in art, ''))
    results.append(('relative CTA links present', art.count('href="../../"') >= 2,
                    f'{art.count(chr(34) + "../../" + chr(34))} found'))
except Exception as e:
    results.append(('article fetch', False, str(e)))

try:
    st, rob = fetch(BASE + '/robots.txt')
    results.append(('robots.txt sitemap line fixed',
                    'Sitemap: https://treystu.github.io/BigEnergyCo/sitemap.xml' in rob, ''))
except Exception as e:
    results.append(('robots.txt fetch', False, str(e)))

try:
    st, blog = fetch(BASE + '/blog/')
    results.append(('blog listing returns 200', st == 200, str(st)))
    results.append(('blog listing has no old domain', 'bigenergyco.github.io' not in blog, ''))
except Exception as e:
    results.append(('blog listing fetch', False, str(e)))

print('\n=== LIVE CHECKS ===')
for name, ok, detail in results:
    print(f'  [{"PASS" if ok else "FAIL"}] {name}' + (f' — {detail}' if detail else ''))
print(f'\nverdict: {"ALL GREEN" if sitemap_ok and all(r[1] for r in results) else "ISSUES REMAIN"}')
