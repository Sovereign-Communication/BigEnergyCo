"""
Render two YouTube Short deliverables from the saved voice recording.

1. short-02-original-edited.mp4
   A tight first-take edit: trims the opening/closing dead air and removes
   long pauses from the first read so the planned script plays as a Short.
2. short-02-raw-uncut.mp4
   Uses the complete source recording, untouched as the editorial source,
   with a longer creative montage of all planned site/AI/card visuals.

The source recording is never overwritten.
Requires imageio-ffmpeg (already present in this workspace).
"""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent
SOURCE_AUDIO = ROOT / "short_audio_me.m4a"
ASSETS = ROOT / "assets"
BUILD_EDITED = ROOT / "build_edited"
BUILD_RAW = ROOT / "build_raw"
OUTPUT = ROOT / "output"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
FPS = 30
SIZE = "1080x1920"


def run(args: list[str], label: str) -> None:
    command = [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", *args]
    print(f"[{label}] {' '.join(str(x) for x in args)}")
    subprocess.run(command, check=True)


def probe_duration(path: Path) -> float:
    result = subprocess.run(
        [FFMPEG, "-hide_banner", "-i", str(path)],
        capture_output=True,
        text=True,
        check=False,
    )
    match = re.search(r"Duration: (\d+):(\d+):(\d+(?:\.\d+)?)", result.stderr)
    if not match:
        raise RuntimeError(f"Could not probe duration for {path}: {result.stderr}")
    hours, minutes, seconds = match.groups()
    return int(hours) * 3600 + int(minutes) * 60 + float(seconds)


def scene(image: Path, duration: float, output: Path, direction: str = "in") -> None:
    # The scale-up before zoompan gives the filter room for a gentle crop.
    if direction == "out":
        zoom = "max(1.0,1.06-on*0.0007)"
    else:
        zoom = "min(zoom+0.0007,1.06)"
    frames = max(1, round(duration * FPS))
    vf = (
        f"scale=2160:3840:force_original_aspect_ratio=increase,"
        f"crop=2160:3840,"
        f"zoompan=z='{zoom}':x='iw/2-(iw/zoom/2)':"
        f"y='ih/2-(ih/zoom/2)':d={frames}:s={SIZE}:fps={FPS},"
        "format=yuv420p"
    )
    run(
        [
            "-loop", "1", "-i", str(image), "-t", f"{duration:.3f}",
            "-vf", vf, "-an", "-c:v", "libx264", "-preset", "fast",
            "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(FPS),
            str(output),
        ],
        f"scene {output.name}",
    )


def concat_video(parts: list[Path], output: Path) -> None:
    listing = output.with_suffix(".txt")
    listing.write_text(
        "\n".join(f"file '{part.resolve().as_posix()}'" for part in parts) + "\n",
        encoding="utf-8",
    )
    run(
        [
            "-f", "concat", "-safe", "0", "-i", str(listing),
            "-c", "copy", "-movflags", "+faststart", str(output),
        ],
        f"concat {output.name}",
    )


def mux_audio(video: Path, audio: Path, output: Path, subtitles: Path | None = None) -> None:
    args = ["-i", str(video), "-i", str(audio)]
    if subtitles:
        # The SRT is authored with the edited timeline, so it is burned in only
        # on the edited deliverable.  Escape the Windows path for libass.
        sub_path = subtitles.resolve().as_posix().replace(":", r"\:")
        args += [
            "-filter_complex",
            f"[0:v]subtitles='{sub_path}':force_style="
            "'FontName=Arial,FontSize=18,PrimaryColour=&H00FFFFFF,"
            "OutlineColour=&H00101820,BorderStyle=1,Outline=3,"
            "Shadow=1,MarginV=190,Alignment=2'[v]",
            "-map", "[v]", "-map", "1:a:0",
        ]
        video_codec = ["-c:v", "libx264", "-preset", "fast", "-crf", "18"]
    else:
        args += ["-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy"]
        video_codec = []
    run(
        args + video_codec + [
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
            "-movflags", "+faststart", "-shortest", str(output),
        ],
        f"mux {output.name}",
    )


def make_scaled_srt(source: Path, output: Path, scale: float) -> None:
    text = source.read_text(encoding="utf-8")

    def timestamp_to_seconds(value: str) -> float:
        h, m, s, ms = re.match(r"(\d+):(\d+):(\d+),(\d+)", value).groups()
        return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000

    def seconds_to_timestamp(seconds: float) -> str:
        seconds = max(0.0, seconds)
        whole = int(seconds)
        ms = round((seconds - whole) * 1000)
        if ms == 1000:
            whole += 1
            ms = 0
        h, remainder = divmod(whole, 3600)
        m, s = divmod(remainder, 60)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    def replace_time(match: re.Match[str]) -> str:
        start = seconds_to_timestamp(timestamp_to_seconds(match.group(1)) * scale)
        end = seconds_to_timestamp(timestamp_to_seconds(match.group(2)) * scale)
        return f"{start} --> {end}"

    output.write_text(
        re.sub(
            r"(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})",
            replace_time,
            text,
        ),
        encoding="utf-8",
    )


def render_edited() -> tuple[Path, float]:
    BUILD_EDITED.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)

    edited_audio = BUILD_EDITED / "short_audio_edited.m4a"
    # The first read is the cleanest contiguous take in this recording.  The
    # filter removes the initial/final dead air and pauses >= 0.75 s, which
    # removes restart gaps without chopping normal word spacing.
    run(
        [
            "-ss", "1.45", "-to", "42.95", "-i", str(SOURCE_AUDIO),
            "-af",
            "silenceremove="
            "start_periods=1:start_duration=0.30:start_threshold=-38dB:"
            "stop_periods=-1:stop_duration=0.75:stop_threshold=-38dB,"
            "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
            str(edited_audio),
        ],
        "edit voice",
    )
    duration = probe_duration(edited_audio)

    # Keep all planned beats, proportionally mapped to the tightened VO.
    plan_durations = [3, 5, 7, 4, 7, 8, 5, 4, 4]
    scale = duration / sum(plan_durations)
    durations = [value * scale for value in plan_durations]
    files = [
        ASSETS / "cards/card_01_hook.png",
        ASSETS / "site/vertical/01_hero_v1.png",
        ASSETS / "site/vertical/02_input_filled_v1.png",
        ASSETS / "ai/vertical/ai_02_satellite.png",
        ASSETS / "site/vertical/03_results_bestpick_v1.png",
        ASSETS / "site/vertical/04_frontier_chart_v1.png",
        ASSETS / "site/vertical/05_cumcost_chart_v1.png",
        ASSETS / "cards/card_02_payback.png",
        ASSETS / "cards/card_03_end.png",
    ]
    parts: list[Path] = []
    for index, (image, length) in enumerate(zip(files, durations), 1):
        part = BUILD_EDITED / f"scene_{index:02d}.mp4"
        scene(image, length, part, "out" if index % 2 == 0 else "in")
        parts.append(part)

    video = BUILD_EDITED / "video_no_audio.mp4"
    concat_video(parts, video)
    scaled_srt = BUILD_EDITED / "captions_edited.srt"
    make_scaled_srt(ROOT / "captions-short-02.srt", scaled_srt, scale)
    output = OUTPUT / "short-02-original-edited.mp4"
    mux_audio(video, edited_audio, output, scaled_srt)
    (OUTPUT / "short-02-original-edited-notes.txt").write_text(
        "Edited deliverable\n"
        f"Source: {SOURCE_AUDIO.name}\n"
        "Editorial source range: 00:01.450 to 00:42.950 (first read)\n"
        "Audio treatment: remove pauses >= 0.75 s, trim dead air, loudness normalize\n"
        f"Final voice/video duration: {duration:.2f} seconds\n"
        "The original recording remains available as short_audio_me.m4a.\n",
        encoding="utf-8",
    )
    return output, duration


