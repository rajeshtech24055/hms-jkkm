@echo off
title JKKM HMS Server
cd /d "d:\HMS JKKM\server"

:start
echo [%date% %time%] Starting JKKM HMS Server...
node index.js > server.log 2>&1
echo [%date% %time%] Server crashed! Restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto start
