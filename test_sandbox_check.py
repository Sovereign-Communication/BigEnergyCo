import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request

url = "http://127.0.0.1:7510/v1/contract/web/AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov/"
r = urllib.request.urlopen(url, timeout=15)
html = r.read().decode('utf-8', errors='replace')

iframe_idx = html.lower().find('<iframe')
end_idx = html.find('>', iframe_idx)
iframe_tag = html[iframe_idx:end_idx+1]
print("IFRAME TAG:")
print(iframe_tag)
print()
print("allow-same-origin present:", 'allow-same-origin' in iframe_tag)
print()
# Also check what the data-src is set to
datasrc_idx = html.find('data-src=')
print("data-src value:")
print(html[datasrc_idx:datasrc_idx+100])
