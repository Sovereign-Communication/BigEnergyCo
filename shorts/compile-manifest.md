# Compile manifest — YouTube Short #2

**Output target:** 1080×1920, 47 s, H.264 + AAC. All assets verified present.

## Scene table

| # | Time | VO cue | Visual asset (use `vertical/` variants) | Duration | Motion |
|---|------|--------|------------------------------------------|----------|--------|
| S1 | 0:00–0:03 | hook | `assets/cards/card_01_hook.png` (alt bg: `assets/ai/vertical/ai_01_bill_hook.png`) | 3.0 s | zoom 1.00→1.06 |
| S2 | 0:03–0:08 | reveal | `assets/site/vertical/01_hero_v1.png` | 5.0 s | pan down |
| S3 | 0:08–0:15 | how it works | `assets/site/vertical/02_input_filled_v1.png` → cutaway `assets/ai/vertical/ai_02_satellite.png` (1 s) | 7.0 s | slow zoom |
| S4 | 0:15–0:22 | options | `assets/site/vertical/03_results_bestpick_v1.png` → `assets/site/el_bestpick.png` (crop) → `assets/site/el_moneybar.png` (crop) | 7.0 s | push-in on cost |
| S5 | 0:22–0:30 | the curve | `assets/site/vertical/04_frontier_chart_v1.png` (alt: `el_frontier.png`) | 8.0 s | push-in to knee |
| S6 | 0:30–0:37 | money math | `assets/site/vertical/05_cumcost_chart_v1.png` (alt: `el_cumcost.png`) | 7.0 s | push-in |
| S7 | 0:37–0:42 | punchline | `assets/cards/card_02_payback.png` over `assets/ai/vertical/ai_05_payback.png` | 5.0 s | numbers pop |
| S8 | 0:42–0:47 | end | `assets/ai/vertical/ai_04_battery.png` (0.5 s) → `assets/cards/card_03_end.png` | 5.0 s | CTA glow, hold end |

## Element-shot crops (for S4)

`el_*.png` are 489×~700 element captures. For full-frame use, pad onto a
1080×1920 dark canvas (`#090d16`) centered with 40 px margins:

```bash
ffmpeg -i assets/site/el_bestpick.png -vf "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x090D16,scale=1080:1920" assets/site/vertical/el_bestpick_v.png
```

## Assembly (per-scene, then concat)

Render each scene with zoompan (Ken Burns), then concat and burn captions:

```bash
cd shorts

# Example: S1 hook (zoompan on a still, 3 s @ 30 fps)
ffmpeg -loop 1 -i assets/cards/card_01_hook.png -t 3 \
  -vf "scale=2160:3840,zoompan=z='min(zoom+0.0008,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=90:s=1080x1920:fps=30" \
  -c:v libx264 -pix_fmt yuv420p build/s1.mp4

# Repeat per scene with its asset/duration, then:
printf "file 'build/s%d.mp4'\n" 1 2 3 4 5 6 7 8 > build/list.txt
ffmpeg -f concat -safe 0 -i build/list.txt -i captions-short-02.srt \
  -vf "subtitles=captions-short-02.srt:force_style='FontName=Arial,FontSize=15,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,MarginV=180'" \
  -c:v libx264 -crf 18 -pix_fmt yuv420p -r 30 \
  -af "silenceremove=stop_periods=-1:stop_threshold=-50dB:stop_duration=0.4" \
  -c:a aac -b:a 192k -shortest ../short-02-final.mp4
```

Notes:
- Add BGM (`bgm.m4a`, not included) as a second `-i` with `-filter_complex "[1:a]volume=0.25,sidechaincompress=..."` ducked under VO; VO track to be recorded from the script.
- `el_moneybar.png` is short (489×98) — crop a wider context region from `03_results_bestpick.png` instead if it feels too thin on screen.
- Keep the last 0.5 s static and silent for a clean YouTube loop point.

## Asset inventory (verified)

- `assets/site/`: 01_hero, 02_input_filled, 03_results_bestpick, 04_frontier_chart, 05_cumcost_chart, 06_bom_panel (full) · el_bestpick, el_moneybar, el_frontier, el_cumcost (elements) · vertical/ crops (6)
- `assets/ai/`: ai_01_bill_hook, ai_02_satellite, ai_03_rooftop, ai_04_battery, ai_05_payback + vertical/ (5+5)
- `assets/cards/`: card_01_hook, card_02_payback, card_03_end (3)

## Regeneration

```bash
python shorts/capture_site.py     # real site screenshots (runs live sizing)
python shorts/fetch_ai_images.py  # AI photos (Pollinations/Flux)
python shorts/make_cards.py       # branded cards
```
