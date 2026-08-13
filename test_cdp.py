import urllib.request
import json
import socket
import base64
import struct

def run_cdp_test():
    res = urllib.request.urlopen("http://127.0.0.1:9222/json")
    targets = json.loads(res.read().decode('utf-8'))
    print("Targets found:", len(targets))
    page = next((t for t in targets if t['type'] == 'page'), None)
    if not page:
        print("No page target found")
        return
    
    ws_url = page['webSocketDebuggerUrl']
    print("WebSocket URL:", ws_url)
    
    # Extract host and path
    # e.g. ws://127.0.0.1:9222/devtools/page/123
    parts = ws_url.replace("ws://", "").split("/", 1)
    host_port = parts[0].split(":")
    host = host_port[0]
    port = int(host_port[1])
    path = "/" + parts[1]

    s = socket.socket()
    s.connect((host, port))
    
    ws_key = base64.b64encode(b"1234567890123456").decode()
    handshake = f"GET {path} HTTP/1.1\r\nHost: {host}:{port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {ws_key}\r\n\r\n"
    s.send(handshake.encode())
    
    resp = s.recv(1024).decode()
    print("CDP Handshake Response:", resp.split('\r\n')[0])
    
    def send_cdp(cmd_id, method, params={}):
        msg_str = json.dumps({"id": cmd_id, "method": method, "params": params})
        payload = msg_str.encode('utf-8')
        frame = bytearray()
        frame.append(0x81)
        length = len(payload)
        mask_key = b'\x00\x00\x00\x00'
        if length <= 125:
            frame.append(0x80 | length)
        elif length <= 65535:
            frame.append(0x80 | 126)
            frame.extend(struct.pack('>H', length))
        else:
            frame.append(0x80 | 127)
            frame.extend(struct.pack('>Q', length))
        frame.extend(mask_key)
        frame.extend(payload)
        s.send(bytes(frame))

    # Enable Page and Runtime
    send_cdp(1, "Page.enable")
    send_cdp(2, "Runtime.enable")

    # Evaluate DOM elements and click behavior
    eval_expr = """
    (function() {
      const sizingBtn = document.querySelector("button[onclick*='openSizingModal']");
      const leadBtn = document.querySelector("button[onclick*='openLeadModal']");
      const sizingModal = document.getElementById("sizingModal");
      const leadModal = document.getElementById("leadModal");
      
      const beforeSizingDisplay = sizingModal ? getComputedStyle(sizingModal).display : 'NULL';
      if (typeof openSizingModal === 'function') {
        openSizingModal();
      }
      const afterSizingDisplay = sizingModal ? getComputedStyle(sizingModal).display : 'NULL';
      
      return {
        hasSizingBtn: !!sizingBtn,
        hasLeadBtn: !!leadBtn,
        hasSizingFn: typeof openSizingModal === 'function',
        hasLeadFn: typeof openLeadModal === 'function',
        beforeSizingDisplay,
        afterSizingDisplay
      };
    })()
    """
    send_cdp(3, "Runtime.evaluate", {"expression": eval_expr, "returnByValue": True})
    
    while True:
        try:
            raw = s.recv(4096)
            if not raw:
                break
            # Decode CDP frame
            b1, b2 = struct.unpack('BB', raw[:2])
            plen = b2 & 0x7f
            offset = 2
            if plen == 126:
                plen = struct.unpack('>H', raw[2:4])[0]
                offset = 4
            elif plen == 127:
                plen = struct.unpack('>Q', raw[2:10])[0]
                offset = 10
            
            payload_data = raw[offset:offset+plen]
            try:
                res_obj = json.loads(payload_data.decode('utf-8', errors='ignore'))
                if res_obj.get('id') == 3:
                    print("CDP EVALUATION RESULT:", json.dumps(res_obj.get('result', {}), indent=2))
                    break
            except Exception:
                pass
        except Exception as e:
            print("Error reading CDP:", e)
            break

if __name__ == "__main__":
    run_cdp_test()
