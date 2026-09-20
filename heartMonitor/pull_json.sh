#!/usr/bin/env bash
# macOS/Linux equivalent of pull_json.bat - copies the session JSON off the board.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p exports
adb pull /home/arduino/ArduinoApps/heart-rate1/python/exports/. exports/
echo "JSON files copied to $(pwd)/exports"
