"""
Full automated browser verification for BigEnergyCo via proxy on port 7510.
Tests: modal buttons, Groq AI chatbot, lead form submission.
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

CONTRACT_HASH = "AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov"
PROXY_URL = f"http://127.0.0.1:7510/v1/contract/web/{CONTRACT_HASH}/"

def get_driver():
    options = Options()
    options.add_argument('--headless=new')
    return webdriver.Chrome(options=options)

def switch_to_contract_iframe(driver, wait):
    """Switch into the Freenet iframe if present, or stay on main page."""
    try:
        iframe = wait.until(EC.presence_of_element_located((By.TAG_NAME, "iframe")))
        driver.switch_to.frame(iframe)
        print("[OK] Switched into Freenet contract iframe")
    except Exception:
        print("[INFO] No iframe found, testing on main page directly")

def test_all():
    print(f"\n{'='*60}")
    print(f"BigEnergyCo Proxy Verification Test")
    print(f"URL: {PROXY_URL}")
    print(f"{'='*60}\n")

    driver = get_driver()
    wait = WebDriverWait(driver, 15)
    passed = 0
    failed = 0

    try:
        # --- Load the page ---
        print("[1] Loading page via proxy...")
        driver.get(PROXY_URL)
        time.sleep(3)
        switch_to_contract_iframe(driver, WebDriverWait(driver, 5))

        # --- Test: Sizing Modal Button ---
        print("\n[2] Testing Sizing Modal button...")
        try:
            btn = wait.until(EC.element_to_be_clickable((By.ID, "btnHeroSizing")))
            btn.click()
            time.sleep(1)
            modal = driver.find_element(By.ID, "sizingModal")
            display = driver.execute_script("return window.getComputedStyle(arguments[0]).display;", modal)
            assert display == 'flex', f"Expected flex, got {display}"
            print(f"  ✅ PASS: sizingModal opened (display=flex)")
            passed += 1
        except Exception as e:
            print(f"  ❌ FAIL: sizingModal - {e}")
            failed += 1

        # --- Test: Groq AI Chatbot ---
        print("\n[3] Testing Groq AI chatbot...")
        try:
            chat_input = wait.until(EC.presence_of_element_located((By.ID, "chatInput")))
            chat_input.clear()
            chat_input.send_keys("hi there")
            btn_send = driver.find_element(By.ID, "btnSendChat")
            btn_send.click()
            print("  Waiting for Groq AI response (up to 20s)...")
            time.sleep(2)
            # Wait for loading to disappear and real reply to appear
            for i in range(18):
                time.sleep(1)
                chat_window = driver.find_element(By.ID, "chatWindow")
                msgs = chat_window.find_elements(By.CLASS_NAME, "chat-msg")
                bot_msgs = [m for m in msgs if 'bot' in (m.get_attribute('class') or '')]
                last_bot = bot_msgs[-1].text if bot_msgs else ''
                if last_bot and 'Thinking' not in last_bot and 'Aloha!' in last_bot:
                    print(f"  ✅ PASS: Groq replied: '{last_bot[:80]}'")
                    passed += 1
                    break
                if last_bot and 'Error' in last_bot:
                    print(f"  ❌ FAIL: Got error: '{last_bot[:120]}'")
                    failed += 1
                    break
            else:
                msgs_text = [m.text for m in bot_msgs]
                print(f"  ❌ FAIL: No valid Groq reply after 20s. Bot msgs: {msgs_text}")
                failed += 1
        except Exception as e:
            print(f"  ❌ FAIL: Chatbot test - {e}")
            failed += 1

        # --- Test: Groq date question ---
        print("\n[4] Testing Groq date question...")
        try:
            chat_input = driver.find_element(By.ID, "chatInput")
            chat_input.clear()
            chat_input.send_keys("what is today's date?")
            btn_send = driver.find_element(By.ID, "btnSendChat")
            btn_send.click()
            print("  Waiting for date answer (up to 20s)...")
            time.sleep(2)
            for i in range(18):
                time.sleep(1)
                chat_window = driver.find_element(By.ID, "chatWindow")
                msgs = chat_window.find_elements(By.CLASS_NAME, "chat-msg")
                bot_msgs = [m for m in msgs if 'bot' in (m.get_attribute('class') or '')]
                last_bot = bot_msgs[-1].text if bot_msgs else ''
                if last_bot and 'Thinking' not in last_bot and '2026' in last_bot:
                    print(f"  ✅ PASS: Date answer contains '2026': '{last_bot[:80]}'")
                    passed += 1
                    break
                if last_bot and 'Error' in last_bot:
                    print(f"  ❌ FAIL: Got error: '{last_bot[:120]}'")
                    failed += 1
                    break
            else:
                print(f"  ❌ FAIL: No date answer with 2026 after 20s. Last: '{last_bot[:80]}'")
                failed += 1
        except Exception as e:
            print(f"  ❌ FAIL: Date test - {e}")
            failed += 1

        # Close sizing modal
        try:
            close_btn = driver.find_element(By.ID, "btnCloseSizing")
            close_btn.click()
            time.sleep(0.5)
        except Exception:
            pass

        # --- Test: Lead Follow-Up Modal ---
        print("\n[5] Testing Follow-Up Lead Modal...")
        try:
            btn_lead = wait.until(EC.element_to_be_clickable((By.ID, "btnNavFollowUp")))
            btn_lead.click()
            time.sleep(1)
            modal = driver.find_element(By.ID, "leadModal")
            display = driver.execute_script("return window.getComputedStyle(arguments[0]).display;", modal)
            assert display == 'flex', f"Expected flex, got {display}"
            print(f"  ✅ PASS: leadModal opened (display=flex)")
            passed += 1
        except Exception as e:
            print(f"  ❌ FAIL: leadModal - {e}")
            failed += 1

        # --- Test: Lead Form Submission ---
        print("\n[6] Testing Lead Form Submission...")
        try:
            driver.find_element(By.ID, "leadName").send_keys("Test User")
            driver.find_element(By.ID, "leadEmail").send_keys("test@bigenergyco.test")
            driver.find_element(By.ID, "leadPhone").send_keys("+1-808-555-9999")
            driver.find_element(By.ID, "leadCapacity").send_keys("100 kWh")
            driver.find_element(By.ID, "leadLocation").send_keys("Pahoa, HI")
            driver.find_element(By.ID, "leadNotes").send_keys("Automated test submission")
            # Submit via form submit button
            submit_btn = driver.find_element(By.CSS_SELECTOR, "#leadForm button[type='submit']")
            submit_btn.click()
            print("  Waiting for lead submission response...")
            for i in range(8):
                time.sleep(1)
                status = driver.find_element(By.ID, "leadStatus").text
                if '✅' in status:
                    print(f"  ✅ PASS: Lead submitted: '{status}'")
                    passed += 1
                    break
                if '⚠️' in status:
                    print(f"  ❌ FAIL: Lead error: '{status}'")
                    failed += 1
                    break
            else:
                status = driver.find_element(By.ID, "leadStatus").text
                print(f"  ❌ FAIL: No success after 8s. Status: '{status}'")
                failed += 1
        except Exception as e:
            print(f"  ❌ FAIL: Lead form - {e}")
            failed += 1

    finally:
        driver.quit()

    print(f"\n{'='*60}")
    print(f"RESULTS: {passed} PASSED / {failed} FAILED")
    print(f"{'='*60}")

    if failed > 0:
        exit(1)

if __name__ == "__main__":
    test_all()
