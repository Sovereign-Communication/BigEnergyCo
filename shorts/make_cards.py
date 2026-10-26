"""
BigEnergyCo — YouTube Short #2: branded title cards.

PIL-drawn cards in the site's exact design system (dark navy #090d16,
energy-emerald #00e699, mono numerals) — hook card, payback punchline,
and end CTA card. All 1080x1920.

Usage:  python shorts/make_cards.py
Output: shorts/assets/cards/*.png
"""

import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "shorts", "assets", "cards")
W, H = 1080, 1920

BG = (9, 13, 22)
EMERALD = (0, 230, 153)
BLUE = (96, 165, 250)
MUTED = (156, 163, 175)
WHITE = (255, 255, 255)


def font(size, bold=True):
    for name in (["arialbd.ttf", "arial.ttf"] if bold else ["arial.ttf"]):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def gradient_bg():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)],
               fill=(int(9 + 6 * t), int(13 + 10 * t), int(22 + 14 * t)))
    # emerald + blue radial glows, like the site's body background
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-300, -400, 700, 500], fill=(0, 45, 33))
    gd.ellipse([500, 1200, 1500, 2100], fill=(0, 25, 50))
    glow = glow.filter(__import__("PIL.ImageFilter", fromlist=["GaussianBlur"]).GaussianBlur(160))
    img = Image.blend(img, Image.composite(glow, img, glow.convert("L")), 0.9)
    return img


def draw_center_lines(d, lines, y_center, spacing=18):
    heights = []
    for text, f, color in lines:
        bb = d.textbbox((0, 0), text, font=f)
        heights.append(bb[3] - bb[1])
    total = sum(heights) + spacing * (len(lines) - 1)
    y = y_center - total // 2
    for (text, f, color), h in zip(lines, heights):
        bb = d.textbbox((0, 0), text, font=f)
        d.text(((W - (bb[2] - bb[0])) // 2 - bb[0], y - bb[1]), text, font=f, fill=color)
        y += h + spacing


def hook_card():
    img = gradient_bg()
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([W//2 - 260, 480, W//2 + 260, 560], radius=40,
                        outline=EMERALD, width=3)
    tag = font(34)
    bb = d.textbbox((0, 0), "YOUR ELECTRIC BILL", font=tag)
    d.text(((W - (bb[2]-bb[0]))//2, 520 - (bb[3]-bb[1])//2), "YOUR ELECTRIC BILL",
           font=tag, fill=EMERALD)
    draw_center_lines(d, [
        ("IS STEALING", font(120), WHITE),
        ("FROM YOU.", font(120), WHITE),
    ], y_center=760, spacing=8)
    draw_center_lines(d, [
        ("Every. Single. Month.", font(52), MUTED),
    ], y_center=1010)
    d.text((W//2, 1560), "bigenergyco.pages.dev", font=font(40), fill=BLUE)
    img.save(os.path.join(OUT, "card_01_hook.png"))


def payback_card():
    img = gradient_bg()
    d = ImageDraw.Draw(img)
    draw_center_lines(d, [
        ("PAYBACK IN", font(64), MUTED),
        ("1\u20134 YEARS", font(150), EMERALD),
        ("then nearly free", font(56), WHITE),
        ("power for decades.", font(56), WHITE),
    ], y_center=860, spacing=26)
    d.text((W//2, 1500), "* estimate only \u2014 verify with a licensed pro",
           font=font(30), fill=MUTED)
    img.save(os.path.join(OUT, "card_02_payback.png"))


def end_card():
    img = gradient_bg()
    d = ImageDraw.Draw(img)
    draw_center_lines(d, [
        ("\u26A1", font(140), EMERALD),
        ("BigEnergyCo", font(96), WHITE),
        ("FREE \u00b7 NO SIGNUP", font(52), EMERALD),
        ("\u00b7 WORKS OFFLINE \u00b7", font(52), EMERALD),
        ("NOTHING FOR SALE", font(52), EMERALD),
    ], y_center=820, spacing=30)
    d.rounded_rectangle([W//2 - 380, 1280, W//2 + 380, 1400], radius=24,
                        fill=(0, 179, 119))
    cta = font(52)
    bb = d.textbbox((0, 0), "bigenergyco.pages.dev", font=cta)
    d.text((W//2 - (bb[2]-bb[0])//2, 1340 - (bb[3]-bb[1])//2),
           "bigenergyco.pages.dev", font=cta, fill=(4, 18, 12))
    img.save(os.path.join(OUT, "card_03_end.png"))


def main():
    os.makedirs(OUT, exist_ok=True)
    hook_card()
    payback_card()
    end_card()
    print("DONE — cards written to", OUT)


if __name__ == "__main__":
    main()
