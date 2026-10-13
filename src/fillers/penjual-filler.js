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

    async function fill(data) {
        if (!(await ensureBadanHukumForm())) {
            alert(MESSAGES.penjualFormMissing);
            return;
        }

        dom.setSelect2Value(S.tipePemilik, data.tipe_pemilik || DEFAULTS.TIPE_PEMILIK);
        dom.setSelect2Value(S.tipeUsaha, data.tipe_usaha || DEFAULTS.TIPE_USAHA);
        dom.fillFields(S.fields, data);

        alert(MESSAGES.penjualFilled);
    }

    return { fill };
})();
