import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

def test_exec():
    options = Options()
    options.add_argument('--headless=new')
    driver = webdriver.Chrome(options=options)
    url = "http://127.0.0.1:7509/v1/contract/web/AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov/"
    driver.get(url)
    time.sleep(3)

    iframes = driver.find_elements(By.TAG_NAME, "iframe")
    if len(iframes) > 0:
        driver.switch_to.frame(iframes[0])

    print("Executing inline js: document.getElementById('sizingModal').style.display = 'flex';")
    driver.execute_script("document.getElementById('sizingModal').style.display = 'flex';")
    disp = driver.execute_script("return getComputedStyle(document.getElementById('sizingModal')).display;")
    print(f"Direct inline set display result: '{disp}'")

    print("\nExecuting window.openSizingModal() directly:")
    try:
        driver.execute_script("window.openSizingModal();")
        disp_fn = driver.execute_script("return getComputedStyle(document.getElementById('sizingModal')).display;")
        print(f"After window.openSizingModal() display: '{disp_fn}'")
    except Exception as e:
        print("window.openSizingModal error:", e)

    driver.quit()

if __name__ == "__main__":
    test_exec()
