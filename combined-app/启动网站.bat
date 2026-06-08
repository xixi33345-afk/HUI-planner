@echo off
rem Start a local web server for this site, then open the browser.
cd /d "%~dp0"
echo Starting local server at http://localhost:8787 ...
echo (Keep this window open. Press Ctrl+C to stop.)
where py >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8787
  py -m http.server 8787
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8787
  python -m http.server 8787
  goto :eof
)
where node >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8787
  npx --yes http-server -p 8787 -c-1 .
  goto :eof
)
echo.
echo [ERROR] Python or Node.js not found.
echo Install Python from https://www.python.org/downloads/
echo (check "Add python.exe to PATH" during install), then run this again.
pause
