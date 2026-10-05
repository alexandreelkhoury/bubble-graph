#!/bin/bash
# Re-limit the audio of finished finals whose true peak is above -1 dBTP (loudnorm's linear pass can overshoot).
# Video is copied untouched. Usage: tools/peakfix.sh out/final/*.mp4
set -euo pipefail
for f in "$@"; do
  tp=$(ffmpeg -v info -i "$f" -af ebur128=peak=true -f null - 2>&1 | grep -A1 "True peak:" | tail -1 | grep -oE -- "-?[0-9.]+" | head -1)
  if awk "BEGIN{exit !($tp > -1.0)}"; then
    ffmpeg -v error -y -i "$f" -c:v copy -af "alimiter=limit=0.82:attack=1:release=50:level=false,aresample=48000" -c:a aac -b:a 256k -movflags +faststart "${f%.mp4}.pk.mp4"
    mv "${f%.mp4}.pk.mp4" "$f"
    echo "$f: true peak $tp -> $(ffmpeg -v info -i "$f" -af ebur128=peak=true -f null - 2>&1 | grep -A1 'True peak:' | tail -1 | xargs)"
  else
    echo "$f: true peak $tp OK"
  fi
done
