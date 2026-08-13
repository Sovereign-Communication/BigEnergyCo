import sys
sys.stdout.reconfigure(encoding='utf-8')
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

CONTRACT_HASH = "AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov"

opts = Options()
opts.add_argument('--headless=new')
opts.set_capability("goog:loggingPrefs", {"browser": "ALL"})
driver = webdriver.Chrome(options=opts)

driver.get(f"http://127.0.0.1:7509/v1/contract/web/{CONTRACT_HASH}/")
time.sleep(4)

iframes = driver.find_elements(By.TAG_NAME, "iframe")
if iframes:
    driver.switch_to.frame(iframes[0])

# Try fetch and see what error we get
result = driver.execute_script("""
    var done = false;
    var result = null;
    fetch('https://attorney-harbour-occurred-manitoba.trycloudflare.com/api/chat', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({message:'hi',history:[]})
    })
    .then(r => r.json()).then(d => { result = 'SUCCESS: ' + d.reply.slice(0,50); })
    .catch(e => { result = 'ERROR: ' + String(e); });
    return 'fetch started';
""")
print("JS result:", result)
time.sleep(5)

# Get final result
final = driver.execute_script("return window._fetchResult || 'still pending'")

# Get all console errors
driver.switch_to.default_content()
logs = driver.get_log("browser")
print(f"\nAll browser console logs ({len(logs)}):")
for l in logs:
    print(f"  [{l['level']}] {l['message'][:200]}")

driver.quit()
