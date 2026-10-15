/**
 * Pengisian otomatis Form Pihak Persetujuan (WNI).
 * Memastikan dan memverifikasi bahwa field NIK, Nama, Tempat Lahir, dan Tanggal Lahir
 * benar-benar telah terisi sebelum tombol Tambah (#btn-tambahPihaksetujuNIK) ditekan.
 */
PPAT.persetujuanFiller = (() => {
    const { dom, config } = PPAT;
    const { SELECTORS, TIMING, MESSAGES } = config;
    const S = SELECTORS.persetujuan;

    /**
     * Memastikan form Pihak Persetujuan tampil dan aktif tanpa memicu reset AJAX yang tidak perlu.
     * Hanya panggil setSelect2Value jika nilai dropdown belum sesuai.
     */
    async function ensurePersetujuanForm() {
        let changedDropdown = false;

        // 1. Cek dropdown "Ada Persetujuan" (#jenispihak)
        // JANGAN trigger change jika nilainya sudah "Ada" karena ATR/BPN akan mengirim AJAX
        // yang mereset dan mengosongkan seluruh form!
        const jenisSelect = S.jenisPihak ? document.querySelector(S.jenisPihak) : null;
        if (jenisSelect && jenisSelect.value !== "Ada") {
            console.log(`[PersetujuanFiller] Mengubah jenispihak ke 'Ada' (sebelumnya: '${jenisSelect.value}')...`);
            dom.setSelect2Value(S.jenisPihak, "Ada");
            changedDropdown = true;
        }

        if (changedDropdown) {
            await dom.delay(600);
        }

        // 2. Cek dropdown "Tipe Pihak Setuju" (#tipepihaksetuju)
        const tipeSelect = S.tipePihak ? document.querySelector(S.tipePihak) : null;
        if (tipeSelect && tipeSelect.value !== "WNI") {
            console.log(`[PersetujuanFiller] Mengubah tipepihaksetuju ke 'WNI' (sebelumnya: '${tipeSelect.value}')...`);
            dom.setSelect2Value(S.tipePihak, "WNI");
            changedDropdown = true;
        }

        if (changedDropdown) {
            await dom.delay(800);
        }

        // 3. Pastikan elemen form dan input NIK sudah ada di DOM
        const form = await dom.waitForElement(S.form, TIMING.PERSETUJUAN_FORM_TIMEOUT_MS || 8000);
        if (!form) return null;

        await dom.waitForElement("#tNIKpihaksetuju", 5000);

        if (changedDropdown) {
            await dom.delay(TIMING.FORM_SETTLE_DELAY_MS || 500);
        }

        return form;
    }

    /**
     * Mengambil nilai saat ini dari DOM input form persetujuan.
     */
    function getFieldValues() {
        return {
            nik: document.querySelector("#tNIKpihaksetuju")?.value?.trim() || "",
            nama: document.querySelector("#tNAMA_LENGKAPpihaksetuju")?.value?.trim() || "",
            tempat_lahir: document.querySelector("#tTEMPAT_LAHIRpihaksetuju")?.value?.trim() || "",
            tgl_lahir: document.querySelector("#tTANGGAL_LAHIRpihaksetuju")?.value?.trim() || "",
            alamat: document.querySelector("#tALAMATpihaksetuju")?.value?.trim() || "",
            pekerjaan: document.querySelector("#frmPihaksetujuDukcapil #tJENIS_PEKERJAAN")?.value?.trim() || "",
        };
    }

    /**
     * Memverifikasi apakah 4 field wajib (NIK, Nama, Tempat Lahir, Tanggal Lahir) sudah terisi dan valid.
     */
    function isFormProperlyFilled(current, expected) {
        const expNik = (expected.nik || "").trim();
        const expNama = (expected.nama || "").trim().toLowerCase();
        const expTempat = (expected.tempat_lahir || "").trim().toLowerCase();
        const expTgl = (expected.tgl_lahir || "").trim();

        const nikOk = Boolean(current.nik && (!expNik || current.nik === expNik));
        const namaOk = Boolean(current.nama && (!expNama || current.nama.toLowerCase() === expNama));
        const tempatOk = Boolean(current.tempat_lahir && (!expTempat || current.tempat_lahir.toLowerCase() === expTempat));
        const tglOk = Boolean(current.tgl_lahir && (!expTgl || current.tgl_lahir === expTgl));

        return {
            isAllValid: nikOk && namaOk && tempatOk && tglOk,
            nikOk,
            namaOk,
            tempatOk,
            tglOk,
        };
    }

    /**
     * Mengisi nilai form dan menyinkronkan ke Page Context (jQuery & DateTimePicker).
     */
    function applyFieldValues(data) {
        // 1. Standar dom.fillFields
        dom.fillFields(S.fields, data);

        // 2. Direct DOM value assignment & input/change events
        const fieldMappings = [
            ["#tNIKpihaksetuju", data.nik],
            ["#tNAMA_LENGKAPpihaksetuju", data.nama],
            ["#tTEMPAT_LAHIRpihaksetuju", data.tempat_lahir],
            ["#tTANGGAL_LAHIRpihaksetuju", data.tgl_lahir],
            ["#tALAMATpihaksetuju", data.alamat],
            ["#frmPihaksetujuDukcapil #tJENIS_PEKERJAAN", data.pekerjaan],
        ];

        for (const [selector, val] of fieldMappings) {
            if (val === undefined || val === null) continue;
            const el = document.querySelector(selector);
            if (el) {
                el.value = val;
                el.dispatchEvent(new Event("input", { bubbles: true }));
                el.dispatchEvent(new Event("change", { bubbles: true }));
            }
        }

        // 3. Sinkronisasi di konteks Main World (jQuery & Bootstrap DateTimePicker)
        dom.runInPageContext((nik, nama, tempat, tgl, alamat, pekerjaan) => {
            if (!window.jQuery) return;
            const $ = window.jQuery;
            if (nik) $("#tNIKpihaksetuju").val(nik).trigger("input").trigger("change");
            if (nama) $("#tNAMA_LENGKAPpihaksetuju").val(nama).trigger("input").trigger("change");
            if (tempat) $("#tTEMPAT_LAHIRpihaksetuju").val(tempat).trigger("input").trigger("change");
            if (alamat) $("#tALAMATpihaksetuju").val(alamat).trigger("input").trigger("change");
            if (pekerjaan) $("#frmPihaksetujuDukcapil #tJENIS_PEKERJAAN").val(pekerjaan).trigger("input").trigger("change");

            if (tgl) {
                const $tgl = $("#tTANGGAL_LAHIRpihaksetuju");
                $tgl.val(tgl).trigger("input").trigger("change");
                if ($tgl.data("DateTimePicker") && typeof $tgl.data("DateTimePicker").date === "function" && window.moment) {
                    try {
                        $tgl.data("DateTimePicker").date(window.moment(tgl, "DD/MM/YYYY"));
                    } catch (e) {
                        console.warn("[Persetujuan] DateTimePicker date sync:", e);
                    }
                }
            }
        }, data.nik, data.nama, data.tempat_lahir, data.tgl_lahir, data.alamat, data.pekerjaan);
    }

    async function fill(data, options = {}) {
        const autoSubmit = options.autoSubmit ?? true;

        console.log(`[PersetujuanFiller] Memulai proses pengisian Pihak Persetujuan: '${data.nama}' (NIK: ${data.nik})...`);

        // 1. Pastikan form siap tanpa memicu AJAX reload yang mereset form
        const form = await ensurePersetujuanForm();
        if (!form) {
            alert(MESSAGES.persetujuanFormMissing || "Form Pihak Persetujuan tidak ditemukan di halaman web.");
            return false;
        }

        // 2. Isi data dan lakukan verifikasi ketat (maksimal 10 percobaan)
        const maxAttempts = 10;
        let verified = false;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            applyFieldValues(data);
            await dom.delay(150);

            const current = getFieldValues();
            const check = isFormProperlyFilled(current, data);

            if (check.isAllValid) {
                console.log(`[PersetujuanFiller] Verifikasi form pihak persetujuan BERHASIL (percobaan ke-${attempt}):`, current);
                verified = true;
                break;
            }

            console.warn(`[PersetujuanFiller] Form belum lengkap pada percobaan ke-${attempt}/${maxAttempts}:`, {
                nik: check.nikOk ? "OK" : "KOSONG/BELUM SESUAI",
                nama: check.namaOk ? "OK" : "KOSONG/BELUM SESUAI",
                tempat_lahir: check.tempatOk ? "OK" : "KOSONG/BELUM SESUAI",
                tgl_lahir: check.tglOk ? "OK" : "KOSONG/BELUM SESUAI",
                values: current,
            });

            await dom.delay(250);
        }

        // Jika setelah percobaan maksimal form masih belum terverifikasi terisi, JANGAN KLIK TAMBAH!
        if (!verified) {
            const errMsg =
                "Gagal memverifikasi isian Form Pihak Persetujuan (NIK, Nama, Tempat Lahir, atau Tanggal Lahir belum terisi).\n" +
                "Tombol Tambah tidak ditekan demi mencegah kesalahan submit data kosong.";
            console.error(`[PersetujuanFiller] ${errMsg}`);
            alert(errMsg);
            return false;
        }

        // 3. Tombol Tambah hanya ditekan jika autoSubmit aktif dan SELURUH field terverifikasi terisi
        if (autoSubmit) {
            await dom.delay(TIMING.SUBMIT_DELAY_MS || 300);

            // Verifikasi final detik terakhir sebelum klik tombol Tambah
            const finalCurrent = getFieldValues();
            const finalCheck = isFormProperlyFilled(finalCurrent, data);
            if (!finalCheck.isAllValid) {
                console.error("[PersetujuanFiller] Submit dibatalkan! Form terdeteksi kosong/ter-reset sesaat sebelum klik:", finalCurrent);
                alert("Pengisian form Pihak Persetujuan ter-reset sebelum diklik. Silakan ulangi pengisian.");
                return false;
            }

            const submitBtn = document.querySelector(S.btnTambah);
            if (!submitBtn) {
                console.warn("[PersetujuanFiller] Tombol Tambah Pihak Persetujuan tidak ditemukan di DOM.");
                return false;
            }

            console.log("[PersetujuanFiller] Seluruh field (NIK, Nama, Tempat Lahir, Tanggal Lahir) terisi valid. Menekan tombol Tambah Pihak Persetujuan...");

            // Klik tombol submit via Page Context agar event form jQuery terpanggil dengan sempurna
            dom.runInPageContext((btnSel) => {
                const btn = document.querySelector(btnSel);
                if (btn) btn.click();
            }, S.btnTambah);

            // Trigger click di content script sebagai pelengkap
            submitBtn.click();

            const autoUploadDocs = options.autoUploadDocs ?? false;
            if (autoUploadDocs && PPAT.penjualUploadFiller) {
                console.log("[PersetujuanFiller] Menunggu baris pihak persetujuan muncul di daftar...");
                const btnUnggah = await dom.waitForElement(S.btnUnggah, 10000);
                if (btnUnggah) {
                    const ptName = options.ptName || PPAT.penjualUploadFiller.getActivePtNameFromPage();
                    if (ptName) {
                        await PPAT.penjualUploadFiller.uploadKtpPersetujuan(ptName, data.nama);
                    }
                }
            }
            return true;
        } else {
            alert(MESSAGES.persetujuanFilled || "Data Pihak Persetujuan telah diisi.");
            return true;
        }
    }

    return {
        fill,
        ensurePersetujuanForm,
        getFieldValues,
        isFormProperlyFilled,
    };
})();
