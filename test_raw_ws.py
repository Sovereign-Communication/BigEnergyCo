import socket
import base64
import hashlib

def test_raw_ws():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect(('127.0.0.1', 3000))
    key = base64.b64encode(b"1234567890123456").decode('utf-8')
    req = (
        "GET / HTTP/1.1\r\n"
        "Host: 127.0.0.1:3000\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        "Sec-WebSocket-Version: 13\r\n\r\n"
    )
    s.sendall(req.encode('utf-8'))
    resp = s.recv(1024).decode('utf-8')
    print("Raw Handshake Response:")
    print(resp)
    s.close()

if __name__ == "__main__":
    test_raw_ws()
