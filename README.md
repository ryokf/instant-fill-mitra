# AutoFill PPAT Mitra Kerja

Ekstensi browser (Manifest V3) yang menampilkan panel melayang di `ppat.atrbpn.go.id`
untuk mengisi otomatis form Penjual (Badan Hukum), Pihak Pembeli (via OCR Akta PDF), Pihak Persetujuan, dan Pihak Saksi.

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
```

1. `main.js` memanggil `PPAT.panel.create()` saat DOM siap.
2. `panel.js` memasang panel, mengisi dropdown PT, lalu menjalankan deteksi berkala:
   `page-reader` membaca nama penjual di web → `pt-matcher` mencocokkannya dengan database → panel memilih PT otomatis.
3. **Pihak Pembeli (Upload Akta)**: Seret / pilih file PDF Akta pada dropzone panel → dikirim ke service backend lokal (`http://127.0.0.1:3001/api/extract-pembeli`) → diekstrak dengan Windows Native OCR → hasil JSON otomatis mengisi Form Pihak Pembeli (`#frmtipepihak2Dukcapil`).
4. Klik nama pada daftar → `persetujuan-filler` / `saksi-filler` mengisi form lewat `dom-helpers`.
5. Tombol "Isi Form Penjual" → `penjual-filler`.
6. Opsi "Otomatis klik tombol Tambah" akan langsung menekan tombol submit form setelah data selesai terisi.

## Menjalankan Service Pembeli Backend

Sebelum mengunggah berkas PDF Akta di ekstensi, jalankan service backend:
1. Double-click file `start-backend.bat` di root proyek ini (atau di dalam folder `pembeli-backend/`).
2. Service akan otomatis aktif di `http://127.0.0.1:3001` dan siap menerima berkas PDF.

## Struktur folder

| Path | Tanggung jawab |
|------|----------------|
| `manifest.json` | Deklarasi ekstensi & **urutan** file content script |
| `src/core/namespace.js` | Membuat namespace global `PPAT` (harus dimuat pertama) |
| `src/core/config.js` | Selector halaman PPAT, timing, default, teks pesan, URL backend |
| `src/data/` | Data PT, Pihak Persetujuan, dan Saksi |
| `src/dom/dom-helpers.js` | Helper DOM generik (tunggu elemen, isi input, Select2) |
| `src/services/` | Logika non-UI: membaca halaman & mencocokkan PT |
| `src/fillers/` | Satu file per form yang diisi (penjual, persetujuan, saksi, pembeli) |
| `src/ui/` | Template HTML, CSS, daftar orang, dropzone upload, controller panel |
| `src/content/main.js` | Entry point content script (dimuat terakhir) |
| `src/background/service-worker.js` | Toggle panel dari ikon toolbar |
| `pembeli-backend/` | Rust service (Windows WinRT OCR & PDF) penyedia API ekstraksi pembeli |
| `start-backend.bat` | Script 1-klik untuk menjalankan service lokal pembeli |
