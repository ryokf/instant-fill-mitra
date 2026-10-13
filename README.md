# AutoFill PPAT Mitra Kerja

Ekstensi browser (Manifest V3) yang menampilkan panel melayang di `ppat.atrbpn.go.id`
untuk mengisi otomatis form Penjual (Badan Hukum), Pihak Persetujuan, dan Pihak Saksi.

## Alur singkat

```
Klik ikon toolbar ──► service-worker.js ──(pesan "toggleAutoFillPanel")──► ui/panel.js

Halaman PPAT dimuat ─► content/main.js ─► ui/panel.js  (membuat panel)
                                            │
        ┌───────────────────────────────────┼────────────────────────────┐
        ▼                                   ▼                            ▼
 services/page-reader.js            ui/person-list.js           fillers/*-filler.js
 (baca "Daftar Penjual" di web)     (daftar nama yang diklik)   (isi form di halaman)
        │                                                            │
        ▼                                                            ▼
 services/pt-matcher.js                                      dom/dom-helpers.js
 (cocokkan dengan data/pt-database.js)                       (isi input & Select2)
```

1. `main.js` memanggil `PPAT.panel.create()` saat DOM siap.
2. `panel.js` memasang panel, mengisi dropdown PT, lalu menjalankan deteksi berkala:
   `page-reader` membaca nama penjual di web → `pt-matcher` mencocokkannya dengan database → panel memilih PT otomatis.
3. Klik nama pada daftar → `persetujuan-filler` / `saksi-filler` mengisi form lewat `dom-helpers`.
4. Tombol "Isi Form Penjual" → `penjual-filler`.

## Struktur folder

| Path | Tanggung jawab |
|------|----------------|
| `manifest.json` | Deklarasi ekstensi & **urutan** file content script |
| `src/core/namespace.js` | Membuat namespace global `PPAT` (harus dimuat pertama) |
| `src/core/config.js` | Selector halaman PPAT, timing, default, teks pesan |
| `src/data/` | Data PT, Pihak Persetujuan, dan Saksi |
| `src/dom/dom-helpers.js` | Helper DOM generik (tunggu elemen, isi input, Select2) |
| `src/services/` | Logika non-UI: membaca halaman & mencocokkan PT |
| `src/fillers/` | Satu file per form yang diisi |
| `src/ui/` | Template HTML, CSS, daftar orang, controller panel |
| `src/content/main.js` | Entry point content script (dimuat terakhir) |
| `src/background/service-worker.js` | Toggle panel dari ikon toolbar |

## Cara umum mengubah

- **Tambah/ubah data PT, saksi** → `src/data/`
- **Situs PPAT mengubah ID/selector form** → `SELECTORS` di `src/core/config.js`
- **Ubah teks alert / timeout** → `MESSAGES` / `TIMING` di `src/core/config.js`
- **Tambah file JS baru** → daftarkan di `content_scripts.js` pada `manifest.json` (urutan penting:
  modul yang dipakai harus dimuat sebelum pemakainya).
