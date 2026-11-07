import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

def debug_ws():
    options = Options()
    options.add_argument('--headless=new')
    driver = webdriver.Chrome(options=options)
    url = "http://127.0.0.1:7509/v1/contract/web/AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov/"
    driver.get(url)
    time.sleep(3)

    iframes = driver.find_elements(By.TAG_NAME, "iframe")
    if len(iframes) > 0:
        driver.switch_to.frame(iframes[0])

    print("Executing WebSocket test with detailed logging...")
    js = """
        window.logs = [];
        function log(msg) { window.logs.push(msg); }
        try {
            log("Attempting new WebSocket('ws://127.0.0.1:3000')...");
            var ws = new WebSocket('ws://127.0.0.1:3000');
            ws.onopen = function() {
                log("WS ONOPEN SUCCESS!");
                ws.send(JSON.stringify({ action: 'chat', message: 'hi', history: [] }));
            };
            ws.onmessage = function(e) {
                log("WS ONMESSAGE: " + e.data);
            };
            ws.onerror = function(e) {
                log("WS ONERROR: " + JSON.stringify(e) + " readyState=" + ws.readyState);
            };
            ws.onclose = function(e) {
                log("WS ONCLOSE: code=" + e.code + " reason=" + e.reason + " clean=" + e.wasClean);
            };
        } catch(err) {
            log("WS EXCEPTION: " + err.message);
        }
    """
    driver.execute_script(js)

    for i in range(5):
        time.sleep(1)
        logs = driver.execute_script("return window.logs;")
        print(f"Time {i+1}s logs:")
        for l in logs:
            print("  ", l)

    driver.quit()

if __name__ == "__main__":
    debug_ws()
