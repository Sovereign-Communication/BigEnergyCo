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

cd /d "c:\Users\SCM\Documents\GitHub\BigEnergyCo\BigEnergyCo\worker"

echo.
echo [1/3] Logging into Cloudflare...
wrangler login

echo.
echo [2/3] Deploying Worker to Cloudflare...
wrangler deploy

echo.
echo [3/3] Adding Groq API Key as a secret...
echo When prompted, paste your Groq API key (from https://console.groq.com/keys)
echo Your key is stored at C:\Users\SCM\.config\scmorc\groq.env
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
