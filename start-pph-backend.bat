@echo off
title Service PPh Backend (Port 3004)
cd /d "%~dp0pph-backend"
echo Memulai Service PPh Backend (Port 3004)...
if not exist "target\debug\pph-backend.exe" (
    echo Binary belum dibuild, melakukan cargo build...
    cargo build
)
target\debug\pph-backend.exe --port 3004
pause
