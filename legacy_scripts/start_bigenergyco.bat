@echo off
echo.
echo ============================================================
echo   BigEnergyCo - AI-Powered Battery Sourcing Platform
echo ============================================================
echo.

echo [1/3] Starting Groq AI Proxy Server on port 7510...
start "BigEnergyCo Proxy Server" cmd /k "python c:\Users\SCM\Documents\GitHub\BigEnergyCo\proxy_server.py"

timeout /t 2 /nobreak >nul

echo [2/3] Starting Cloudflare HTTPS Tunnel & Auto-Publisher...
start "BigEnergyCo Cloudflare Tunnel" cmd /k "python c:\Users\SCM\Documents\GitHub\BigEnergyCo\start_tunnel.py"

timeout /t 5 /nobreak >nul

echo [3/3] Opening BigEnergyCo Platform in your browser...
echo.
echo  ----------------------------------------------------------
echo   PUBLIC GLOBAL URL (Share with anyone):
echo   https://attorney-harbour-occurred-manitoba.trycloudflare.com/
echo.
echo   LOCAL PROXY URL:
echo   http://127.0.0.1:7510/v1/contract/web/AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov/
echo  ----------------------------------------------------------
echo.

start "" "https://attorney-harbour-occurred-manitoba.trycloudflare.com/"
