"""
BigEnergyCo — YouTube Short #2: AI-generated scene imagery.

Downloads AI photos (Flux via Pollinations.ai, free, no key) for the scenes
that need photographic material, in a style consistent with the site's dark
emerald design system. Falls back to PIL brand-gradient cards on failure.

Usage:  python shorts/fetch_ai_images.py
Output: shorts/assets/ai/*.png  (1536x2752, 9:16 master)
        shorts/assets/ai/vertical/*.png  (1080x1920 downscaled)
"""

import os
import sys
import time
import urllib.request

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "shorts", "assets", "ai")
VOUT = os.path.join(OUT, "vertical")
MW, MH = 1536, 2752        # 9:16 master
VW, VH = 1080, 1920        # Shorts frame

# Cohesive style suffix for every prompt (matches site: dark navy + emerald glow)
STYLE = ("dark navy night background, emerald green and cyan energy glow accents, "
         "cinematic lighting, photorealistic, high detail, vertical composition, "
         "no text, no watermark, no people")

SCENES = {
    "ai_01_bill_hook": (
        "close-up of a paper electricity bill with a red rising total and a glowing "
        "electricity meter in the background, moody dark atmosphere, " + STYLE),
    "ai_02_satellite": (
        "satellite orbiting earth scanning a city at night with a green data beam, "
        "space photography style, " + STYLE),
    "ai_03_rooftop": (
        "modern house rooftop covered with solar panels at dusk, green glow on the "
        "horizon, aerial view, " + STYLE),
    "ai_04_battery": (
        "home energy storage battery cabinet with glowing green status LEDs in a "
        "dark garage, " + STYLE),
    "ai_05_payback": (
        "solar panels on a roof with sunrise light and a faint ascending green "
        "financial growth curve overlaid on the sky, " + STYLE),
}


def fetch(name, prompt, retries=3):
    path = os.path.join(OUT, f"{name}.png")
    url = ("https://image.pollinations.ai/prompt/" + urllib.request.quote(prompt) +
           f"?width=1080&height=1920&nologo=true&seed=7")
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=180) as r:
                data = r.read()
            if len(data) < 15_000:
                raise ValueError(f"suspiciously small payload ({len(data)} B)")
            with open(path, "wb") as f:
                f.write(data)
            img = Image.open(path)
            img.verify()
            img = Image.open(path)
            img.resize((VW, VH), Image.LANCZOS).save(os.path.join(VOUT, f"{name}.png"))
            print(f"  OK {name}.png ({len(data)//1024} KB)")
            return True
        except Exception as e:
            print(f"  attempt {attempt} failed for {name}: {e}")
            time.sleep(3 * attempt)
    return False


def fallback_card(name, title):
    """PIL brand-gradient card in the site design system."""
    img = Image.new("RGB", (MW, MH), (9, 13, 22))
    d = ImageDraw.Draw(img)
    for y in range(MH):
        t = y / MH
        r = int(9 + 0 * t)
        g = int(13 + 30 * t)
        b = int(22 + 20 * t)
        d.line([(0, y), (MW, y)], fill=(r, g, b))
    d.ellipse([-MW // 2, -MH // 3, MW, MH // 2], fill=(0, 60, 45))
    img = img.filter(ImageFilter.GaussianBlur(120))
    d = ImageDraw.Draw(img)
    d.text((MW // 2, MH // 2), title, anchor="mm", fill=(0, 230, 153))
    img.save(os.path.join(OUT, f"{name}.png"))
    img.resize((VW, VH), Image.LANCZOS).save(os.path.join(VOUT, f"{name}.png"))
    print(f"  FALLBACK card {name}.png")


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(VOUT, exist_ok=True)
    titles = {
        "ai_01_bill_hook": "BILL",
        "ai_02_satellite": "NASA 5-YR",
        "ai_03_rooftop": "SOLAR",
        "ai_04_battery": "BATTERY",
        "ai_05_payback": "PAYBACK",
    }
    failed = []
    for name, prompt in SCENES.items():
        if not fetch(name, prompt):
            fallback_card(name, titles[name])
            failed.append(name)
    if failed:
        print(f"\nNOTE: fallback cards used for: {', '.join(failed)}")
    print("DONE — AI imagery complete.")


if __name__ == "__main__":
    main()
