import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request

url = "http://127.0.0.1:7510/v1/contract/web/AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov/"
r = urllib.request.urlopen(url, timeout=15)
html = r.read().decode('utf-8', errors='replace')

# Find and show the full iframe tag
iframe_idx = html.lower().find('<iframe')
end_idx = html.find('>', iframe_idx)
print("Full iframe tag:")
print(repr(html[iframe_idx:end_idx+1]))
print()
print("Next 500 chars after iframe:")
print(html[end_idx+1:end_idx+500])
print()
# Show any script near top 
print("First 500 chars of body:")
body_idx = html.find('<body')
print(html[body_idx:body_idx+500])
