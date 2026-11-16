@echo off
title CodeChef Autonomous Speedrunner
echo ===================================================================
echo     CODECHEF FULLY AUTONOMOUS BROWSER RUNNER
echo ===================================================================
echo.
echo 1. Connecting directly to your browser...
echo 2. Solving MCQs with Gemini AI...
echo 3. Writing and debugging code in Monaco...
echo 4. Verifying green ticks and advancing automatically!
echo.

cd /d "%~dp0backend"
.\venv\Scripts\python.exe autonomous_runner.py
pause