def render_raw() -> Path:
    BUILD_RAW.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    duration = probe_duration(SOURCE_AUDIO)
    files = [
        ASSETS / "cards/card_01_hook.png",
        ASSETS / "ai/vertical/ai_01_bill_hook.png",
        ASSETS / "site/vertical/01_hero_v1.png",
        ASSETS / "site/vertical/02_input_filled_v1.png",
        ASSETS / "ai/vertical/ai_02_satellite.png",
        ASSETS / "ai/vertical/ai_03_rooftop.png",
        ASSETS / "site/vertical/03_results_bestpick_v1.png",
        ASSETS / "site/vertical/04_frontier_chart_v1.png",
        ASSETS / "site/vertical/05_cumcost_chart_v1.png",
        ASSETS / "site/vertical/06_bom_panel_v1.png",
        ASSETS / "ai/vertical/ai_04_battery.png",
        ASSETS / "ai/vertical/ai_05_payback.png",
        ASSETS / "cards/card_02_payback.png",
        ASSETS / "cards/card_03_end.png",
    ]
    each = duration / len(files)
    parts: list[Path] = []
    for index, image in enumerate(files, 1):
        part = BUILD_RAW / f"scene_{index:02d}.mp4"
        scene(image, each, part, "out" if index % 2 == 0 else "in")
        parts.append(part)
    video = BUILD_RAW / "video_no_audio.mp4"
    concat_video(parts, video)
    output = OUTPUT / "short-02-raw-uncut.mp4"
    mux_audio(video, SOURCE_AUDIO, output)
    (OUTPUT / "short-02-raw-uncut-notes.txt").write_text(
        "Raw creative deliverable\n"
        f"Source audio: {SOURCE_AUDIO.name}\n"
        f"Audio treatment: none; complete {duration:.2f}-second recording muxed as-is\n"
        "Visual treatment: animated montage of planned site captures, AI imagery, and brand cards\n"
        "No script captions are burned in because this version preserves every take and mistake.\n",
        encoding="utf-8",
    )
    return output


def main() -> None:
    if not SOURCE_AUDIO.exists():
        raise FileNotFoundError(SOURCE_AUDIO)
    edited, edited_duration = render_edited()
    raw = render_raw()
    print("\nDONE")
    print(f"edited: {edited} ({probe_duration(edited):.2f}s)")
    print(f"raw:    {raw} ({probe_duration(raw):.2f}s)")
    print(f"voice edit: {edited_duration:.2f}s")


if __name__ == "__main__":
    main()
