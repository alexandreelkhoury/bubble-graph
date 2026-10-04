#!/usr/bin/env bash
# Capture real Mish Ana! TV screenshots while bots play a game.
# Usage: tools/capture-tv.sh <adb serial e.g. 192.168.0.3:39093> [en|ar] [pace_ms]
# Takes a 1920x1080 screencap every 4 s into play-store/graphics/raw/<locale>/, drives the host
# with the remote (OK on Start / Next), then stops the bots and restores the app locale to French.
set -euo pipefail
SERIAL=${1:?adb serial}; LOC=${2:-en}; PACE=${3:-9000}
HERE=$(cd "$(dirname "$0")" && pwd)
OUT="$HERE/../play-store/graphics/raw/$LOC"; mkdir -p "$OUT"
A() { adb -s "$SERIAL" "$@"; }
BOTS=""
cleanup() { [ -n "$BOTS" ] && kill "$BOTS" 2>/dev/null || true; A shell cmd locale set-app-locales app.mishana.tv --locales fr || true; }
trap cleanup EXIT

A shell input keyevent KEYCODE_WAKEUP
A shell cmd locale set-app-locales app.mishana.tv --locales "$LOC"
A shell am force-stop app.mishana.tv; sleep 1
A shell am start -n app.mishana.tv/.MainActivity; sleep 8
CODE=""
for _ in 1 2 3 4 5 6; do
  A shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || true
  CODE=$(A exec-out cat /sdcard/ui.xml | grep -oE '(text|content-desc)="[A-Z]{4}"' | head -1 | grep -oE '[A-Z]{4}' || true)
  [ -n "$CODE" ] && break; sleep 3
done
[ -z "$CODE" ] && { echo "room code not found in UI dump"; exit 1; }
echo "room $CODE"
node "$HERE/mishana-bots.mjs" "$CODE" --pace "$PACE" --timeout 600 > "$OUT/bots.log" 2>&1 &
BOTS=$!
sleep 14  # 6 joins
for i in $(seq -w 1 120); do
  A exec-out screencap -p > "$OUT/shot-$i.png"
  # Host remote: OK starts the game from the lobby and advances reveal/elimination screens.
  if (( 10#$i == 2 )) || (( 10#$i % 5 == 0 )); then A shell input keyevent KEYCODE_DPAD_CENTER; fi
  grep -q "stopping" "$OUT/bots.log" && break
  sleep 4
done
