import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

def dump_frames():
    options = Options()
    options.add_argument('--headless=new')
    driver = webdriver.Chrome(options=options)
    url = "http://127.0.0.1:7509/v1/contract/web/AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov/"
    driver.get(url)
    time.sleep(3)

    print("Main Frame URL:", driver.current_url)
    print("Main Frame Scripts count:", len(driver.find_elements(By.TAG_NAME, "script")))

    iframes = driver.find_elements(By.TAG_NAME, "iframe")
    print("Main Frame iframe count:", len(iframes))
    for i, frame in enumerate(iframes):
        print(f"\n--- Checking Frame {i} (src: {frame.get_attribute('src')}) ---")
        driver.switch_to.frame(frame)
        scripts = driver.find_elements(By.TAG_NAME, "script")
        print(f"Frame {i} Script count: {len(scripts)}")
        for idx, s in enumerate(scripts):
            src = s.get_attribute('src')
            text = s.get_attribute('text') or s.get_attribute('innerHTML') or ''
            print(f"  Script {idx}: src='{src}', len={len(text)}, sample='{text[:100]}'")

        buttons = driver.find_elements(By.TAG_NAME, "button")
        print(f"Frame {i} Button count: {len(buttons)}")

        # Check typeof window.openSizingModal in this frame
        res = driver.execute_script("return typeof window.openSizingModal;")
        print(f"Frame {i} typeof window.openSizingModal: '{res}'")

        # Check sub-iframes inside Frame i
        sub_iframes = driver.find_elements(By.TAG_NAME, "iframe")
        print(f"Frame {i} sub-iframe count: {len(sub_iframes)}")
        for j, sub_frame in enumerate(sub_iframes):
            print(f"  Sub-frame {j} src: {sub_frame.get_attribute('src')}")
            driver.switch_to.frame(sub_frame)
            sub_res = driver.execute_script("return typeof window.openSizingModal;")
            print(f"  Sub-frame {j} typeof window.openSizingModal: '{sub_res}'")
            driver.switch_to.parent_frame()

        driver.switch_to.default_content()

    driver.quit()

if __name__ == "__main__":
    dump_frames()
