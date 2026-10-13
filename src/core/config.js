/**
 * Konfigurasi terpusat: selector halaman PPAT, durasi tunggu, dan pesan UI.
 * Jika struktur HTML situs PPAT berubah, cukup ubah selector di sini.
 */
PPAT.config = Object.freeze({
    TIMING: Object.freeze({
        POLL_INTERVAL_MS: 150, // interval cek elemen saat menunggu muncul
        PENJUAL_FORM_TIMEOUT_MS: 8000,
        PERSETUJUAN_FORM_TIMEOUT_MS: 5000,
        SAKSI_FORM_TIMEOUT_MS: 5000,
        FORM_SETTLE_DELAY_MS: 300, // jeda agar form hasil AJAX selesai dirender
        DETECT_INTERVAL_MS: 2500, // pengecekan berkala daftar penjual di web
    }),

    DEFAULTS: Object.freeze({
        TIPE_PEMILIK: "33", // 33: Badan Usaha Milik Swasta (BUMS)
        TIPE_USAHA: "4", // 4: Perseroan Terbatas (PT)
        TIPE_BUKTI_SAKSI: "1", // 1: KTP
        TIPE_PIHAK_NON_PERORANGAN: "Non Perorangan",
    }),

    SELECTORS: Object.freeze({
        daftarPenjual: "#daftarpihak1placeholder blockquote.message",

        penjual: Object.freeze({
            tipePihak: "select#tipepihak1",
            form: "#frmInput1BadanHukum",
            tipePemilik: "#frmInput1BadanHukum select#tipepemilikid",
            tipeUsaha: "#frmInput1BadanHukum select#tipeusaha",
            // [selector input, properti pada data penjual]
            fields: [
                ["#tNAMA_LENGKAPPihak1", "nama"],
                ["#frmInput1BadanHukum #tALAMAT", "alamat"],
                ["#frmInput1BadanHukum #tLOKASI", "kota"],
                ["#frmInput1BadanHukum #tNPWP", "npwp"],
                ["#frmInput1BadanHukum #tIDENTITAS", "akta"],
                ["#frmInput1BadanHukum #tPENDIRIAN", "tgl_akta"],
            ],
        }),

        persetujuan: Object.freeze({
            form: "#frmPihaksetujuDukcapil",
            fields: [
                ["#tNIKpihaksetuju", "nik"],
                ["#tNAMA_LENGKAPpihaksetuju", "nama"],
                ["#tALAMATpihaksetuju", "alamat"],
                ["#tTEMPAT_LAHIRpihaksetuju", "tempat_lahir"],
                ["#tTANGGAL_LAHIRpihaksetuju", "tgl_lahir"],
                ["#frmPihaksetujuDukcapil #tJENIS_PEKERJAAN", "pekerjaan"],
            ],
        }),

        saksi: Object.freeze({
            form: "#frmSaksiDukcapil",
            tipeBukti: "#frmSaksiDukcapil select#tipebuktisaksi1",
            fields: [
                ["#tNIKsaksi", "nik"],
                ["#tNAMA_LENGKAPsaksi", "nama"],
                ["#tALAMATsaksi", "alamat"],
                ["#tTEMPAT_LAHIRsaksi", "tempat_lahir"],
                ["#tTANGGAL_LAHIRsaksi", "tgl_lahir"],
                ["#tJENIS_PEKERJAANsaksi", "pekerjaan"],
            ],
        }),
    }),

    MESSAGES: Object.freeze({
        TOGGLE_PANEL_ACTION: "toggleAutoFillPanel",

        penjualFormMissing:
            "Gagal memuat Form Penjual (Badan Hukum). Pastikan Anda berada di halaman pembuatan Akta PPAT.",
        penjualFilled: "Data Penjual (Badan Hukum) berhasil diisi!",
        persetujuanFormMissing:
            "Form Pihak Persetujuan tidak ditemukan. Pastikan Anda berada di seksi E (Pihak Persetujuan).",
        persetujuanFilled: "Data Pihak Persetujuan berhasil diisi!\nSilakan periksa dan klik 'Tambah'.",
        saksiFormMissing: "Form Saksi tidak ditemukan. Pastikan Anda berada di halaman pembuatan Akta PPAT.",
        saksiFilled: (nama) => `Data Saksi (${nama}) berhasil diisi!\nSilakan periksa dan klik 'Tambah'.`,
        selectPtFirst: "Pilih PT terlebih dahulu!",
    }),
});
