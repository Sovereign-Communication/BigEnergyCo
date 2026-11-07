import sys, time
sys.stdout.reconfigure(encoding='utf-8')
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

SITE_URL = "https://treystu.github.io/BigEnergyCo/"

def run():
    print(f"\n=======================================================")
    print(f"  LIVE GITHUB PAGES E2E VERIFICATION")
    print(f"  URL: {SITE_URL}")
    print(f"=======================================================\n")

    opts = Options()
    opts.add_argument('--headless=new')
    opts.add_argument('--disable-gpu')
    opts.add_argument('--no-sandbox')
    opts.set_capability("goog:loggingPrefs", {"browser": "ALL"})
    driver = webdriver.Chrome(options=opts)
    wait = WebDriverWait(driver, 15)

    passed = 0
    failed = 0

    try:
        print("[1] Loading live GitHub Pages site...")
        driver.get(SITE_URL)
        time.sleep(3)
        print(f"  Page Title: {driver.title}")
        assert "BigEnergyCo" in driver.title
        passed += 1

        print("\n[2] Testing Sizing Modal UI...")
        btn = wait.until(EC.element_to_be_clickable((By.ID, "btnHeroSizing")))
        btn.click()
        time.sleep(1)
        modal = driver.find_element(By.ID, "sizingModal")
        disp = driver.execute_script("return window.getComputedStyle(arguments[0]).display;", modal)
        assert disp == 'flex'
        print("  ✅ PASS: Sizing modal opened successfully")
        passed += 1

        print("\n[3] Testing Live Groq AI Chatbot in Browser UI...")
        chat_input = wait.until(EC.presence_of_element_located((By.ID, "chatInput")))
        chat_input.clear()
        chat_input.send_keys("Aloha! What are the specs for a 100kWh LFP bank?")
        driver.find_element(By.ID, "btnSendChat").click()

        print("  Waiting up to 25s for Groq (openai/gpt-oss-120b) response via Cloudflare Worker...")
        bot_reply = None
        for _ in range(25):
            time.sleep(1)
            msgs = driver.find_elements(By.CSS_SELECTOR, "#chatWindow .chat-msg.bot")
            if msgs:
                last_txt = msgs[-1].text
                if last_txt and "Thinking" not in last_txt and len(last_txt) > 20:
                    bot_reply = last_txt
                    break

        if bot_reply and ("kWh" in bot_reply or "Aloha" in bot_reply or "LFP" in bot_reply or "EVE" in bot_reply):
            print(f"  ✅ PASS: AI Chatbot replied in UI:")
            print(f"     '{bot_reply[:140]}...'")
            passed += 1
        else:
            print(f"  ❌ FAIL: Bot reply unexpected or timeout: {bot_reply}")
            failed += 1

        print("\n[4] Testing Lead Follow-up Form in Browser UI...")
        try:
            driver.find_element(By.ID, "btnCloseSizing").click()
            time.sleep(0.5)
        except Exception:
            pass

        btn_lead = wait.until(EC.element_to_be_clickable((By.ID, "btnNavFollowUp")))
        btn_lead.click()
        time.sleep(1)

        driver.find_element(By.ID, "leadName").send_keys("Live GitHub Pages User")
        driver.find_element(By.ID, "leadEmail").send_keys("liveuser@bigenergyco.com")
        driver.find_element(By.ID, "leadPhone").send_keys("808-555-0188")
        driver.find_element(By.ID, "leadLocation").send_keys("Big Island, Hawaii")
        driver.find_element(By.CSS_SELECTOR, "#leadForm button[type='submit']").click()

        lead_status = None
        for _ in range(10):
            time.sleep(1)
            status_elem = driver.find_element(By.ID, "leadStatus")
            txt = status_elem.text
            if txt and "Saving" not in txt:
                lead_status = txt
                break

        if lead_status and ("✅" in lead_status or "recorded" in lead_status or "submitted" in lead_status):
            print(f"  ✅ PASS: Lead submitted successfully in UI: '{lead_status}'")
            passed += 1
        else:
            print(f"  ❌ FAIL: Lead submission status: {lead_status}")
            failed += 1

    except Exception as e:
        print(f"❌ Exception occurred: {e}")
        failed += 1
    finally:
        driver.quit()

    print(f"\n=======================================================")
    print(f"  SUMMARY: {passed} PASSED / {failed} FAILED")
    print(f"=======================================================\n")
    if failed > 0:
        sys.exit(1)

if __name__ == "__main__":
    run()
