#!/usr/bin/env bash
# macOS/Linux equivalent of deploy.bat.
#   ./deploy.sh demo    (10 s warm-up, 30 s calibration - use this for demos)
#   ./deploy.sh full    (20 s warm-up, 90 s calibration)
set -euo pipefail

MODE="${1:-}"
if [[ "$MODE" != "demo" && "$MODE" != "full" ]]; then
  echo "Usage: ./deploy.sh demo   or   ./deploy.sh full" >&2
  exit 1
fi

DEST=/home/arduino/ArduinoApps/heart-rate1
cd "$(dirname "$0")"

adb devices
adb shell mkdir -p "$DEST/python" "$DEST/sketch"
adb push python/main.py                   "$DEST/python/main.py"
adb push python/requirements.txt          "$DEST/python/requirements.txt"
adb push python/penpal_stress_checker.eim "$DEST/python/penpal_stress_checker.eim"
adb push "python/config_${MODE}.json"     "$DEST/python/config.json"
adb push sketch/sketch.ino                "$DEST/sketch/sketch.ino"
# ports: [8766] - without this the container publishes nothing and the web app
# cannot reach the monitor.
adb push app.yaml                         "$DEST/app.yaml"
adb shell chmod +x "$DEST/python/penpal_stress_checker.eim"

echo
echo "Deployed the ${MODE} config. In App Lab: open the app, press Stop then Run."
echo "Then point the web app at the board:  VITE_HEART_HTTP_URL=http://<board-ip>:8766"
