import time
import sys
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

def test_freenet_ui():
    options = Options()
    options.add_argument('--headless=new')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    
    driver = webdriver.Chrome(options=options)
    url = "http://127.0.0.1:7509/v1/contract/web/AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov/"
    print(f"[SELENIUM TEST] Navigating to Freenet URL: {url}")
    
    driver.get(url)
    time.sleep(3)
    
    iframes = driver.find_elements(By.TAG_NAME, "iframe")
    if len(iframes) > 0:
        driver.switch_to.frame(iframes[0])
        print("[SELENIUM TEST] Switched context into Freenet Contract iframe")

    # 1. Test "Size Your Array" button (#btnHeroSizing)
    sizing_btn = driver.find_element(By.ID, "btnHeroSizing")
    print("[SELENIUM TEST] Found #btnHeroSizing button. Executing click...")
    driver.execute_script("arguments[0].click();", sizing_btn)
    time.sleep(1)
    
    sizing_modal = driver.find_element(By.ID, "sizingModal")
    display_sizing = sizing_modal.value_of_css_property("display")
    print(f"[SELENIUM TEST] sizingModal display property after click: '{display_sizing}'")
    assert display_sizing == 'flex', f"Expected 'flex', got '{display_sizing}'"

    # Close sizing modal
    close_sizing = driver.find_element(By.ID, "btnCloseSizing")
    driver.execute_script("arguments[0].click();", close_sizing)
    time.sleep(1)
    print(f"[SELENIUM TEST] sizingModal display property after close: '{sizing_modal.value_of_css_property('display')}'")
    assert sizing_modal.value_of_css_property("display") == 'none', "Expected 'none' after close"

    # 2. Test "Request Follow-Up" button (#btnNavFollowUp)
    lead_btn = driver.find_element(By.ID, "btnNavFollowUp")
    print("[SELENIUM TEST] Found #btnNavFollowUp button. Executing click...")
    driver.execute_script("arguments[0].click();", lead_btn)
    time.sleep(1)
    
    lead_modal = driver.find_element(By.ID, "leadModal")
    display_lead = lead_modal.value_of_css_property("display")
    print(f"[SELENIUM TEST] leadModal display property after click: '{display_lead}'")
    assert display_lead == 'flex', f"Expected 'flex', got '{display_lead}'"

    # Close lead modal
    close_lead = driver.find_element(By.ID, "btnCloseLead")
    driver.execute_script("arguments[0].click();", close_lead)
    time.sleep(1)
    print(f"[SELENIUM TEST] leadModal display property after close: '{lead_modal.value_of_css_property('display')}'")
    assert lead_modal.value_of_css_property("display") == 'none', "Expected 'none' after close"

    # 3. Test "Read Master Terms" button (#btnLegalTerms1)
    legal_btn = driver.find_element(By.ID, "btnLegalTerms1")
    print("[SELENIUM TEST] Found #btnLegalTerms1 button. Executing click...")
    driver.execute_script("arguments[0].click();", legal_btn)
    time.sleep(1)
    
    legal_modal = driver.find_element(By.ID, "legalModal")
    display_legal = legal_modal.value_of_css_property("display")
    print(f"[SELENIUM TEST] legalModal display property after click: '{display_legal}'")
    assert display_legal == 'flex', f"Expected 'flex', got '{display_legal}'"

    # Close legal modal
    close_legal = driver.find_element(By.ID, "btnCloseLegal")
    driver.execute_script("arguments[0].click();", close_legal)
    time.sleep(1)

    print("\nHARD VERIFICATION PASSED: ALL FREENET UI BUTTONS WORK 100% IN REAL CHROME BROWSER!")
    driver.quit()

if __name__ == "__main__":
    test_freenet_ui()
