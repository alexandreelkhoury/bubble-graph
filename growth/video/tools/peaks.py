#!/usr/bin/env python3
"""Peak time (s) of each SFX: first frame whose envelope reaches 90% of max (the audible hit), plus duration."""
import subprocess, sys, json, numpy as np
SR = 44100
out = {}
for p in sys.argv[1:]:
    x = np.frombuffer(subprocess.run(["ffmpeg","-v","quiet","-i",p,"-ac","1","-ar",str(SR),"-f","f32le","-"],capture_output=True).stdout, dtype=np.float32)
    env = np.convolve(np.abs(x), np.ones(441)/441, mode="same")  # 10 ms envelope
    peak = int(np.argmax(env >= 0.9*env.max()))
    onset = int(np.argmax(env >= 0.1*env.max()))
    out[p.split("/")[-1].rsplit(".",1)[0]] = {"onset": round(onset/SR,3), "peak": round(peak/SR,3), "dur": round(len(x)/SR,2)}
print(json.dumps(out, indent=1))
