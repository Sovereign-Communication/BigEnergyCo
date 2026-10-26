"""
BigEnergyCo — YouTube Short #2 asset capture.

Runs the real site locally in headless Chromium, performs a genuine grid-tie
sizing (Honolulu, $150/month bill, $0.42/kWh), and captures screenshots of
every scene asset for the Short. No site files are modified.

Usage:  python shorts/capture_site.py
Output: shorts/assets/site/*.png  (full-page / element shots, 1440px wide)
        shorts/assets/site/vertical/*.png  (1080x1920 center-crops)
"""

import json
import os
import subprocess
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "shorts", "assets", "site")
VOUT = os.path.join(OUT, "vertical")
PORT = 8943  # unlikely to collide; launcher uses other ports
URL = f"http://127.0.0.1:{PORT}/index.html"

VIEW_W, VIEW_H = 1440, 2400          # tall viewport so results are in frame
VERT_W, VERT_H = 1080, 1920          # YouTube Shorts frame

# ---------------------------------------------------------------- helpers

def die(msg):
    print(f"FATAL: {msg}", file=sys.stderr)
    sys.exit(1)


def wait_http(url, timeout=30):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=3) as r:
                if r.status == 200:
                    return
        except Exception:
            pass
        time.sleep(0.4)
    die(f"server never answered {url}")


def vertical_crops(png_path, out_dir, crop_windows):
    """Cut 1080x1920 vertical crops out of a wide screenshot.
    crop_windows: list of (x0_frac, x1_frac, y0_frac, y1_frac) in image fractions."""
    from PIL import Image
    img = Image.open(png_path)
    W, H = img.size
    for i, (x0, x1, y0, y1) in enumerate(crop_windows):
        box = (int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H))
        cw, ch = box[2] - box[0], box[3] - box[1]
        # scale crop to fill 1080x1920 (center-crop the remainder)
        target_ratio = VERT_W / VERT_H
        if cw / ch > target_ratio:      # too wide -> trim sides
            nw = int(ch * target_ratio)
            off = (cw - nw) // 2
            box = (box[0] + off, box[1], box[0] + off + nw, box[3])
        else:                            # too tall -> trim top/bottom
            nh = int(cw / target_ratio)
            off = (ch - nh) // 2
            box = (box[0], box[1] + off, box[2], box[1] + off + nh)
        crop = img.crop(box).resize((VERT_W, VERT_H), Image.LANCZOS)
        name = os.path.splitext(os.path.basename(png_path))[0]
        crop.save(os.path.join(out_dir, f"{name}_v{i + 1}.png"))
    print(f"  vertical crops: {len(crop_windows)}")


def shot(page, name, full=False, clip=None):
    path = os.path.join(OUT, f"{name}.png")
    if clip:
        page.screenshot(path=path, clip=clip)
    else:
        page.screenshot(path=path, full_page=full)
    print(f"  saved {name}.png")
    return path


# ---------------------------------------------------------------- main

