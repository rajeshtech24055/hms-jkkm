@echo off
cd /d "d:\HMS JKKM\client"
call npm run build
start "JKKM Server" "d:\HMS JKKM\server\start_server.bat"
echo DONE
