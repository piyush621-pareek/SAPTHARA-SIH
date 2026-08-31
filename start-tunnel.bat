@echo off
REM ============================================================
REM  SAPTHARA public tunnel — makes your laptop-server reachable
REM  from ANY network (mobile data, other Wi-Fi). No account.
REM  1) Make sure the backend is running:  docker compose up -d
REM  2) Double-click this file.
REM  3) Copy the https://....trycloudflare.com URL it prints.
REM  4) In the app: Settings -> Backend Server -> paste that URL
REM     (no :8080 needed) -> Save -> reopen the app.
REM ============================================================
cd /d "%~dp0"
echo Starting tunnel to http://localhost:8080 ...
echo Look for a line like:  https://something-random.trycloudflare.com
echo (Keep this window OPEN while you use the app.)
echo.
"%~dp0tools\cloudflared.exe" tunnel --url http://localhost:8080
pause
