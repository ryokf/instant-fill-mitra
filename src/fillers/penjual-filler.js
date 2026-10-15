/**
 * Pengisian otomatis Form Penjual (Badan Hukum).
 */
PPAT.penjualFiller = (() => {
    const { dom, config } = PPAT;
    const { SELECTORS, TIMING, DEFAULTS, MESSAGES } = config;
    const S = SELECTORS.penjual;

    function isBadanHukumFormActive() {
        const tipePihak = document.querySelector(S.tipePihak);
        const form = document.querySelector(S.form);
        const isNonPerorangan = !tipePihak || tipePihak.value === DEFAULTS.TIPE_PIHAK_NON_PERORANGAN;
        return Boolean(form) && isNonPerorangan;
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

    async function fill(data, options = {}) {
        const autoSubmit = options.autoSubmit ?? true;

        if (!(await ensureBadanHukumForm())) {
            alert(MESSAGES.penjualFormMissing);
            return;
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
    }

    return { fill };
})();
