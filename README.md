# AutoFill PPAT Mitra Kerja

Ekstensi browser (Manifest V3) yang menampilkan panel melayang di `ppat.atrbpn.go.id`
untuk mengisi otomatis form Penjual (Badan Hukum), Pihak Pembeli (via OCR Akta PDF), Pengecekan Sertipikat, PBB & BPHTB (via OCR Dokumen BPHTB), PPh (via OCR Surat Keterangan), Pihak Persetujuan, dan Pihak Saksi.

## Alur Singkat

```
[ Web Browser (Chrome/Edge) ]                      [ Localhost (Port 3001) ]
   ppat.atrbpn.go.id                                  instant-fill-backend (Rust)
┌───────────────────────────────┐                  ┌─────────────────────────────────┐
│ Manifest V3 Content Script    │  HTTP / Multipart│ - POST /api/extract-pembeli     │
│ - Floating Panel UI           │ ────────────────►│ - POST /api/extract-bphtb       │
│ - DOM Helpers & Page Context  │ ◄────────────────│ - POST /api/extract-sertipikat   │
│ - Form Fillers                │   JSON Response  │ - POST /api/extract-pph         │
└───────────────────────────────┘                  └─────────────────────────────────┘
                │
                ▼
  [ Pengisian Form ATR/BPN Berurutan ]
  1. Sertipikat Elektronik (NIB & Kode Blangko)
  2. Akta & Pihak Pembeli (AJB)
  3. PBB (tunggu ZNT & simpan) -> Lanjut BPHTB (No. Bukti)
  4. PPh (Suket & NPWP -> Validasi & Upload)
```

1. **Backend Terpadu (Port 3001)**: Keempat layanan backend (Pembeli, BPHTB, Sertipikat, PPh) disatukan dalam satu binary Rust berkecepatan tinggi berbasis Tokio dan Windows Native WinRT OCR (`Windows.Media.Ocr`).
2. **Ekstraksi Paralel (Client-Driven Parallel)**:
   - Pengguna dapat memilih/men-drag beberapa berkas sekaligus pada panel **Multi-Upload**.
   - Ekstensi mengirimkan seluruh berkas secara bersamaan (`Promise.all`) ke port 3001. Backend memproses seluruh dokumen di thread pool secara paralel.
3. **Pengisian Form Sekuensial (Anti Race Condition)**:
   - Setelah ekstraksi paralel selesai, data diisikan ke form web PPAT ATR/BPN secara berurutan dan disiplin mengikuti status AJAX halaman (Sertipikat $\rightarrow$ Akta/Pembeli $\rightarrow$ PBB $\rightarrow$ BPHTB $\rightarrow$ PPh).
4. **Fleksibilitas Upload Individual**:
   - Jika pengguna hanya memiliki satu berkas (misal hanya Akta saja atau hanya berkas BPHTB), dropzone masing-masing bagian tetap dapat digunakan seperti biasa.

## Menjalankan Service Backend

Cukup jalankan satu file:
- Double-click **`start-backend.bat`** (atau `start-all-backends.bat`) di root proyek.
- Backend terpadu akan langsung aktif di `http://127.0.0.1:3001` dan melayani keempat endpoint secara bersamaan.

## Struktur Folder

| Path | Tanggung jawab |
|------|----------------|
| `backend/` | **Single unified Rust project** penyedia API ekstraksi Pembeli, BPHTB, Sertipikat, dan PPh (Port 3001) |
| `start-backend.bat` | Script 1-klik untuk menjalankan backend terpadu |
| `start-all-backends.bat` | Script alias yang memanggil `start-backend.bat` |
| `manifest.json` | Deklarasi ekstensi Chrome Manifest V3 |
| `src/core/config.js` | Konfigurasi terpusat (URL backend port 3001, selector DOM, timing, pesan) |
| `src/dom/dom-helpers.js` | Helper DOM & injeksi skrip Main World untuk sinkronisasi jQuery & Select2 |
| `src/fillers/` | Implementasi pengisian form per modul (penjual, pembeli, sertipikat, pbb-bphtb, pph) |
| `src/ui/` | Template panel melayang, style CSS, dan controller multi-upload |
| `src/content/main.js` | Entry point content script |
