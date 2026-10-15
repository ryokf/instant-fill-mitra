/**
 * Konfigurasi terpusat: selector halaman PPAT, durasi tunggu, dan pesan UI.
 * Jika struktur HTML situs PPAT berubah, cukup ubah selector di sini.
 */
PPAT.config = Object.freeze({
    BACKEND_URL: "http://127.0.0.1:3001/api/extract-pembeli",
    BPHTB_BACKEND_URL: "http://127.0.0.1:3001/api/extract-bphtb",
    SERTIPIKAT_BACKEND_URL: "http://127.0.0.1:3001/api/extract-sertipikat",
    PPH_BACKEND_URL: "http://127.0.0.1:3001/api/extract-pph",
    PT_FILE_INFO_URL: "http://127.0.0.1:3001/api/pt-files-info",
    PT_FILE_DOWNLOAD_URL: "http://127.0.0.1:3001/api/pt-file",

    TIMING: Object.freeze({
        POLL_INTERVAL_MS: 150, // interval cek elemen saat menunggu muncul
        AKTA_FORM_TIMEOUT_MS: 5000,
        PENJUAL_FORM_TIMEOUT_MS: 8000,
        PERSETUJUAN_FORM_TIMEOUT_MS: 5000,
        SAKSI_FORM_TIMEOUT_MS: 5000,
        PEMBELI_FORM_TIMEOUT_MS: 5000,
        BERKAS_TIMEOUT_MS: 15000,
        SERTIPIKAT_FORM_TIMEOUT_MS: 8000,
        PBB_FORM_TIMEOUT_MS: 8000,
        BPHTB_FORM_TIMEOUT_MS: 8000,
        PPH_FORM_TIMEOUT_MS: 8000,
        ZNT_WAIT_TIMEOUT_MS: 10000,
        UPLOAD_TIMEOUT_MS: 30000,
        SIDEBAR_TIMEOUT_MS: 15000,
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

        penjualUpload: Object.freeze({
            btnUnggah: "#daftarpihak1placeholder a[onclick*='unggahpihakakta']",
            selectTipeUnggah: "#tipeunggah2",
            inputFile: "#txtUploadFileNonInputupload2",
            btnSimpanUpload: "#divnewdokumenupload2 button[onclick*='simpandokumenupload2']",
            divNewDokumen: "#divnewdokumenupload2",
            divSideNav: "#divsidenavupload2",
            modal: "#globalModal",
            modalTitle: "#globalModalTitle",
            modalBtnOk: "#globalModal button.btn-primary, #globalModal button[data-bs-dismiss='modal'], #globalModal button, #myModal #btn-ok, #myModal button",
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
            daftarPlaceholder: "#bphtbplaceholder",
            daftarItems: "#bphtbplaceholder li",
        }),

        berkas: Object.freeze({
            inputNomor: "#nmrberkas",
            inputTahun: "#thnberkas",
            btnCari: "#btncari",
            form: "#frmFindBerkasSaya",
            tableBody: "#berkassayaplaceholder",
            tabMelengkapi: "#melengkapi-tab",
            tabProses2: "#tabproses2",
            step1Anchor: "ul.wizard_steps a[href*='#sertifikat'], a[data-content-url*='Step1'], ul.wizard_steps li:first-child a, ul.step-anchor a[href*='step-1']",
            inputNibElektronik: "#DataSertipikat_inputsertipikat_nibelektronik, #nibelektronik, input[name*='nibelektronik' i]",
            inputKodeSertipikat: "#DataSertipikat_inputsertipikat_kodesertipikat, #kodesertipikat, input[name*='kodesertipikat' i]",
            docViewer: "#docViewerProduct",
            docViewerIframe: "#docViewerProduct iframe",
        }),

        sertipikat: Object.freeze({
            container: "#inputSertipikatplaceholder",
            formDiv: "#inputsertipikatdiv",
            form: "#frmHAT",
            toggleMode: "#toggle-two",
            inputNibElektronik: "#nibelektronik",
            inputKodeSertipikat: "#kodesertipikat",
            btnTambah: "#btn-tambahhat",
            daftarPlaceholder: "#daftarhatplaceholder",
            daftarItems: "#daftarhatplaceholder li",
        }),

        pph: Object.freeze({
            container: "#inputPPHplaceholder, #inputPPhplaceholder, #inputpphplaceholder, #frmPPH, #frmPph, #section-pph",
            inputNomorSuket: "#nomorsuket, #nosuket, #txtNomorSuket, #nomor_suket, #suket, input[name*='suket' i], input[placeholder*='suket' i], input[placeholder*='KET-' i]",
            btnCariSuket: "#btncarisuket, #btnCariSuket, #btn-cari-suket, #btncari, #btnCariPPH, button[id*='suket' i]",
            inputNpwp: "#tNPWP, #npwp, #npwppph, input[name*='npwp' i], input[id*='npwp' i]",
            inputFile: "#txtUploadFilePPH, #txtUploadFilePPh, input[name*='UploadFilePPH'], .btn-file input[type='file'], input[type='file']",
            btnTambah: "#btn-tambahpph, #btn-tambahPPH, #btn-tambah",
            daftarPlaceholder: "#daftarpphplaceholder",
            daftarItems: "#daftarpphplaceholder li",
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
        berkasFormMissing: "Form Pencarian Berkas (#nmrberkas) tidak ditemukan di halaman ini.",
        berkasNotFound: "Berkas tidak ditemukan pada hasil pencarian web PPAT.",
        berkasRowFound: "Data berkas ditemukan! Membuka halaman berkas...",
        sertipikatExtracted: (nib, kode) => `NIB: ${nib} | Kode: ${kode} berhasil diperoleh!`,
        sertipikatFormMissing: "Form Sertipikat (#frmHAT) tidak ditemukan di halaman PPAT.",
        sertipikatFilled: "Data Sertipikat Elektronik berhasil diisi!",
        sertifikatBelumTerisi: "Sertifikat belum terisi di web PPAT. PBB dan BPHTB hanya bisa diisi jika sertifikat sudah terisi.",
        sertifikatBelumTerdaftar: "Sertipikat belum terdaftar pada 'Daftar Sertipkat HAT' di sebelah kanan form. PBB hanya bisa diisi jika Sertipikat sudah terisi!",
        pbbBelumTerdaftar: "PBB belum terdaftar pada 'Daftar PBB' di sebelah kanan form. BPHTB hanya bisa diisi jika PBB sudah terisi!",
        pbbFormMissing: "Form PBB tidak ditemukan di halaman PPAT.",
        pbbFilled: "Data PBB berhasil diisi!",
        bphtbFormMissing: "Form BPHTB tidak ditemukan di halaman PPAT.",
        bphtbFilled: "Data BPHTB berhasil diisi!",
        pphFormMissing: "Form PPh tidak ditemukan di halaman PPAT.",
        pphFilled: "Data PPh berhasil diisi!",
        selectPtFirst: "Pilih PT terlebih dahulu!",
        backendOffline: "Service backend belum aktif di http://127.0.0.1:3001.\nSilakan jalankan start-backend.bat terlebih dahulu.",
        backendBphtbOffline: "Service backend belum aktif di http://127.0.0.1:3001.\nSilakan jalankan start-backend.bat terlebih dahulu.",
        backendSertipikatOffline: "Service backend belum aktif di http://127.0.0.1:3001.\nSilakan jalankan start-backend.bat terlebih dahulu.",
        backendPphOffline: "Service backend belum aktif di http://127.0.0.1:3001.\nSilakan jalankan start-backend.bat terlebih dahulu.",
    }),
});
