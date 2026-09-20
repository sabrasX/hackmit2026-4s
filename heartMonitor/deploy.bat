@echo off
if "%1"=="" goto usage
set DEST=/home/arduino/ArduinoApps/heart-rate1
adb devices
adb shell mkdir -p %DEST%/python
adb push python\main.py %DEST%/python/main.py
adb push python\requirements.txt %DEST%/python/requirements.txt
adb push python\penpal_stress_checker.eim %DEST%/python/penpal_stress_checker.eim
adb push python\config_%1.json %DEST%/python/config.json
adb push sketch\sketch.ino %DEST%/sketch/sketch.ino
adb shell chmod +x %DEST%/python/penpal_stress_checker.eim
echo.
echo Deployed %1 version. In App Lab, open the app, click Stop then Run.
goto end
:usage
echo Usage: deploy.bat full   or   deploy.bat demo
:end