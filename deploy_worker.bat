@echo off
echo.
echo ============================================================
echo   BigEnergyCo - Cloudflare Worker Setup
echo ============================================================
echo.
echo This will open your browser to authorize Cloudflare.
echo Log in with your Cloudflare account when prompted.
echo.
echo Press any key to start...
pause >nul

cd /d "%~dp0worker"

echo.
echo [1/3] Logging into Cloudflare...
wrangler login

echo.
echo [2/3] Deploying Worker to Cloudflare...
wrangler deploy

echo.
echo [3/3] Adding Groq API Key as a secret...
echo Paste your Groq API key (from https://console.groq.com/keys) when prompted.
echo Tip: set a GROQ_API_KEY env var (see .env.example) and pipe it instead:
echo   echo %GROQ_API_KEY% | wrangler secret put GROQ_API_KEY
echo The key is stored only as a Worker secret - never commit it.
echo.
wrangler secret put GROQ_API_KEY

echo.
echo ============================================================
echo   DONE! Your Worker is live at:
echo   https://bigenergyco-api.treystu.workers.dev
echo.
echo   Test it: https://bigenergyco-api.treystu.workers.dev/api/health
echo ============================================================
echo.
pause
