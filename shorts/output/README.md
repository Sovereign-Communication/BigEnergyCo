# YouTube Short #2 — rendered deliverables

Both files are vertical 1080×1920 H.264/AAC videos.

## 1. `short-02-original-edited.mp4`

The planned/script version. It uses the first contiguous read from
`../short_audio_me.m4a`, trims dead air, removes pauses of at least 0.75 s,
normalizes the voice level, and burns in the planned captions. The edited
voice track is about 33 seconds, so the visual beats are proportionally timed
to the actual read rather than padded with silence.

The source recording is not changed. The intermediate edited voice file is
`../build_edited/short_audio_edited.m4a`, and the rendered-caption source is
`../build_edited/captions_edited.srt`.

## 2. `short-02-raw-uncut.mp4`

The creative/raw version. It uses the complete `../short_audio_me.m4a`
recording without cutting or silence removal and runs about 2:51. It has an
animated montage of the planned site screenshots, generated imagery, and
brand cards. Script captions are intentionally not burned in because this
version preserves all takes, pauses, and mistakes.

## Re-render

From the project root:

```bash
python shorts/render_versions.py
```

The script uses the bundled `imageio-ffmpeg` binary and never overwrites the
source audio.
