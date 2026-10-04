#!/usr/bin/env python3
"""Beat grid + drop detection with numpy only (ffmpeg decodes).

Usage: python3 tools/beats.py track.mp3 [--json out.json]
Prints BPM, first downbeat offset, and drop candidates (time where bass energy jumps the most,
snapped to the beat grid).
"""
import json
import subprocess
import sys

import numpy as np

SR = 22050
HOP = 256


def decode(path):
    raw = subprocess.run(
        ["ffmpeg", "-v", "quiet", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32)


def stft_mag(x, n=1024):
    win = np.hanning(n).astype(np.float32)
    frames = 1 + (len(x) - n) // HOP
    idx = np.arange(n)[None, :] + HOP * np.arange(frames)[:, None]
    return np.abs(np.fft.rfft(x[idx] * win, axis=1))


def analyse(path):
    x = decode(path)
    dur = len(x) / SR
    S = stft_mag(x)
    freqs = np.fft.rfftfreq(1024, 1 / SR)
    logS = np.log1p(S)
    flux = np.maximum(0, np.diff(logS, axis=0)).sum(axis=1)
    flux = np.concatenate([[0], flux])
    flux -= np.convolve(flux, np.ones(16) / 16, mode="same")
    flux = np.maximum(flux, 0)
    fps = SR / HOP

    # Tempo: autocorrelation of the onset envelope, 90-160 BPM.
    ac = np.correlate(flux, flux, mode="full")[len(flux) - 1:]
    lags = np.arange(len(ac))
    bpm_of = 60 * fps / np.maximum(lags, 1)
    mask = (bpm_of >= 90) & (bpm_of <= 160)
    best = lags[mask][np.argmax(ac[mask])]
    # Refine with parabolic interpolation.
    a, b, c = ac[best - 1], ac[best], ac[best + 1]
    period = best + 0.5 * (a - c) / (a - 2 * b + c)
    bpm = 60 * fps / period

    # Phase: offset that maximises onset energy on the grid.
    best_off, best_score = 0.0, -1
    for off in np.linspace(0, period, 64, endpoint=False):
        pos = np.arange(off, len(flux) - 1, period).astype(int)
        s = flux[pos].sum()
        if s > best_score:
            best_off, best_score = off, s
    beat0 = best_off / fps
    spb = 60 / bpm

    # Bass energy per beat (20-150 Hz) and full RMS per beat.
    bass = S[:, (freqs >= 20) & (freqs <= 150)].sum(axis=1)
    full = S.sum(axis=1)
    beats = np.arange(beat0, dur - spb, spb)
    def per_beat(sig):
        out = []
        for t in beats:
            i0, i1 = int(t * fps), int((t + spb) * fps)
            out.append(sig[i0:i1].mean())
        return np.array(out)
    bb, fb = per_beat(bass), per_beat(full)
    # Drop: largest ratio of mean bass over next 4 beats vs previous 4 beats (needs 8+ beats of context).
    cands = []
    for i in range(8, len(beats) - 8):
        before = bb[i - 4:i].mean() + 1e-6
        after = bb[i:i + 4].mean()
        cands.append((after / before, i))
    cands.sort(reverse=True)
    drops = []
    for ratio, i in cands:
        if all(abs(i - j) >= 8 for _, j, _ in drops):
            drops.append((round(float(ratio), 2), i, round(float(beats[i]), 3)))
        if len(drops) == 4:
            break
    # Quiet breakdowns: lowest full-energy 4-beat windows.
    return {
        "file": path,
        "duration": round(dur, 2),
        "bpm": round(float(bpm), 2),
        "first_beat": round(float(beat0), 3),
        "sec_per_beat": round(float(spb), 4),
        "drops": [{"ratio": r, "beat": i, "time": t} for r, i, t in drops],
        "energy_per_beat": [round(float(v / fb.max()), 3) for v in fb],
    }


if __name__ == "__main__":
    res = analyse(sys.argv[1])
    if "--json" in sys.argv:
        json.dump(res, open(sys.argv[sys.argv.index("--json") + 1], "w"), indent=1)
    e = res.pop("energy_per_beat")
    print(json.dumps(res))
    # Coarse energy sparkline, one char per 4 beats.
    bars = " ▁▂▃▄▅▆▇█"
    print("energy/4 beats:", "".join(bars[min(8, int(np.mean(e[i:i + 4]) * 8.99))] for i in range(0, len(e), 4)))
