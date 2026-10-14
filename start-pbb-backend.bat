@echo off
title Service PBB & BPHTB Backend (AutoFill PPAT)
echo =======================================================
echo   Menjalankan Service PBB & BPHTB Backend (Port 3002)...
echo =======================================================
cd /d "%~dp0pbb-bphtb-backend"
if exist "target\release\pbb-bphtb-backend.exe" (
    "target\release\pbb-bphtb-backend.exe" --port 3002
) else if exist "target\debug\pbb-bphtb-backend.exe" (
    "target\debug\pbb-bphtb-backend.exe" --port 3002
) else (
    cargo run -- --port 3002
)
pause
