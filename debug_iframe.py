import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

def debug_freenet():
    options = Options()
    options.add_argument('--headless=new')
    driver = webdriver.Chrome(options=options)
    url = "http://127.0.0.1:7509/v1/contract/web/AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov/"
    driver.get(url)
    time.sleep(3)

    print("Main Frame HTML sample:")
    print(driver.page_source[:500])

    iframes = driver.find_elements(By.TAG_NAME, "iframe")
    print(f"\nMain Frame has {len(iframes)} iframe(s)")
    for idx, frame in enumerate(iframes):
        print(f"Iframe {idx} src: {frame.get_attribute('src')}")
        driver.switch_to.frame(frame)
        print(f"Iframe {idx} HTML sample:")
        print(driver.page_source[:500])
        
        # Check sub-iframes inside this frame
        sub_iframes = driver.find_elements(By.TAG_NAME, "iframe")
        print(f"Iframe {idx} has {len(sub_iframes)} sub-iframe(s)")
        if len(sub_iframes) > 0:
            driver.switch_to.frame(sub_iframes[0])
            print(f"Sub-Iframe 0 HTML sample:")
            print(driver.page_source[:500])
            driver.switch_to.parent_frame()

        driver.switch_to.default_content()

    driver.quit()

if __name__ == "__main__":
    debug_freenet()
