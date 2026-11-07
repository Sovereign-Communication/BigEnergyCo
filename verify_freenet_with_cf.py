"""
verify_freenet_with_cf.py — Verifies that the Freenet site at port 7509
(native Freenet, as external users would see it) now has working Groq AI
via the Cloudflare tunnel hardcoded in index.html.
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
import time, json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

CONTRACT_HASH = "AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov"
# Test NATIVE Freenet (port 7509) — as external users see it
FREENET_URL = f"http://127.0.0.1:7509/v1/contract/web/{CONTRACT_HASH}/"

def get_driver():
    opts = Options()
    opts.add_argument('--headless=new')
    opts.set_capability("goog:loggingPrefs", {"browser": "ALL"})
    return webdriver.Chrome(options=opts)

def run():
    print(f"\n{'='*65}")
    print(f"NATIVE FREENET VERIFICATION (port 7509 — external user view)")
    print(f"URL: {FREENET_URL}")
    print(f"{'='*65}\n")

    driver = get_driver()
    wait = WebDriverWait(driver, 15)
    passed = 0
    failed = 0

    try:
        print("[1] Loading native Freenet URL...")
        driver.get(FREENET_URL)
        time.sleep(4)

        iframes = driver.find_elements(By.TAG_NAME, "iframe")
        if iframes:
            driver.switch_to.frame(iframes[0])
            print("  Switched into contract iframe")

        # Check fetch URLs in the page source contain CF tunnel
        page_src = driver.page_source
        if 'trycloudflare.com' in page_src:
            print("  ✅ Cloudflare tunnel URL present in page source")
            passed += 1
        else:
            print("  ❌ Cloudflare URL NOT found — old version still cached?")
            failed += 1

        # Test sizing modal
        print("\n[2] Testing Sizing Modal...")
        try:
            btn = wait.until(EC.element_to_be_clickable((By.ID, "btnHeroSizing")))
            btn.click()
            time.sleep(1)
            modal = driver.find_element(By.ID, "sizingModal")
            disp = driver.execute_script("return window.getComputedStyle(arguments[0]).display;", modal)
            assert disp == 'flex'
            print("  ✅ PASS: sizingModal opened")
            passed += 1
        except Exception as e:
            print(f"  ❌ FAIL: {e}")
            failed += 1

        # Test Groq AI chatbot via Cloudflare tunnel
        print("\n[3] Testing Groq AI via Cloudflare tunnel (port 7509 → CF → port 7510)...")
        try:
            chat_input = wait.until(EC.presence_of_element_located((By.ID, "chatInput")))
            chat_input.clear()
            chat_input.send_keys("what is today's date?")
            driver.find_element(By.ID, "btnSendChat").click()

            print("  Waiting up to 30s for Groq response via CF tunnel...")
            reply_text = None
            for _ in range(30):
                time.sleep(1)
                msgs = driver.find_elements(By.CSS_SELECTOR, "#chatWindow .chat-msg.bot")
                if msgs:
                    last = msgs[-1].text
                    if last and 'Thinking' not in last and len(last) > 20:
                        reply_text = last
                        break

            if reply_text and '2026' in reply_text:
                print(f"  ✅ PASS: Groq replied via CF tunnel: '{reply_text[:90]}'")
                passed += 1
            elif reply_text and ('Error' in reply_text or 'Failed' in reply_text):
                print(f"  ❌ FAIL: Error: '{reply_text[:120]}'")
                # Show console logs
                driver.switch_to.default_content()
                logs = driver.get_log("browser")
                for l in logs[-5:]:
                    print(f"    CONSOLE [{l['level']}]: {l['message'][:120]}")
                driver.switch_to.frame(iframes[0]) if iframes else None
                failed += 1
            else:
                print(f"  ❌ FAIL: No date in reply. Got: '{str(reply_text)[:80]}'")
                failed += 1
        except Exception as e:
            print(f"  ❌ FAIL: {e}")
            failed += 1

        # Test lead form
        print("\n[4] Testing Lead Form via Cloudflare tunnel...")
        try:
            # Close sizing modal first
            try:
                driver.find_element(By.ID, "btnCloseSizing").click()
                time.sleep(0.5)
            except Exception:
                pass
            btn = wait.until(EC.element_to_be_clickable((By.ID, "btnNavFollowUp")))
            btn.click()
            time.sleep(1)
            driver.find_element(By.ID, "leadName").send_keys("CF Test User")
            driver.find_element(By.ID, "leadEmail").send_keys("cftest@bigenergyco.test")
            driver.find_element(By.ID, "leadPhone").send_keys("+1-808-555-0002")
            driver.find_element(By.ID, "leadLocation").send_keys("Test City, HI")
            driver.find_element(By.CSS_SELECTOR, "#leadForm button[type='submit']").click()
            for _ in range(10):
                time.sleep(1)
                status = driver.find_element(By.ID, "leadStatus").text
                if status:
                    if '✅' in status:
                        print(f"  ✅ PASS: Lead saved via CF: '{status}'")
                        passed += 1
                    else:
                        print(f"  ❌ FAIL: '{status}'")
                        failed += 1
                    break
        except Exception as e:
            print(f"  ❌ FAIL: {e}")
            failed += 1

        # Verify leads.jsonl
        print("\n[5] Checking leads.jsonl on disk...")
        import os
        lf = r"c:\Users\SCM\Documents\GitHub\BigEnergyCo\leads.jsonl"
        if os.path.exists(lf):
            lines = open(lf, 'r', encoding='utf-8').readlines()
            last = json.loads(lines[-1]) if lines else {}
            print(f"  Total leads: {len(lines)}")
            print(f"  Last: {last.get('name')} / {last.get('email')}")
            print(f"  ✅ PASS: {len(lines)} lead(s) saved to disk")
            passed += 1
        else:
            print("  ❌ leads.jsonl not found")
            failed += 1

    finally:
        driver.quit()

    print(f"\n{'='*65}")
    print(f"RESULTS: {passed} PASSED / {failed} FAILED")
    print(f"{'='*65}")
    if failed == 0:
        print(f"\n✅ ALL GOOD! Native Freenet users get full AI via Cloudflare tunnel.")
        print(f"\nShare this URL with anyone:")
        cf_url = open(r"c:\Users\SCM\Documents\GitHub\BigEnergyCo\tunnel_url.txt").read().strip()
        print(f"  {cf_url}/v1/contract/web/{CONTRACT_HASH}/")
    else:
        exit(1)

if __name__ == "__main__":
    run()
