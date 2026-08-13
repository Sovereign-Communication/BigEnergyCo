"""
start_and_publish_tunnel.py
===========================
Combined script that:
  1. Starts the Cloudflare quick tunnel on port 7510
  2. Captures the new public HTTPS URL
  3. Patches index.html with the new CF_API_URL
  4. Republishes the Freenet web contract
  5. Keeps the tunnel alive indefinitely

Run this once after proxy_server.py is up.
"""
import sys, os, re, time, subprocess, shutil, json

sys.stdout.reconfigure(encoding='utf-8')

REPO       = r"c:\Users\SCM\Documents\GitHub\BigEnergyCo"
DIST       = os.path.join(REPO, "freenet_web_dist")
INDEX_SRC  = os.path.join(REPO, "index.html")
TUNNEL_FILE = os.path.join(REPO, "tunnel_url.txt")
CF_EXE     = os.path.join(REPO, "cloudflared.exe")
FDEV       = r"C:\Users\SCM\AppData\Local\Freenet\bin\fdev.exe"
PROXY_PORT = 7510

def patch_and_publish(tunnel_url):
    """Patch CF_API_URL in index.html and republish to Freenet."""
    with open(INDEX_SRC, 'r', encoding='utf-8') as f:
        html = f.read()

    # Update the CF_API_URL variable line
    lines = html.split('\n')
    for i, line in enumerate(lines):
        if "var CF_API_URL = '" in line:
            lines[i] = f"    var CF_API_URL = '{tunnel_url}';"
            print(f"[PATCH] CF_API_URL = '{tunnel_url}'")
            break
    html = '\n'.join(lines)

    with open(INDEX_SRC, 'w', encoding='utf-8') as f:
        f.write(html)

    # Sync to dist
    os.makedirs(DIST, exist_ok=True)
    for fname in ['index.html', 'styles.css']:
        src = os.path.join(REPO, fname)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(DIST, fname))
            print(f"[SYNC] {fname} -> freenet_web_dist/")

    # Publish to Freenet
    print("[PUBLISH] Publishing to Freenet...")
    result = subprocess.run(
        [FDEV, "website", "publish", "--key", "bigenergyco", DIST],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        print(f"[PUBLISH] ✅ SUCCESS")
        print(result.stdout.strip())
    else:
        print(f"[PUBLISH] ❌ FAILED: {result.stderr.strip()}")


def run_tunnel():
    """Start cloudflared, return (proc, tunnel_url) or raise on failure."""
    print(f"[TUNNEL] Starting Cloudflare tunnel on http://127.0.0.1:{PROXY_PORT} ...")
    proc = subprocess.Popen(
        [CF_EXE, "tunnel", "--url", f"http://127.0.0.1:{PROXY_PORT}"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True, encoding='utf-8', errors='replace'
    )

    deadline = time.time() + 90
    print("[TUNNEL] Waiting for URL (up to 90s)...")
    while time.time() < deadline:
        line = proc.stdout.readline()
        if not line:
            if proc.poll() is not None:
                raise RuntimeError("cloudflared process exited before providing URL")
            time.sleep(0.1)
            continue
        print(f"  CF> {line.rstrip()}")
        m = re.search(r'https://[a-zA-Z0-9\-]+\.trycloudflare\.com', line)
        if m:
            url = m.group(0)
            print(f"\n[TUNNEL] ✅ Public URL: {url}\n")
            return proc, url

    proc.terminate()
    raise TimeoutError("Timed out waiting for tunnel URL")


def drain_proc(proc):
    """Keep reading proc stdout until it exits."""
    while True:
        line = proc.stdout.readline()
        if not line:
            if proc.poll() is not None:
                return
            time.sleep(1)
            continue
        if any(k in line for k in ('ERR', 'error', 'warn', 'WARN', 'disconnect', 'reconnect', 'retry')):
            print(f"  CF> {line.rstrip()}")


def main():
    attempt = 0
    while True:
        attempt += 1
        print(f"\n[WATCHDOG] Tunnel attempt #{attempt} ...")
        try:
            proc, tunnel_url = run_tunnel()
        except Exception as e:
            print(f"[WATCHDOG] Failed to start tunnel: {e}")
            print(f"[WATCHDOG] Retrying in 30s...")
            time.sleep(30)
            continue

        # Save URL and update Freenet
        with open(TUNNEL_FILE, 'w', encoding='utf-8') as f:
            f.write(tunnel_url)
        try:
            patch_and_publish(tunnel_url)
        except Exception as e:
            print(f"[WATCHDOG] Publish failed (non-fatal): {e}")

        print(f"\n{'='*65}")
        print(f"✅ LIVE (attempt #{attempt})")
        print(f"  PUBLIC:  {tunnel_url}/")
        print(f"  FREENET: http://127.0.0.1:7509/v1/contract/web/AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov/")
        print(f"{'='*65}")

        # Drain until it dies
        drain_proc(proc)
        exit_code = proc.poll()
        print(f"[WATCHDOG] Tunnel exited (code={exit_code}). Restarting in 5s...")
        time.sleep(5)


if __name__ == "__main__":
    main()
