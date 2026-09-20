@echo off
if not exist exports mkdir exports
adb pull /home/arduino/ArduinoApps/heart-rate1/python/exports/. exports\
echo JSON files copied to %CD%\exports