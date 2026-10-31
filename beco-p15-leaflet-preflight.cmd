@echo off
setlocal
cd /d C:\tmp\beco-p15-leaflet-20261022
echo === npm test ===
call npm test
if errorlevel 1 exit /b %errorlevel%
echo === node scripts/check-chars.mjs ===
call node scripts/check-chars.mjs
if errorlevel 1 exit /b %errorlevel%
echo === npm run seo ===
call npm run seo
if errorlevel 1 exit /b %errorlevel%
echo === npm run format:check ===
call npm run format:check
if errorlevel 1 exit /b %errorlevel%
echo === npm run deploy:check ===
call npm run deploy:check
if errorlevel 1 exit /b %errorlevel%
echo === npm run plan:check ===
call npm run plan:check
if errorlevel 1 exit /b %errorlevel%
echo === npx --yes prettier@3.9.6 --check . ===
call npx --yes prettier@3.9.6 --check .
if errorlevel 1 exit /b %errorlevel%
echo PREFLIGHT PASS
exit /b 0
