<#
.SYNOPSIS
    Script untuk menghapus semua data dummy, file sample, dan output sementara pada project auto-crop-akta.

.DESCRIPTION
    Menghapus:
    - File PDF sample (*.pdf di root)
    - File hasil crop dan anotasi (hasil_*, sample_*, ajb_*, *_annotated.png, *_crop_pembeli.png)
    - File JSON metadata (hasil_*.json)
    - Folder output/
#>

[CmdletBinding()]
param()

$root = $PSScriptRoot
if (-not $root) { $root = Get-Location }

Write-Host "Membersihkan file dummy, sample, dan output..." -ForegroundColor Cyan

$deletedCount = 0

# 1. Hapus file-file dummy/sample di root
$patterns = @("*.pdf", "hasil_*", "sample_*", "ajb_*", "*_annotated.png", "*_crop_pembeli.png")

Get-ChildItem -Path $root -File | Where-Object {
    $file = $_
    $matched = $false
    foreach ($p in $patterns) {
        if ($file.Name -like $p) {
            $matched = $true
            break
        }
    }
    $matched
} | ForEach-Object {
    Write-Host "  [DIHAPUS] $($_.Name)" -ForegroundColor Yellow
    Remove-Item -LiteralPath $_.FullName -Force
    $deletedCount++
}

# 2. Hapus folder output jika ada
$outputDir = Join-Path $root "output"
if (Test-Path -LiteralPath $outputDir) {
    Write-Host "  [DIHAPUS] output/ (direktori)" -ForegroundColor Yellow
    Remove-Item -LiteralPath $outputDir -Recurse -Force
    $deletedCount++
}

Write-Host "`nSelesai! Sebanyak $deletedCount item dummy/sample berhasil dihapus.`n" -ForegroundColor Green
