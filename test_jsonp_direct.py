import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

def test_jsonp_script():
    options = Options()
    options.add_argument('--headless=new')
    # Disable PNA enforcement explicitly
    # options.add_argument('--disable-features=PrivateNetworkAccessSendPreflights')
    driver = webdriver.Chrome(options=options)
    url = "http://127.0.0.1:7509/v1/contract/web/AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov/"
    driver.get(url)
    time.sleep(3)

    iframes = driver.find_elements(By.TAG_NAME, "iframe")
    if len(iframes) > 0:
        driver.switch_to.frame(iframes[0])
        print("Switched into iframe")
    else:
        print("No iframe found, testing on main page")

    # Test 1: Direct JSONP script injection in the page
    js = """
        window.testLogs = [];
        window.testReply = null;
        window.testDone = false;
        
        var cbName = 'test_cb_' + Math.floor(Math.random() * 1000000);
        window[cbName] = function(data) {
            window.testLogs.push('SUCCESS: ' + JSON.stringify(data).slice(0, 100));
            window.testReply = data;
            window.testDone = true;
        };
        
        var script = document.createElement('script');
        script.id = cbName;
        script.src = 'http://127.0.0.1:3000/api/jsonp?callback=' + cbName + '&prompt=' + encodeURIComponent("what is today's date?") + '&history=[]';
        script.onload = function() {
            window.testLogs.push('Script ONLOAD triggered');
        };
        script.onerror = function(e) {
            window.testLogs.push('Script ONERROR: ' + JSON.stringify(e));
            window.testDone = 'error';
        };
        document.body.appendChild(script);
        window.testLogs.push('Script appended: ' + script.src);
    """
    driver.execute_script(js)

    for i in range(8):
        time.sleep(1)
        logs = driver.execute_script("return window.testLogs;")
        done = driver.execute_script("return window.testDone;")
        reply = driver.execute_script("return window.testReply;")
        print(f"Time {i+1}s: done={done}, reply={str(reply)[:80]}")
        for l in (logs or []):
            print("  LOG:", l)
        if done:
            break

    driver.quit()

if __name__ == "__main__":
    test_jsonp_script()
