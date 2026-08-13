"""
launcher.py — one command to bring BigEnergyCo up or down.

    START.bat   ->  python launcher.py
    STOP.bat    ->  python launcher.py --stop

Replaces the old two-window dance (proxy_server.py in one window,
start_tunnel.py in another) that had to be babysat by hand.

What it does, in order:
  1. Stops anything already running from a previous launch (no port clashes).
  2. Starts proxy_server.py on 7510 and waits until /api/health answers.
  3. Starts the Cloudflare tunnel and captures the public https URL.
  4. Writes that URL into tunnel_url.txt and patches CF_API_URL in index.html,
     then copies index.html into freenet_web_dist/ so the Freenet build matches.
  5. Prints the URLs and stays running. Ctrl+C — or STOP.bat — shuts it down.

Optional flags:
  --stop        stop everything and exit
  --no-tunnel   local only, skip the public Cloudflare tunnel
  --publish     also republish the Freenet contract via fdev
"""

import sys

sys.stdout.reconfigure(encoding='utf-8')

import json
import os
import re
import shutil
import signal
import subprocess
import time
import urllib.request

REPO = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(REPO, "freenet_web_dist")
INDEX = os.path.join(REPO, "index.html")
TUNNEL_URL_FILE = os.path.join(REPO, "tunnel_url.txt")
PIDFILE = os.path.join(REPO, ".launcher_pids.json")
FDEV = r"C:\Users\SCM\AppData\Local\Freenet\bin\fdev.exe"

PROXY_PORT = 7510
CONTRACT = "AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov"

CF_CANDIDATES = [
    os.path.join(REPO, "cloudflared.exe"),
    r"C:\Program Files\cloudflared\cloudflared.exe",
]


def say(msg):
    print(msg, flush=True)


def rule():
    say("=" * 66)


# ── process bookkeeping ───────────────────────────────────────────────────────

def read_pids():
    if not os.path.exists(PIDFILE):
        return {}
    try:
        with open(PIDFILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def write_pids(pids):
    try:
        with open(PIDFILE, "w", encoding="utf-8") as f:
            json.dump(pids, f)
    except Exception:
        pass


def kill_pid(pid):
    """Kill a process and its children. taskkill /T gets the cloudflared child too."""
    try:
        subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"],
                       capture_output=True, timeout=15)
        return True
    except Exception:
        return False


def stop_all(quiet=False):
    pids = read_pids()
    stopped = 0
    for name, pid in pids.items():
        if kill_pid(pid):
            if not quiet:
                say(f"  stopped {name} (pid {pid})")
            stopped += 1

    # Belt and braces: anything still holding 7510 from an earlier run.
    for pid in pids_on_port(PROXY_PORT):
        if pid not in pids.values():
            kill_pid(pid)
            if not quiet:
                say(f"  stopped stray process on port {PROXY_PORT} (pid {pid})")
            stopped += 1

    if os.path.exists(PIDFILE):
        try:
            os.remove(PIDFILE)
        except Exception:
            pass

    if not quiet and stopped == 0:
        say("  nothing was running")
    return stopped


def pids_on_port(port):
    """PIDs listening on a TCP port, via netstat (no extra dependencies)."""
    found = set()
    try:
        out = subprocess.run(["netstat", "-ano", "-p", "TCP"],
                             capture_output=True, text=True, timeout=15).stdout
        for line in out.splitlines():
            parts = line.split()
            if len(parts) >= 5 and parts[0] == "TCP" and "LISTENING" in line:
                if parts[1].endswith(f":{port}"):
                    try:
                        found.add(int(parts[-1]))
                    except ValueError:
                        pass
    except Exception:
        pass
    return found


# ── startup steps ─────────────────────────────────────────────────────────────

def wait_for_health(timeout=25):
    deadline = time.time() + timeout
    url = f"http://127.0.0.1:{PROXY_PORT}/api/health"
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(0.4)
    return False


def start_proxy():
    say("[1/3] Starting the local server on port 7510...")
    proc = subprocess.Popen(
        [sys.executable, os.path.join(REPO, "proxy_server.py")],
        cwd=REPO,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
    )
    if not wait_for_health():
        say("      [!] Server did not come up. Run 'python proxy_server.py' by hand to see why.")
        kill_pid(proc.pid)
        return None
    say(f"      ok — running (pid {proc.pid})")
    return proc


def find_cloudflared():
    for path in CF_CANDIDATES:
        if os.path.exists(path):
            return path
    return shutil.which("cloudflared")


