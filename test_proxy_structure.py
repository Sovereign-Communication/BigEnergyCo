import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request

url = "http://127.0.0.1:7510/v1/contract/web/AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov/"
r = urllib.request.urlopen(url, timeout=15)
html = r.read().decode('utf-8', errors='replace')

# Search for iframe
iframe_idx = html.lower().find('<iframe')
print(f"Total response length: {len(html)} bytes")
print(f"iframe found at index: {iframe_idx}")
if iframe_idx >= 0:
    print("iframe context (100 chars around it):")
    print(html[max(0,iframe_idx-20):iframe_idx+200])
else:
    print("No iframe found - page is served directly!")
    
# Search for sandbox
sandbox_idx = html.lower().find('sandbox')
print(f"\n'sandbox' found at index: {sandbox_idx}")
if sandbox_idx >= 0:
    print(html[max(0,sandbox_idx-30):sandbox_idx+100])

# Look for our BigEnergyCo content
bec_idx = html.find('BigEnergyCo')
print(f"\n'BigEnergyCo' found at index: {bec_idx}")

# Look for fetch or api/chat
api_idx = html.find('/api/chat')
print(f"\n'/api/chat' found at index: {api_idx}")
if api_idx >= 0:
    print(html[max(0,api_idx-50):api_idx+100])
