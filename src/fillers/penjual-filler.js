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
        const isNonPerorangan = !tipePihak || tipePihak.value === DEFAULTS.TIPE_PIHAK_NON_PERORANGAN || tipePihak.value === "Badan Hukum";
        return Boolean(form) && isNonPerorangan;
    }

    function isPeroranganFormActive() {
        const tipePihak = document.querySelector(SP.tipePihak);
        const form = document.querySelector(SP.form);
        const isPerorangan = Boolean(tipePihak) && tipePihak.value === DEFAULTS.TIPE_PIHAK_PERORANGAN;
        return Boolean(form) && isPerorangan;
    }

    /**
     * Memastikan form Badan Hukum tampil (beralih ke "Non Perorangan" bila perlu).
     * @returns {Promise<boolean>} false jika form gagal dimuat
     */
    async function ensureBadanHukumForm() {
        if (isBadanHukumFormActive()) return true;

        if (document.querySelector(S.tipePihak)) {
            dom.setSelect2Value(S.tipePihak, DEFAULTS.TIPE_PIHAK_NON_PERORANGAN);
        }

        const form = await dom.waitForElement(S.form, TIMING.PENJUAL_FORM_TIMEOUT_MS);
        if (!form) return false;

        await dom.delay(TIMING.FORM_SETTLE_DELAY_MS);
        return true;
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

        if (!(await ensureBadanHukumForm())) {
            alert(MESSAGES.penjualFormMissing);
            return false;
        }

        dom.setSelect2Value(S.tipePemilik, data.tipe_pemilik || DEFAULTS.TIPE_PEMILIK);
        dom.setSelect2Value(S.tipeUsaha, data.tipe_usaha || DEFAULTS.TIPE_USAHA);
        dom.fillFields(S.fields, data);

        if (autoSubmit) {
            await dom.delay(TIMING.SUBMIT_DELAY_MS);
            const submitBtn = document.querySelector(S.btnTambah);
            if (submitBtn) {
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
