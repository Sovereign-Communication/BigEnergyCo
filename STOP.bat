@echo off
REM ============================================================
REM  BigEnergyCo - double-click this to stop everything.
REM ============================================================
title BigEnergyCo Shutdown
cd /d "%~dp0"

python launcher.py --stop

echo.
echo Press any key to close this window...
pause >nul
