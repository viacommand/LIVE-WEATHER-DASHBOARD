@echo off
echo =============================================
echo   LIVE WEATHER DASHBOARD - Local Server
echo =============================================
echo.
echo Starting server at http://localhost:5500
echo Press Ctrl+C to stop the server.
echo.
start "" "http://localhost:5500"
node "%~dp0server.js"
pause
