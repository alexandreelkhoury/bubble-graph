#!/usr/bin/env python3
"""Single-frame pop scan: mean abs difference between consecutive frames (downscaled to 240 px wide, grey).
Flags frame i when diff[i] > 3x the median of its 6 neighbours and is large in absolute terms,
and when the frame is an isolated spike (diff[i] and diff[i+1] both high, i.e. a frame that differs from
both sides = a one-frame pop). Prints flagged frames with their time and beat.
Usage: python3 tools/qa.py video.mp4
"""
import subprocess, sys, numpy as np

BPM, FPS = 123.78, 60
path = sys.argv[1]
w, h = 240, None
probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                        "-of", "csv=p=0", path], capture_output=True, text=True).stdout.strip().split(",")
W, H = int(probe[0]), int(probe[1])
h = int(round(H * w / W / 2) * 2)
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={w}:{h},format=gray", "-f", "rawvideo", "-"],
                     capture_output=True).stdout
frames = np.frombuffer(raw, dtype=np.uint8).reshape(-1, h, w).astype(np.float32)
d = np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2))  # d[i] = diff between frame i and i+1
flags = []
for i in range(1, len(d) - 1):
    nb = np.concatenate([d[max(0, i - 4):i - 1], d[i + 2:i + 5]])
    med = np.median(nb) if len(nb) else 0
    # frame i+1 differs from both its neighbours a lot while the surrounding motion is calm
    if d[i] > 3 * (med + 0.3) and d[i + 1] > 3 * (med + 0.3) and min(d[i], d[i + 1]) > 2.0:
        flags.append(i + 1)
cuts = [i + 1 for i in range(len(d)) if d[i] > 25]
print(f"{len(frames)} frames, mean diff {d.mean():.2f}, max {d.max():.1f} at frame {int(d.argmax()) + 1}")
print("one-frame pops:", ", ".join(f"{f} ({f / FPS:.2f}s, beat {f / FPS * BPM / 60:.2f})" for f in flags) or "none")
print("hard jumps (>25):", ", ".join(f"{f} (beat {f / FPS * BPM / 60:.2f}, {d[f - 1]:.0f})" for f in cuts) or "none")