def start_tunnel():
    say("[2/3] Opening the public Cloudflare tunnel...")
    cf = find_cloudflared()
    if not cf:
        say("      [!] cloudflared.exe not found — skipping. The site will be local-only.")
        return None, None

    proc = subprocess.Popen(
        [cf, "tunnel", "--url", f"http://127.0.0.1:{PROXY_PORT}"],
        cwd=REPO,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
    )

    url = None
    deadline = time.time() + 60
    while time.time() < deadline:
        line = proc.stdout.readline()
        if not line:
            if proc.poll() is not None:
                break
            time.sleep(0.1)
            continue
        match = re.search(r"https://[a-zA-Z0-9\-]+\.trycloudflare\.com", line)
        if match:
            url = match.group(0)
            break

    if not url:
        say("      [!] Tunnel did not produce a URL in 60s — continuing local-only.")
        kill_pid(proc.pid)
        return None, None

    say(f"      ok — {url}")
    return proc, url


def apply_tunnel_url(url):
    """Point the page's fallback API URL at this run's tunnel, and sync the Freenet build."""
    say("[3/3] Updating the site with this run's URL...")

    with open(TUNNEL_URL_FILE, "w", encoding="utf-8") as f:
        f.write(url)

    try:
        with open(INDEX, "r", encoding="utf-8") as f:
            html = f.read()
        patched, count = re.subn(
            r"var CF_API_URL = '[^']*';",
            f"var CF_API_URL = '{url}';",
            html,
            count=1,
        )
        if count:
            with open(INDEX, "w", encoding="utf-8") as f:
                f.write(patched)
            say("      ok — index.html updated")
        else:
            say("      [!] CF_API_URL line not found in index.html; left unchanged")
    except Exception as e:
        say(f"      [!] Could not patch index.html: {e}")

    os.makedirs(DIST, exist_ok=True)
    # Use the static Freenet version (no AI) for the Freenet contract
    index_src = os.path.join(REPO, "index-freenet.html")
    if os.path.exists(index_src):
        try:
            shutil.copy2(index_src, os.path.join(DIST, "index.html"))
        except Exception:
            pass
    for name in ("styles.css", "app.js"):
        src = os.path.join(REPO, name)
        if os.path.exists(src):
            try:
                shutil.copy2(src, os.path.join(DIST, name))
            except Exception:
                pass
    say("      ok — freenet_web_dist/ synced (using static offline version)")


def publish_freenet():
    say("[+] Republishing the Freenet contract...")
    if not os.path.exists(FDEV):
        say(f"    [!] fdev.exe not found at {FDEV} — skipped")
        return
    try:
        result = subprocess.run([FDEV, "website", "publish", "--key", "bigenergyco", DIST],
                                capture_output=True, text=True, timeout=180)
        say("    ok — published" if result.returncode == 0
            else f"    [!] publish failed: {result.stderr.strip()[:300]}")
    except Exception as e:
        say(f"    [!] publish error: {e}")


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    args = sys.argv[1:]

    if "--stop" in args:
        rule()
        say("  Stopping BigEnergyCo")
        rule()
        stop_all()
        say("\nDone.")
        return 0

    rule()
    say("  BigEnergyCo — Free Solar & Battery Estimator")
    rule()

    say("Clearing anything left over from a previous run...")
    stop_all(quiet=True)
    say("")

    pids = {}

    proxy = start_proxy()
    if not proxy:
        return 1
    pids["server"] = proxy.pid
    write_pids(pids)

    url = None
    if "--no-tunnel" not in args:
        tunnel, url = start_tunnel()
        if tunnel:
            pids["tunnel"] = tunnel.pid
            write_pids(pids)
        if url:
            apply_tunnel_url(url)
    else:
        say("[2/3] Tunnel skipped (--no-tunnel)")
        say("[3/3] Nothing to update")

    if "--publish" in args:
        publish_freenet()

    say("")
    rule()
    say("  RUNNING")
    rule()
    if url:
        say("")
        say("   >>>  SHARE THIS LINK:")
        say(f"   >>>  {url}")
        say("")
        say("   This is a NEW link. Any link you shared before is now dead —")
        say("   free tunnels get a new address every restart. Run LINK.bat")
        say("   any time to reopen the current one.")
        say("")
    else:
        say("  Public link:       none — local only")
    say(f"  On this computer:  http://127.0.0.1:{PROXY_PORT}/")
    say(f"  Freenet:           http://127.0.0.1:7509/v1/contract/web/{CONTRACT}/")
    rule()
    say("  Leave this window open. Close it, press Ctrl+C, or run STOP.bat to stop.")
    rule()

    try:
        while True:
            time.sleep(2)
            if proxy.poll() is not None:
                say("\n[!] The server stopped unexpectedly. Shutting down.")
                break
    except KeyboardInterrupt:
        say("\nShutting down...")

    stop_all(quiet=True)
    say("Stopped.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        say(f"\n[!] Launcher error: {exc}")
        sys.exit(1)
