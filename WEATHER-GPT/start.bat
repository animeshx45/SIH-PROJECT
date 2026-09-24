@echo off
title WeatherGPT Full-Stack Platform
cd /d %~dp0
echo Starting WeatherGPT Server on port 3000...
node src/server.js
pause
