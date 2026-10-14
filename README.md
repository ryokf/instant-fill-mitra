# AutoFill PPAT Mitra Kerja

Ekstensi browser (Manifest V3) yang menampilkan panel melayang di `ppat.atrbpn.go.id`
untuk mengisi otomatis form Penjual (Badan Hukum), Pihak Pembeli (via OCR Akta PDF), PBB & BPHTB (via OCR Dokumen BPHTB), Pihak Persetujuan, dan Pihak Saksi.

## Alur singkat

```
Klik ikon toolbar ──► service-worker.js ──(pesan "toggleAutoFillPanel")──► ui/panel.js

Halaman PPAT dimuat ─► content/main.js ─► ui/panel.js  (membuat panel)
                                            │
        ┌───────────────────────────────────┼────────────────────────────┐
        ▼                                   ▼                            ▼
 services/page-reader.js            ui/person-list.js           fillers/*-filler.js
 (baca "Daftar Penjual" di web)     (daftar nama yang diklik)   (isi form di halaman)
        │                                   │                            │
        ▼                                   ▼                            ▼
 services/pt-matcher.js             Upload PDF Akta             dom/dom-helpers.js
 (cocokkan database PT)             └─► pembeli-backend (OCR)   (isi input & Select2)
                                        └─► pembeli-filler.js
                                    Upload Dokumen BPHTB
                                    └─► pbb-bphtb-backend (OCR)
                                        └─► pbb-bphtb-filler.js
```

1. `main.js` memanggil `PPAT.panel.create()` saat DOM siap.
2. `panel.js` memasang panel, mengisi dropdown PT, lalu menjalankan deteksi berkala:
   `page-reader` membaca nama penjual di web → `pt-matcher` mencocokkannya dengan database → panel memilih PT otomatis.
3. **Pihak Pembeli (Upload Akta)**: Seret / pilih file PDF Akta pada dropzone panel → dikirim ke service backend lokal (`http://127.0.0.1:3001/api/extract-pembeli`) → diekstrak dengan Windows Native OCR → hasil JSON otomatis mengisi Form Pihak Pembeli (`#frmtipepihak2Dukcapil`).
4. **PBB & BPHTB (Upload Dokumen BPHTB)**:
   - Pastikan Sertifikat sudah terisi di web PPAT terlebih dahulu.
   - Seret / pilih file PDF atau foto dokumen BPHTB pada panel → dikirim ke service backend (`http://127.0.0.1:3002/api/extract-bphtb`).
   - **Section PBB**: Dropdown Nomor Sertifikat (`#alashakid`) memilih opsi pertama → otomatis menunggu kolom `Luas (M2)` pertama (`#luassertipikat`) dan kolom `ZNT per M2 (Rp)` (`#nilaiznt`) terisi → mengisi lengkap NOP (18 digit), Tahun (tahun sekarang), Luas Tanah, dan NJOP per M2 tanah → submit form PBB.
   - **Section BPHTB**: Dropdown (`#obyekpajakid`) memilih opsi pertama → tanpa menunggu data apapun terisi, langsung mengisi `Nomor Bukti Pembayaran` (`#nomorbphtb`) yang diambil dari ujung kanan atas dokumen BPHTB → submit form BPHTB.
5. Klik nama pada daftar → `persetujuan-filler` / `saksi-filler` mengisi form lewat `dom-helpers`.
6. Tombol "Isi Form Penjual" → `penjual-filler`.
7. Opsi "Otomatis klik tombol Tambah" akan langsung menekan tombol submit form setelah data selesai terisi.

## Menjalankan Service Backend

Sebelum mengunggah berkas di ekstensi, jalankan service backend:
- **Jalankan Semua Service Sekaligus**: Double-click `start-all-backends.bat` di root proyek.
- **Service Pembeli Backend Saja (Port 3001)**: Double-click `start-backend.bat`.
- **Service PBB & BPHTB Backend Saja (Port 3002)**: Double-click `start-pbb-backend.bat`.

## Struktur folder

| Path | Tanggung jawab |
|------|----------------|
| `manifest.json` | Deklarasi ekstensi & **urutan** file content script |
| `src/core/namespace.js` | Membuat namespace global `PPAT` (harus dimuat pertama) |
| `src/core/config.js` | Selector halaman PPAT, timing, default, teks pesan, URL backend |
| `src/data/` | Data PT, Pihak Persetujuan, dan Saksi |
| `src/dom/dom-helpers.js` | Helper DOM generik (tunggu elemen, isi input, Select2) |
| `src/services/` | Logika non-UI: membaca halaman & mencocokkan PT |
| `src/fillers/` | File filler per form (penjual, persetujuan, saksi, pembeli, pbb-bphtb) |
| `src/ui/` | Template HTML, CSS, daftar orang, dropzone upload, controller panel |
| `src/content/main.js` | Entry point content script (dimuat terakhir) |
| `src/background/service-worker.js` | Toggle panel dari ikon toolbar |
| `pembeli-backend/` | Rust service (Windows WinRT OCR & PDF) penyedia API ekstraksi pembeli (Port 3001) |
| `pbb-bphtb-backend/` | Rust service (Windows WinRT OCR & PDF) penyedia API ekstraksi PBB & BPHTB (Port 3002) |
| `start-backend.bat` | Script 1-klik untuk menjalankan pembeli-backend |
| `start-pbb-backend.bat` | Script 1-klik untuk menjalankan pbb-bphtb-backend |
| `start-all-backends.bat` | Script 1-klik untuk menjalankan kedua backend sekaligus |
