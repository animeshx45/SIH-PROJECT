@echo off
title WeatherGPT - Mobile Application (AMOLED Frame)
echo ============================================================
echo   📱  WeatherGPT — Mobile Application Mode (AMOLED UI)
echo ============================================================
echo.
echo Launching WeatherGPT in Native Mobile Frame (412x915)...
start "" "msedge.exe" --app=http://127.0.0.1:3000 --window-size=412,915
echo.
cd /d "%~dp0WEATHER-GPT"
echo Starting WeatherGPT Server on port 3000...
node src/server.js
pause

