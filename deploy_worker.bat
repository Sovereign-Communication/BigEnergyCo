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
echo Target: bigenergyco-api  (worker\wrangler.production.json)
rem The config is named EXPLICITLY. A bare `wrangler deploy` here would pick up
rem worker\wrangler.json, which is the SHOWCASE surface (bigenergyco-api-showcase,
rem with the showcase D1 and KV bindings) - it would ship the showcase worker and
rem then write the production key to it. Same for the secret below.
wrangler deploy --config wrangler.production.json

echo.
echo [3/3] Adding Groq API Key as a secret...
echo Paste your Groq API key (from https://console.groq.com/keys) when prompted.
echo Tip: set a GROQ_API_KEY env var (see .env.example) and pipe it instead:
echo   echo %GROQ_API_KEY% | wrangler secret put GROQ_API_KEY --config wrangler.production.json
echo The key is stored only as a Worker secret - never commit it.
echo.
wrangler secret put GROQ_API_KEY --config wrangler.production.json

echo.
echo ============================================================
echo   DONE! Your Worker is live at:
echo   https://bigenergyco-api.bigenergyco.workers.dev
echo.
echo   Test it: https://bigenergyco-api.bigenergyco.workers.dev/api/health
echo ============================================================
echo.
pause
