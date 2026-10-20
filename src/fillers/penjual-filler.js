/**
 * Pengisian otomatis Form Penjual (Badan Hukum & Perorangan).
 */
PPAT.penjualFiller = (() => {
    const { dom, config } = PPAT;
    const { SELECTORS, TIMING, DEFAULTS, MESSAGES } = config;
    const S = SELECTORS.penjual;
    const SP = SELECTORS.penjualPerorangan;

    function isBadanHukumFormActive() {
        const tipePihak = document.querySelector(S.tipePihak);
        const form = document.querySelector(S.form);
        const hasInputs = Boolean(document.querySelector("#frmInput1BadanHukum #tNAMA_LENGKAPPihak1"));
        const isNonPerorangan = Boolean(tipePihak) && (tipePihak.value === DEFAULTS.TIPE_PIHAK_NON_PERORANGAN || tipePihak.value === "Badan Hukum");
        return Boolean(form) && isNonPerorangan && hasInputs;
    }

    /**
     * Memastikan form Badan Hukum tampil (mengubah dropdown tipe penjual ke "Badan Hukum" / "Non Perorangan"
     * sampai form #frmInput1BadanHukum muncul).
     * @returns {Promise<boolean>} false jika form gagal dimuat
     */
    async function ensureBadanHukumForm() {
        if (isBadanHukumFormActive()) {
            console.log("[PenjualFiller] Form Badan Hukum sudah aktif dan siap.");
            return true;
        }

        console.log("[PenjualFiller] Mengubah tipe penjual (tipepihak1) menjadi 'Badan Hukum' (Non Perorangan)...");

        // 1. Pilih opsi "Non Perorangan" (label tampilan: "Badan Hukum") pada select#tipepihak1
        if (document.querySelector(S.tipePihak)) {
            dom.setSelect2Value(S.tipePihak, DEFAULTS.TIPE_PIHAK_NON_PERORANGAN);
        }

        // 2. Jalankan juga di Page Context untuk memicu event Select2 & AJAX RefreshPemohonpihak1
        dom.runInPageContext((sel, val) => {
            if (!window.jQuery) return;
            const $ = window.jQuery;
            const $el = $(sel);
            if ($el.length) {
                $el.val(val).trigger("change");
                if ($el.data("select2")) {
                    $el.trigger("change.select2");
                }
            }
            if (typeof window.RefreshPemohonpihak1 === "function") {
                window.RefreshPemohonpihak1("Pihak 1");
            }
        }, S.tipePihak, DEFAULTS.TIPE_PIHAK_NON_PERORANGAN);

        // 3. Update teks Select2 container agar terlihat "Badan Hukum"
        const container = document.getElementById("select2-tipepihak1-container");
        if (container) {
            container.textContent = "Badan Hukum";
            container.title = "Badan Hukum";
        }

        // 4. Tunggu form #frmInput1BadanHukum muncul di dalam #inputpihak1placeholder
        const form = await dom.waitForElement(S.form, TIMING.PENJUAL_FORM_TIMEOUT_MS);
        if (!form) {
            console.error("[PenjualFiller] Form #frmInput1BadanHukum tidak ditemukan setelah timeout.");
            return false;
        }

        // 5. Tunggu sampai field nama dan dropdown jenis/tipe benar-benar tersedia
        await dom.waitForElement("#frmInput1BadanHukum #tNAMA_LENGKAPPihak1", 5000);
        await dom.waitForElement("#frmInput1BadanHukum select#tipepemilikid", 5000);
        await dom.waitForElement("#frmInput1BadanHukum select#tipeusaha", 5000);

        await dom.delay(TIMING.FORM_SETTLE_DELAY_MS + 200);
        return true;
    }

    function isPeroranganFormActive() {
        const tipePihak = document.querySelector(SP.tipePihak);
        const form = document.querySelector(SP.form);
        const isPerorangan = Boolean(tipePihak) && tipePihak.value === DEFAULTS.TIPE_PIHAK_PERORANGAN;
        return Boolean(form) && isPerorangan;
    }

    /**
     * Memastikan form Perorangan tampil (beralih ke "Perorangan" pada dropdown tipepihak1).
     * @returns {Promise<boolean>} false jika form gagal dimuat
     */
    async function ensurePeroranganForm() {
        if (isPeroranganFormActive()) return true;

        if (document.querySelector(SP.tipePihak)) {
            console.log("[PenjualFiller] Mengubah tipepihak1 ke 'Perorangan'...");
            dom.setSelect2Value(SP.tipePihak, DEFAULTS.TIPE_PIHAK_PERORANGAN);
        }

        const form = await dom.waitForElement(SP.form, TIMING.PENJUAL_FORM_TIMEOUT_MS);
        if (!form) return false;

        await dom.waitForElement("#frmtipepihak1Dukcapil #tNIKPemilik", 5000);
        await dom.delay(TIMING.FORM_SETTLE_DELAY_MS);
        return true;
    }

    /**
     * Mengisi data Penjual Perorangan ke #frmtipepihak1Dukcapil.
     */
    async function fillPerorangan(data, options = {}) {
        const autoSubmit = options.autoSubmit ?? true;

        console.log(`[PenjualFiller] Memulai pengisian Penjual Perorangan: '${data.nama}' (NIK: ${data.nik})...`);

        if (!(await ensurePeroranganForm())) {
            alert(MESSAGES.penjualPeroranganFormMissing);
            return false;
        }

        // 1. Pilih jenis bukti identitas (KTP: "1")
        dom.setSelect2Value(SP.tipeBukti, data.tipe_bukti || DEFAULTS.TIPE_BUKTI_PENJUAL);
        dom.fillFields(SP.fields, data);

        // 2. Pilih Jenis Kelamin (Radio button Laki-laki / Perempuan)
        if (data.jenis_kelamin) {
            const radio = document.querySelector(
                `#frmtipepihak1Dukcapil input[name="JENIS_KELAMIN"][value="${data.jenis_kelamin}"]`
            );
            if (radio) {
                radio.checked = true;
                radio.dispatchEvent(new Event("input", { bubbles: true }));
                radio.dispatchEvent(new Event("change", { bubbles: true }));
                radio.dispatchEvent(new Event("click", { bubbles: true }));
            }
        }

        // 3. Direct DOM value assignment & input/change events
        const fieldMappings = [
            ["#frmtipepihak1Dukcapil #tNIKPemilik", data.nik],
            ["#frmtipepihak1Dukcapil #tNAMA_LENGKAP", data.nama],
            ["#frmtipepihak1Dukcapil #tALAMAT", data.alamat],
            ["#frmtipepihak1Dukcapil #tTEMPAT_LAHIR", data.tempat_lahir],
            ["#frmtipepihak1Dukcapil #tTANGGAL_LAHIR", data.tgl_lahir],
            ["#frmtipepihak1Dukcapil #tJENIS_PEKERJAAN", data.pekerjaan],
            ["#frmtipepihak1Dukcapil #tNPWP", data.npwp],
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

        // 4. Sinkronisasi di Main World (jQuery & DateTimePicker)
        dom.runInPageContext((nik, nama, tempat, tgl, alamat, pekerjaan, npwp, jk) => {
            if (!window.jQuery) return;
            const $ = window.jQuery;
            const $f = $("#frmtipepihak1Dukcapil");
            if (!$f.length) return;

            if (nik) $f.find("#tNIKPemilik").val(nik).trigger("input").trigger("change");
            if (nama) $f.find("#tNAMA_LENGKAP").val(nama).trigger("input").trigger("change");
            if (tempat) $f.find("#tTEMPAT_LAHIR").val(tempat).trigger("input").trigger("change");
            if (alamat) $f.find("#tALAMAT").val(alamat).trigger("input").trigger("change");
            if (pekerjaan) $f.find("#tJENIS_PEKERJAAN").val(pekerjaan).trigger("input").trigger("change");
            if (npwp) $f.find("#tNPWP").val(npwp).trigger("input").trigger("change");

            if (jk) {
                const $radio = $f.find(`input[name="JENIS_KELAMIN"][value="${jk}"]`);
                if ($radio.length) {
                    $radio.prop("checked", true).trigger("change").trigger("click");
                }
            }

            if (tgl) {
                const $tgl = $f.find("#tTANGGAL_LAHIR");
                $tgl.val(tgl).trigger("input").trigger("change");
                if ($tgl.data("DateTimePicker") && typeof $tgl.data("DateTimePicker").date === "function" && window.moment) {
                    try {
                        $tgl.data("DateTimePicker").date(window.moment(tgl, "DD/MM/YYYY"));
                    } catch (e) {
                        console.warn("[PenjualPerorangan] DateTimePicker date sync:", e);
                    }
                }
            }
        }, data.nik, data.nama, data.tempat_lahir, data.tgl_lahir, data.alamat, data.pekerjaan, data.npwp, data.jenis_kelamin);

        if (autoSubmit) {
            await dom.delay(TIMING.SUBMIT_DELAY_MS);
            const submitBtn = document.querySelector(SP.btnTambah);
            if (submitBtn) {
                console.log("[PenjualFiller] Menekan tombol Tambah Penjual Perorangan...");
                dom.runInPageContext((btnSel) => {
                    const btn = document.querySelector(btnSel);
                    if (btn) btn.click();
                }, SP.btnTambah);
                submitBtn.click();

                const autoUploadDocs = options.autoUploadDocs ?? true;
                if (autoUploadDocs && PPAT.penjualUploadFiller) {
                    console.log("[PenjualFiller] Menunggu tombol Unggah muncul di daftar penjual perorangan...");
                    const btnUnggah = await dom.waitForElement(config.SELECTORS.penjualUpload.btnUnggah, 10000);
                    if (btnUnggah) {
                        await dom.delay(400);
                        await PPAT.penjualUploadFiller.runAutoUploadPerorangan(data.nama, options.buyerName);
                    }
                }
            }
        } else if (options.showAlert) {
            alert(MESSAGES.penjualPeroranganFilled(data.nama));
        }

        return true;
    }

    async function fill(data, options = {}) {
        // Cek apakah data ini adalah Penjual Perorangan
        if (data.is_perorangan || (!data.tipe_pemilik && !data.tipe_usaha && data.nik)) {
            return fillPerorangan(data, options);
        }

        const autoSubmit = options.autoSubmit ?? true;

        console.log(`[PenjualFiller] Memulai pengisian Penjual Badan Hukum (PT): '${data.nama}'...`);

        // 1. Pastikan dropdown tipe penjual diubah ke Badan Hukum dan form #frmInput1BadanHukum siap
        if (!(await ensureBadanHukumForm())) {
            alert(MESSAGES.penjualFormMissing);
            return false;
        }

        // 2. Set dropdown Jenis: BUMS ("33") dan Tipe: PT ("4")
        const tipePemilikVal = (data.tipe_pemilik === "BUMS" || !data.tipe_pemilik) ? "33" : String(data.tipe_pemilik);
        const tipeUsahaVal = (data.tipe_usaha === "PT" || !data.tipe_usaha) ? "4" : String(data.tipe_usaha);

        console.log(`[PenjualFiller] Mengatur Jenis: '${tipePemilikVal}' (BUMS) & Tipe: '${tipeUsahaVal}' (PT)...`);
        dom.setSelect2Value(S.tipePemilik, tipePemilikVal);
        dom.setSelect2Value(S.tipeUsaha, tipeUsahaVal);

        // 3. Isi field teks standar (Nama, Alamat, Kota, NPWP, No Akta, Tgl Akta)
        dom.fillFields(S.fields, data);

        // 4. Direct DOM value assignment & input/change events
        const fieldMappings = [
            ["#frmInput1BadanHukum #tNAMA_LENGKAPPihak1", data.nama],
            ["#frmInput1BadanHukum #tALAMAT", data.alamat],
            ["#frmInput1BadanHukum #tLOKASI", data.kota],
            ["#frmInput1BadanHukum #tNPWP", data.npwp],
            ["#frmInput1BadanHukum #tIDENTITAS", data.akta],
            ["#frmInput1BadanHukum #tPENDIRIAN", data.tgl_akta],
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

        // 5. Sinkronisasi di konteks Main World (jQuery, Select2, SetInput, DateTimePicker)
        dom.runInPageContext((pemilikVal, usahaVal, nama, alamat, kota, npwp, akta, tglAkta) => {
            if (!window.jQuery) return;
            const $ = window.jQuery;
            const $f = $("#frmInput1BadanHukum");
            if (!$f.length) return;

            // Sync Select2 Jenis & Tipe
            const $pemilik = $f.find("select#tipepemilikid");
            if ($pemilik.length) {
                $pemilik.val(pemilikVal).trigger("change");
                if ($pemilik.data("select2")) $pemilik.trigger("change.select2");
            }
            const $usaha = $f.find("select#tipeusaha");
            if ($usaha.length) {
                $usaha.val(usahaVal).trigger("change");
                if ($usaha.data("select2")) $usaha.trigger("change.select2");
            }
            if (typeof window.SetInput === "function") {
                try { window.SetInput(); } catch (e) {}
            }

            // Sync Form fields
            if (nama) $f.find("#tNAMA_LENGKAPPihak1").val(nama).trigger("input").trigger("change");
            if (alamat) $f.find("#tALAMAT").val(alamat).trigger("input").trigger("change");
            if (kota) $f.find("#tLOKASI").val(kota).trigger("input").trigger("change");
            if (npwp) $f.find("#tNPWP").val(npwp).trigger("input").trigger("change");
            if (akta) $f.find("#tIDENTITAS").val(akta).trigger("input").trigger("change");

            // Sync DateTimePicker untuk Tanggal Akta Pendirian
            if (tglAkta) {
                const $tgl = $f.find("#tPENDIRIAN");
                $tgl.val(tglAkta).trigger("input").trigger("change");
                const picker = $tgl.data("DateTimePicker") || $("#tglAkta").data("DateTimePicker");
                if (picker && typeof picker.date === "function" && window.moment) {
                    try {
                        picker.date(window.moment(tglAkta, "DD/MM/YYYY"));
                    } catch (e) {
                        console.warn("[PenjualBadanHukum] DateTimePicker sync:", e);
                    }
                }
            }
        }, tipePemilikVal, tipeUsahaVal, data.nama, data.alamat, data.kota, data.npwp, data.akta, data.tgl_akta);

        if (autoSubmit) {
            await dom.delay(TIMING.SUBMIT_DELAY_MS);
            const submitBtn = document.querySelector(S.btnTambah);
            if (submitBtn) {
                console.log("[PenjualFiller] Menekan tombol Tambah Penjual Badan Hukum (PT)...");
                dom.runInPageContext((btnSel) => {
                    const btn = document.querySelector(btnSel);
                    if (btn) btn.click();
                }, S.btnTambah);
                submitBtn.click();

                const autoUploadDocs = options.autoUploadDocs ?? true;
                if (autoUploadDocs && PPAT.penjualUploadFiller) {
                    console.log("[PenjualFiller] Menunggu tombol Unggah muncul di daftar penjual...");
                    const btnUnggah = await dom.waitForElement(config.SELECTORS.penjualUpload.btnUnggah, 10000);
                    if (btnUnggah) {
                        await dom.delay(600);
                        await PPAT.penjualUploadFiller.runAutoUpload(data.nama);
                    }
                }
            }
        } else {
            alert(MESSAGES.penjualFilled);
        }
        return true;
    }

    return { fill, fillPerorangan, ensurePeroranganForm, ensureBadanHukumForm };
})();
