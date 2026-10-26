"""Validate the JSON-LD structured data blocks in the blog article page."""
import sys, re, json
sys.stdout.reconfigure(encoding='utf-8')

path = r'C:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\blog\diy-vs-prebuilt-sodium-ion-lifepo4-battery-storage\index.html'
t = open(path, encoding='utf-8').read()
blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', t, re.S)
print(f'Found {len(blocks)} JSON-LD block(s)')
for i, b in enumerate(blocks, 1):
    try:
        d = json.loads(b)
    except json.JSONDecodeError as e:
        print(f'  Block {i}: INVALID JSON — {e}')
        continue
    nodes = d.get('@graph', [d] if isinstance(d, dict) else d)
    types = [n.get('@type') for n in nodes]
    print(f'  Block {i}: valid JSON — types: {types}')
    for n in nodes:
        if n.get('@type') == 'FAQPage':
            qs = n.get('mainEntity', [])
            print(f'    FAQPage questions: {len(qs)}')
            ok = all(q.get('name') and q.get('acceptedAnswer', {}).get('text') for q in qs)
            print(f'    all questions have name+answer: {ok}')
        if n.get('@type') == 'Article':
            missing = [k for k in ('headline', 'datePublished', 'author', 'publisher') if k not in n]
            print(f'    Article missing recommended fields: {missing or "none"}')
