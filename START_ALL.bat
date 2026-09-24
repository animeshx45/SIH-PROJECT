@echo off
title WeatherGPT - Master Launcher
echo ============================================================
echo   🌦️  WeatherGPT Platform (SIH26068)
echo   Mobile & Web AMOLED Intelligence Suite
echo ============================================================
echo.

cd /d "%~dp0WEATHER-GPT"

echo Launching WeatherGPT in Web Browser: http://localhost:3000 ...
start "" "http://localhost:3000"
echo Starting WeatherGPT Backend on port 3000...
node src/server.js
pause

