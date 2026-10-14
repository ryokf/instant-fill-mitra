@echo off
title Service Sertipikat Backend (Port 3003)
cd /d "%~dp0sertipikat-backend"
echo Memulai Service Sertipikat Backend (Port 3003)...
if not exist "target\debug\sertipikat-backend.exe" (
    echo Binary belum dibuild, melakukan cargo build...
    cargo build
)
target\debug\sertipikat-backend.exe --port 3003
pause
