"""
Live browser verification test — opens Chrome with DevTools logging
to capture console errors and verify real Groq AI chat + lead save.
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
import time
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service

CONTRACT_HASH = "AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov"
PROXY_URL = f"http://127.0.0.1:7510/v1/contract/web/{CONTRACT_HASH}/"
OLD_URL   = f"http://127.0.0.1:7509/v1/contract/web/{CONTRACT_HASH}/"

def get_driver(headless=True):
    opts = Options()
    if headless:
        opts.add_argument('--headless=new')
    # Enable browser console log capture
    opts.set_capability("goog:loggingPrefs", {"browser": "ALL"})
    opts.add_argument('--no-sandbox')
    opts.add_argument('--disable-dev-shm-usage')
    return webdriver.Chrome(options=opts)

def run_live_test():
    print(f"\n{'='*65}")
    print(f"LIVE BigEnergyCo Verification via Proxy")
    print(f"Proxy URL: {PROXY_URL}")
    print(f"{'='*65}\n")

    driver = get_driver(headless=True)
    wait = WebDriverWait(driver, 15)
    passed = 0
    failed = 0

    try:
        # ── Load page ──────────────────────────────────────────────────
        print("[STEP 1] Loading proxy URL...")
        driver.get(PROXY_URL)
        time.sleep(4)
        print(f"  Page title: '{driver.title}'")
        print(f"  Current URL: {driver.current_url}")

        # Switch into iframe
        iframes = driver.find_elements(By.TAG_NAME, "iframe")
        print(f"  iframes found: {len(iframes)}")
        if iframes:
            driver.switch_to.frame(iframes[0])
            print("  Switched into contract iframe")
        else:
            print("  WARNING: No iframe - testing on main page")

        # ── Capture JS console errors ──────────────────────────────────
        driver.switch_to.default_content()
        console_logs = driver.get_log("browser")
        errors = [l for l in console_logs if l.get('level') in ('SEVERE','WARNING')]
        if errors:
            print(f"\n  Browser console errors ({len(errors)}):")
            for e in errors[:5]:
                print(f"    [{e['level']}] {e['message'][:120]}")
        else:
            print("  No browser console errors")
        if iframes:
            driver.switch_to.frame(iframes[0])

        # ── Test sizing modal ──────────────────────────────────────────
        print("\n[STEP 2] Opening AI Sizing Modal...")
        try:
            btn = wait.until(EC.element_to_be_clickable((By.ID, "btnHeroSizing")))
            btn.click()
            time.sleep(1)
            modal = driver.find_element(By.ID, "sizingModal")
            disp = driver.execute_script("return window.getComputedStyle(arguments[0]).display;", modal)
            assert disp == 'flex', f"got display={disp}"
            print(f"  ✅ PASS: sizingModal opened")
            passed += 1
        except Exception as e:
            print(f"  ❌ FAIL: {e}")
            failed += 1

        # ── Test Groq chatbot ──────────────────────────────────────────
        print("\n[STEP 3] Sending 'what is today date?' to Groq AI...")
        try:
            chat_input = wait.until(EC.presence_of_element_located((By.ID, "chatInput")))
            chat_input.clear()
            chat_input.send_keys("what is today's date?")
            driver.find_element(By.ID, "btnSendChat").click()

            print("  Waiting up to 25s for Groq response...")
            reply_text = None
            for _ in range(25):
                time.sleep(1)
                msgs = driver.find_elements(By.CSS_SELECTOR, "#chatWindow .chat-msg.bot")
                if msgs:
                    last = msgs[-1].text
                    if last and 'Thinking' not in last and 'Aloha!' not in last or '2026' in last:
                        reply_text = last
                        break
                    if 'Error' in last or 'Failed' in last:
                        reply_text = last
                        break

            if reply_text and '2026' in reply_text:
                print(f"  ✅ PASS: Groq replied with date: '{reply_text[:100]}'")
                passed += 1
            elif reply_text and 'Error' in reply_text:
                print(f"  ❌ FAIL: Error response: '{reply_text[:120]}'")
                # Capture console logs for diagnosis
                driver.switch_to.default_content()
                logs2 = driver.get_log("browser")
                for l in logs2[-10:]:
                    print(f"    CONSOLE [{l['level']}]: {l['message'][:120]}")
                driver.switch_to.frame(iframes[0]) if iframes else None
                failed += 1
            else:
                all_msgs = [m.text for m in driver.find_elements(By.CSS_SELECTOR, "#chatWindow .chat-msg")]
                print(f"  ❌ FAIL: No date answer. All chat msgs: {all_msgs}")
                failed += 1
        except Exception as e:
            print(f"  ❌ FAIL Groq test: {e}")
            failed += 1

        # Also test "hi" greeting
        print("\n[STEP 4] Testing 'hi' greeting...")
        try:
            chat_input = driver.find_element(By.ID, "chatInput")
            chat_input.clear()
            chat_input.send_keys("hi")
            driver.find_element(By.ID, "btnSendChat").click()
            time.sleep(2)
            for _ in range(15):
                time.sleep(1)
                msgs = driver.find_elements(By.CSS_SELECTOR, "#chatWindow .chat-msg.bot")
                if msgs:
                    last = msgs[-1].text
                    if last and 'Thinking' not in last and len(last) > 20:
                        if 'Error' in last or 'Failed' in last:
                            print(f"  ❌ FAIL: '{last[:100]}'")
                            failed += 1
                        else:
                            print(f"  ✅ PASS: Groq replied to 'hi': '{last[:100]}'")
                            passed += 1
                        break
        except Exception as e:
            print(f"  ❌ FAIL hi test: {e}")
            failed += 1

        # Close sizing modal
        try:
            driver.find_element(By.ID, "btnCloseSizing").click()
            time.sleep(0.5)
        except Exception:
            pass

        # ── Test lead form ─────────────────────────────────────────────
        print("\n[STEP 5] Opening Follow-Up Lead Form...")
        try:
            btn_lead = wait.until(EC.element_to_be_clickable((By.ID, "btnNavFollowUp")))
            btn_lead.click()
            time.sleep(1)
            modal = driver.find_element(By.ID, "leadModal")
            disp = driver.execute_script("return window.getComputedStyle(arguments[0]).display;", modal)
            assert disp == 'flex', f"got display={disp}"
            print(f"  ✅ PASS: leadModal opened")
            passed += 1

            # Fill and submit
            print("\n[STEP 6] Submitting lead contact form...")
            driver.find_element(By.ID, "leadName").send_keys("Live Test User")
            driver.find_element(By.ID, "leadEmail").send_keys("livetest@bigenergyco.test")
            driver.find_element(By.ID, "leadPhone").send_keys("+1-808-555-0001")
            driver.find_element(By.ID, "leadCapacity").send_keys("200 kWh")
            driver.find_element(By.ID, "leadLocation").send_keys("Pahoa, Hawaii")
            driver.find_element(By.ID, "leadNotes").send_keys("Live site verification test submission")

            driver.find_element(By.CSS_SELECTOR, "#leadForm button[type='submit']").click()
            print("  Waiting for response...")
            for _ in range(10):
                time.sleep(1)
                status = driver.find_element(By.ID, "leadStatus").text
                if status:
                    if '✅' in status:
                        print(f"  ✅ PASS: Lead saved: '{status}'")
                        passed += 1
                    else:
                        print(f"  ❌ FAIL: Lead error: '{status}'")
                        failed += 1
                    break
            else:
                print(f"  ❌ FAIL: No status after 10s")
                failed += 1
        except Exception as e:
            print(f"  ❌ FAIL lead test: {e}")
            failed += 1

        # ── Verify leads.jsonl ─────────────────────────────────────────
        print("\n[STEP 7] Verifying leads.jsonl on disk...")
        import os
        leads_file = r"c:\Users\SCM\Documents\GitHub\BigEnergyCo\leads.jsonl"
        if os.path.exists(leads_file):
            with open(leads_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            print(f"  Total leads saved: {len(lines)}")
            if lines:
                last = json.loads(lines[-1])
                print(f"  Last lead: {last.get('name')} / {last.get('email')} / {last.get('location')}")
                print(f"  ✅ PASS: leads.jsonl has {len(lines)} lead(s)")
                passed += 1
            else:
                print(f"  ❌ FAIL: leads.jsonl is empty")
                failed += 1
        else:
            print(f"  ❌ FAIL: leads.jsonl not found at {leads_file}")
            failed += 1

    finally:
        driver.quit()

    print(f"\n{'='*65}")
    print(f"FINAL RESULTS: {passed} PASSED / {failed} FAILED")
    print(f"{'='*65}")
    if failed > 0:
        print(f"\n⚠️  Access the working site at:")
        print(f"   http://127.0.0.1:7510/v1/contract/web/{CONTRACT_HASH}/")
        print(f"   (NOT port 7509 - that's raw Freenet without the API bridge)")
        exit(1)
    else:
        print(f"\n✅ All systems functional! Use:")
        print(f"   http://127.0.0.1:7510/v1/contract/web/{CONTRACT_HASH}/")

if __name__ == "__main__":
    run_live_test()
