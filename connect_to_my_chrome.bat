@echo off
title Connect Autonomous Runner to Existing Chrome
echo ===================================================================
echo   CONNECT TO YOUR EXISTING CHROME SESSION (PORT 9222)
echo ===================================================================
echo.
echo Restarting Chrome with Remote Debugging enabled...
taskkill /F /IM chrome.exe >nul 2>&1
timeout /t 1 >nul
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --restore-last-session
timeout /t 2 >nul
echo.
echo Chrome restarted! Starting Autonomous Speedrunner...
echo.

cd /d "%~dp0backend"
.\venv\Scripts\python.exe autonomous_runner.py
pause
