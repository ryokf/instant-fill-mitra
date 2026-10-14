@echo off
title Service Backend Terpadu (AutoFill PPAT)
echo =======================================================
echo   Menjalankan Service Backend Terpadu (Port 3001)
echo   Layanan: Pembeli, BPHTB, Sertipikat, PPh
echo =======================================================
cd /d "%~dp0backend"
if exist "target\release\instant-fill-backend.exe" (
    "target\release\instant-fill-backend.exe" --port 3001
) else if exist "target\debug\instant-fill-backend.exe" (
    "target\debug\instant-fill-backend.exe" --port 3001
) else (
    cargo run -- --port 3001
)
pause
