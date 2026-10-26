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
    print(f"  LIVE GITHUB PAGES + CLOUDFLARE WORKER E2E VERIFICATION")
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

        print("\n[2] Testing Sizing Modal...")
        btn = wait.until(EC.element_to_be_clickable((By.ID, "btnHeroSizing")))
        btn.click()
        time.sleep(1)
        modal = driver.find_element(By.ID, "sizingModal")
        disp = driver.execute_script("return window.getComputedStyle(arguments[0]).display;", modal)
        assert disp == 'flex'
        print("  ✅ PASS: Sizing modal opened successfully")
        passed += 1

        print("\n[3] Testing 'Get My Free Estimate' Intake Calculator...")
        btn_calc = wait.until(EC.element_to_be_clickable((By.ID, "btnIntakeCalculate")))
        btn_calc.click()
        time.sleep(1)
        print("  Waiting for AI Advisor intake calculation...")
        intake_reply = None
        for _ in range(25):
            time.sleep(1)
            msgs = driver.find_elements(By.CSS_SELECTOR, "#chatWindow .chat-msg.bot")
            if len(msgs) > 1:
                last_txt = msgs[-1].text
                if last_txt and "Thinking" not in last_txt and len(last_txt) > 20:
                    intake_reply = last_txt
                    break

        if intake_reply:
            print(f"  ✅ PASS: Intake Calculator AI recommendation received:")
            print(f"     '{intake_reply[:140]}...'")
            passed += 1
        else:
            print(f"  ❌ FAIL: Intake recommendation timeout")
            failed += 1

        print("\n[4] Testing Interactive AI Chatbot with custom query (openai/gpt-oss-120b)...")
        chat_input = wait.until(EC.presence_of_element_located((By.ID, "chatInput")))
        chat_input.clear()
        chat_input.send_keys("What is the cost comparison between EVE MB31 cells and Tesla Powerwalls?")
        driver.find_element(By.ID, "btnSendChat").click()

        print("  Waiting up to 25s for Groq (openai/gpt-oss-120b) response via Cloudflare Worker...")
        bot_reply = None
        for _ in range(25):
            time.sleep(1)
            msgs = driver.find_elements(By.CSS_SELECTOR, "#chatWindow .chat-msg.bot")
            if len(msgs) > 2:
                last_txt = msgs[-1].text
                if last_txt and "Thinking" not in last_txt and len(last_txt) > 20:
                    bot_reply = last_txt
                    break

        if bot_reply and ("Powerwall" in bot_reply or "EVE" in bot_reply or "$" in bot_reply or "kWh" in bot_reply or "Aloha" in bot_reply):
            print(f"  ✅ PASS: AI Chatbot replied in live UI:")
            print(f"     '{bot_reply[:140]}...'")
            passed += 1
        else:
            print(f"  ❌ FAIL: Bot reply unexpected or timeout: {bot_reply}")
            failed += 1

        print("\n[5] Testing Legal & Terms Modal...")
        driver.execute_script("window.openLegalModal();")
        time.sleep(1)
        legal_modal = driver.find_element(By.ID, "legalModal")
        legal_disp = driver.execute_script("return window.getComputedStyle(arguments[0]).display;", legal_modal)
        assert legal_disp == 'flex'
        print("  ✅ PASS: Terms and Legal disclaimer modal verified")
        passed += 1

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
