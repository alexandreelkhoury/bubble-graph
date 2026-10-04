#!/bin/bash
# Final renders, one at a time: motion blur (8 samples), QA pop scan, two-pass loudnorm to -14 LUFS / -1 dBTP.
# Usage: tools/finalize.sh COMP_ID [COMP_ID ...]   -> out/final/<COMP_ID>.mp4 (+ .qa.txt)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/final
# wait for any render already running in this project
while pgrep -f "remotion render src/index.ts" >/dev/null; do sleep 15; done
for id in "$@"; do
  raw="out/final/$id.raw.mp4"
  echo "== $id: render $(date +%T)"
  npx remotion render src/index.ts "$id" "$raw" --props='{"blur":12,"guide":false}' --codec=h264 --crf=16 --color-space=bt709 --concurrency=8 --log=error
  python3 tools/qa.py "$raw" > "out/final/$id.qa.txt"
  J=$(ffmpeg -v info -i "$raw" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
  g() { echo "$J" | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }
  ffmpeg -v error -y -i "$raw" -c:v copy -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true" -ar 48000 -c:a aac -b:a 256k -movflags +faststart "out/final/$id.mp4"
  ffmpeg -v info -i "out/final/$id.mp4" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I:|Peak:)" | tail -2 >> "out/final/$id.qa.txt"
  rm -f "$raw"
  echo "== $id: done $(date +%T)"; cat "out/final/$id.qa.txt"
done
