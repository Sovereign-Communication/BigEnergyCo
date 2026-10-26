import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

def test_ws():
    options = Options()
    options.add_argument('--headless=new')
    driver = webdriver.Chrome(options=options)
    url = "http://127.0.0.1:7509/v1/contract/web/AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov/"
    driver.get(url)
    time.sleep(3)

    iframes = driver.find_elements(By.TAG_NAME, "iframe")
    if len(iframes) > 0:
        driver.switch_to.frame(iframes[0])

    print("Testing WebSocket connection directly in iframe JS...")
    js_script = """
        window.wsTestStatus = 'pending';
        window.wsTestError = null;
        window.wsTestReply = null;
        try {
            var socket = new WebSocket('ws://127.0.0.1:3000');
            socket.onopen = function() {
                window.wsTestStatus = 'connected';
                socket.send(JSON.stringify({ action: 'chat', message: "what's todays date?", history: [] }));
            };
            socket.onmessage = function(e) {
                window.wsTestStatus = 'received';
                window.wsTestReply = JSON.parse(e.data).reply;
            };
            socket.onerror = function(e) {
                window.wsTestStatus = 'error';
                window.wsTestError = String(e);
            };
        } catch(err) {
            window.wsTestStatus = 'exception';
            window.wsTestError = String(err);
        }
    """
    driver.execute_script(js_script)
    
    for i in range(10):
        time.sleep(1)
        status = driver.execute_script("return window.wsTestStatus;")
        reply = driver.execute_script("return window.wsTestReply;")
        err = driver.execute_script("return window.wsTestError;")
        print(f"Second {i+1}: status='{status}', reply='{str(reply)[:100]}', err='{err}'")
        if status == 'received':
            break

    driver.quit()

if __name__ == "__main__":
    test_ws()
