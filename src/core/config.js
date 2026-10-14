/**
 * Konfigurasi terpusat: selector halaman PPAT, durasi tunggu, dan pesan UI.
 * Jika struktur HTML situs PPAT berubah, cukup ubah selector di sini.
 */
PPAT.config = Object.freeze({
    BACKEND_URL: "http://127.0.0.1:3001/api/extract-pembeli",
    BPHTB_BACKEND_URL: "http://127.0.0.1:3002/api/extract-bphtb",

    TIMING: Object.freeze({
        POLL_INTERVAL_MS: 150, // interval cek elemen saat menunggu muncul
        AKTA_FORM_TIMEOUT_MS: 5000,
        PENJUAL_FORM_TIMEOUT_MS: 8000,
        PERSETUJUAN_FORM_TIMEOUT_MS: 5000,
        SAKSI_FORM_TIMEOUT_MS: 5000,
        PEMBELI_FORM_TIMEOUT_MS: 5000,
        PBB_FORM_TIMEOUT_MS: 8000,
        BPHTB_FORM_TIMEOUT_MS: 8000,
        ZNT_WAIT_TIMEOUT_MS: 10000,
        FORM_SETTLE_DELAY_MS: 300, // jeda agar form hasil AJAX selesai dirender
        SUBMIT_DELAY_MS: 250, // jeda setelah input terisi sebelum menekan Tambah
        DETECT_INTERVAL_MS: 2500, // pengecekan berkala daftar penjual di web
    }),

    DEFAULTS: Object.freeze({
        TIPE_PEMILIK: "33", // 33: Badan Usaha Milik Swasta (BUMS)
        TIPE_USAHA: "4", // 4: Perseroan Terbatas (PT)
        TIPE_BUKTI_SAKSI: "1", // 1: KTP
        TIPE_BUKTI_PEMBELI: "1", // 1: KTP
        TIPE_PIHAK_NON_PERORANGAN: "Non Perorangan",
    }),

    SELECTORS: Object.freeze({
        daftarPenjual: "#daftarpihak1placeholder blockquote.message",

        akta: Object.freeze({
            form: "#frmEditAkta",
            btnSimpan: "#BtnSimpanAkta",
            fields: [
                ["#frmEditAkta #nomor", "nomor_akta"],
                ["#frmEditAkta #tanggalakta", "tanggal_akta"],
            ],
        }),

        penjual: Object.freeze({
            tipePihak: "select#tipepihak1",
            form: "#frmInput1BadanHukum",
            btnTambah: "#btn-tambah",
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
            btnTambah: "#btn-tambahPihaksetujuNIK",
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
            btnTambah: "#btn-tambahSaksiNIK",
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

        pembeli: Object.freeze({
            form: "#frmtipepihak2Dukcapil",
            btnTambah: "#btn-tambahtipepihak2NIK",
            tipeBukti: "#frmtipepihak2Dukcapil select#tipebuktipihak2",
            fields: [
                ["#frmtipepihak2Dukcapil #tNIKPemilik", "nik"],
                ["#frmtipepihak2Dukcapil #tNAMA_LENGKAP", "nama"],
                ["#frmtipepihak2Dukcapil #tALAMAT", "alamat"],
                ["#frmtipepihak2Dukcapil #tTEMPAT_LAHIR", "tempat_lahir"],
                ["#frmtipepihak2Dukcapil #tTANGGAL_LAHIR", "tgl_lahir"],
                ["#frmtipepihak2Dukcapil #tJENIS_PEKERJAAN", "pekerjaan"],
            ],
        }),

        pbb: Object.freeze({
            container: "#inputPBBplaceholder",
            dropdownSertifikat: "#alashakid",
            form: "#frmPBBDetail",
            luasSertifikat: "#luassertipikat",
            nilaiZnt: "#nilaiznt",
            inputFile: "#txtUploadFilePBB",
            btnTambah: "#btn-tambahpbb",
            daftarPlaceholder: "#daftarpbbplaceholder",
            daftarItems: "#daftarpbbplaceholder li",
            fields: [
                ["#frmPBBDetail #nomor", "nop"],
                ["#frmPBBDetail #tahun", "tahun"],
                ["#frmPBBDetail #luas", "luas_tanah"],
                ["#frmPBBDetail #nilai", "njop_m2"],
            ],
        }),

        bphtb: Object.freeze({
            container: "#inputBPHTBplaceholder",
            dropdownNop: "#obyekpajakid",
            form: "#frmBPHTB",
            inputNomorBukti: "#nomorbphtb",
            inputFile: "#txtUploadFileBPHTB",
            btnTambah: "#btn-tambahbphtb",
        }),
    }),

    MESSAGES: Object.freeze({
        TOGGLE_PANEL_ACTION: "toggleAutoFillPanel",

        aktaFormMissing: "Form Input Akta (#frmEditAkta) tidak ditemukan di halaman PPAT.",
        aktaSaved: (nomor) => `Data Akta (No: ${nomor}) berhasil diisi dan disimpan!`,
        penjualFormMissing:
            "Gagal memuat Form Penjual (Badan Hukum). Pastikan Anda berada di halaman pembuatan Akta PPAT.",
        penjualFilled: "Data Penjual (Badan Hukum) berhasil diisi!",
        persetujuanFormMissing:
            "Form Pihak Persetujuan tidak ditemukan. Pastikan Anda berada di seksi E (Pihak Persetujuan).",
        persetujuanFilled: "Data Pihak Persetujuan berhasil diisi!\nSilakan periksa dan klik 'Tambah'.",
        saksiFormMissing: "Form Saksi tidak ditemukan. Pastikan Anda berada di halaman pembuatan Akta PPAT.",
        saksiFilled: (nama) => `Data Saksi (${nama}) berhasil diisi!\nSilakan periksa dan klik 'Tambah'.`,
        pembeliFormMissing: "Form Pihak Pembeli tidak ditemukan. Pastikan Anda berada di bagian Pihak Pembeli (Pihak 2).",
        pembeliFilled: (nama) => `Data Pembeli (${nama}) berhasil diisi!\nSilakan periksa dan klik 'Tambah'.`,
        sertifikatBelumTerisi: "Sertifikat belum terisi di web PPAT. PBB dan BPHTB hanya bisa diisi jika sertifikat sudah terisi.",
        pbbFormMissing: "Form PBB tidak ditemukan di halaman PPAT.",
        pbbFilled: "Data PBB berhasil diisi!",
        bphtbFormMissing: "Form BPHTB tidak ditemukan di halaman PPAT.",
        bphtbFilled: "Data BPHTB berhasil diisi!",
        selectPtFirst: "Pilih PT terlebih dahulu!",
        backendOffline: "Service pembeli-backend belum aktif di http://127.0.0.1:3001.\nSilakan jalankan service terlebih dahulu.",
        backendBphtbOffline: "Service pbb-bphtb-backend belum aktif di http://127.0.0.1:3002.\nSilakan jalankan start-pbb-backend.bat terlebih dahulu.",
    }),
});
