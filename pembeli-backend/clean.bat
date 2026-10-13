@echo off
setlocal

echo Membersihkan file dummy, sample, dan output...

for %%f in (*.pdf hasil_* sample_* ajb_* *_annotated.png *_crop_pembeli.png) do (
    if exist "%%f" (
        echo   [DIHAPUS] %%f
        del /f /q "%%f" >nul 2>&1
    )
)

if exist "output" (
    echo   [DIHAPUS] output/ (direktori)
    rmdir /s /q "output" >nul 2>&1
)

echo Selesai! Semua item dummy dan sample data telah dibersihkan.
