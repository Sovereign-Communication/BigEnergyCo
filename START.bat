@echo off
REM ============================================================
REM  BigEnergyCo - double-click this to start everything.
REM  Runs the launcher and keeps the window open on exit so you
REM  can read any error instead of watching it vanish.
REM ============================================================
title BigEnergyCo Launcher
cd /d "%~dp0"

python launcher.py
if errorlevel 1 (
  echo.
  echo [!] The launcher exited with an error. Details are above.
)

echo.
echo Press any key to close this window...
pause >nul
