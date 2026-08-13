import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

def test_click_by_id():
    options = Options()
    options.add_argument('--headless=new')
    driver = webdriver.Chrome(options=options)
    url = "http://127.0.0.1:7509/v1/contract/web/AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov/"
    driver.get(url)
    time.sleep(3)

    iframes = driver.find_elements(By.TAG_NAME, "iframe")
    if len(iframes) > 0:
        driver.switch_to.frame(iframes[0])

    print("Checking btnHeroSizing in DOM...")
    has_btn = driver.execute_script("return !!document.getElementById('btnHeroSizing');")
    print(f"Has #btnHeroSizing: {has_btn}")

    if has_btn:
        print("Executing document.getElementById('btnHeroSizing').click()...")
        driver.execute_script("document.getElementById('btnHeroSizing').click();")
        time.sleep(1)
        disp = driver.execute_script("return getComputedStyle(document.getElementById('sizingModal')).display;")
        print(f"Computed display of #sizingModal: '{disp}'")

        print("Executing document.getElementById('btnNavFollowUp').click()...")
        driver.execute_script("document.getElementById('btnNavFollowUp').click();")
        time.sleep(1)
        disp_lead = driver.execute_script("return getComputedStyle(document.getElementById('leadModal')).display;")
        print(f"Computed display of #leadModal: '{disp_lead}'")

    driver.quit()

if __name__ == "__main__":
    test_click_by_id()
