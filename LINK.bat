@echo off
REM ============================================================
REM  Opens the CURRENT public link in your browser.
REM  The link changes every time you restart, so always use
REM  this instead of a bookmark.
REM ============================================================
title BigEnergyCo Public Link
cd /d "%~dp0"

if not exist "tunnel_url.txt" (
  echo.
  echo   No public link found. Is the site running?
  echo   Double-click START.bat first.
  echo.
  pause
  exit /b 1
)

set /p URL=<tunnel_url.txt

echo.
echo   Current public link:
echo   %URL%
echo.
echo   Opening in your browser...
start "" "%URL%"

timeout /t 3 /nobreak >nul