def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(VOUT, exist_ok=True)

    # 1. serve the project root statically
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    wait_http(URL)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": VIEW_W, "height": VIEW_H})
            page.goto(URL, wait_until="networkidle")
            page.wait_for_timeout(1200)

            # ---- Scene 2: hero -------------------------------------------------
            hero = page.locator(".hero")
            hero.scroll_into_view_if_needed()
            page.wait_for_timeout(300)
            shot(page, "01_hero", clip=None)

            # ---- Scene 3: fill the form (Honolulu + bill mode) ------------------
            city = page.locator("#citySearch")
            city.scroll_into_view_if_needed()
            city.fill("Honolulu")
            page.keyboard.press("Enter")
            page.wait_for_timeout(400)

            # switch to bill mode
            page.select_option("#loadMode", "bill")
            page.wait_for_timeout(200)
            page.fill("#billAmount", "150")
            page.fill("#customRateVal", "0.42")
            page.select_option("#systemGoal", "gridtie")
            page.select_option("#autoTarget", "cut80")
            page.wait_for_timeout(400)
            shot(page, "02_input_filled")

            # ---- run the real sizing -------------------------------------------
            page.click("#btnRunSizing")
            # NASA fetch (~2MB) + 5-year sim can take a while; poll for results
            deadline = time.time() + 180
            results_visible = False
            while time.time() < deadline:
                try:
                    if page.evaluate(
                        "() => { const el = document.getElementById('bestPickWrap');"
                        " return el && el.innerHTML.trim().length > 0; }"
                    ):
                        results_visible = True
                        break
                except Exception:
                    pass
                page.wait_for_timeout(1500)
            if not results_visible:
                # capture whatever state we reached for debugging, then fail
                shot(page, "zz_debug_no_results", full=True)
                die("sizing never produced results (NASA fetch or sim failed)")
            print("  sizing complete — results rendered")

            # ---- Scene 4: best-pick results + money bar ------------------------
            page.locator("#bestPickWrap").scroll_into_view_if_needed()
            page.wait_for_timeout(500)
            shot(page, "03_results_bestpick", full=True)

            # ---- Scene 5: plausibility frontier chart ---------------------------
            fw = page.locator("#frontierWrap")
            if fw.is_visible():
                fw.scroll_into_view_if_needed()
                page.wait_for_timeout(600)
                shot(page, "04_frontier_chart", full=True)
            else:
                print("  WARN: frontier chart not visible — skipping shot")

            # ---- Scene 6: cumulative 20-year cost chart -------------------------
            cc = page.locator("#cumCostChartWrap")
            if cc.is_visible():
                cc.scroll_into_view_if_needed()
                page.wait_for_timeout(600)
                shot(page, "05_cumcost_chart", full=True)
            else:
                print("  WARN: cumulative cost chart not visible — skipping shot")

            # ---- Scene 7: BOM hardware list -------------------------------------
            bom = page.locator("#bomPanel")
            if bom.is_visible():
                page.locator("#bomPanel summary").click()
                page.wait_for_timeout(500)
                bom.scroll_into_view_if_needed()
                page.wait_for_timeout(400)
                shot(page, "06_bom_panel", full=True)
            else:
                print("  WARN: BOM panel not visible — skipping shot")

            # ---- element-level tight shots for punchy vertical cuts -------------
            for sel, name in [
                ("#bestPickWrap", "el_bestpick"),
                ("#moneyBar", "el_moneybar"),
                ("#frontierWrap", "el_frontier"),
                ("#cumCostChartWrap", "el_cumcost"),
            ]:
                loc = page.locator(sel)
                try:
                    if loc.is_visible():
                        loc.scroll_into_view_if_needed()
                        page.wait_for_timeout(300)
                        loc.screenshot(path=os.path.join(OUT, f"{name}.png"))
                        print(f"  saved {name}.png (element)")
                except Exception as e:
                    print(f"  WARN: element shot {name} failed: {e}")

            browser.close()
    finally:
        proc.terminate()

    # ---- vertical crops for the wide shots -----------------------------------
    crop_map = {
        "01_hero.png": [(0.02, 0.98, 0.0, 1.0)],
        "02_input_filled.png": [(0.30, 0.70, 0.10, 0.90)],
        "03_results_bestpick.png": [(0.05, 0.95, 0.02, 0.60)],
        "04_frontier_chart.png": [(0.05, 0.95, 0.05, 0.75)],
        "05_cumcost_chart.png": [(0.05, 0.95, 0.05, 0.75)],
        "06_bom_panel.png": [(0.05, 0.95, 0.05, 0.70)],
    }
    for fname, windows in crop_map.items():
        path = os.path.join(OUT, fname)
        if os.path.exists(path):
            vertical_crops(path, VOUT, windows)

    print("\nDONE — real site captures complete.")


if __name__ == "__main__":
    main()
