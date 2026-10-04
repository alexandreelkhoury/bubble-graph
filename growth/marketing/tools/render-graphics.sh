#!/usr/bin/env bash
# Renders the Play Store brand graphics from play-store/src/*.html with headless Chrome.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd); SRC="$ROOT/play-store/src"; OUT="$ROOT/play-store/graphics"; mkdir -p "$OUT"
CH=${CHROME:-$(find ~/.cache/ms-playwright -name chrome-headless-shell -type f | head -1)}
shot() { "$CH" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --default-background-color=00000000 \
  --virtual-time-budget=3000 --window-size="$2" --screenshot="$3" "file://$SRC/$1" 2>/dev/null; }
shot icon.html 512,512 "$OUT/app-icon-512.png"
python3 -c 'import sys;from PIL import Image;Image.open(sys.argv[1]).convert("RGBA").save(sys.argv[1])' "$OUT/app-icon-512.png"  # Play: 32-bit PNG
shot tv-banner.html 1280,720 "$OUT/tv-banner-1280x720.png"
shot feature-graphic.html 1024,500 "$OUT/feature-graphic-1024x500.png"
# Marketing frames: tools/render-graphics.sh frames  (reads raw/en/pick-*.png, see frames.tsv)
if [ "${1:-}" = frames ]; then
  mkdir -p "$OUT/marketing"
  while IFS=$'\t' read -r raw name head sub; do
    [ -z "$raw" ] || [ "${raw:0:1}" = "#" ] && continue
    url="frame.html?img=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "file://$OUT/$raw")&h=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$head")&s=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$sub")"
    shot "$url" 1920,1080 "$OUT/marketing/$name.png"
  done < "$ROOT/play-store/frames.tsv"
fi
