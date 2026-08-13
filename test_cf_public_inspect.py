import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request

url = "https://attorney-harbour-occurred-manitoba.trycloudflare.com/v1/contract/web/AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov/"
print(f"Fetching public URL: {url}")

req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        html = resp.read().decode('utf-8', errors='replace')
        print(f"Status: {resp.status}")
        print(f"HTML Length: {len(html)} bytes")
        print("First 1500 chars of HTML:")
        print(html[:1500])
except Exception as e:
    print(f"Error: {e}")
