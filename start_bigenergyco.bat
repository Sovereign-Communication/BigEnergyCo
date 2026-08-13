@echo off
setlocal

echo.
echo ============================================================
echo   BigEnergyCo - AI Battery Sovereignty Platform
echo   Full Stack Launcher (Persistent Background Services)
echo ============================================================
echo.

set REPO=c:\Users\SCM\Documents\GitHub\BigEnergyCo

REM ── Kill any stale Python processes on port 7510 ────────────
echo [0/3] Clearing stale processes on port 7510...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":7510" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

REM ── Start proxy_server.py as persistent background process ──
echo [1/3] Starting Groq AI Proxy Server (port 7510)...
powershell -WindowStyle Hidden -Command "Start-Process python -ArgumentList '%REPO%\proxy_server.py' -WorkingDirectory '%REPO%' -WindowStyle Minimized"

timeout /t 3 /nobreak >nul

REM ── Start Cloudflare tunnel + auto patch+publish ─────────────
echo [2/3] Starting Cloudflare Tunnel + Freenet Publisher...
powershell -WindowStyle Hidden -Command "Start-Process python -ArgumentList '%REPO%\start_and_publish_tunnel.py' -WorkingDirectory '%REPO%' -WindowStyle Minimized"

timeout /t 8 /nobreak >nul

REM ── Show the live URL ─────────────────────────────────────────
echo [3/3] Reading tunnel URL...
if exist "%REPO%\tunnel_url.txt" (
    set /p CF_URL=<"%REPO%\tunnel_url.txt"
    echo.
    echo  ============================================================
    echo   PUBLIC CLOUDFLARE URL (share with anyone worldwide):
    echo   !CF_URL!
    echo.
    echo   LOCAL PROXY URL (your machine):
    echo   http://127.0.0.1:7510/
    echo  ============================================================
    echo.
    start "" "!CF_URL!"
) else (
    echo   Tunnel still starting — check tunnel_url.txt in 10s
    echo   Then open: http://127.0.0.1:7510/
)

echo.
echo  Both services are running as background Windows processes.
echo  They will persist after you close this window.
echo  To stop them: taskkill /IM python.exe /F
echo.
pause
