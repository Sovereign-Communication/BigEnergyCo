import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

def test_fetch():
    options = Options()
    options.add_argument('--headless=new')
    driver = webdriver.Chrome(options=options)
    url = "http://127.0.0.1:7509/v1/contract/web/AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov/"
    driver.get(url)
    time.sleep(3)

    iframes = driver.find_elements(By.TAG_NAME, "iframe")
    if len(iframes) > 0:
        driver.switch_to.frame(iframes[0])

    print("Testing fetch('http://127.0.0.1:3000/api/chat') in iframe...")
    js = """
        window.fetchStatus = 'pending';
        window.fetchReply = null;
        window.fetchError = null;
        fetch('http://127.0.0.1:3000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: "what's todays date?", history: [] })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            window.fetchStatus = 'success';
            window.fetchReply = data.reply;
        })
        .catch(function(err) {
            window.fetchStatus = 'error';
            window.fetchError = String(err);
        });
    """
    driver.execute_script(js)

    for i in range(5):
        time.sleep(1)
        status = driver.execute_script("return window.fetchStatus;")
        reply = driver.execute_script("return window.fetchReply;")
        err = driver.execute_script("return window.fetchError;")
        print(f"Time {i+1}s: status='{status}', reply='{str(reply)[:100]}', err='{err}'")
        if status == 'success':
            break

    driver.quit()

if __name__ == "__main__":
    test_fetch()
