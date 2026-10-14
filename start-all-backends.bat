@echo off
title Start All Backends (AutoFill PPAT)
echo =======================================================
echo   Menjalankan Ketiga Service Backend PPAT:
echo   1. Pembeli Backend (Port 3001)
echo   2. PBB & BPHTB Backend (Port 3002)
echo   3. Sertipikat Backend (Port 3003)
echo =======================================================
start "Service Pembeli Backend (Port 3001)" cmd /c "%~dp0start-backend.bat"
start "Service PBB & BPHTB Backend (Port 3002)" cmd /c "%~dp0start-pbb-backend.bat"
start "Service Sertipikat Backend (Port 3003)" cmd /c "%~dp0start-sertipikat-backend.bat"
echo Ketiga layanan backend telah dijalankan di jendela terpisah.
