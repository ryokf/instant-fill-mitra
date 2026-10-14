@echo off
title Start All Backends (AutoFill PPAT)
echo =======================================================
echo   Menjalankan Kedua Service Backend PPAT:
echo   1. Pembeli Backend (Port 3001)
echo   2. PBB & BPHTB Backend (Port 3002)
echo =======================================================
start "Service Pembeli Backend (Port 3001)" cmd /c "%~dp0start-backend.bat"
start "Service PBB & BPHTB Backend (Port 3002)" cmd /c "%~dp0start-pbb-backend.bat"
echo Layanan backend telah dijalankan di jendela terpisah.
