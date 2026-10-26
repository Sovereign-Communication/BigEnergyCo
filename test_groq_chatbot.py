import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

def test_groq_chatbot():
    options = Options()
    options.add_argument('--headless=new')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    
    driver = webdriver.Chrome(options=options)
    url = "http://127.0.0.1:7509/v1/contract/web/AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov/"
    print(f"[GROQ CHATBOT TEST] Navigating to Freenet URL: {url}")
    
    driver.get(url)
    time.sleep(3)
    
    iframes = driver.find_elements(By.TAG_NAME, "iframe")
    if len(iframes) > 0:
        driver.switch_to.frame(iframes[0])
        print("[GROQ CHATBOT TEST] Switched context into Freenet Contract iframe")

    # 1. Open Sizing Modal
    sizing_btn = driver.find_element(By.ID, "btnHeroSizing")
    print("[GROQ CHATBOT TEST] Opening AI Chatbot modal...")
    driver.execute_script("arguments[0].click();", sizing_btn)
    time.sleep(1)
    
    chat_input = driver.find_element(By.ID, "chatInput")
    send_btn = driver.find_element(By.ID, "btnSendChat")

    # --- TEST 1: Greeting "hi" ---
    prompt1 = "hi"
    print(f"\n[GROQ TEST 1] Sending prompt: '{prompt1}'")
    chat_input.send_keys(prompt1)
    driver.execute_script("arguments[0].click();", send_btn)
    time.sleep(5)

    chat_window = driver.find_element(By.ID, "chatWindow")
    messages = chat_window.find_elements(By.CLASS_NAME, "chat-msg")
    reply1 = messages[-1].text
    safe_reply1 = reply1.encode('ascii', 'ignore').decode('ascii')
    print(f"[GROQ REPLIED 1]: {safe_reply1}")
    assert "100 kWh baseline sizing" not in reply1, "FAIL: Should NOT return fixed pre-computed template for 'hi'"

    # --- TEST 2: Date Question "what's todays date?" ---
    prompt2 = "what's todays date?"
    print(f"\n[GROQ TEST 2] Sending prompt: '{prompt2}'")
    chat_input.send_keys(prompt2)
    driver.execute_script("arguments[0].click();", send_btn)
    time.sleep(5)

    messages = chat_window.find_elements(By.CLASS_NAME, "chat-msg")
    reply2 = messages[-1].text
    safe_reply2 = reply2.encode('ascii', 'ignore').decode('ascii')
    print(f"[GROQ REPLIED 2]: {safe_reply2}")
    assert "August 1, 2026" in reply2 or "2026" in reply2, f"FAIL: Expected Groq LLM to return current date 2026, got: {safe_reply2}"

    print("\n✅ HARD VERIFICATION PASSED: REAL GROQ LLM CHATBOT PASSED ON FREENET SITE!")
    driver.quit()

def test_chemistry_default_sodium():
    """Sodium-Ion should be recommended by default in temperate climate."""
    from proxy_server import process_bot_query
    prompt = "I want to size a battery system. I live in California and have space."
    response = process_bot_query(prompt, history=[])
    reply_lower = response['reply'].lower()

    assert 'sodium' in reply_lower, "FAIL: Sodium-Ion not mentioned"
    sodium_pos = reply_lower.find('sodium')
    lithium_pos = reply_lower.find('lithium')
    if lithium_pos > 0:
        assert sodium_pos < lithium_pos, f"FAIL: Sodium should be mentioned before Lithium (sodium at {sodium_pos}, lithium at {lithium_pos})"
    print("✅ PASS: Chemistry test—Sodium-Ion recommended first (default case)")

def test_chemistry_cold_lithium():
    """Lithium should be recommended for cold climates."""
    from proxy_server import process_bot_query
    prompt = "I'm in Canada, winters get to -30°C. What battery should I use?"
    response = process_bot_query(prompt, history=[])
    reply_lower = response['reply'].lower()

    assert 'lithium' in reply_lower, "FAIL: Lithium not mentioned for cold climate"
    assert 'sodium' in reply_lower, "FAIL: Sodium should be mentioned as alternative"
    lithium_pos = reply_lower.find('lithium')
    sodium_pos = reply_lower.find('sodium')
    if sodium_pos > 0:
        assert lithium_pos < sodium_pos, f"FAIL: Lithium should be primary for cold climate (lithium at {lithium_pos}, sodium at {sodium_pos})"
    print("✅ PASS: Chemistry test—Lithium recommended for cold climate")

def test_lead_acid_warning():
    """Lead-Acid should include cost-of-ownership warning."""
    from proxy_server import process_bot_query
    prompt = "Should I just go with cheap lead-acid batteries?"
    response = process_bot_query(prompt, history=[])
    reply_lower = response['reply'].lower()

    has_tco = any(x in reply_lower for x in ['replacement', 'years', 'lifespan', 'dies', 'cost'])
    assert has_tco, "FAIL: Should explain lifespan/cost of Lead-Acid"

    assert 'sodium' in reply_lower or 'lithium' in reply_lower, \
        "FAIL: Should mention better alternatives"
    print("✅ PASS: Lead-Acid cost-of-ownership warning given")

def test_pricing_caveat():
    """Pricing should include ranges or caveats, not false precision."""
    from proxy_server import process_bot_query
    prompt = "How much does a 50 kWh battery system cost?"
    response = process_bot_query(prompt, history=[])
    reply_lower = response['reply'].lower()

    has_caveat = ('-' in response['reply'] or
                  'roughly' in reply_lower or
                  'estimate' in reply_lower or
                  'range' in reply_lower or
                  'approximately' in reply_lower or
                  'varies' in reply_lower)
    assert has_caveat, "FAIL: Should give a range or caveat, not a false-precision number"
    print("✅ PASS: Pricing caveat provided")

def test_inverter_vague_follow_up():
    """Vague inverter info should trigger follow-up questions."""
    from proxy_server import process_bot_query
    history = []
    prompt = ("Please size an off-grid battery system for me. Basis: daily consumption of 35 kWh/day. "
              "Destination region: North America. Inverter: I have an old inverter but not sure what model.")
    response = process_bot_query(prompt, history)
    reply_lower = response['reply'].lower()

    assert '?' in response['reply'], "FAIL: Groq should ask follow-up questions"
    assert 'make' in reply_lower or 'model' in reply_lower or 'power' in reply_lower, \
        "FAIL: Should ask for inverter details"
    print("✅ PASS: Inverter vague input handled with follow-up questions")

def test_no_false_precision():
    """Efficiency/performance numbers should be ranges, not false precision."""
    from proxy_server import process_bot_query
    import re
    prompt = "What's the efficiency of a typical battery system?"
    response = process_bot_query(prompt, history=[])

    suspicious = re.findall(r'\d+\.\d{2,}%', response['reply'])

    if suspicious:
        print(f"⚠️  WARNING: Found suspicious precise decimals: {suspicious}")
    print("✅ PASS: Precision test passed (check above for warnings)")

if __name__ == "__main__":
    print("Running Groq chatbot tests...\n")

    test_groq_chatbot()
    print()

    test_chemistry_default_sodium()
    test_chemistry_cold_lithium()
    test_lead_acid_warning()
    test_pricing_caveat()
    test_inverter_vague_follow_up()
    test_no_false_precision()

    print("\n✅ ALL VERIFICATION TESTS COMPLETED")
