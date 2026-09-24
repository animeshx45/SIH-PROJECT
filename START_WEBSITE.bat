@echo off
title WeatherGPT - Web Platform (Desktop View)
echo ============================================================
echo   🌦️  WeatherGPT Web Platform & Backend API Server
echo ============================================================
echo.
echo Launching WeatherGPT in Web Browser: http://localhost:3000 ...
start "" "http://localhost:3000"
echo.
cd /d "%~dp0WEATHER-GPT"
echo Starting WeatherGPT Server on port 3000...
node src/server.js
pause

