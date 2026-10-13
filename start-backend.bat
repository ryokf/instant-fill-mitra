@echo off
title Service Pembeli Backend (AutoFill PPAT)
echo =======================================================
echo   Menjalankan Service Pembeli Backend (Port 3001)...
echo =======================================================
cd /d "%~dp0pembeli-backend"
if exist "target\release\auto-crop-akta.exe" (
    "target\release\auto-crop-akta.exe" --port 3001
) else if exist "target\debug\auto-crop-akta.exe" (
    "target\debug\auto-crop-akta.exe" --port 3001
) else (
    cargo run -- --port 3001
)
pause
